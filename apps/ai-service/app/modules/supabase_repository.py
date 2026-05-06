import json
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote, urlencode

import httpx

from app.modules.repositories import (
    ChunkWrite,
    DocumentRecord,
    EmbeddingRecordWrite,
    ProcessingJobRecord,
)


class SupabaseRepositoryError(Exception):
    """Raised when the local worker cannot read or update Supabase state."""


class SupabaseIngestionRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self.base_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key

    def get_job(self, job_id: str) -> ProcessingJobRecord | None:
        rows = self._request(
            "GET",
            "document_processing_jobs",
            query={
                "id": f"eq.{job_id}",
                "status": "in.(queued,running)",
                "select": "id,document_id",
                "limit": "1",
            },
        )
        if not rows:
            return None
        return ProcessingJobRecord(id=rows[0]["id"], document_id=rows[0]["document_id"])

    def get_document(self, document_id: str) -> DocumentRecord | None:
        rows = self._request(
            "GET",
            "documents",
            query={
                "id": f"eq.{document_id}",
                "select": "id,mime_type,file_size_bytes,upload_id,original_file_name",
                "limit": "1",
            },
        )
        if not rows:
            return None

        row = rows[0]
        return DocumentRecord(
            id=row["id"],
            mime_type=row["mime_type"],
            storage_path=build_local_storage_path(
                document_id=row["id"],
                file_name=row["original_file_name"],
                upload_id=row["upload_id"],
            ),
            byte_size=int(row["file_size_bytes"]),
        )

    def mark_job_running(self, job_id: str) -> None:
        self._request(
            "PATCH",
            "document_processing_jobs",
            query={"id": f"eq.{job_id}"},
            body={"status": "running", "started_at": now_sql()},
            prefer="return=minimal",
        )

    def replace_document_ingestion_outputs(
        self,
        document_id: str,
        chunks: list[ChunkWrite],
        embeddings: list[EmbeddingRecordWrite],
    ) -> None:
        if len(chunks) != len(embeddings):
            raise SupabaseRepositoryError(
                "Chunk and embedding reference counts must match"
            )

        self._request(
            "POST",
            "rpc/replace_document_ingestion_outputs",
            body={
                "p_document_id": document_id,
                "p_chunks": [
                    {
                        "chunk_index": chunk.chunk_index,
                        "content": chunk.content,
                        "metadata": chunk.metadata,
                    }
                    for chunk in chunks
                ],
                "p_embeddings": [
                    {
                        **asdict(embedding),
                        "chunk_index": chunks[index].chunk_index,
                    }
                    for index, embedding in enumerate(embeddings)
                ],
            },
            prefer="return=minimal",
        )

    def mark_job_succeeded(self, job_id: str, metadata: dict[str, object]) -> None:
        self._request(
            "PATCH",
            "document_processing_jobs",
            query={"id": f"eq.{job_id}"},
            body={
                "status": "succeeded",
                "error_message": None,
                "completed_at": now_sql(),
                "metadata": metadata,
            },
            prefer="return=minimal",
        )

    def mark_job_failed(
        self,
        job_id: str,
        failure_code: str,
        metadata: dict[str, object],
    ) -> None:
        self._request(
            "PATCH",
            "document_processing_jobs",
            query={"id": f"eq.{job_id}"},
            body={
                "status": "failed",
                "error_message": "Document processing failed",
                "completed_at": now_sql(),
                "metadata": {**metadata, "failure_code": failure_code},
            },
            prefer="return=minimal",
        )

    def mark_document_processed(self, document_id: str) -> None:
        self._request(
            "PATCH",
            "documents",
            query={"id": f"eq.{document_id}"},
            body={
                "processing_status": "succeeded",
                "processing_failure_code": None,
                "eligibility_status": "eligible",
                "review_outcome": "auto_approved",
            },
            prefer="return=minimal",
        )

    def mark_document_failed(self, document_id: str, failure_code: str) -> None:
        self._request(
            "PATCH",
            "documents",
            query={"id": f"eq.{document_id}"},
            body={
                "processing_status": "failed",
                "processing_failure_code": failure_code,
                "eligibility_status": "limited",
                "review_outcome": "needs_review",
            },
            prefer="return=minimal",
        )

    def _request(
        self,
        method: str,
        table: str,
        query: dict[str, str] | None = None,
        body: Any | None = None,
        prefer: str = "return=representation",
    ) -> Any:
        query_string = f"?{urlencode(query or {})}" if query else ""
        url = f"{self.base_url}/rest/v1/{quote(table)}{query_string}"
        try:
            response = httpx.request(
                method,
                url,
                json=body,
                timeout=30,
                headers={
                    "apikey": self.service_role_key,
                    "authorization": f"Bearer {self.service_role_key}",
                    "content-type": "application/json",
                    "prefer": prefer,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise SupabaseRepositoryError(
                "Supabase ingestion repository request failed"
            ) from exc

        if not response.content:
            return []
        return json.loads(response.text)


def build_local_storage_path(document_id: str, upload_id: str, file_name: str) -> str:
    safe_name = sanitize_file_name(file_name) or "upload.bin"
    return f"{document_id}/{upload_id}-{safe_name}"


def sanitize_file_name(file_name: str) -> str:
    basename = file_name.split("/")[-1].split("\\")[-1]
    safe = "".join(char if char.isalnum() or char in "._-" else "-" for char in basename)
    return safe.strip("-")[:120]


def now_sql() -> str:
    return datetime.now(UTC).isoformat()
