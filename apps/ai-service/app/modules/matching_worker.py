from dataclasses import dataclass
from typing import Literal, Protocol

from app.modules.embeddings import VertexAdapterError, VertexTextEmbeddingAdapter
from app.modules.explanations import (
    ExplanationProvider,
    ExplanationSafetyError,
    MatchCandidateEvidence,
)
from app.modules.match_detail import build_detail_snapshot
from app.modules.matching import MatchingResult
from app.modules.matching_scoring import (
    MatchScoringResult,
    is_visible_match,
    score_match_candidate,
)
from app.modules.matching_signals import (
    DEFAULT_SIGNAL_EMBEDDING_PROVIDER,
    SignalEmbeddingProvider,
    build_manuscript_signal_writes,
    build_publisher_signal_writes,
    normalize_manuscript_for_signals,
    normalize_publisher_for_signals,
)
from app.modules.repositories import (
    MatchCandidateWrite,
    MatchingRepository,
    MatchRunRecord,
    MatchSignalSourceWrite,
    ProfileAccessGrantWrite,
)
from app.modules.retrieval import VectorRestrict, VertexVectorSearchAdapter

MATCHING_PROVIDER_FAILED = "matching_provider_failed"
MATCHING_INPUT_NOT_READY = "matching_input_not_ready"
MATCHING_EXPLANATION_FAILED = "matching_explanation_failed"


@dataclass(frozen=True)
class RetrievedNeighbor:
    candidate_id: str
    distance: float


class SignalRetrievalProvider(Protocol):
    def find_neighbors(
        self,
        *,
        signal: MatchSignalSourceWrite,
        candidate_type: Literal["publisher", "manuscript"],
        limit: int,
    ) -> list[RetrievedNeighbor]:
        """Return nearest candidate ids for one source axis."""


@dataclass(frozen=True)
class LocalSignalRetrievalProvider:
    repository: MatchingRepository

    def find_neighbors(
        self,
        *,
        signal: MatchSignalSourceWrite,
        candidate_type: Literal["publisher", "manuscript"],
        limit: int,
    ) -> list[RetrievedNeighbor]:
        del signal
        candidates = (
            self.repository.list_eligible_publishers(limit)
            if candidate_type == "publisher"
            else self.repository.list_eligible_manuscripts(limit)
        )
        return [
            RetrievedNeighbor(candidate_id=required_text(candidate, "id"), distance=0.25)
            for candidate in candidates[:limit]
        ]


@dataclass(frozen=True)
class VertexSignalRetrievalProvider:
    embedding_adapter: VertexTextEmbeddingAdapter
    vector_search_adapter: VertexVectorSearchAdapter

    def find_neighbors(
        self,
        *,
        signal: MatchSignalSourceWrite,
        candidate_type: Literal["publisher", "manuscript"],
        limit: int,
    ) -> list[RetrievedNeighbor]:
        if signal.summary is None:
            return []
        target_signal = target_signal_for_retrieval(signal.signal_type, candidate_type)
        vector = self.embedding_adapter.embed_signal_text(
            signal.summary,
            task_type="RETRIEVAL_QUERY",
        )
        neighbors = self.vector_search_adapter.find_neighbors(
            vector,
            signal_axis=target_signal,
            limit=limit,
            restricts=[
                VectorRestrict(
                    namespace="source_type",
                    allow_list=[
                        "publisher_profile" if candidate_type == "publisher" else "manuscript"
                    ],
                )
            ],
        )
        return [
            RetrievedNeighbor(
                candidate_id=neighbor_id_from_metadata(neighbor.datapoint_id, neighbor.metadata),
                distance=neighbor.distance if neighbor.distance is not None else 1.0,
            )
            for neighbor in neighbors
        ]


@dataclass(frozen=True)
class SignalSyncResult:
    manuscript_count: int
    publisher_count: int
    signal_count: int


@dataclass
class MatchingSignalSyncWorker:
    repository: MatchingRepository
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER

    def sync(self, manuscript_limit: int = 250, publisher_limit: int = 250) -> SignalSyncResult:
        signal_count = 0
        manuscript_count = 0
        for manuscript in self.repository.list_eligible_manuscripts(manuscript_limit):
            manuscript_id = required_text(manuscript, "id")
            owner_profile_id = required_text(manuscript, "author_profile_id")
            for signal in build_manuscript_signal_writes(
                manuscript=manuscript,
                manuscript_id=manuscript_id,
                owner_profile_id=owner_profile_id,
                embedding_provider=self.embedding_provider,
            ):
                self.repository.upsert_match_signal_source(signal)
                signal_count += 1
            manuscript_count += 1

        publisher_count = 0
        for publisher in self.repository.list_eligible_publishers(publisher_limit):
            publisher_profile_id = required_text(publisher, "id")
            for signal in build_publisher_signal_writes(
                publisher=publisher,
                publisher_profile_id=publisher_profile_id,
                owner_profile_id=publisher_profile_id,
                embedding_provider=self.embedding_provider,
            ):
                self.repository.upsert_match_signal_source(signal)
                signal_count += 1
            publisher_count += 1

        return SignalSyncResult(
            manuscript_count=manuscript_count,
            publisher_count=publisher_count,
            signal_count=signal_count,
        )


@dataclass
class RepositoryBackedMatchingWorker:
    repository: MatchingRepository
    retrieval_provider: SignalRetrievalProvider
    explanation_provider: ExplanationProvider
    embedding_provider: SignalEmbeddingProvider = DEFAULT_SIGNAL_EMBEDDING_PROVIDER

    def process_run(self, match_run_id: str) -> MatchingResult:
        try:
            result = self._process_run(match_run_id)
            self.repository.mark_match_run_succeeded(match_run_id, result.candidate_count)
            return result
        except ExplanationSafetyError:
            self.repository.mark_match_run_failed(match_run_id, MATCHING_EXPLANATION_FAILED)
            return MatchingResult(
                status="failed",
                candidate_count=0,
                failure_code=MATCHING_EXPLANATION_FAILED,
            )
        except MatchingWorkerInputError:
            self.repository.mark_match_run_failed(match_run_id, MATCHING_INPUT_NOT_READY)
            return MatchingResult(
                status="failed",
                candidate_count=0,
                failure_code=MATCHING_INPUT_NOT_READY,
            )
        except VertexAdapterError as exc:
            self.repository.mark_match_run_failed(match_run_id, exc.safe_failure_code)
            return MatchingResult(
                status="failed",
                candidate_count=0,
                failure_code=exc.safe_failure_code,
            )
        except Exception:
            self.repository.mark_match_run_failed(match_run_id, MATCHING_PROVIDER_FAILED)
            return MatchingResult(
                status="failed",
                candidate_count=0,
                failure_code=MATCHING_PROVIDER_FAILED,
            )

    def _process_run(self, match_run_id: str) -> MatchingResult:
        run = self.repository.get_match_run(match_run_id)
        if run is None:
            raise MatchingWorkerInputError("match run not found")

        source, source_signals, candidates_by_id, candidate_type = self._load_run_context(run)
        retrieval_scores = self._retrieve_candidate_scores(source_signals, candidate_type)
        ranked = self._rank_candidates(
            run=run,
            source=source,
            candidates_by_id=candidates_by_id,
            retrieval_scores=retrieval_scores,
            candidate_type=candidate_type,
        )
        writes = self._build_candidate_writes(run, source, ranked[:25])
        self._attach_top_ten_explanations(writes)
        self.repository.insert_match_candidates(writes)
        self.repository.insert_profile_access_grants(build_profile_access_grants(run, writes))
        return MatchingResult(status="succeeded", candidate_count=len(writes))

    def _load_run_context(
        self, run: MatchRunRecord
    ) -> tuple[
        dict[str, object],
        list[MatchSignalSourceWrite],
        dict[str, dict[str, object]],
        Literal["publisher", "manuscript"],
    ]:
        if run.direction == "author_to_publisher":
            if run.source_manuscript_id is None:
                raise MatchingWorkerInputError("author match missing source manuscript")
            manuscript = self.repository.get_manuscript_matching_source(
                run.source_manuscript_id
            )
            if manuscript is None:
                raise MatchingWorkerInputError("source manuscript not found")
            source = normalize_manuscript_for_signals(manuscript)
            source_signals = build_manuscript_signal_writes(
                manuscript=source,
                manuscript_id=run.source_manuscript_id,
                owner_profile_id=run.requester_profile_id,
                embedding_provider=self.embedding_provider,
            )
            persist_required_signals(self.repository, source_signals)
            candidates = {
                required_text(candidate, "id"): normalize_publisher_for_signals(candidate)
                for candidate in self.repository.list_eligible_publishers(500)
            }
            return source, source_signals, candidates, "publisher"

        if run.source_publisher_profile_id is None:
            raise MatchingWorkerInputError("publisher match missing source publisher")
        publisher = self.repository.get_publisher_matching_source(
            run.source_publisher_profile_id
        )
        if publisher is None:
            raise MatchingWorkerInputError("source publisher not found")
        source = normalize_publisher_for_signals(publisher)
        source_signals = build_publisher_signal_writes(
            publisher=source,
            publisher_profile_id=run.source_publisher_profile_id,
            owner_profile_id=run.requester_profile_id,
            embedding_provider=self.embedding_provider,
        )
        persist_required_signals(self.repository, source_signals)
        candidates = {
            required_text(candidate, "id"): normalize_manuscript_for_signals(candidate)
            for candidate in self.repository.list_eligible_manuscripts(500)
        }
        return source, source_signals, candidates, "manuscript"

    def _retrieve_candidate_scores(
        self,
        source_signals: list[MatchSignalSourceWrite],
        candidate_type: Literal["publisher", "manuscript"],
    ) -> dict[str, dict[str, float]]:
        scores: dict[str, dict[str, float]] = {}
        for signal in source_signals:
            if signal.status != "current" or signal.summary is None:
                continue
            neighbors = self.retrieval_provider.find_neighbors(
                signal=signal,
                candidate_type=candidate_type,
                limit=50,
            )
            for neighbor in neighbors:
                axis_scores = scores.setdefault(neighbor.candidate_id, {})
                scoring_axis = scoring_axis_for_signal(signal.signal_type)
                axis_scores[scoring_axis] = max(
                    axis_scores.get(scoring_axis, 0.0),
                    distance_to_similarity(neighbor.distance),
                )
        return scores

    def _rank_candidates(
        self,
        *,
        run: MatchRunRecord,
        source: dict[str, object],
        candidates_by_id: dict[str, dict[str, object]],
        retrieval_scores: dict[str, dict[str, float]],
        candidate_type: Literal["publisher", "manuscript"],
    ) -> list[tuple[str, dict[str, object], MatchScoringResult]]:
        ranked: list[tuple[str, dict[str, object], MatchScoringResult]] = []
        for candidate_id, axis_scores in retrieval_scores.items():
            candidate = candidates_by_id.get(candidate_id)
            if candidate is None:
                continue
            self._sync_candidate_signals(candidate, candidate_type)
            result = score_match_candidate(
                candidate_kind=candidate_type,
                rank_seed=f"{run.id}:{candidate_id}",
                source=source,
                candidate=candidate,
                retrieval_scores=axis_scores,
            )
            if is_visible_match(result):
                ranked.append((candidate_id, candidate, result))
        return sorted(
            ranked,
            key=lambda item: (-item[2].final_score, item[0]),
        )

    def _sync_candidate_signals(
        self,
        candidate: dict[str, object],
        candidate_type: Literal["publisher", "manuscript"],
    ) -> None:
        if candidate_type == "publisher":
            publisher_profile_id = required_text(candidate, "id")
            persist_required_signals(
                self.repository,
                build_publisher_signal_writes(
                    publisher=candidate,
                    publisher_profile_id=publisher_profile_id,
                    owner_profile_id=publisher_profile_id,
                    embedding_provider=self.embedding_provider,
                ),
            )
            return

        manuscript_id = required_text(candidate, "id")
        owner_profile_id = required_text(candidate, "author_profile_id")
        persist_required_signals(
            self.repository,
            build_manuscript_signal_writes(
                manuscript=candidate,
                manuscript_id=manuscript_id,
                owner_profile_id=owner_profile_id,
                embedding_provider=self.embedding_provider,
            ),
        )

    def _build_candidate_writes(
        self,
        run: MatchRunRecord,
        source: dict[str, object],
        ranked: list[tuple[str, dict[str, object], MatchScoringResult]],
    ) -> list[MatchCandidateWrite]:
        writes: list[MatchCandidateWrite] = []
        for index, (candidate_id, candidate, result) in enumerate(ranked):
            rank = index + 1
            is_manuscript = run.direction == "publisher_to_manuscript"
            candidate_profile_id = (
                required_text(candidate, "author_profile_id")
                if is_manuscript
                else candidate_id
            )
            candidate_manuscript_id = candidate_id if is_manuscript else None
            writes.append(
                MatchCandidateWrite(
                    match_run_id=run.id,
                    rank=rank,
                    candidate_profile_id=candidate_profile_id,
                    candidate_manuscript_id=candidate_manuscript_id,
                    candidate_type="manuscript" if is_manuscript else "publisher",
                    score_band=result.score_band,
                    axis_bands={key: value for key, value in result.axis_bands.items()},
                    explanation=None,
                    explanation_status="not_requested",
                    fit_reasons=result.fit_reasons,
                    risk_reasons=result.risk_reasons,
                    score_details=score_details(candidate, result, is_manuscript),
                    safe_snippets=[
                        {"label": snippet.label, "text": snippet.text}
                        for snippet in result.safe_snippets
                    ],
                    detail_snapshot=build_detail_snapshot(
                        run=run,
                        source=source,
                        candidate=candidate,
                        result=result,
                        candidate_profile_id=candidate_profile_id,
                        candidate_manuscript_id=candidate_manuscript_id,
                        is_manuscript=is_manuscript,
                    ),
                )
            )
        return writes

    def _attach_top_ten_explanations(self, candidates: list[MatchCandidateWrite]) -> None:
        top_ten = candidates[:10]
        if not top_ten:
            return
        evidence = [candidate_evidence(candidate) for candidate in top_ten]
        result = self.explanation_provider.explain_top_candidates(evidence)
        paragraphs = {
            explanation.candidate_id: explanation.paragraph
            for explanation in result.explanations
        }
        for index, candidate in enumerate(candidates):
            if index >= 10:
                candidates[index] = candidate_with_explanation(candidate, None, "not_requested")
                continue
            explanation = paragraphs.get(candidate_evidence_id(candidate))
            if explanation is None:
                raise ExplanationSafetyError("Missing top candidate explanation")
            candidates[index] = candidate_with_explanation(
                candidate,
                explanation,
                "generated",
            )


class MatchingWorkerInputError(Exception):
    """Raised when trusted database inputs are not ready for matching."""


def persist_required_signals(
    repository: MatchingRepository,
    signals: list[MatchSignalSourceWrite],
) -> None:
    for signal in signals:
        if signal.signal_type in {"premise", "voice", "arc", "guidelines"} and (
            signal.status != "current" or signal.summary is None or signal.embedding is None
        ):
            raise MatchingWorkerInputError("required signal missing or stale")
        repository.upsert_match_signal_source(signal)


def build_profile_access_grants(
    run: MatchRunRecord,
    candidates: list[MatchCandidateWrite],
) -> list[ProfileAccessGrantWrite]:
    return [
        ProfileAccessGrantWrite(
            viewer_profile_id=run.requester_profile_id,
            target_profile_id=candidate.candidate_profile_id,
            manuscript_id=candidate.candidate_manuscript_id,
        )
        for candidate in candidates
    ]


def score_details(
    candidate: dict[str, object],
    result: MatchScoringResult,
    is_manuscript: bool,
) -> dict[str, object]:
    title = safe_title(
        candidate.get("title") if is_manuscript else candidate.get("publisherName")
    )
    candidate_id = required_text(candidate, "id")
    return {
        "title": title,
        "subtitle": candidate.get("genre") if is_manuscript else "Publisher profile",
        "profilePath": (
            f"/app/profiles/authors/{required_text(candidate, 'author_profile_id')}"
            if is_manuscript
            else f"/app/profiles/publishers/{candidate_id}"
        ),
        "manuscriptProfilePath": (
            f"/app/profiles/manuscripts/{candidate_id}" if is_manuscript else None
        ),
        "penalties": [
            {
                "code": penalty.code,
                "label": penalty.label,
                "severity": penalty.severity,
            }
            for penalty in result.penalties
        ],
    }


def candidate_evidence(candidate: MatchCandidateWrite) -> MatchCandidateEvidence:
    details = candidate.score_details
    penalties = details.get("penalties") if isinstance(details.get("penalties"), list) else []
    return MatchCandidateEvidence.model_validate(
        {
            "candidate_id": candidate_evidence_id(candidate),
            "rank": candidate.rank,
            "title": safe_title(details.get("title")),
            "candidate_type": candidate.candidate_type,
            "score_band": candidate.score_band,
            "axis_bands": candidate.axis_bands,
            "fit_reasons": candidate.fit_reasons,
            "risk_reasons": candidate.risk_reasons,
            "penalties": penalties,
            "safe_snippets": candidate.safe_snippets,
        }
    )


def candidate_evidence_id(candidate: MatchCandidateWrite) -> str:
    return candidate.candidate_manuscript_id or candidate.candidate_profile_id


def candidate_with_explanation(
    candidate: MatchCandidateWrite,
    explanation: str | None,
    status: Literal["generated", "not_requested"],
) -> MatchCandidateWrite:
    return MatchCandidateWrite(
        match_run_id=candidate.match_run_id,
        rank=candidate.rank,
        candidate_profile_id=candidate.candidate_profile_id,
        candidate_manuscript_id=candidate.candidate_manuscript_id,
        candidate_type=candidate.candidate_type,
        score_band=candidate.score_band,
        axis_bands=candidate.axis_bands,
        explanation=explanation,
        explanation_status=status,
        fit_reasons=candidate.fit_reasons,
        risk_reasons=candidate.risk_reasons,
        score_details=candidate.score_details,
        safe_snippets=candidate.safe_snippets,
        detail_snapshot=candidate.detail_snapshot,
    )


def distance_to_similarity(distance: float) -> float:
    if distance < 0:
        return 0.0
    if distance <= 1:
        return 1 - distance
    return 1 / (1 + distance)


def target_signal_for_retrieval(
    signal_type: str,
    candidate_type: Literal["publisher", "manuscript"],
) -> str:
    if candidate_type == "publisher":
        return {
            "premise": "guidelines",
            "voice": "wishlist",
            "arc": "catalog",
        }.get(signal_type, "guidelines")
    return {
        "guidelines": "premise",
        "wishlist": "arc",
        "catalog": "voice",
    }.get(signal_type, "premise")


def scoring_axis_for_signal(signal_type: str) -> str:
    return {
        "guidelines": "premise",
        "wishlist": "arc",
        "catalog": "voice",
    }.get(signal_type, signal_type)


def neighbor_id_from_metadata(datapoint_id: str, metadata: dict[str, object]) -> str:
    source_id = metadata.get("source_id")
    if isinstance(source_id, str) and source_id:
        return source_id
    parts = datapoint_id.split("-")
    return parts[-2] if len(parts) > 2 else datapoint_id


def required_text(row: dict[str, object], key: str) -> str:
    value = row.get(key)
    if isinstance(value, str) and value:
        return value
    raise MatchingWorkerInputError(f"Missing required value {key}")


def safe_title(value: object) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()[:200]
    return "Candidate"
