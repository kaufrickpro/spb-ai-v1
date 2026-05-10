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
    MatchCandidateWrite,
    MatchRunRecord,
    MatchSignalSourceWrite,
    ProcessingJobRecord,
    ProfileAccessGrantWrite,
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


class SupabaseMatchingRepository:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self.base_url = supabase_url.rstrip("/")
        self.service_role_key = service_role_key

    def get_match_run(self, match_run_id: str) -> MatchRunRecord | None:
        rows = self._request(
            "GET",
            "match_runs",
            query={
                "id": f"eq.{match_run_id}",
                "select": (
                    "id,direction,requester_profile_id,source_manuscript_id,"
                    "source_publisher_profile_id,input_snapshot"
                ),
                "limit": "1",
            },
        )
        if not rows:
            return None
        row = rows[0]
        return MatchRunRecord(
            id=row["id"],
            direction=row["direction"],
            requester_profile_id=row["requester_profile_id"],
            source_manuscript_id=row.get("source_manuscript_id"),
            source_publisher_profile_id=row.get("source_publisher_profile_id"),
            input_snapshot=row.get("input_snapshot") or {},
        )

    def get_manuscript_matching_source(
        self, manuscript_id: str
    ) -> dict[str, object] | None:
        rows = self._request(
            "GET",
            "manuscripts",
            query={
                "id": f"eq.{manuscript_id}",
                "select": (
                    "id,author_id,title,genre,language,word_count,logline,synopsis,"
                    "subgenres,audience_categories,manuscript_form,declared_themes,"
                    "declared_content_warnings,arc_summary,chapter_summaries,"
                    "sample_document_id,eligibility_status"
                ),
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    def get_publisher_matching_source(
        self, publisher_profile_id: str
    ) -> dict[str, object] | None:
        profile_rows = self._request(
            "GET",
            "profiles",
            query={
                "id": f"eq.{publisher_profile_id}",
                "role": "eq.publisher",
                "select": "id,display_name,eligibility_status",
                "limit": "1",
            },
        )
        if not profile_rows:
            return None
        detail_rows = self._request(
            "GET",
            "publisher_profiles",
            query={
                "profile_id": f"eq.{publisher_profile_id}",
                "select": (
                    "profile_id,publisher_name,focus_genres,accepted_primary_genres,"
                    "accepted_audience_categories,accepted_manuscript_forms,"
                    "submission_guidelines,what_we_are_looking_for,excluded_topics,"
                    "editor_wishlist,imprint_tone,market_positioning,"
                    "recent_acquisitions,best_selling_books"
                ),
                "limit": "1",
            },
        )
        return {**profile_rows[0], **(detail_rows[0] if detail_rows else {})}

    def list_eligible_publishers(self, limit: int) -> list[dict[str, object]]:
        profiles = self._request(
            "GET",
            "profiles",
            query={
                "role": "eq.publisher",
                "eligibility_status": "eq.eligible",
                "select": "id,display_name",
                "limit": str(limit),
            },
        )
        if not profiles:
            return []
        profile_ids = ",".join(profile["id"] for profile in profiles)
        details = self._request(
            "GET",
            "publisher_profiles",
            query={
                "profile_id": f"in.({profile_ids})",
                "select": (
                    "profile_id,publisher_name,focus_genres,accepted_primary_genres,"
                    "accepted_audience_categories,accepted_manuscript_forms,"
                    "submission_guidelines,what_we_are_looking_for,excluded_topics,"
                    "editor_wishlist,imprint_tone,market_positioning,"
                    "recent_acquisitions,best_selling_books"
                ),
            },
        )
        details_by_profile_id = {detail["profile_id"]: detail for detail in details}
        return [
            {**profile, **details_by_profile_id.get(profile["id"], {})}
            for profile in profiles
        ]

    def list_eligible_manuscripts(self, limit: int) -> list[dict[str, object]]:
        manuscripts = self._request(
            "GET",
            "manuscripts",
            query={
                "eligibility_status": "eq.eligible",
                "select": (
                    "id,author_id,title,genre,language,word_count,logline,synopsis,"
                    "subgenres,audience_categories,manuscript_form,declared_themes,"
                    "declared_content_warnings,arc_summary,chapter_summaries,"
                    "sample_document_id"
                ),
                "limit": str(limit),
            },
        )
        if not manuscripts:
            return []
        sample_document_ids = ",".join(
            sorted(
                {
                    row["sample_document_id"]
                    for row in manuscripts
                    if row.get("sample_document_id")
                }
            )
        )
        if not sample_document_ids:
            return []
        documents = self._request(
            "GET",
            "documents",
            query={
                "id": f"in.({sample_document_ids})",
                "processing_status": "eq.succeeded",
                "eligibility_status": "eq.eligible",
                "select": "id",
            },
        )
        eligible_document_ids = {document["id"] for document in documents}
        manuscripts = [
            manuscript
            for manuscript in manuscripts
            if manuscript.get("sample_document_id") in eligible_document_ids
        ]
        if not manuscripts:
            return []
        author_user_ids = ",".join(
            sorted({row["author_id"] for row in manuscripts if row.get("author_id")})
        )
        if not author_user_ids:
            return []
        authors = self._request(
            "GET",
            "profiles",
            query={
                "user_id": f"in.({author_user_ids})",
                "role": "eq.author",
                "eligibility_status": "eq.eligible",
                "select": "id,user_id,display_name,eligibility_status",
            },
        )
        authors_by_user_id = {author["user_id"]: author for author in authors}
        return [
            {
                **manuscript,
                "author_profile_id": authors_by_user_id[manuscript["author_id"]]["id"],
                "author_display_name": authors_by_user_id[manuscript["author_id"]][
                    "display_name"
                ],
            }
            for manuscript in manuscripts
            if manuscript.get("author_id") in authors_by_user_id
        ]

    def upsert_match_signal_source(self, signal: MatchSignalSourceWrite) -> str:
        embedding_record_id = (
            self.upsert_embedding_reference(signal.embedding)
            if signal.embedding is not None
            else None
        )
        existing = self._find_match_signal_source(signal)
        row = {
            "owner_profile_id": signal.owner_profile_id,
            "manuscript_id": signal.manuscript_id,
            "publisher_profile_id": signal.publisher_profile_id,
            "signal_type": signal.signal_type,
            "fingerprint": signal.fingerprint,
            "source_fingerprint": signal.source_fingerprint,
            "status": signal.status,
            "summary": signal.summary,
            "embedding_record_id": embedding_record_id,
            "metadata": signal.metadata,
        }
        if existing is None:
            inserted = self._request(
                "POST",
                "match_signal_sources",
                body=row,
                prefer="return=representation",
            )
            return inserted[0]["id"]

        updated = self._request(
            "PATCH",
            "match_signal_sources",
            query={"id": f"eq.{existing['id']}"},
            body=row,
            prefer="return=representation",
        )
        return updated[0]["id"]

    def upsert_embedding_reference(self, embedding: EmbeddingRecordWrite) -> str:
        rows = self._request(
            "POST",
            "embedding_records",
            query={"on_conflict": "vector_index_name,vector_datapoint_id"},
            body=asdict(embedding),
            prefer="resolution=merge-duplicates,return=representation",
        )
        return rows[0]["id"]

    def insert_match_candidates(self, candidates: list[MatchCandidateWrite]) -> None:
        if not candidates:
            return
        self._request(
            "POST",
            "match_candidates",
            body=[
                {
                    "match_run_id": candidate.match_run_id,
                    "rank": candidate.rank,
                    "candidate_profile_id": candidate.candidate_profile_id,
                    "candidate_manuscript_id": candidate.candidate_manuscript_id,
                    "candidate_type": candidate.candidate_type,
                    "score_band": candidate.score_band,
                    "axis_bands": candidate.axis_bands,
                    "explanation": candidate.explanation,
                    "explanation_status": candidate.explanation_status,
                    "fit_reasons": candidate.fit_reasons,
                    "risk_reasons": candidate.risk_reasons,
                    "score_details": candidate.score_details,
                    "safe_snippets": candidate.safe_snippets,
                    "detail_snapshot": candidate.detail_snapshot,
                }
                for candidate in candidates
            ],
            prefer="return=minimal",
        )

    def insert_profile_access_grants(
        self, grants: list[ProfileAccessGrantWrite]
    ) -> None:
        for grant in grants:
            existing = self._find_profile_access_grant(grant)
            if existing is not None:
                continue
            self._request(
                "POST",
                "profile_access_grants",
                body=asdict(grant),
                prefer="return=minimal",
            )

    def mark_match_run_succeeded(self, match_run_id: str, candidate_count: int) -> None:
        self._request(
            "PATCH",
            "match_runs",
            query={"id": f"eq.{match_run_id}"},
            body={
                "status": "succeeded",
                "candidate_count": candidate_count,
                "failure_code": None,
            },
            prefer="return=minimal",
        )

    def mark_match_run_failed(self, match_run_id: str, failure_code: str) -> None:
        self._request(
            "PATCH",
            "match_runs",
            query={"id": f"eq.{match_run_id}"},
            body={
                "status": "failed",
                "candidate_count": 0,
                "failure_code": failure_code,
            },
            prefer="return=minimal",
        )

    def _find_match_signal_source(
        self, signal: MatchSignalSourceWrite
    ) -> dict[str, object] | None:
        query = {
            "owner_profile_id": f"eq.{signal.owner_profile_id}",
            "signal_type": f"eq.{signal.signal_type}",
            "select": "id",
            "limit": "1",
            "manuscript_id": (
                "is.null" if signal.manuscript_id is None else f"eq.{signal.manuscript_id}"
            ),
            "publisher_profile_id": (
                "is.null"
                if signal.publisher_profile_id is None
                else f"eq.{signal.publisher_profile_id}"
            ),
        }
        rows = self._request("GET", "match_signal_sources", query=query)
        return rows[0] if rows else None

    def _find_profile_access_grant(
        self, grant: ProfileAccessGrantWrite
    ) -> dict[str, object] | None:
        query = {
            "viewer_profile_id": f"eq.{grant.viewer_profile_id}",
            "target_profile_id": f"eq.{grant.target_profile_id}",
            "source": f"eq.{grant.source}",
            "select": "id",
            "limit": "1",
            "manuscript_id": (
                "is.null" if grant.manuscript_id is None else f"eq.{grant.manuscript_id}"
            ),
        }
        rows = self._request("GET", "profile_access_grants", query=query)
        return rows[0] if rows else None

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
                "Supabase matching repository request failed"
            ) from exc

        if not response.content:
            return []
        return json.loads(response.text)


def build_local_storage_path(document_id: str, upload_id: str, file_name: str) -> str:
    safe_name = sanitize_file_name(file_name) or "upload.bin"
    return f"{document_id}/{upload_id}-{safe_name}"


def sanitize_file_name(file_name: str) -> str:
    basename = file_name.split("/")[-1].split("\\")[-1]
    safe = "".join(
        char if char.isascii() and (char.isalnum() or char in "._-") else "-"
        for char in basename
    )
    return safe.strip("-")[:120]


def now_sql() -> str:
    return datetime.now(UTC).isoformat()
