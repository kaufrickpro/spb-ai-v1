import os
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator


class AiServiceConfig(BaseModel):
    provider_mode: Literal["local", "vertex"] = Field(default="local")
    internal_token: str | None = None
    local_storage_root: Path = Field(default=Path("local-storage"))
    max_upload_bytes: int = Field(default=26_214_400)
    max_extracted_characters: int = Field(default=250_000)
    max_chunks_per_document: int = Field(default=300)
    embedding_model: str = Field(default="local-reference-v1")
    vector_index_name: str = Field(default="local-reference-index")
    vertex_project_id: str | None = None
    vertex_location: str | None = None

    @field_validator(
        "max_upload_bytes",
        "max_extracted_characters",
        "max_chunks_per_document",
    )
    @classmethod
    def require_positive_limit(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("AI service numeric limits must be positive")
        return value

    @field_validator("embedding_model", "vector_index_name")
    @classmethod
    def require_non_empty_provider_value(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Embedding provider settings must be non-empty")
        return value

    @model_validator(mode="after")
    def require_vertex_config(self) -> "AiServiceConfig":
        if self.provider_mode == "vertex" and (
            not self.vertex_project_id
            or not self.vertex_location
            or not self.embedding_model
            or not self.vector_index_name
        ):
            raise ValueError(
                "Vertex mode requires VERTEX_PROJECT_ID, VERTEX_LOCATION, "
                "VERTEX_AI_EMBEDDING_MODEL, and VERTEX_AI_VECTOR_INDEX"
            )
        return self


def load_config() -> AiServiceConfig:
    try:
        return AiServiceConfig(
            provider_mode=os.getenv("AI_PROVIDER_MODE", "local"),
            internal_token=os.getenv("AI_INTERNAL_TOKEN"),
            local_storage_root=Path(os.getenv("LOCAL_STORAGE_ROOT", "local-storage")),
            max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "26214400")),
            max_extracted_characters=int(os.getenv("MAX_EXTRACTED_CHARACTERS", "250000")),
            max_chunks_per_document=int(os.getenv("MAX_CHUNKS_PER_DOCUMENT", "300")),
            embedding_model=os.getenv("VERTEX_AI_EMBEDDING_MODEL", "local-reference-v1"),
            vector_index_name=os.getenv("VERTEX_AI_VECTOR_INDEX", "local-reference-index"),
            vertex_project_id=os.getenv("VERTEX_PROJECT_ID"),
            vertex_location=os.getenv("VERTEX_LOCATION"),
        )
    except (ValueError, ValidationError) as exc:
        raise RuntimeError("Invalid AI service configuration") from exc
