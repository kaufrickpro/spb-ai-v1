from __future__ import annotations

from typing import Any, cast
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from sentry_sdk.types import Event, Hint

from app.modules.config import AiServiceConfig

REDACTED = "[Filtered]"

SENSITIVE_KEY_PARTS = (
    "authorization",
    "cookie",
    "token",
    "secret",
    "signature",
    "apikey",
    "servicerole",
    "signedurl",
    "downloadurl",
    "uploadurl",
    "sampleurl",
    "manuscripttext",
    "documenttext",
    "documentchunk",
    "chunktext",
    "rawtext",
    "fulltext",
    "extractedtext",
    "contact",
    "recipient",
    "email",
    "phone",
    "card",
    "cvv",
    "pan",
)

SENSITIVE_QUERY_KEY_PARTS = (
    "token",
    "signature",
    "credential",
    "key",
    "secret",
    "x-goog-signature",
    "x-goog-credential",
    "x-goog-security-token",
)


def initialize_sentry(config: AiServiceConfig) -> None:
    if not config.sentry_dsn:
        return

    sentry_sdk.init(
        dsn=config.sentry_dsn,
        environment=config.sentry_environment,
        release=config.sentry_release,
        send_default_pii=False,
        traces_sample_rate=config.sentry_traces_sample_rate,
        integrations=[FastApiIntegration(), HttpxIntegration()],
        before_send=scrub_sentry_event,
    )
    sentry_sdk.set_tag("service", "ai-service")


def scrub_sentry_event(event: Event, hint: Hint | None = None) -> Event:
    _ = hint
    return cast(Event, _scrub_value(event))


def _scrub_value(value: Any) -> Any:
    if isinstance(value, str):
        return _scrub_string(value)

    if isinstance(value, list):
        return [_scrub_value(item) for item in value]

    if isinstance(value, dict):
        return {
            key: REDACTED if _should_redact_key(str(key)) else _scrub_value(nested)
            for key, nested in value.items()
        }

    return value


def _should_redact_key(key: str) -> bool:
    normalized = "".join(character for character in key.lower() if character.isalnum())
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)


def _scrub_string(value: str) -> str:
    if "X-Goog-Signature" in value or "X-Goog-Credential" in value:
        return REDACTED

    if "service_role" in value.lower() or "sentry_auth_token" in value.lower():
        return REDACTED

    return _scrub_url(value)


def _scrub_url(value: str) -> str:
    parsed = urlsplit(value)
    if not parsed.scheme or not parsed.netloc:
        return value

    query = parse_qsl(parsed.query, keep_blank_values=True)
    changed = False
    scrubbed_query: list[tuple[str, str]] = []

    for key, nested_value in query:
        normalized = key.lower()
        if any(part in normalized for part in SENSITIVE_QUERY_KEY_PARTS):
            scrubbed_query.append((key, REDACTED))
            changed = True
        else:
            scrubbed_query.append((key, nested_value))

    if not changed:
        return value

    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urlencode(scrubbed_query),
            parsed.fragment,
        )
    )
