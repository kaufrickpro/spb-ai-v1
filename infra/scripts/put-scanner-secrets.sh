#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Create or update Google Secret Manager entries for the real document scanner.

Required environment variables:
  DOCUMENT_SCANNER_ENDPOINT
  DOCUMENT_SCANNER_TOKEN
  DOCUMENT_SCANNER_TIMEOUT_SECONDS

Optional environment variables:
  GCP_PROJECT=spb-ai
  DEPLOY_ENV=staging

Example:
  DOCUMENT_SCANNER_ENDPOINT="https://scanner.internal/scan" \
  DOCUMENT_SCANNER_TOKEN="..." \
  DOCUMENT_SCANNER_TIMEOUT_SECONDS="10" \
  GCP_PROJECT="spb-ai" \
  DEPLOY_ENV="staging" \
  ./infra/scripts/put-scanner-secrets.sh
USAGE
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

project="${GCP_PROJECT:-spb-ai}"
environment="${DEPLOY_ENV:-staging}"

endpoint="${DOCUMENT_SCANNER_ENDPOINT:-}"
token="${DOCUMENT_SCANNER_TOKEN:-}"
timeout_seconds="${DOCUMENT_SCANNER_TIMEOUT_SECONDS:-}"

if [[ -z "$endpoint" || -z "$token" || -z "$timeout_seconds" ]]; then
  usage >&2
  echo "Missing one or more required scanner config values." >&2
  exit 1
fi

if [[ ! "$timeout_seconds" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "DOCUMENT_SCANNER_TIMEOUT_SECONDS must be a positive number." >&2
  exit 1
fi

if ! awk "BEGIN { exit !($timeout_seconds > 0) }"; then
  echo "DOCUMENT_SCANNER_TIMEOUT_SECONDS must be greater than zero." >&2
  exit 1
fi

endpoint_secret="spb-ai-${environment}-document-scanner-endpoint"
token_secret="spb-ai-${environment}-document-scanner-token"
timeout_secret="spb-ai-${environment}-document-scanner-timeout-seconds"

ensure_secret() {
  local secret_name="$1"

  if gcloud secrets describe "$secret_name" --project="$project" >/dev/null 2>&1; then
    return
  fi

  gcloud secrets create "$secret_name" \
    --project="$project" \
    --replication-policy="automatic" \
    --labels="app=spb-ai,environment=${environment},service=ai-service,purpose=document-scanner" \
    >/dev/null
}

add_secret_version() {
  local secret_name="$1"
  local secret_value="$2"

  printf '%s' "$secret_value" | gcloud secrets versions add "$secret_name" \
    --project="$project" \
    --data-file=- \
    >/dev/null
}

ensure_secret "$endpoint_secret"
ensure_secret "$token_secret"
ensure_secret "$timeout_secret"

add_secret_version "$endpoint_secret" "$endpoint"
add_secret_version "$token_secret" "$token"
add_secret_version "$timeout_secret" "$timeout_seconds"

echo "Updated scanner Secret Manager versions in project ${project}:"
echo "- ${endpoint_secret}"
echo "- ${token_secret}"
echo "- ${timeout_secret}"
