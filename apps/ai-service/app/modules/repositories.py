from dataclasses import dataclass, field
from typing import Protocol


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
