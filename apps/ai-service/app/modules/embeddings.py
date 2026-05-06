from dataclasses import dataclass
from hashlib import sha256
from typing import Protocol

from app.modules.ingestion import LOCAL_EMBEDDING_MODEL

LOCAL_VECTOR_INDEX_NAME = "local-reference-index"


@dataclass(frozen=True)
class EmbeddingReference:
    vector_index_name: str
    vector_datapoint_id: str
    embedding_model: str
    metadata: dict[str, object]


class EmbeddingReferenceProvider(Protocol):
    def create_reference(
        self,
        document_id: str,
        chunk_index: int,
        chunk_checksum: str,
    ) -> EmbeddingReference:
        """Create or return an external embedding reference for a chunk."""


@dataclass(frozen=True)
class LocalEmbeddingReferenceProvider:
    embedding_model: str = LOCAL_EMBEDDING_MODEL
    vector_index_name: str = LOCAL_VECTOR_INDEX_NAME

    def create_reference(
        self,
        document_id: str,
        chunk_index: int,
        chunk_checksum: str,
    ) -> EmbeddingReference:
        stable_suffix = sha256(
            f"{document_id}:{chunk_index}:{chunk_checksum}".encode()
        ).hexdigest()[:16]
        return EmbeddingReference(
            vector_index_name=self.vector_index_name,
            vector_datapoint_id=f"local-document-chunk-{document_id}-{chunk_index}-{stable_suffix}",
            embedding_model=self.embedding_model,
            metadata={
                "provider": "local",
                "storage": "reference_only",
                "has_vector_array": False,
            },
        )
