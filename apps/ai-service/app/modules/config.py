import os
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

AppConfigMode = Literal["local", "staging", "production"]
ProviderMode = Literal["local", "vertex"]
ScannerMode = Literal["local_fake", "real"]
StorageProvider = Literal["local", "gcs"]


class AiServiceConfig(BaseModel):
    app_config_mode: AppConfigMode = Field(default="local")
    provider_mode: ProviderMode = Field(default="local")
    storage_provider: StorageProvider = Field(default="local")
    internal_token: str | None = None
    local_storage_root: Path = Field(default=Path("../api/local-uploads"))
    gcs_bucket_private_uploads: str | None = None
    max_upload_bytes: int = Field(default=26_214_400)
    max_extracted_characters: int = Field(default=250_000)
    max_chunks_per_document: int = Field(default=300)
    embedding_model: str = Field(default="local-reference-v1")
    vector_index_name: str = Field(default="local-reference-index")
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    document_scanner_mode: ScannerMode = Field(default="local_fake")
    document_scanner_provider: str | None = None
    document_scanner_launch_decision_id: str | None = None
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

    @field_validator("document_scanner_provider", "document_scanner_launch_decision_id")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def require_deployed_config(self) -> "AiServiceConfig":
        if self.storage_provider == "gcs" and not self.gcs_bucket_private_uploads:
            raise ValueError("STORAGE_PROVIDER=gcs requires GCS_BUCKET_PRIVATE_UPLOADS")

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

        if self.app_config_mode != "local":
            if self.storage_provider != "gcs":
                raise ValueError("Staging/production must use STORAGE_PROVIDER=gcs")
            if not self.supabase_url or not self.supabase_service_role_key:
                raise ValueError(
                    "Staging/production AI service requires SUPABASE_URL and "
                    "SUPABASE_SERVICE_ROLE_KEY"
                )
            if self.document_scanner_mode == "real":
                if not self.document_scanner_provider:
                    raise ValueError(
                        "DOCUMENT_SCANNER_PROVIDER is required when "
                        "DOCUMENT_SCANNER_MODE=real"
                    )
            elif not self.document_scanner_launch_decision_id:
                raise ValueError(
                    "Staging/production cannot use DOCUMENT_SCANNER_MODE=local_fake "
                    "without DOCUMENT_SCANNER_LAUNCH_DECISION_ID"
                )
        return self


def load_config() -> AiServiceConfig:
    load_local_env_file()
    try:
        return AiServiceConfig(
            app_config_mode=parse_app_config_mode(
                os.getenv("APP_CONFIG_MODE", os.getenv("APP_ENV", "local"))
            ),
            provider_mode=parse_provider_mode(os.getenv("AI_PROVIDER_MODE", "local")),
            storage_provider=parse_storage_provider(os.getenv("STORAGE_PROVIDER", "local")),
            internal_token=os.getenv("AI_INTERNAL_TOKEN"),
            local_storage_root=Path(os.getenv("LOCAL_STORAGE_ROOT", "../api/local-uploads")),
            gcs_bucket_private_uploads=os.getenv("GCS_BUCKET_PRIVATE_UPLOADS"),
            max_upload_bytes=int(os.getenv("MAX_UPLOAD_BYTES", "26214400")),
            max_extracted_characters=int(os.getenv("MAX_EXTRACTED_CHARACTERS", "250000")),
            max_chunks_per_document=int(os.getenv("MAX_CHUNKS_PER_DOCUMENT", "300")),
            embedding_model=os.getenv("VERTEX_AI_EMBEDDING_MODEL", "local-reference-v1"),
            vector_index_name=os.getenv("VERTEX_AI_VECTOR_INDEX", "local-reference-index"),
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
            document_scanner_mode=parse_scanner_mode(
                os.getenv("DOCUMENT_SCANNER_MODE", "local_fake")
            ),
            document_scanner_provider=os.getenv("DOCUMENT_SCANNER_PROVIDER"),
            document_scanner_launch_decision_id=os.getenv(
                "DOCUMENT_SCANNER_LAUNCH_DECISION_ID"
            ),
            vertex_project_id=os.getenv("VERTEX_PROJECT_ID"),
            vertex_location=os.getenv("VERTEX_LOCATION"),
        )
    except (ValueError, ValidationError) as exc:
        raise RuntimeError("Invalid AI service configuration") from exc


def parse_provider_mode(value: str) -> ProviderMode:
    if value == "local":
        return "local"
    if value == "vertex":
        return "vertex"
    raise ValueError("AI_PROVIDER_MODE must be local or vertex")


def parse_storage_provider(value: str) -> StorageProvider:
    if value == "local":
        return "local"
    if value == "gcs":
        return "gcs"
    raise ValueError("STORAGE_PROVIDER must be local or gcs")


def parse_app_config_mode(value: str) -> AppConfigMode:
    if value == "local":
        return "local"
    if value == "staging":
        return "staging"
    if value == "production":
        return "production"
    raise ValueError("APP_CONFIG_MODE must be local, staging, or production")


def parse_scanner_mode(value: str) -> ScannerMode:
    if value == "local_fake":
        return "local_fake"
    if value == "real":
        return "real"
    raise ValueError("DOCUMENT_SCANNER_MODE must be local_fake or real")


def load_local_env_file() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
