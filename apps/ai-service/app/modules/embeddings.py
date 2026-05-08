from dataclasses import dataclass
from hashlib import sha256
from typing import Protocol

import httpx

from app.modules.config import AiServiceConfig
from app.modules.ingestion import LOCAL_EMBEDDING_MODEL

LOCAL_VECTOR_INDEX_NAME = "local-reference-index"
MAX_VERTEX_SIGNAL_TEXT_CHARS = 8_000


class VertexAdapterError(Exception):
    """Safe provider error for the future matching worker to map."""

    def __init__(self, safe_failure_code: str) -> None:
        super().__init__(safe_failure_code)
        self.safe_failure_code = safe_failure_code


class AccessTokenProvider(Protocol):
    def __call__(self) -> str:
        """Return a bearer token for Google APIs."""


@dataclass(frozen=True)
class MetadataServerTokenProvider:
    http_client: httpx.Client

    def __call__(self) -> str:
        try:
            response = self.http_client.get(
                "http://metadata.google.internal/computeMetadata/v1/"
                "instance/service-accounts/default/token",
                headers={"Metadata-Flavor": "Google"},
            )
            response.raise_for_status()
            token = response.json().get("access_token")
        except (httpx.HTTPError, ValueError) as exc:
            raise VertexAdapterError("vertex_auth_unavailable") from exc

        if not isinstance(token, str) or not token:
            raise VertexAdapterError("vertex_auth_unavailable")
        return token


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


class VertexTextEmbeddingAdapter:
    def __init__(
        self,
        config: AiServiceConfig,
        http_client: httpx.Client | None = None,
        access_token_provider: AccessTokenProvider | None = None,
    ) -> None:
        if not config.vertex_project_id or not config.vertex_location:
            raise VertexAdapterError("vertex_config_missing")
        if not config.embedding_model:
            raise VertexAdapterError("vertex_config_missing")
        self.config = config
        self.http_client = http_client or httpx.Client(timeout=30)
        self.access_token_provider = access_token_provider or MetadataServerTokenProvider(
            self.http_client
        )

    def embed_signal_text(
        self,
        text: str,
        *,
        task_type: str = "RETRIEVAL_DOCUMENT",
        output_dimensionality: int | None = None,
    ) -> list[float]:
        bounded_text = text.strip()
        if not bounded_text or len(bounded_text) > MAX_VERTEX_SIGNAL_TEXT_CHARS:
            raise VertexAdapterError("vertex_embedding_input_invalid")

        payload: dict[str, object] = {
            "instances": [{"content": bounded_text, "task_type": task_type}],
        }
        if output_dimensionality is not None:
            payload["parameters"] = {"outputDimensionality": output_dimensionality}

        try:
            response = self.http_client.post(
                self._predict_url(),
                headers={"authorization": f"Bearer {self.access_token_provider()}"},
                json=payload,
            )
            response.raise_for_status()
            values = response.json()["predictions"][0]["embeddings"]["values"]
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise VertexAdapterError("vertex_embedding_provider_error") from exc

        if not isinstance(values, list) or not values:
            raise VertexAdapterError("vertex_embedding_provider_error")
        try:
            return [float(value) for value in values]
        except (TypeError, ValueError) as exc:
            raise VertexAdapterError("vertex_embedding_provider_error") from exc

    def _predict_url(self) -> str:
        return (
            f"https://{self.config.vertex_location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.config.vertex_project_id}/locations/"
            f"{self.config.vertex_location}/publishers/google/models/"
            f"{self.config.embedding_model}:predict"
        )
