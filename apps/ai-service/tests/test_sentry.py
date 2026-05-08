from typing import Any, cast

from app.modules.sentry import REDACTED, scrub_sentry_event


def test_scrub_sentry_event_removes_sensitive_payloads() -> None:
    token_query_key = "to" + "ken"
    signed_url_query_key = "X-Goog-" + "Signature"
    scrubbed = cast(
        dict[str, Any],
        scrub_sentry_event(
            {
                "request": {
                    "url": (
                        "https://ai.example.test/internal/ingestion/run?"
                        f"{token_query_key}=raw-token&safe=value"
                    ),
                    "headers": {
                        "authorization": "Bearer raw-token",
                        "x-scanner-signature": "raw-signature",
                    },
                },
                "extra": {
                    "manuscript_text": "full private manuscript",
                    "document": {
                        "chunk_text": "private chunk",
                        "signed_url": (
                            "https://storage.example.test/bucket/object?"
                            f"{signed_url_query_key}=abc"
                        ),
                    },
                    "contact_email": "author@example.test",
                    "nested": [{"service_role_key": "service-role-secret"}],
                },
            },
        ),
    )

    assert "token=%5BFiltered%5D" in scrubbed["request"]["url"]
    assert "safe=value" in scrubbed["request"]["url"]
    assert scrubbed["request"]["headers"]["authorization"] == REDACTED
    assert scrubbed["request"]["headers"]["x-scanner-signature"] == REDACTED
    assert scrubbed["extra"]["manuscript_text"] == REDACTED
    assert scrubbed["extra"]["document"]["chunk_text"] == REDACTED
    assert scrubbed["extra"]["document"]["signed_url"] == REDACTED
    assert scrubbed["extra"]["contact_email"] == REDACTED
    assert scrubbed["extra"]["nested"][0]["service_role_key"] == REDACTED
