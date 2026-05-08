from typing import Any

import httpx
import pytest

from app.modules.config import AiServiceConfig
from app.modules.scanner import (
    HttpClamAvDocumentScanner,
    LocalFakeDocumentScanner,
    ScannerProviderError,
    build_document_scanner,
    sanitize_scanner_signature,
)


def test_build_document_scanner_uses_local_fake_mode() -> None:
    scanner = build_document_scanner(
        AiServiceConfig(provider_mode="local", local_fake_scanner_result="clean")
    )

    result = scanner.scan_bytes(
        document_id="doc-1",
        mime_type="text/plain",
        byte_size=11,
        content=b"Sample text",
    )

    assert isinstance(scanner, LocalFakeDocumentScanner)
    assert result.scanner_result == "clean"


def test_http_clamav_scanner_sends_safe_request_shape(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, Any]] = []

    def fake_post(
        url: str,
        *,
        content: bytes,
        headers: dict[str, str],
        timeout: float,
    ) -> httpx.Response:
        requests.append(
            {
                "url": url,
                "content": content,
                "headers": headers,
                "timeout": timeout,
            }
        )
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "result": "suspicious",
                "scanner": "clamav",
                "scanner_version": "1.4.0",
                "signature": " Eicar Test Signature ",
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    scanner = HttpClamAvDocumentScanner(
        endpoint="https://scanner.internal/scan",
        token="scanner-token",
        timeout_seconds=7,
    )

    result = scanner.scan_bytes(
        document_id="doc-1",
        mime_type="text/plain",
        byte_size=11,
        content=b"Sample text",
    )

    assert result.scanner_result == "suspicious"
    assert result.safe_metadata() == {
        "scanner": "clamav",
        "scanner_result": "suspicious",
        "scanner_version": "1.4.0",
        "scanner_signature": "Eicar Test Signature",
    }
    assert requests == [
        {
            "url": "https://scanner.internal/scan",
            "content": b"Sample text",
            "headers": {
                "authorization": "Bearer scanner-token",
                "content-type": "application/octet-stream",
                "x-document-id": "doc-1",
                "x-document-mime-type": "text/plain",
                "x-document-byte-size": "11",
            },
            "timeout": 7,
        }
    ]


def test_http_clamav_scanner_can_use_cloud_run_oidc_auth(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requests: list[dict[str, Any]] = []

    def fake_post(
        url: str,
        *,
        content: bytes,
        headers: dict[str, str],
        timeout: float,
    ) -> httpx.Response:
        requests.append(
            {
                "url": url,
                "content": content,
                "headers": headers,
                "timeout": timeout,
            }
        )
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"result": "clean", "scanner": "clamav"},
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    scanner = HttpClamAvDocumentScanner(
        endpoint="https://scanner.internal/scan",
        token="scanner-token",
        timeout_seconds=7,
        cloud_run_audience="https://scanner.internal",
        id_token_fetcher=lambda audience: f"id-token-for-{audience}",
    )

    result = scanner.scan_bytes(
        document_id="doc-1",
        mime_type="text/plain",
        byte_size=11,
        content=b"Sample text",
    )

    assert result.scanner_result == "clean"
    assert requests == [
        {
            "url": "https://scanner.internal/scan",
            "content": b"Sample text",
            "headers": {
                "authorization": "Bearer id-token-for-https://scanner.internal",
                "content-type": "application/octet-stream",
                "x-document-id": "doc-1",
                "x-document-mime-type": "text/plain",
                "x-document-byte-size": "11",
                "x-scanner-token": "scanner-token",
            },
            "timeout": 7,
        }
    ]


def test_http_clamav_scanner_rejects_unknown_response_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(
        url: str,
        *,
        content: bytes,
        headers: dict[str, str],
        timeout: float,
    ) -> httpx.Response:
        _ = (url, content, headers, timeout)
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={"result": "unknown"},
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    scanner = HttpClamAvDocumentScanner(
        endpoint="https://scanner.internal/scan",
        token="scanner-token",
        timeout_seconds=7,
    )

    with pytest.raises(ScannerProviderError) as exc_info:
        scanner.scan_bytes(
            document_id="doc-1",
            mime_type="text/plain",
            byte_size=11,
            content=b"Sample text",
        )

    assert exc_info.value.error_type == "invalid_response"


def test_http_clamav_scanner_maps_timeouts_to_provider_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(
        url: str,
        *,
        content: bytes,
        headers: dict[str, str],
        timeout: float,
    ) -> httpx.Response:
        _ = (url, content, headers, timeout)
        raise httpx.TimeoutException("scanner timed out")

    monkeypatch.setattr(httpx, "post", fake_post)
    scanner = HttpClamAvDocumentScanner(
        endpoint="https://scanner.internal/scan",
        token="scanner-token",
        timeout_seconds=7,
    )

    with pytest.raises(ScannerProviderError) as exc_info:
        scanner.scan_bytes(
            document_id="doc-1",
            mime_type="text/plain",
            byte_size=11,
            content=b"Sample text",
        )

    assert exc_info.value.error_type == "timeout"


def test_http_clamav_scanner_maps_http_errors_to_provider_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(
        url: str,
        *,
        content: bytes,
        headers: dict[str, str],
        timeout: float,
    ) -> httpx.Response:
        _ = (content, headers, timeout)
        return httpx.Response(503, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    scanner = HttpClamAvDocumentScanner(
        endpoint="https://scanner.internal/scan",
        token="scanner-token",
        timeout_seconds=7,
    )

    with pytest.raises(ScannerProviderError) as exc_info:
        scanner.scan_bytes(
            document_id="doc-1",
            mime_type="text/plain",
            byte_size=11,
            content=b"Sample text",
        )

    assert exc_info.value.error_type == "http_error"


def test_scanner_signature_is_bounded_and_normalized() -> None:
    sanitized = sanitize_scanner_signature(" signature\n" * 40)

    assert len(sanitized) == 200
    assert "\n" not in sanitized
    assert sanitized.startswith("signature signature")
