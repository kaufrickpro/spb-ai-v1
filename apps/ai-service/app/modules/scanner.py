from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, Protocol

import google.auth.transport.requests
import google.oauth2.id_token
import httpx
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from app.modules.config import AiServiceConfig

ScannerResultValue = Literal["not_scanned", "clean", "suspicious", "quarantined"]
LocalFakeScannerResult = Literal[
    "not_scanned",
    "clean",
    "suspicious",
    "quarantined",
    "scanner_failed",
]

MAX_SCANNER_SIGNATURE_LENGTH = 200
SCANNER_PROVIDER_HTTP_CLAMAV = "http-clamav"


class ScannerProviderError(Exception):
    def __init__(self, error_type: str) -> None:
        super().__init__(error_type)
        self.error_type = error_type


@dataclass(frozen=True)
class ScannerResult:
    scanner: str
    scanner_result: ScannerResultValue
    scanner_version: str | None = None
    scanner_signature: str | None = None

    def safe_metadata(self) -> dict[str, object]:
        metadata: dict[str, object] = {
            "scanner": self.scanner,
            "scanner_result": self.scanner_result,
        }
        if self.scanner_version:
            metadata["scanner_version"] = self.scanner_version
        if self.scanner_result != "clean" and self.scanner_signature:
            metadata["scanner_signature"] = sanitize_scanner_signature(
                self.scanner_signature
            )
        return metadata


class DocumentScanner(Protocol):
    def scan_bytes(
        self,
        *,
        document_id: str,
        mime_type: str,
        byte_size: int,
        content: bytes,
    ) -> ScannerResult:
        """Scan trusted document bytes before parsing content."""


@dataclass(frozen=True)
class LocalFakeDocumentScanner:
    result: LocalFakeScannerResult = "not_scanned"

    def scan_bytes(
        self,
        *,
        document_id: str,
        mime_type: str,
        byte_size: int,
        content: bytes,
    ) -> ScannerResult:
        _ = (document_id, mime_type, byte_size, content)
        if self.result == "scanner_failed":
            raise ScannerProviderError("local_fake_failure")
        if self.result == "not_scanned":
            return ScannerResult(scanner="local-fake", scanner_result="not_scanned")
        if self.result == "clean":
            return ScannerResult(scanner="local-fake", scanner_result="clean")
        if self.result == "suspicious":
            return ScannerResult(scanner="local-fake", scanner_result="suspicious")
        if self.result == "quarantined":
            return ScannerResult(scanner="local-fake", scanner_result="quarantined")
        raise ScannerProviderError("invalid_local_fake_result")


class HttpClamAvScannerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    result: Literal["clean", "suspicious", "quarantined"]
    scanner: str | None = "clamav"
    scanner_version: str | None = None
    signature: str | None = None

    @field_validator("scanner", "scanner_version", "signature")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


@dataclass(frozen=True)
class HttpClamAvDocumentScanner:
    endpoint: str
    token: str
    timeout_seconds: float
    cloud_run_audience: str | None = None
    id_token_fetcher: Callable[[str], str] | None = None

    def scan_bytes(
        self,
        *,
        document_id: str,
        mime_type: str,
        byte_size: int,
        content: bytes,
    ) -> ScannerResult:
        try:
            headers = self._build_headers(
                document_id=document_id,
                mime_type=mime_type,
                byte_size=byte_size,
            )
        except Exception as exc:
            raise ScannerProviderError("auth_error") from exc

        try:
            response = httpx.post(
                self.endpoint,
                content=content,
                headers=headers,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            payload = HttpClamAvScannerResponse.model_validate_json(response.text)
        except httpx.TimeoutException as exc:
            raise ScannerProviderError("timeout") from exc
        except httpx.HTTPStatusError as exc:
            raise ScannerProviderError("http_error") from exc
        except httpx.HTTPError as exc:
            raise ScannerProviderError("provider_error") from exc
        except ValidationError as exc:
            raise ScannerProviderError("invalid_response") from exc

        return ScannerResult(
            scanner=payload.scanner or "clamav",
            scanner_result=payload.result,
            scanner_version=payload.scanner_version,
            scanner_signature=payload.signature,
        )

    def _build_headers(
        self,
        *,
        document_id: str,
        mime_type: str,
        byte_size: int,
    ) -> dict[str, str]:
        headers = {
            "content-type": "application/octet-stream",
            "x-document-id": document_id,
            "x-document-mime-type": mime_type,
            "x-document-byte-size": str(byte_size),
        }

        if self.cloud_run_audience:
            headers["authorization"] = (
                f"Bearer {self._fetch_id_token(self.cloud_run_audience)}"
            )
            headers["x-scanner-token"] = self.token
            return headers

        headers["authorization"] = f"Bearer {self.token}"
        return headers

    def _fetch_id_token(self, audience: str) -> str:
        if self.id_token_fetcher:
            return self.id_token_fetcher(audience)

        request = google.auth.transport.requests.Request()
        return google.oauth2.id_token.fetch_id_token(request, audience)


def build_document_scanner(config: AiServiceConfig) -> DocumentScanner:
    if config.document_scanner_mode == "local_fake":
        return LocalFakeDocumentScanner(result=config.local_fake_scanner_result)

    if config.document_scanner_provider == SCANNER_PROVIDER_HTTP_CLAMAV:
        if (
            not config.document_scanner_endpoint
            or not config.document_scanner_token
            or config.document_scanner_timeout_seconds is None
        ):
            raise ValueError(
                "DOCUMENT_SCANNER_PROVIDER=http-clamav requires "
                "DOCUMENT_SCANNER_ENDPOINT, DOCUMENT_SCANNER_TOKEN, and "
                "DOCUMENT_SCANNER_TIMEOUT_SECONDS"
            )
        return HttpClamAvDocumentScanner(
            endpoint=config.document_scanner_endpoint,
            token=config.document_scanner_token,
            timeout_seconds=config.document_scanner_timeout_seconds,
            cloud_run_audience=config.document_scanner_cloud_run_audience,
        )

    raise ValueError(
        "DOCUMENT_SCANNER_PROVIDER must be http-clamav when "
        "DOCUMENT_SCANNER_MODE=real"
    )


def sanitize_scanner_signature(value: str) -> str:
    normalized = " ".join(value.split())
    return normalized[:MAX_SCANNER_SIGNATURE_LENGTH]
