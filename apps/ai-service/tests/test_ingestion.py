from fastapi.testclient import TestClient

from app.main import create_app
from app.modules.config import AiServiceConfig
from app.modules.ingestion import ProcessingFailureCode, chunk_text, ingest_text_document


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
    app = create_app(AiServiceConfig(provider_mode="local", internal_token="secret"))
    response = TestClient(app).post(
        "/internal/ingestion/run",
        json={
            "job_id": "job-1",
            "document_id": "doc-1",
            "mime_type": "text/plain",
            "text_content": "Sample text",
        },
    )

    assert response.status_code == 401


def test_internal_ingestion_endpoint_accepts_valid_local_token() -> None:
    app = create_app(AiServiceConfig(provider_mode="local", internal_token="secret"))
    response = TestClient(app).post(
        "/internal/ingestion/run",
        headers={"authorization": "Bearer secret"},
        json={
            "job_id": "job-1",
            "document_id": "doc-1",
            "mime_type": "text/plain",
            "text_content": "Sample text",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "succeeded"
