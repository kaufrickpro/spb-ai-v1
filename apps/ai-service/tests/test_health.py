from fastapi.testclient import TestClient

from app.main import create_app
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
