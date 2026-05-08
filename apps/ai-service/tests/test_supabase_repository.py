from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.modules.repositories import (
    ChunkWrite,
    EmbeddingRecordWrite,
    MatchSignalSourceWrite,
)
from app.modules.supabase_repository import (
    SupabaseIngestionRepository,
    SupabaseMatchingRepository,
    SupabaseRepositoryError,
)


class FakeResponse:
    def __init__(self, payload: Any = None, status_code: int = 200) -> None:
        self.status_code = status_code
        self.content = b"" if payload is None else httpx.Response(200, json=payload).content
        self.text = self.content.decode()

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "request failed",
                request=httpx.Request("GET", "https://example.test"),
                response=httpx.Response(self.status_code),
            )


def capture_requests(
    monkeypatch: pytest.MonkeyPatch,
    response_for: Callable[[str, str, Any], FakeResponse],
) -> list[dict[str, Any]]:
    requests: list[dict[str, Any]] = []

    def fake_request(
        method: str,
        url: str,
        json: Any,
        timeout: int,
        headers: dict[str, str],
    ) -> FakeResponse:
        requests.append(
            {
                "method": method,
                "url": url,
                "json": json,
                "timeout": timeout,
                "headers": headers,
            }
        )
        return response_for(method, url, json)

    monkeypatch.setattr(httpx, "request", fake_request)
    return requests


def test_repository_loads_queued_job_by_id(monkeypatch: pytest.MonkeyPatch) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(
            [{"id": "job-1", "document_id": "doc-1"}]
        ),
    )
    repository = SupabaseIngestionRepository("https://project.supabase.co", "service")

    job = repository.get_job("job-1")

    assert job is not None
    assert job.id == "job-1"
    assert job.document_id == "doc-1"
    assert requests[0]["method"] == "GET"
    assert "/rest/v1/document_processing_jobs?" in requests[0]["url"]
    assert "status=in.%28queued%2Crunning%29" in requests[0]["url"]


def test_repository_loads_document_metadata_without_file_bytes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(
            [
                {
                    "id": "doc-1",
                    "mime_type": "text/plain",
                    "file_size_bytes": 42,
                    "upload_id": "upload-1",
                    "original_file_name": "../Sample Draft.txt",
                }
            ]
        ),
    )
    repository = SupabaseIngestionRepository("https://project.supabase.co", "service")

    document = repository.get_document("doc-1")

    assert document is not None
    assert document.storage_path == "doc-1/upload-1-Sample-Draft.txt"
    assert document.byte_size == 42
    assert "select=id%2Cmime_type%2Cfile_size_bytes%2Cupload_id%2Coriginal_file_name" in (
        requests[0]["url"]
    )
    assert "content" not in requests[0]["url"]


def test_repository_marks_job_and_document_failure_with_safe_code(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(),
    )
    repository = SupabaseIngestionRepository("https://project.supabase.co", "service")

    repository.mark_job_failed(
        "job-1",
        "empty_extracted_text",
        {"failure_category": "user_correctable"},
    )
    repository.mark_document_failed("doc-1", "empty_extracted_text")

    assert requests[0]["json"] == {
        "status": "failed",
        "error_message": "Document processing failed",
        "completed_at": requests[0]["json"]["completed_at"],
        "metadata": {
            "failure_category": "user_correctable",
            "failure_code": "empty_extracted_text",
        },
    }
    assert requests[1]["json"] == {
        "processing_status": "failed",
        "processing_failure_code": "empty_extracted_text",
        "eligibility_status": "limited",
        "review_outcome": "needs_review",
    }


def test_repository_replaces_outputs_through_single_transactional_rpc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(),
    )
    repository = SupabaseIngestionRepository("https://project.supabase.co", "service")

    repository.replace_document_ingestion_outputs(
        "doc-1",
        [
            ChunkWrite(
                document_id="doc-1",
                chunk_index=0,
                content="First chunk",
                checksum="abc",
                metadata={"checksum": "abc"},
            )
        ],
        [
            EmbeddingRecordWrite(
                source_type="document_chunk",
                source_id="ignored-by-rpc",
                vector_index_name="index-1",
                vector_datapoint_id="provider-specific-id",
                embedding_model="model-1",
                metadata={"has_vector_array": False},
            )
        ],
    )

    assert len(requests) == 1
    assert requests[0]["method"] == "POST"
    assert requests[0]["url"] == (
        "https://project.supabase.co/rest/v1/rpc/replace_document_ingestion_outputs"
    )
    assert requests[0]["json"] == {
        "p_document_id": "doc-1",
        "p_chunks": [
            {
                "chunk_index": 0,
                "content": "First chunk",
                "metadata": {"checksum": "abc"},
            }
        ],
        "p_embeddings": [
            {
                "source_type": "document_chunk",
                "source_id": "ignored-by-rpc",
                "vector_index_name": "index-1",
                "vector_datapoint_id": "provider-specific-id",
                "embedding_model": "model-1",
                "metadata": {"has_vector_array": False},
                "chunk_index": 0,
            }
        ],
    }


def test_repository_wraps_supabase_http_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(status_code=500),
    )
    repository = SupabaseIngestionRepository("https://project.supabase.co", "service")

    with pytest.raises(SupabaseRepositoryError):
        repository.mark_job_running("job-1")


def test_matching_repository_loads_trusted_run_by_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(
            [
                {
                    "id": "run-1",
                    "direction": "author_to_publisher",
                    "requester_profile_id": "profile-1",
                    "source_manuscript_id": "manuscript-1",
                    "source_publisher_profile_id": None,
                    "input_snapshot": {"title": "Safe snapshot"},
                }
            ]
        ),
    )
    repository = SupabaseMatchingRepository("https://project.supabase.co", "service")

    run = repository.get_match_run("run-1")

    assert run is not None
    assert run.id == "run-1"
    assert run.direction == "author_to_publisher"
    assert run.input_snapshot == {"title": "Safe snapshot"}
    assert "/rest/v1/match_runs?" in requests[0]["url"]
    assert "id=eq.run-1" in requests[0]["url"]


def test_matching_repository_upserts_embedding_reference_without_vector_arrays(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse([{"id": "embedding-1"}]),
    )
    repository = SupabaseMatchingRepository("https://project.supabase.co", "service")

    embedding_id = repository.upsert_embedding_reference(
        EmbeddingRecordWrite(
            source_type="manuscript",
            source_id="10000000-0000-4000-8000-000000000001",
            vector_index_name="match-signal-reference-index",
            vector_datapoint_id="match-signal-premise-1",
            embedding_model="reference-only-local",
            metadata={"provider": "ai-service-reference", "has_vector_array": False},
        )
    )

    assert embedding_id == "embedding-1"
    assert requests[0]["method"] == "POST"
    assert "/rest/v1/embedding_records?" in requests[0]["url"]
    assert "on_conflict=vector_index_name%2Cvector_datapoint_id" in requests[0]["url"]
    assert requests[0]["headers"]["prefer"] == (
        "resolution=merge-duplicates,return=representation"
    )
    assert requests[0]["json"]["metadata"] == {
        "provider": "ai-service-reference",
        "has_vector_array": False,
    }


def test_matching_repository_updates_existing_signal_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    responses = [
        FakeResponse([{"id": "embedding-1"}]),
        FakeResponse([{"id": "signal-1"}]),
        FakeResponse([{"id": "signal-1"}]),
    ]
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: responses.pop(0),
    )
    repository = SupabaseMatchingRepository("https://project.supabase.co", "service")

    signal_id = repository.upsert_match_signal_source(
        MatchSignalSourceWrite(
            owner_profile_id="20000000-0000-4000-8000-000000000001",
            manuscript_id="10000000-0000-4000-8000-000000000001",
            publisher_profile_id=None,
            signal_type="premise",
            fingerprint="fingerprint-1",
            source_fingerprint="fingerprint-1",
            status="current",
            summary="A bounded premise summary.",
            embedding=EmbeddingRecordWrite(
                source_type="manuscript",
                source_id="10000000-0000-4000-8000-000000000001",
                vector_index_name="match-signal-reference-index",
                vector_datapoint_id="match-signal-premise-1",
                embedding_model="reference-only-local",
                metadata={"has_vector_array": False},
            ),
            metadata={"has_vector_array": False},
        )
    )

    assert signal_id == "signal-1"
    assert requests[0]["method"] == "POST"
    assert "/rest/v1/embedding_records?" in requests[0]["url"]
    assert requests[1]["method"] == "GET"
    assert "match_signal_sources" in requests[1]["url"]
    assert "manuscript_id=eq.10000000-0000-4000-8000-000000000001" in (
        requests[1]["url"]
    )
    assert requests[2]["method"] == "PATCH"
    assert requests[2]["json"]["embedding_record_id"] == "embedding-1"
    assert requests[2]["json"]["summary"] == "A bounded premise summary."


def test_matching_repository_records_missing_optional_signal_without_embedding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    responses = [
        FakeResponse([]),
        FakeResponse([{"id": "signal-1"}]),
    ]
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: responses.pop(0),
    )
    repository = SupabaseMatchingRepository("https://project.supabase.co", "service")

    signal_id = repository.upsert_match_signal_source(
        MatchSignalSourceWrite(
            owner_profile_id="30000000-0000-4000-8000-000000000001",
            manuscript_id=None,
            publisher_profile_id="30000000-0000-4000-8000-000000000001",
            signal_type="catalog",
            fingerprint="fingerprint-2",
            source_fingerprint="fingerprint-2",
            status="missing_optional",
            summary=None,
            embedding=None,
            metadata={"has_vector_array": False},
        )
    )

    assert signal_id == "signal-1"
    assert len(requests) == 2
    assert requests[0]["method"] == "GET"
    assert "manuscript_id=is.null" in requests[0]["url"]
    assert requests[1]["method"] == "POST"
    assert requests[1]["json"]["embedding_record_id"] is None
    assert requests[1]["json"]["status"] == "missing_optional"


def test_matching_repository_marks_run_success_and_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests = capture_requests(
        monkeypatch,
        lambda _method, _url, _json: FakeResponse(),
    )
    repository = SupabaseMatchingRepository("https://project.supabase.co", "service")

    repository.mark_match_run_succeeded("run-1", 12)
    repository.mark_match_run_failed("run-2", "matching_provider_failed")

    assert requests[0]["method"] == "PATCH"
    assert requests[0]["json"] == {
        "status": "succeeded",
        "candidate_count": 12,
        "failure_code": None,
    }
    assert requests[1]["json"] == {
        "status": "failed",
        "candidate_count": 0,
        "failure_code": "matching_provider_failed",
    }
