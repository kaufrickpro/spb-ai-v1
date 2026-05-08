# Document Scanner

Private HTTP wrapper around ClamAV for manuscript upload scanning.

Runtime shape:

- `freshclam` updates ClamAV signatures at container startup.
- `clamd` listens only on `127.0.0.1:3310` inside the container.
- The Node wrapper exposes `POST /scan` on Cloud Run.
- The wrapper accepts raw bytes and returns only bounded scanner metadata.

Request:

```http
POST /scan
Authorization: Bearer <scanner-token>
Content-Type: application/octet-stream
```

For private Cloud Run callers that must use Google OIDC in `Authorization`, the
app-level scanner token can be sent as:

```http
X-Scanner-Token: <scanner-token>
```

Response:

```json
{
  "result": "clean",
  "scanner": "clamav",
  "scanner_version": null,
  "signature": null
}
```

`result` is either `clean` or `suspicious`. ClamAV detections map to
`suspicious`; operational failures return non-2xx responses so the AI service
records `scanner_failed`.

Deploy staging with:

```sh
./infra/scripts/deploy-document-scanner-staging.sh
```

The deploy script builds the container, deploys private Cloud Run service
`spb-document-scanner-staging`, creates/rotates scanner Secret Manager values,
and grants the staging AI service account access.
