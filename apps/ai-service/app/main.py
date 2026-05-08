from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict

from app.modules.config import AiServiceConfig, load_config
from app.modules.ingestion import IngestionResult
from app.modules.ingestion_worker import IngestionWorker, create_local_ingestion_worker
from app.modules.matching import MatchingResult, MatchingWorker
from app.modules.runtime import RuntimeAdapter, create_runtime_adapter
from app.modules.storage import GcsDocumentStorage, LocalFileStorage
from app.modules.supabase_repository import SupabaseIngestionRepository


class HealthResponse(BaseModel):
    status: str
    service: str


class InternalIngestionRequest(BaseModel):
    job_id: str


class InternalMatchingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_run_id: str


def create_app(
    config: AiServiceConfig | None = None,
    runtime_adapter: RuntimeAdapter | None = None,
    ingestion_worker: IngestionWorker | None = None,
    matching_worker: MatchingWorker | None = None,
) -> FastAPI:
    resolved_config = config or load_config()
    runtime = runtime_adapter or create_runtime_adapter(resolved_config)
    resolved_worker = ingestion_worker or create_default_ingestion_worker(resolved_config)
    app = FastAPI(title="AI Service", version="0.1.0")

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok", service="ai-service")

    @app.get("/ready", response_model=HealthResponse)
    def ready() -> HealthResponse:
        status = "ok" if runtime.is_ready() else "not_ready"
        return HealthResponse(status=status, service="ai-service")

    @app.post("/internal/ingestion/run", response_model=IngestionResult)
    def run_ingestion(
        request: InternalIngestionRequest,
        authorization: str | None = Header(default=None),
    ) -> IngestionResult:
        require_internal_auth(resolved_config, authorization)
        if resolved_worker is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Ingestion worker is not configured",
            )
        return resolved_worker.process_job(request.job_id)

    @app.post("/internal/matching/run", response_model=MatchingResult)
    def run_matching(
        request: InternalMatchingRequest,
        authorization: str | None = Header(default=None),
    ) -> MatchingResult:
        require_internal_auth(resolved_config, authorization)
        if matching_worker is not None:
            return matching_worker.process_run(request.match_run_id)
        return MatchingResult(status="succeeded", candidate_count=0)

    return app


def require_internal_auth(config: AiServiceConfig, authorization: str | None) -> None:
    if not config.internal_token:
        return

    expected = f"Bearer {config.internal_token}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal token",
        )


def create_default_ingestion_worker(config: AiServiceConfig) -> IngestionWorker | None:
    if not config.supabase_url or not config.supabase_service_role_key:
        return None

    return create_local_ingestion_worker(
        repository=SupabaseIngestionRepository(
            config.supabase_url,
            config.supabase_service_role_key,
        ),
        storage=create_document_storage(config),
        config=config,
    )


def create_document_storage(config: AiServiceConfig) -> LocalFileStorage | GcsDocumentStorage:
    if config.storage_provider == "gcs":
        return GcsDocumentStorage(config.gcs_bucket_private_uploads or "")

    return LocalFileStorage(config.local_storage_root)


app = create_app()
