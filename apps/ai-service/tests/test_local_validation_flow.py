from app.modules.config import AiServiceConfig
from app.modules.embeddings import LocalEmbeddingReferenceProvider
from app.modules.ingestion_worker import IngestionWorker
from app.modules.repositories import (
    DocumentRecord,
    InMemoryIngestionRepository,
    ProcessingJobRecord,
)
from app.modules.scanner import LocalFakeDocumentScanner
from app.modules.storage import InMemoryDocumentStorage


def build_worker(
    files: dict[str, bytes],
) -> tuple[IngestionWorker, InMemoryIngestionRepository]:
    repository = InMemoryIngestionRepository()
    repository.documents["doc-1"] = DocumentRecord(
        id="doc-1",
        mime_type="text/plain",
        storage_path="doc-1/local-flow.txt",
        byte_size=len(files["doc-1/local-flow.txt"]),
    )
    repository.jobs["job-1"] = ProcessingJobRecord(id="job-1", document_id="doc-1")
    config = AiServiceConfig(provider_mode="local")
    worker = IngestionWorker(
        repository=repository,
        storage=InMemoryDocumentStorage(files),
        embedding_provider=LocalEmbeddingReferenceProvider(
            embedding_model=config.embedding_model,
            vector_index_name=config.vector_index_name,
        ),
        config=config,
        scanner=LocalFakeDocumentScanner(),
    )
    return worker, repository


def test_repeatable_local_validation_flow_writes_chunks_and_embedding_references() -> None:
    worker, repository = build_worker(
        {"doc-1/local-flow.txt": b"First paragraph.\n\nSecond paragraph."}
    )

    result = worker.process_job("job-1")

    assert result.status == "succeeded"
    assert repository.job_statuses["job-1"] == "succeeded"
    assert repository.document_statuses["doc-1"] == "processed"
    assert [chunk.content for chunk in repository.chunks_by_document["doc-1"]] == [
        "First paragraph.\n\nSecond paragraph."
    ]
    assert repository.embeddings_by_document["doc-1"][0].source_type == "document_chunk"
    assert (
        repository.embeddings_by_document["doc-1"][0].vector_index_name
        == "local-reference-index"
    )


def test_repeatable_local_validation_flow_records_user_safe_empty_file_failure() -> None:
    worker, repository = build_worker({"doc-1/local-flow.txt": b"  \n\n  "})

    result = worker.process_job("job-1")

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "empty_extracted_text"
    assert repository.job_statuses["job-1"] == "failed"
    assert repository.document_statuses["doc-1"] == "failed"
    assert repository.document_failure_codes["doc-1"] == "empty_extracted_text"
    assert "doc-1" not in repository.chunks_by_document
    assert "doc-1" not in repository.embeddings_by_document
