from enum import StrEnum
from hashlib import sha256
from typing import Protocol

from pydantic import BaseModel, Field

MAX_EXTRACTED_CHARACTERS = 250_000
MAX_CHUNKS = 300
TARGET_CHUNK_SIZE = 1_600
HARD_MAX_CHUNK_SIZE = 2_400
CHUNKER_VERSION = "paragraph-v1"
INGESTION_VERSION = "ingestion-v1"
LOCAL_EMBEDDING_MODEL = "local-reference-v1"


class ProcessingFailureCode(StrEnum):
    EMPTY_EXTRACTED_TEXT = "empty_extracted_text"
    UNSUPPORTED_FILE_TYPE = "unsupported_file_type"
    FILE_TYPE_MISMATCH = "file_type_mismatch"
    EXTRACTED_TEXT_TOO_LARGE = "extracted_text_too_large"
    CHUNK_LIMIT_EXCEEDED = "chunk_limit_exceeded"
    DOWNLOAD_FAILED = "download_failed"
    PARSER_FAILED = "parser_failed"
    EMBEDDING_FAILED = "embedding_failed"
    SCANNER_SUSPICIOUS = "scanner_suspicious"
    SCANNER_FAILED = "scanner_failed"
    UNEXPECTED_PROCESSING_ERROR = "unexpected_processing_error"


class IngestionStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class IngestionCategory(StrEnum):
    SUCCEEDED = "succeeded"
    USER_CORRECTABLE = "user_correctable"
    SYSTEM = "system"
    SUSPICIOUS = "suspicious"
    QUARANTINED = "quarantined"


class IngestionChunk(BaseModel):
    chunk_index: int
    content: str
    checksum: str
    embedding_datapoint_id: str


class IngestionResult(BaseModel):
    status: IngestionStatus
    category: IngestionCategory
    failure_code: ProcessingFailureCode | None = None
    extracted_character_count: int = 0
    chunk_count: int = 0
    chunks: list[IngestionChunk] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class IngestionService(Protocol):
    def ingest_document(self, document_id: str) -> None:
        """Ingest a document once storage and parsing are implemented."""


def ingest_text_document(document_id: str, mime_type: str, text: str | None) -> IngestionResult:
    if mime_type != "text/plain":
        return failure_result(
            ProcessingFailureCode.UNSUPPORTED_FILE_TYPE,
            IngestionCategory.USER_CORRECTABLE,
        )

    if text is None:
        return failure_result(
            ProcessingFailureCode.DOWNLOAD_FAILED,
            IngestionCategory.SYSTEM,
        )

    normalized = normalize_text(text)
    if not normalized:
        return failure_result(
            ProcessingFailureCode.EMPTY_EXTRACTED_TEXT,
            IngestionCategory.USER_CORRECTABLE,
        )

    if len(normalized) > MAX_EXTRACTED_CHARACTERS:
        return failure_result(
            ProcessingFailureCode.EXTRACTED_TEXT_TOO_LARGE,
            IngestionCategory.USER_CORRECTABLE,
            extracted_character_count=len(normalized),
        )

    chunk_contents = chunk_text(normalized)
    if len(chunk_contents) > MAX_CHUNKS:
        return failure_result(
            ProcessingFailureCode.CHUNK_LIMIT_EXCEEDED,
            IngestionCategory.USER_CORRECTABLE,
            extracted_character_count=len(normalized),
        )

    chunks = [
        IngestionChunk(
            chunk_index=index,
            content=content,
            checksum=checksum(content),
            embedding_datapoint_id=f"local-document-chunk-{document_id}-{index}",
        )
        for index, content in enumerate(chunk_contents)
    ]

    return IngestionResult(
        status=IngestionStatus.SUCCEEDED,
        category=IngestionCategory.SUCCEEDED,
        extracted_character_count=len(normalized),
        chunk_count=len(chunks),
        chunks=chunks,
        metadata=base_metadata(
            failure_code=None,
            failure_category=None,
            extracted_character_count=len(normalized),
            chunk_count=len(chunks),
        ),
    )


def normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def chunk_text(text: str) -> list[str]:
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        for part in split_oversized_paragraph(paragraph):
            candidate = f"{current}\n\n{part}".strip() if current else part
            if len(candidate) <= TARGET_CHUNK_SIZE:
                current = candidate
                continue

            if current:
                chunks.append(current)
            current = part

    if current:
        chunks.append(current)

    return chunks


def split_oversized_paragraph(paragraph: str) -> list[str]:
    if len(paragraph) <= HARD_MAX_CHUNK_SIZE:
        return [paragraph]

    return [
        paragraph[index : index + HARD_MAX_CHUNK_SIZE].strip()
        for index in range(0, len(paragraph), HARD_MAX_CHUNK_SIZE)
        if paragraph[index : index + HARD_MAX_CHUNK_SIZE].strip()
    ]


def failure_result(
    failure_code: ProcessingFailureCode,
    category: IngestionCategory,
    extracted_character_count: int = 0,
) -> IngestionResult:
    return IngestionResult(
        status=IngestionStatus.FAILED,
        category=category,
        failure_code=failure_code,
        extracted_character_count=extracted_character_count,
        metadata=base_metadata(
            failure_code=failure_code.value,
            failure_category=category.value,
            extracted_character_count=extracted_character_count,
            chunk_count=0,
        ),
    )


def base_metadata(
    failure_code: str | None,
    failure_category: str | None,
    extracted_character_count: int,
    chunk_count: int,
    embedding_model: str = LOCAL_EMBEDDING_MODEL,
    vector_index_name: str = "local-reference-index",
) -> dict[str, object]:
    return {
        "ingestion_version": INGESTION_VERSION,
        "parser": "txt-v1",
        "chunker": CHUNKER_VERSION,
        "scanner": "local-none",
        "scanner_result": "not_scanned",
        "embedding_model": embedding_model,
        "vector_index_name": vector_index_name,
        "extracted_character_count": extracted_character_count,
        "chunk_count": chunk_count,
        "failure_code": failure_code,
        "failure_category": failure_category,
    }


def checksum(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()
