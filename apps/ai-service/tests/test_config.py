from typing import Any

import pytest

from app.modules.config import AiServiceConfig
from app.modules.runtime import create_runtime_adapter
from app.modules.supabase_repository import build_local_storage_path


def test_local_mode_requires_no_vertex_settings() -> None:
    config = AiServiceConfig(provider_mode="local")

    assert config.provider_mode == "local"


def test_vertex_mode_requires_project_and_location() -> None:
    with pytest.raises(ValueError, match="Vertex mode requires"):
        AiServiceConfig(provider_mode="vertex")


def test_vertex_mode_runtime_is_ready_with_required_settings() -> None:
    config = AiServiceConfig(
        provider_mode="vertex",
        vertex_project_id="project-1",
        vertex_location="europe-west1",
        embedding_model="text-embedding-005",
        vector_index_name="publisher-author-vector-index",
        vector_index_id="123456789",
        vector_index_endpoint_id="987654321",
        vector_deployed_index_id="publisher_author_staging_v1",
        vector_psc_network="projects/project-1/global/networks/matching-vpc",
        explanation_provider="vertex_gemini",
        gemini_explanation_model="gemini-2.5-flash",
    )

    runtime = create_runtime_adapter(config)

    assert runtime.is_ready()


def test_vertex_gemini_explanations_require_model_settings() -> None:
    with pytest.raises(ValueError, match="Vertex/Gemini explanations"):
        AiServiceConfig(
            explanation_provider="vertex_gemini",
            vertex_project_id="project-1",
            vertex_location="europe-west1",
        )


def test_vertex_gemini_explanation_config_is_explicit() -> None:
    config = AiServiceConfig(
        explanation_provider="vertex_gemini",
        vertex_project_id="project-1",
        vertex_location="europe-west1",
        gemini_explanation_model="gemini-2.5-flash",
    )

    assert config.gemini_explanation_model == "gemini-2.5-flash"


def test_config_requires_positive_limits() -> None:
    with pytest.raises(ValueError):
        AiServiceConfig(provider_mode="local", max_chunks_per_document=0)


def test_sentry_sample_rate_must_be_between_zero_and_one() -> None:
    with pytest.raises(ValueError, match="SENTRY_TRACES_SAMPLE_RATE"):
        AiServiceConfig(sentry_traces_sample_rate=1.5)


def test_sentry_release_metadata_is_explicit() -> None:
    config = AiServiceConfig(
        sentry_dsn="https://public@example.ingest.sentry.io/1",
        sentry_environment="staging",
        sentry_release="ai-service@test-sha",
        sentry_traces_sample_rate=0.2,
    )

    assert config.sentry_dsn == "https://public@example.ingest.sentry.io/1"
    assert config.sentry_environment == "staging"
    assert config.sentry_release == "ai-service@test-sha"
    assert config.sentry_traces_sample_rate == 0.2


def test_config_requires_embedding_reference_settings() -> None:
    with pytest.raises(ValueError):
        AiServiceConfig(provider_mode="local", vector_index_name=" ")


def test_deployed_config_rejects_local_matching_provider() -> None:
    with pytest.raises(ValueError, match="AI_PROVIDER_MODE=vertex"):
        AiServiceConfig(**deployed_config_kwargs(provider_mode="local"))


def test_deployed_config_requires_vertex_gemini_explanations() -> None:
    with pytest.raises(ValueError, match="MATCH_EXPLANATION_PROVIDER=vertex_gemini"):
        AiServiceConfig(**deployed_config_kwargs(explanation_provider="disabled"))


def test_deployed_vertex_config_requires_vector_search_ids() -> None:
    with pytest.raises(ValueError, match="VERTEX_AI_INDEX_ENDPOINT_ID"):
        AiServiceConfig(**deployed_config_kwargs(vector_index_endpoint_id=None))


def test_deployed_vertex_config_requires_network_or_query_host() -> None:
    with pytest.raises(ValueError, match="VERTEX_AI_PSC_NETWORK"):
        AiServiceConfig(
            **deployed_config_kwargs(
                vector_psc_network=None,
                vector_search_query_host=None,
            )
        )


def test_deployed_vertex_config_is_explicit() -> None:
    config = AiServiceConfig(**deployed_config_kwargs())

    assert config.provider_mode == "vertex"
    assert config.explanation_provider == "vertex_gemini"
    assert config.vector_index_id == "6107839868853813248"
    assert config.vector_index_endpoint_id == "737156575726141440"
    assert config.vector_deployed_index_id == "publisher_author_staging_v1"


def test_deployed_config_rejects_fake_scanner_without_launch_decision() -> None:
    with pytest.raises(ValueError, match="DOCUMENT_SCANNER_LAUNCH_DECISION_ID"):
        AiServiceConfig(
            **deployed_config_kwargs(
                document_scanner_mode="local_fake",
                document_scanner_provider=None,
                document_scanner_endpoint=None,
                document_scanner_token=None,
                document_scanner_timeout_seconds=None,
            )
        )


def test_deployed_config_allows_fake_scanner_with_named_launch_decision() -> None:
    config = AiServiceConfig(
        **deployed_config_kwargs(
            app_config_mode="production",
            gcs_bucket_private_uploads="spb-ai-prod-manuscripts",
            document_scanner_mode="local_fake",
            document_scanner_launch_decision_id="ADR-STEP9-SCANNER-LAUNCH-DECISION",
            document_scanner_provider=None,
            document_scanner_endpoint=None,
            document_scanner_token=None,
            document_scanner_timeout_seconds=None,
        )
    )

    assert config.document_scanner_launch_decision_id == (
        "ADR-STEP9-SCANNER-LAUNCH-DECISION"
    )


def test_deployed_real_scanner_requires_provider_name() -> None:
    with pytest.raises(ValueError, match="DOCUMENT_SCANNER_PROVIDER"):
        AiServiceConfig(
            **deployed_config_kwargs(
                document_scanner_mode="real",
                document_scanner_provider=None,
            )
        )


def test_real_scanner_requires_http_clamav_settings() -> None:
    with pytest.raises(ValueError, match="DOCUMENT_SCANNER_PROVIDER=http-clamav"):
        AiServiceConfig(
            **deployed_config_kwargs(
                document_scanner_mode="real",
                document_scanner_provider="http-clamav",
                document_scanner_endpoint=None,
                document_scanner_token=None,
                document_scanner_timeout_seconds=None,
            )
        )


def test_deployed_real_scanner_config_is_explicit() -> None:
    config = AiServiceConfig(**deployed_config_kwargs())

    assert config.document_scanner_provider == "http-clamav"
    assert config.document_scanner_endpoint == "https://scanner.internal/scan"


def test_deployed_real_scanner_can_use_cloud_run_audience() -> None:
    config = AiServiceConfig(
        **deployed_config_kwargs(
            document_scanner_cloud_run_audience="https://scanner.internal",
        )
    )

    assert config.document_scanner_cloud_run_audience == "https://scanner.internal"


def test_real_scanner_rejects_local_fake_result_configuration() -> None:
    with pytest.raises(ValueError, match="LOCAL_FAKE_SCANNER_RESULT"):
        AiServiceConfig(
            document_scanner_mode="real",
            document_scanner_provider="http-clamav",
            document_scanner_endpoint="https://scanner.internal/scan",
            document_scanner_token="scanner-token",
            document_scanner_timeout_seconds=5,
            local_fake_scanner_result="suspicious",
        )


def test_deployed_fake_scanner_rejects_local_simulation_outcomes() -> None:
    with pytest.raises(ValueError, match="LOCAL_FAKE_SCANNER_RESULT"):
        AiServiceConfig(
            **deployed_config_kwargs(
                document_scanner_mode="local_fake",
                document_scanner_launch_decision_id="ADR-STEP9-SCANNER-LAUNCH-DECISION",
                document_scanner_provider=None,
                document_scanner_endpoint=None,
                document_scanner_token=None,
                document_scanner_timeout_seconds=None,
                local_fake_scanner_result="clean",
            )
        )


def test_scanner_timeout_must_be_positive() -> None:
    with pytest.raises(ValueError, match="DOCUMENT_SCANNER_TIMEOUT_SECONDS"):
        AiServiceConfig(
            document_scanner_mode="real",
            document_scanner_provider="http-clamav",
            document_scanner_endpoint="https://scanner.internal/scan",
            document_scanner_token="scanner-token",
            document_scanner_timeout_seconds=0,
        )


def test_deployed_config_requires_gcs_storage() -> None:
    with pytest.raises(ValueError, match="STORAGE_PROVIDER=gcs"):
        AiServiceConfig(
            **deployed_config_kwargs(
                storage_provider="local",
                gcs_bucket_private_uploads=None,
            )
        )


def test_gcs_storage_requires_bucket() -> None:
    with pytest.raises(ValueError, match="GCS_BUCKET_PRIVATE_UPLOADS"):
        AiServiceConfig(storage_provider="gcs")


def test_local_storage_path_matches_api_upload_layout() -> None:
    assert (
        build_local_storage_path(
            document_id="doc-1",
            upload_id="upload-1",
            file_name="../Sample Draft!.txt",
        )
        == "doc-1/upload-1-Sample-Draft-.txt"
    )


def deployed_config_kwargs(**overrides: object) -> dict[str, Any]:
    values: dict[str, Any] = {
        "app_config_mode": "staging",
        "provider_mode": "vertex",
        "storage_provider": "gcs",
        "gcs_bucket_private_uploads": "spb-ai-staging-manuscripts",
        "supabase_url": "https://example.supabase.co",
        "supabase_service_role_key": "service",
        "document_scanner_mode": "real",
        "document_scanner_provider": "http-clamav",
        "document_scanner_endpoint": "https://scanner.internal/scan",
        "document_scanner_token": "scanner-token",
        "document_scanner_timeout_seconds": 5,
        "vertex_project_id": "spb-ai",
        "vertex_location": "europe-west3",
        "embedding_model": "gemini-embedding-001",
        "vector_index_name": "publisher-author-staging-vector-index",
        "vector_index_id": "6107839868853813248",
        "vector_index_endpoint_id": "737156575726141440",
        "vector_deployed_index_id": "publisher_author_staging_v1",
        "vector_psc_network": "projects/spb-ai/global/networks/spb-ai-staging-vpc",
        "explanation_provider": "vertex_gemini",
        "gemini_explanation_model": "gemini-2.5-flash",
    }
    values.update(overrides)
    return values
