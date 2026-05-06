# ADR 8: Temporary Staging Document Scanner Posture

## Status

Accepted

## Context

Step 9 adds a scanner boundary before document parsing so suspicious or quarantined files stop before text extraction, chunking, or embedding work. Production-grade scanning still needs a private HTTP ClamAV-compatible scanner endpoint, endpoint authentication, timeout behavior, operational monitoring, and Secret Manager configuration.

The team needs to smoke-test the production-shaped staging flow before that scanner provider is ready: browser upload, API upload completion, durable processing job creation, Cloud Tasks dispatch, private AI service processing, private GCS reads, Supabase ingestion output writes, and author-facing checked/unreadable states.

## Decision

Use `DOCUMENT_SCANNER_LAUNCH_DECISION_ID=ADR-0008` as the temporary launch-decision escape hatch for staging-only smoke testing.

Staging may use:

- `DOCUMENT_SCANNER_MODE=local_fake`
- `LOCAL_FAKE_SCANNER_RESULT=not_scanned`
- `DOCUMENT_SCANNER_LAUNCH_DECISION_ID=ADR-0008`

This exception is limited to controlled internal staging uploads. It must not be used for production, public pilots, real user manuscripts, security testing that claims malware protection, or any environment that accepts documents from untrusted external users.

Production and real-user staging uploads require:

- `DOCUMENT_SCANNER_MODE=real`
- `DOCUMENT_SCANNER_PROVIDER=http-clamav`
- `DOCUMENT_SCANNER_ENDPOINT`
- `DOCUMENT_SCANNER_TOKEN`
- `DOCUMENT_SCANNER_TIMEOUT_SECONDS`

## Consequences

- Step 9 staging infrastructure can be smoke-tested without blocking on scanner procurement or deployment.
- Staging scanner evidence with `scanner_result = not_scanned` remains developer/test evidence only and must not be treated as a clean scan.
- The AI service must continue to fail fast in deployed environments unless either real scanner config is present or this launch decision id is explicitly configured.
- Before any real user upload in staging or production, replace this exception with a private scanner endpoint and move `DOCUMENT_SCANNER_TOKEN` into Secret Manager.
