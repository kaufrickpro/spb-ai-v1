from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from app.modules.config import AiServiceConfig
from app.modules.config import load_config
from app.modules.ingestion import IngestionResult, ingest_text_document
from app.modules.runtime import RuntimeAdapter, create_runtime_adapter


class HealthResponse(BaseModel):
    status: str
    service: str


class InternalIngestionRequest(BaseModel):
    job_id: str
    document_id: str
    mime_type: str
    text_content: str | None = None


def create_app(
    config: AiServiceConfig | None = None,
    runtime_adapter: RuntimeAdapter | None = None,
) -> FastAPI:
    resolved_config = config or load_config()
    runtime = runtime_adapter or create_runtime_adapter(resolved_config)
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
        return ingest_text_document(
            document_id=request.document_id,
            mime_type=request.mime_type,
            text=request.text_content,
        )

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


app = create_app()
