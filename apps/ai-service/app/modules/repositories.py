from dataclasses import dataclass, field
from typing import Literal, Protocol


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    mime_type: str
    storage_path: str
    byte_size: int


@dataclass(frozen=True)
class ProcessingJobRecord:
    id: str
    document_id: str


@dataclass(frozen=True)
class ChunkWrite:
    document_id: str
    chunk_index: int
    content: str
    checksum: str
    metadata: dict[str, object]


@dataclass(frozen=True)
class EmbeddingRecordWrite:
    source_type: str
    source_id: str
    vector_index_name: str
    vector_datapoint_id: str
    embedding_model: str
    metadata: dict[str, object]


MatchDirection = Literal["author_to_publisher", "publisher_to_manuscript"]
MatchSignalType = Literal[
    "premise",
    "voice",
    "arc",
    "guidelines",
    "wishlist",
    "catalog",
]
MatchSignalStatus = Literal["current", "stale", "missing_optional"]


@dataclass(frozen=True)
class MatchRunRecord:
    id: str
    direction: MatchDirection
    requester_profile_id: str
    source_manuscript_id: str | None
    source_publisher_profile_id: str | None
    input_snapshot: dict[str, object]


@dataclass(frozen=True)
class MatchSignalSourceWrite:
    owner_profile_id: str
    manuscript_id: str | None
    publisher_profile_id: str | None
    signal_type: MatchSignalType
    fingerprint: str
    source_fingerprint: str
    status: MatchSignalStatus
    summary: str | None
    embedding: EmbeddingRecordWrite | None
    metadata: dict[str, object]


@dataclass(frozen=True)
class MatchCandidateWrite:
    match_run_id: str
    rank: int
    candidate_profile_id: str
    candidate_manuscript_id: str | None
    candidate_type: Literal["publisher", "manuscript"]
    score_band: Literal["strong", "moderate", "weak"]
    axis_bands: dict[str, object]
    explanation: str | None
    explanation_status: Literal["generated", "not_requested"]
    fit_reasons: list[str]
    risk_reasons: list[str]
    score_details: dict[str, object]
    safe_snippets: list[dict[str, object]]


@dataclass(frozen=True)
class ProfileAccessGrantWrite:
    viewer_profile_id: str
    target_profile_id: str
    manuscript_id: str | None
    source: Literal["match_candidate", "manuscript_access"] = "match_candidate"


class IngestionRepository(Protocol):
    def get_job(self, job_id: str) -> ProcessingJobRecord | None:
        """Return a durable processing job record."""

    def get_document(self, document_id: str) -> DocumentRecord | None:
        """Return document metadata needed by the worker."""

    def mark_job_running(self, job_id: str) -> None:
        """Mark a job as running before storage/parser work starts."""

    def replace_document_ingestion_outputs(
        self,
        document_id: str,
        chunks: list[ChunkWrite],
        embeddings: list[EmbeddingRecordWrite],
    ) -> None:
        """Replace the active chunk/embedding set for one document atomically."""

    def mark_job_succeeded(self, job_id: str, metadata: dict[str, object]) -> None:
        """Mark processing job success with safe metadata."""

    def mark_job_failed(
        self,
        job_id: str,
        failure_code: str,
        metadata: dict[str, object],
    ) -> None:
        """Mark processing job failure with a stable safe failure code."""

    def mark_document_processed(self, document_id: str) -> None:
        """Move the document to processed state."""

    def mark_document_failed(self, document_id: str, failure_code: str) -> None:
        """Move the document to failed state with a user-safe code."""


class MatchingRepository(Protocol):
    def get_match_run(self, match_run_id: str) -> MatchRunRecord | None:
        """Load a trusted match run by durable id."""

    def get_manuscript_matching_source(self, manuscript_id: str) -> dict[str, object] | None:
        """Load bounded manuscript metadata needed to build matching signals."""

    def get_publisher_matching_source(
        self, publisher_profile_id: str
    ) -> dict[str, object] | None:
        """Load bounded publisher profile metadata needed to build matching signals."""

    def list_eligible_publishers(self, limit: int) -> list[dict[str, object]]:
        """Load eligible publisher candidates without private account fields."""

    def list_eligible_manuscripts(self, limit: int) -> list[dict[str, object]]:
        """Load eligible manuscript candidates without document bytes or signed URLs."""

    def upsert_match_signal_source(self, signal: MatchSignalSourceWrite) -> str:
        """Create or update a signal source and its optional embedding reference."""

    def insert_match_candidates(self, candidates: list[MatchCandidateWrite]) -> None:
        """Persist already-ranked match candidates."""

    def insert_profile_access_grants(self, grants: list[ProfileAccessGrantWrite]) -> None:
        """Persist idempotent profile grants created by visible match candidates."""

    def mark_match_run_succeeded(self, match_run_id: str, candidate_count: int) -> None:
        """Mark a match run as succeeded after candidates are persisted."""

    def mark_match_run_failed(self, match_run_id: str, failure_code: str) -> None:
        """Mark a match run as failed with a stable safe code."""


@dataclass
class InMemoryIngestionRepository:
    jobs: dict[str, ProcessingJobRecord] = field(default_factory=dict)
    documents: dict[str, DocumentRecord] = field(default_factory=dict)
    chunks_by_document: dict[str, list[ChunkWrite]] = field(default_factory=dict)
    embeddings_by_document: dict[str, list[EmbeddingRecordWrite]] = field(default_factory=dict)
    job_statuses: dict[str, str] = field(default_factory=dict)
    document_statuses: dict[str, str] = field(default_factory=dict)
    job_metadata: dict[str, dict[str, object]] = field(default_factory=dict)
    document_failure_codes: dict[str, str] = field(default_factory=dict)

    def get_job(self, job_id: str) -> ProcessingJobRecord | None:
        return self.jobs.get(job_id)

    def get_document(self, document_id: str) -> DocumentRecord | None:
        return self.documents.get(document_id)

    def mark_job_running(self, job_id: str) -> None:
        self.job_statuses[job_id] = "running"

    def replace_document_ingestion_outputs(
        self,
        document_id: str,
        chunks: list[ChunkWrite],
        embeddings: list[EmbeddingRecordWrite],
    ) -> None:
        self.chunks_by_document[document_id] = list(chunks)
        self.embeddings_by_document[document_id] = list(embeddings)

    def mark_job_succeeded(self, job_id: str, metadata: dict[str, object]) -> None:
        self.job_statuses[job_id] = "succeeded"
        self.job_metadata[job_id] = dict(metadata)

    def mark_job_failed(
        self,
        job_id: str,
        failure_code: str,
        metadata: dict[str, object],
    ) -> None:
        self.job_statuses[job_id] = "failed"
        self.job_metadata[job_id] = {**metadata, "failure_code": failure_code}

    def mark_document_processed(self, document_id: str) -> None:
        self.document_statuses[document_id] = "processed"
        self.document_failure_codes.pop(document_id, None)

    def mark_document_failed(self, document_id: str, failure_code: str) -> None:
        self.document_statuses[document_id] = "failed"
        self.document_failure_codes[document_id] = failure_code


@dataclass
class InMemoryMatchingRepository:
    match_runs: dict[str, MatchRunRecord] = field(default_factory=dict)
    manuscripts: dict[str, dict[str, object]] = field(default_factory=dict)
    publishers: dict[str, dict[str, object]] = field(default_factory=dict)
    signal_ids: list[str] = field(default_factory=list)
    signal_writes: list[MatchSignalSourceWrite] = field(default_factory=list)
    candidates: list[MatchCandidateWrite] = field(default_factory=list)
    profile_access_grants: list[ProfileAccessGrantWrite] = field(default_factory=list)
    run_statuses: dict[str, tuple[str, int, str | None]] = field(default_factory=dict)

    def get_match_run(self, match_run_id: str) -> MatchRunRecord | None:
        return self.match_runs.get(match_run_id)

    def get_manuscript_matching_source(self, manuscript_id: str) -> dict[str, object] | None:
        return self.manuscripts.get(manuscript_id)

    def get_publisher_matching_source(
        self, publisher_profile_id: str
    ) -> dict[str, object] | None:
        return self.publishers.get(publisher_profile_id)

    def list_eligible_publishers(self, limit: int) -> list[dict[str, object]]:
        return [
            publisher
            for publisher in self.publishers.values()
            if publisher.get("eligibility_status") == "eligible"
        ][:limit]

    def list_eligible_manuscripts(self, limit: int) -> list[dict[str, object]]:
        return [
            manuscript
            for manuscript in self.manuscripts.values()
            if manuscript.get("eligibility_status") == "eligible"
        ][:limit]

    def upsert_match_signal_source(self, signal: MatchSignalSourceWrite) -> str:
        signal_id = f"signal-{len(self.signal_writes) + 1}"
        self.signal_ids.append(signal_id)
        self.signal_writes.append(signal)
        return signal_id

    def insert_match_candidates(self, candidates: list[MatchCandidateWrite]) -> None:
        self.candidates.extend(candidates)

    def insert_profile_access_grants(self, grants: list[ProfileAccessGrantWrite]) -> None:
        for grant in grants:
            if grant not in self.profile_access_grants:
                self.profile_access_grants.append(grant)

    def mark_match_run_succeeded(self, match_run_id: str, candidate_count: int) -> None:
        self.run_statuses[match_run_id] = ("succeeded", candidate_count, None)

    def mark_match_run_failed(self, match_run_id: str, failure_code: str) -> None:
        self.run_statuses[match_run_id] = ("failed", 0, failure_code)
