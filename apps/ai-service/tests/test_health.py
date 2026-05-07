from fastapi.testclient import TestClient

from app.main import create_app, create_default_ingestion_worker
from app.modules.config import AiServiceConfig

client = TestClient(create_app(AiServiceConfig(provider_mode="local")))


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai-service"}


def test_ready_endpoint() -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai-service"}


class NotReadyRuntime:
    def is_ready(self) -> bool:
        return False


def test_ready_endpoint_reports_runtime_not_ready() -> None:
    app = create_app(
        AiServiceConfig(provider_mode="local"),
        runtime_adapter=NotReadyRuntime(),
    )
    response = TestClient(app).get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "not_ready", "service": "ai-service"}


def test_internal_matching_endpoint_accepts_trusted_run_id_only() -> None:
    app = create_app(AiServiceConfig(provider_mode="local"))
    response = TestClient(app).post(
        "/internal/matching/run",
        json={"match_run_id": "10000000-0000-4000-8000-000000000001"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "succeeded",
        "candidate_count": 0,
        "failure_code": None,
    }


def test_default_ingestion_worker_uses_local_supabase_settings() -> None:
    worker = create_default_ingestion_worker(
        AiServiceConfig(
            provider_mode="local",
            supabase_url="http://127.0.0.1:54321",
            supabase_service_role_key="service",
        )
    )

    assert worker is not None
