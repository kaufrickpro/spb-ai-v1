import pytest

from app.modules.config import AiServiceConfig
from app.modules.runtime import create_runtime_adapter


def test_local_mode_requires_no_vertex_settings() -> None:
    config = AiServiceConfig(provider_mode="local")

    assert config.provider_mode == "local"


def test_vertex_mode_requires_project_and_location() -> None:
    with pytest.raises(ValueError):
        AiServiceConfig(provider_mode="vertex")


def test_vertex_mode_runtime_is_ready_with_required_settings() -> None:
    config = AiServiceConfig(
        provider_mode="vertex",
        vertex_project_id="project-1",
        vertex_location="europe-west1",
        embedding_model="text-embedding-005",
        vector_index_name="publisher-author-vector-index",
    )

    runtime = create_runtime_adapter(config)

    assert runtime.is_ready()


def test_config_requires_positive_limits() -> None:
    with pytest.raises(ValueError):
        AiServiceConfig(provider_mode="local", max_chunks_per_document=0)


def test_config_requires_embedding_reference_settings() -> None:
    with pytest.raises(ValueError):
        AiServiceConfig(provider_mode="local", vector_index_name=" ")
