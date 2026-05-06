import pytest

from app.modules.config import AiServiceConfig
from app.modules.runtime import create_runtime_adapter
from app.modules.supabase_repository import build_local_storage_path


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


def test_deployed_config_rejects_fake_scanner_without_launch_decision() -> None:
    with pytest.raises(ValueError, match="DOCUMENT_SCANNER_LAUNCH_DECISION_ID"):
        AiServiceConfig(
            app_config_mode="staging",
            storage_provider="gcs",
            gcs_bucket_private_uploads="spb-ai-staging-manuscripts",
            supabase_url="https://example.supabase.co",
            supabase_service_role_key="service",
            document_scanner_mode="local_fake",
        )


def test_deployed_config_allows_fake_scanner_with_named_launch_decision() -> None:
    config = AiServiceConfig(
        app_config_mode="production",
        storage_provider="gcs",
        gcs_bucket_private_uploads="spb-ai-prod-manuscripts",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service",
        document_scanner_mode="local_fake",
        document_scanner_launch_decision_id="ADR-STEP9-SCANNER-LAUNCH-DECISION",
    )

    assert config.document_scanner_launch_decision_id == (
        "ADR-STEP9-SCANNER-LAUNCH-DECISION"
    )


def test_deployed_real_scanner_requires_provider_name() -> None:
    with pytest.raises(ValueError, match="DOCUMENT_SCANNER_PROVIDER"):
        AiServiceConfig(
            app_config_mode="staging",
            storage_provider="gcs",
            gcs_bucket_private_uploads="spb-ai-staging-manuscripts",
            supabase_url="https://example.supabase.co",
            supabase_service_role_key="service",
            document_scanner_mode="real",
        )


def test_deployed_real_scanner_config_is_explicit() -> None:
    config = AiServiceConfig(
        app_config_mode="staging",
        storage_provider="gcs",
        gcs_bucket_private_uploads="spb-ai-staging-manuscripts",
        supabase_url="https://example.supabase.co",
        supabase_service_role_key="service",
        document_scanner_mode="real",
        document_scanner_provider="gcs-malware-scanner",
    )

    assert config.document_scanner_provider == "gcs-malware-scanner"


def test_deployed_config_requires_gcs_storage() -> None:
    with pytest.raises(ValueError, match="STORAGE_PROVIDER=gcs"):
        AiServiceConfig(
            app_config_mode="staging",
            document_scanner_mode="real",
            document_scanner_provider="gcs-malware-scanner",
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
