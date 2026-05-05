from dataclasses import dataclass
from uuid import NAMESPACE_URL, uuid5

from app.modules.config import AiServiceConfig
from app.modules.embeddings import EmbeddingReferenceProvider, LocalEmbeddingReferenceProvider
from app.modules.ingestion import (
    IngestionCategory,
    IngestionChunk,
    IngestionResult,
    IngestionStatus,
    ProcessingFailureCode,
    base_metadata,
    checksum,
    chunk_text,
    normalize_text,
)
from app.modules.repositories import ChunkWrite, EmbeddingRecordWrite, IngestionRepository
from app.modules.storage import DocumentStorage, StorageReadError


@dataclass(frozen=True)
class IngestionWorker:
    repository: IngestionRepository
    storage: DocumentStorage
    embedding_provider: EmbeddingReferenceProvider
    config: AiServiceConfig

    def process_job(self, job_id: str) -> IngestionResult:
        job = self.repository.get_job(job_id)
        if job is None:
            return failure_result(
                ProcessingFailureCode.UNEXPECTED_PROCESSING_ERROR,
                IngestionCategory.SYSTEM,
            )

        document = self.repository.get_document(job.document_id)
        if document is None:
            failure_code = ProcessingFailureCode.UNEXPECTED_PROCESSING_ERROR
            result = failure_result(failure_code, IngestionCategory.SYSTEM)
            self.repository.mark_job_failed(job.id, failure_code.value, result.metadata)
            return result

        self.repository.mark_job_running(job.id)

        result = self._process_document(job.document_id)
        if result.status == IngestionStatus.SUCCEEDED:
            chunk_writes = [
                ChunkWrite(
                    document_id=job.document_id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.content,
                    checksum=chunk.checksum,
                    metadata={
                        "checksum": chunk.checksum,
                        "chunker": result.metadata["chunker"],
                    },
                )
                for chunk in result.chunks
            ]
            embedding_writes = [
                self._build_embedding_record(job.document_id, chunk)
                for chunk in result.chunks
            ]
            self.repository.replace_document_ingestion_outputs(
                job.document_id,
                chunk_writes,
                embedding_writes,
            )
            self.repository.mark_document_processed(job.document_id)
            self.repository.mark_job_succeeded(job.id, result.metadata)
            return result

        failure_code = result.failure_code or ProcessingFailureCode.UNEXPECTED_PROCESSING_ERROR
        self.repository.mark_document_failed(job.document_id, failure_code.value)
        self.repository.mark_job_failed(job.id, failure_code.value, result.metadata)
        return result

    def _process_document(self, document_id: str) -> IngestionResult:
        document = self.repository.get_document(document_id)
        if document is None:
            return failure_result(
                ProcessingFailureCode.UNEXPECTED_PROCESSING_ERROR,
                IngestionCategory.SYSTEM,
            )

        if document.mime_type != "text/plain":
            return failure_result(
                ProcessingFailureCode.UNSUPPORTED_FILE_TYPE,
                IngestionCategory.USER_CORRECTABLE,
            )

        if document.byte_size > self.config.max_upload_bytes:
            return failure_result(
                ProcessingFailureCode.EXTRACTED_TEXT_TOO_LARGE,
                IngestionCategory.USER_CORRECTABLE,
            )

        try:
            raw_bytes = self.storage.read_bytes(document.storage_path)
        except StorageReadError:
            return failure_result(
                ProcessingFailureCode.DOWNLOAD_FAILED,
                IngestionCategory.SYSTEM,
            )

        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return failure_result(
                ProcessingFailureCode.PARSER_FAILED,
                IngestionCategory.USER_CORRECTABLE,
            )

        normalized = normalize_text(text)
        if not normalized:
            return failure_result(
                ProcessingFailureCode.EMPTY_EXTRACTED_TEXT,
                IngestionCategory.USER_CORRECTABLE,
            )

        if len(normalized) > self.config.max_extracted_characters:
            return failure_result(
                ProcessingFailureCode.EXTRACTED_TEXT_TOO_LARGE,
                IngestionCategory.USER_CORRECTABLE,
                extracted_character_count=len(normalized),
            )

        chunk_contents = chunk_text(normalized)
        if len(chunk_contents) > self.config.max_chunks_per_document:
            return failure_result(
                ProcessingFailureCode.CHUNK_LIMIT_EXCEEDED,
                IngestionCategory.USER_CORRECTABLE,
                extracted_character_count=len(normalized),
            )

        chunks: list[IngestionChunk] = []
        for index, content in enumerate(chunk_contents):
            content_checksum = checksum(content)
            reference = self.embedding_provider.create_reference(
                document_id=document.id,
                chunk_index=index,
                chunk_checksum=content_checksum,
            )
            chunks.append(
                IngestionChunk(
                    chunk_index=index,
                    content=content,
                    checksum=content_checksum,
                    embedding_datapoint_id=reference.vector_datapoint_id,
                )
            )

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
                embedding_model=self.config.embedding_model,
                vector_index_name=self.config.vector_index_name,
            ),
        )

    def _build_embedding_record(
        self,
        document_id: str,
        chunk: IngestionChunk,
    ) -> EmbeddingRecordWrite:
        reference = self.embedding_provider.create_reference(
            document_id=document_id,
            chunk_index=chunk.chunk_index,
            chunk_checksum=chunk.checksum,
        )
        return EmbeddingRecordWrite(
            source_type="document_chunk",
            source_id=str(
                uuid5(NAMESPACE_URL, f"document-chunk:{document_id}:{chunk.chunk_index}")
            ),
            vector_index_name=reference.vector_index_name,
            vector_datapoint_id=reference.vector_datapoint_id,
            embedding_model=reference.embedding_model,
            metadata=reference.metadata,
        )


def create_local_ingestion_worker(
    repository: IngestionRepository,
    storage: DocumentStorage,
    config: AiServiceConfig,
) -> IngestionWorker:
    return IngestionWorker(
        repository=repository,
        storage=storage,
        embedding_provider=LocalEmbeddingReferenceProvider(
            embedding_model=config.embedding_model,
            vector_index_name=config.vector_index_name,
        ),
        config=config,
    )


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
