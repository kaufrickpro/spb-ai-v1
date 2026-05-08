from typing import Literal

import pytest

from app.modules.embeddings import VertexAdapterError
from app.modules.explanations import (
    ExplanationBatchResult,
    MatchCandidateEvidence,
    MatchExplanation,
)
from app.modules.matching_signals import LocalSignalEmbeddingProvider
from app.modules.matching_worker import (
    MATCHING_EXPLANATION_FAILED,
    MATCHING_INPUT_NOT_READY,
    MatchingSignalSyncWorker,
    RepositoryBackedMatchingWorker,
    RetrievedNeighbor,
)
from app.modules.repositories import (
    EmbeddingRecordWrite,
    InMemoryMatchingRepository,
    MatchRunRecord,
    MatchSignalSourceWrite,
    MatchSignalType,
)


class StaticRetrievalProvider:
    def __init__(self, neighbors: dict[str, list[RetrievedNeighbor]]) -> None:
        self.calls: list[str] = []
        self.neighbors = neighbors

    def find_neighbors(
        self,
        *,
        signal: MatchSignalSourceWrite,
        candidate_type: Literal["publisher", "manuscript"],
        limit: int,
    ) -> list[RetrievedNeighbor]:
        self.calls.append(f"{candidate_type}:{signal.signal_type}:{limit}")
        return self.neighbors.get(signal.signal_type, [])


class EchoExplanationProvider:
    def explain_top_candidates(
        self, evidence: list[MatchCandidateEvidence]
    ) -> ExplanationBatchResult:
        return ExplanationBatchResult(
            explanations=[
                MatchExplanation(
                    candidate_id=item.candidate_id,
                    paragraph=(
                        "This candidate has enough safe metadata overlap to justify "
                        "a stored explanation for the matching result."
                    ),
                )
                for item in evidence
            ],
            model="gemini-test",
            prompt_version="test",
            provider="fake",
        )


class IncompleteExplanationProvider:
    def explain_top_candidates(
        self, evidence: list[MatchCandidateEvidence]
    ) -> ExplanationBatchResult:
        return ExplanationBatchResult(
            explanations=[],
            model="gemini-test",
            prompt_version="test",
            provider="fake",
        )


def test_signal_sync_worker_embeds_required_and_missing_optional_signals() -> None:
    repository = matching_repository()
    result = MatchingSignalSyncWorker(repository).sync()

    assert result.manuscript_count == 1
    assert result.publisher_count == 2
    assert result.signal_count == 9
    by_type = {signal.signal_type: signal for signal in repository.signal_writes}
    assert by_type["premise"].embedding is not None
    assert by_type["wishlist"].status == "missing_optional"
    assert by_type["wishlist"].embedding is None


def test_author_to_publisher_worker_retrieves_scores_and_persists_top_candidates() -> None:
    repository = matching_repository()
    worker = RepositoryBackedMatchingWorker(
        repository=repository,
        retrieval_provider=StaticRetrievalProvider(
            {
                "premise": [
                    RetrievedNeighbor(candidate_id="publisher-1", distance=0.05),
                    RetrievedNeighbor(candidate_id="publisher-2", distance=0.65),
                ],
                "voice": [RetrievedNeighbor(candidate_id="publisher-1", distance=0.1)],
                "arc": [RetrievedNeighbor(candidate_id="publisher-1", distance=0.1)],
            }
        ),
        explanation_provider=EchoExplanationProvider(),
    )

    result = worker.process_run("run-author")

    assert result.status == "succeeded"
    assert result.candidate_count == 1
    assert repository.candidates[0].candidate_profile_id == "publisher-1"
    assert repository.candidates[0].candidate_type == "publisher"
    assert repository.candidates[0].explanation_status == "generated"
    assert repository.profile_access_grants[0].target_profile_id == "publisher-1"
    assert repository.run_statuses["run-author"] == ("succeeded", 1, None)


def test_publisher_to_manuscript_worker_persists_manuscript_candidates() -> None:
    repository = matching_repository()
    worker = RepositoryBackedMatchingWorker(
        repository=repository,
        retrieval_provider=StaticRetrievalProvider(
            {
                "guidelines": [
                    RetrievedNeighbor(candidate_id="manuscript-1", distance=0.05)
                ],
                "wishlist": [
                    RetrievedNeighbor(candidate_id="manuscript-1", distance=0.1)
                ],
                "catalog": [],
            }
        ),
        explanation_provider=EchoExplanationProvider(),
    )

    result = worker.process_run("run-publisher")

    assert result.status == "succeeded"
    assert result.candidate_count == 1
    candidate = repository.candidates[0]
    assert candidate.candidate_type == "manuscript"
    assert candidate.candidate_profile_id == "author-profile-1"
    assert candidate.candidate_manuscript_id == "manuscript-1"
    assert repository.profile_access_grants[0].manuscript_id == "manuscript-1"


def test_worker_marks_run_failed_when_required_source_is_missing() -> None:
    repository = matching_repository()
    repository.match_runs["bad-run"] = MatchRunRecord(
        id="bad-run",
        direction="author_to_publisher",
        requester_profile_id="author-profile-1",
        source_manuscript_id="missing",
        source_publisher_profile_id=None,
        input_snapshot={},
    )
    worker = RepositoryBackedMatchingWorker(
        repository=repository,
        retrieval_provider=StaticRetrievalProvider({}),
        explanation_provider=EchoExplanationProvider(),
    )

    result = worker.process_run("bad-run")

    assert result.status == "failed"
    assert result.failure_code == MATCHING_INPUT_NOT_READY
    assert repository.run_statuses["bad-run"] == ("failed", 0, MATCHING_INPUT_NOT_READY)


def test_worker_fails_safely_when_top_ten_explanation_is_incomplete() -> None:
    repository = matching_repository()
    worker = RepositoryBackedMatchingWorker(
        repository=repository,
        retrieval_provider=StaticRetrievalProvider(
            {
                "premise": [RetrievedNeighbor(candidate_id="publisher-1", distance=0.05)],
                "voice": [RetrievedNeighbor(candidate_id="publisher-1", distance=0.1)],
                "arc": [RetrievedNeighbor(candidate_id="publisher-1", distance=0.1)],
            }
        ),
        explanation_provider=IncompleteExplanationProvider(),
    )

    result = worker.process_run("run-author")

    assert result.status == "failed"
    assert result.failure_code == MATCHING_EXPLANATION_FAILED
    assert repository.candidates == []
    assert repository.run_statuses["run-author"] == (
        "failed",
        0,
        MATCHING_EXPLANATION_FAILED,
    )


def test_worker_preserves_safe_vertex_adapter_failure_code() -> None:
    class FailingRetrievalProvider:
        def find_neighbors(
            self,
            *,
            signal: object,
            candidate_type: Literal["publisher", "manuscript"],
            limit: int,
        ) -> list[RetrievedNeighbor]:
            raise VertexAdapterError("vertex_vector_query_failed")

    repository = matching_repository()
    worker = RepositoryBackedMatchingWorker(
        repository=repository,
        retrieval_provider=FailingRetrievalProvider(),
        explanation_provider=EchoExplanationProvider(),
    )

    result = worker.process_run("run-author")

    assert result.status == "failed"
    assert result.failure_code == "vertex_vector_query_failed"
    assert repository.run_statuses["run-author"] == (
        "failed",
        0,
        "vertex_vector_query_failed",
    )


def test_signal_sync_surfaces_provider_failures() -> None:
    class FailingEmbeddingProvider(LocalSignalEmbeddingProvider):
        def create_signal_embedding(
            self,
            *,
            signal_type: MatchSignalType,
            source_id: str,
            source_type: str,
            fingerprint: str,
            text: str,
        ) -> EmbeddingRecordWrite:
            del signal_type, source_id, source_type, fingerprint, text
            raise RuntimeError("vertex unavailable")

    with pytest.raises(RuntimeError, match="vertex unavailable"):
        MatchingSignalSyncWorker(
            matching_repository(),
            embedding_provider=FailingEmbeddingProvider(),
        ).sync()


def matching_repository() -> InMemoryMatchingRepository:
    return InMemoryMatchingRepository(
        match_runs={
            "run-author": MatchRunRecord(
                id="run-author",
                direction="author_to_publisher",
                requester_profile_id="author-profile-1",
                source_manuscript_id="manuscript-1",
                source_publisher_profile_id=None,
                input_snapshot={},
            ),
            "run-publisher": MatchRunRecord(
                id="run-publisher",
                direction="publisher_to_manuscript",
                requester_profile_id="publisher-1",
                source_manuscript_id=None,
                source_publisher_profile_id="publisher-1",
                input_snapshot={},
            ),
        },
        manuscripts={
            "manuscript-1": {
                "id": "manuscript-1",
                "author_profile_id": "author-profile-1",
                "title": "Kayıp Şehir",
                "genre": "Roman",
                "eligibility_status": "eligible",
                "audience_categories": ["adult"],
                "manuscript_form": "novel",
                "logline": "A literary mystery across Istanbul.",
                "synopsis": "A family follows an archive trail.",
                "arc_summary": "A hidden archive changes the family.",
                "declared_themes": ["memory"],
            }
        },
        publishers={
            "publisher-1": {
                "id": "publisher-1",
                "display_name": "Bridge Publishing",
                "publisher_name": "Bridge Publishing",
                "eligibility_status": "eligible",
                "accepted_primary_genres": ["Roman"],
                "accepted_audience_categories": ["adult"],
                "accepted_manuscript_forms": ["novel"],
                "submission_guidelines": "Literary mystery with a strong arc.",
                "what_we_are_looking_for": "Istanbul stories about memory.",
            },
            "publisher-2": {
                "id": "publisher-2",
                "display_name": "Mismatch Press",
                "publisher_name": "Mismatch Press",
                "eligibility_status": "eligible",
                "accepted_primary_genres": ["poetry"],
                "accepted_audience_categories": ["children"],
                "accepted_manuscript_forms": ["poetry"],
                "submission_guidelines": "Short poems only.",
            },
        },
    )
