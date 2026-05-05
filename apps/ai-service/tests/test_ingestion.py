from typing import cast

from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.config import AiServiceConfig
from app.modules.embeddings import LocalEmbeddingReferenceProvider
from app.modules.ingestion import ProcessingFailureCode, chunk_text, ingest_text_document
from app.modules.ingestion_worker import IngestionWorker
from app.modules.repositories import (
    DocumentRecord,
    InMemoryIngestionRepository,
    ProcessingJobRecord,
)
from app.modules.storage import InMemoryDocumentStorage


def make_worker(
    *,
    files: dict[str, bytes],
    document: DocumentRecord | None = None,
    config: AiServiceConfig | None = None,
) -> tuple[IngestionWorker, InMemoryIngestionRepository]:
    repository = InMemoryIngestionRepository()
    document = document or DocumentRecord(
        id="doc-1",
        mime_type="text/plain",
        storage_path="doc-1.txt",
        byte_size=len(files.get("doc-1.txt", b"")),
    )
    repository.documents[document.id] = document
    repository.jobs["job-1"] = ProcessingJobRecord(id="job-1", document_id=document.id)
    resolved_config = config or AiServiceConfig(provider_mode="local")
    worker = IngestionWorker(
        repository=repository,
        storage=InMemoryDocumentStorage(files),
        embedding_provider=LocalEmbeddingReferenceProvider(
            embedding_model=resolved_config.embedding_model,
            vector_index_name=resolved_config.vector_index_name,
        ),
        config=resolved_config,
    )
    return worker, repository


def test_processing_failure_codes_match_contract_values() -> None:
    assert {item.value for item in ProcessingFailureCode} == {
        "empty_extracted_text",
        "unsupported_file_type",
        "file_type_mismatch",
        "extracted_text_too_large",
        "chunk_limit_exceeded",
        "download_failed",
        "parser_failed",
        "embedding_failed",
        "scanner_suspicious",
        "unexpected_processing_error",
    }


def test_text_ingestion_chunks_paragraphs_deterministically() -> None:
    result = ingest_text_document(
        document_id="doc-1",
        mime_type="text/plain",
        text="First paragraph.\n\nSecond paragraph.",
    )

    assert result.status == "succeeded"
    assert result.failure_code is None
    assert result.chunk_count == 1
    assert result.chunks[0].content == "First paragraph.\n\nSecond paragraph."
    assert result.chunks[0].embedding_datapoint_id == "local-document-chunk-doc-1-0"
    assert result.metadata["scanner_result"] == "not_scanned"


def test_text_ingestion_returns_safe_failure_for_empty_text() -> None:
    result = ingest_text_document(
        document_id="doc-1",
        mime_type="text/plain",
        text="  \n\n  ",
    )

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "empty_extracted_text"
    assert result.metadata["failure_code"] == "empty_extracted_text"


def test_text_ingestion_returns_safe_failure_for_unsupported_type() -> None:
    result = ingest_text_document(
        document_id="doc-1",
        mime_type="application/pdf",
        text="%PDF-1.7",
    )

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "unsupported_file_type"


def test_chunker_splits_oversized_paragraphs() -> None:
    chunks = chunk_text("x" * 2_500)

    assert len(chunks) == 2
    assert len(chunks[0]) == 2_400
    assert len(chunks[1]) == 100


def test_internal_ingestion_endpoint_requires_local_token() -> None:
    worker, _repository = make_worker(files={"doc-1.txt": b"Sample text"})
    app = create_app(
        AiServiceConfig(provider_mode="local", internal_token="secret"),
        ingestion_worker=worker,
    )
    response = TestClient(app).post(
        "/internal/ingestion/run",
        json={
            "job_id": "job-1",
        },
    )

    assert response.status_code == 401


def test_internal_ingestion_endpoint_accepts_valid_local_token() -> None:
    worker, repository = make_worker(files={"doc-1.txt": b"Sample text"})
    app = create_app(
        AiServiceConfig(provider_mode="local", internal_token="secret"),
        ingestion_worker=worker,
    )
    response = TestClient(app).post(
        "/internal/ingestion/run",
        headers={"authorization": "Bearer secret"},
        json={
            "job_id": "job-1",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
    assert repository.job_statuses["job-1"] == "succeeded"
    assert repository.document_statuses["doc-1"] == "processed"


def test_worker_reads_text_from_storage_and_stores_bounded_chunks() -> None:
    worker, repository = make_worker(
        files={"doc-1.txt": b"First paragraph.\n\nSecond paragraph."}
    )

    result = worker.process_job("job-1")

    assert result.status == "succeeded"
    assert repository.chunks_by_document["doc-1"][0].content == (
        "First paragraph.\n\nSecond paragraph."
    )
    assert repository.job_metadata["job-1"]["chunk_count"] == 1
    assert repository.job_metadata["job-1"]["vector_index_name"] == "local-reference-index"


def test_worker_returns_safe_failure_for_empty_file() -> None:
    worker, repository = make_worker(files={"doc-1.txt": b" \n\n "})

    result = worker.process_job("job-1")

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "empty_extracted_text"
    assert repository.document_failure_codes["doc-1"] == "empty_extracted_text"
    assert repository.chunks_by_document.get("doc-1") is None


def test_worker_returns_safe_failure_for_too_large_extracted_text() -> None:
    config = AiServiceConfig(provider_mode="local", max_extracted_characters=10)
    worker, repository = make_worker(files={"doc-1.txt": b"01234567890"}, config=config)

    result = worker.process_job("job-1")

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "extracted_text_too_large"
    assert repository.document_failure_codes["doc-1"] == "extracted_text_too_large"


def test_worker_returns_safe_failure_for_unsupported_type() -> None:
    worker, repository = make_worker(
        files={"doc-1.pdf": b"%PDF-1.7"},
        document=DocumentRecord(
            id="doc-1",
            mime_type="application/pdf",
            storage_path="doc-1.pdf",
            byte_size=8,
        ),
    )

    result = worker.process_job("job-1")

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "unsupported_file_type"
    assert repository.document_failure_codes["doc-1"] == "unsupported_file_type"


def test_worker_returns_safe_failure_for_unreadable_corrupt_text() -> None:
    worker, repository = make_worker(files={"doc-1.txt": b"\xff\xfe\xfd"})

    result = worker.process_job("job-1")

    assert result.status == "failed"
    assert result.category == "user_correctable"
    assert result.failure_code == "parser_failed"
    assert repository.document_failure_codes["doc-1"] == "parser_failed"


def test_worker_reprocessing_replaces_active_chunks_and_embeddings() -> None:
    worker, repository = make_worker(files={"doc-1.txt": b"Old text"})
    first = worker.process_job("job-1")
    assert first.status == "succeeded"
    first_datapoint = repository.embeddings_by_document["doc-1"][0].vector_datapoint_id

    repository.jobs["job-2"] = ProcessingJobRecord(id="job-2", document_id="doc-1")
    storage = cast(InMemoryDocumentStorage, worker.storage)
    storage.files["doc-1.txt"] = b"New first paragraph.\n\nNew second paragraph."
    second = worker.process_job("job-2")

    assert second.status == "succeeded"
    assert [chunk.content for chunk in repository.chunks_by_document["doc-1"]] == [
        "New first paragraph.\n\nNew second paragraph."
    ]
    assert repository.job_statuses["job-1"] == "succeeded"
    assert repository.job_statuses["job-2"] == "succeeded"
    assert repository.embeddings_by_document["doc-1"][0].vector_datapoint_id != first_datapoint


def test_worker_embedding_records_are_references_not_vector_arrays() -> None:
    worker, repository = make_worker(files={"doc-1.txt": b"Reference only text"})

    result = worker.process_job("job-1")

    assert result.status == "succeeded"
    embedding = repository.embeddings_by_document["doc-1"][0]
    assert embedding.source_type == "document_chunk"
    assert embedding.vector_index_name == "local-reference-index"
    assert embedding.embedding_model == "local-reference-v1"
    assert "vector" not in embedding.metadata
    assert embedding.metadata["has_vector_array"] is False
