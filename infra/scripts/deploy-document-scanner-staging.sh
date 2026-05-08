#!/usr/bin/env bash
set -euo pipefail

project="${GCP_PROJECT:-spb-ai}"
region="${GOOGLE_CLOUD_REGION:-europe-west3}"
environment="${DEPLOY_ENV:-staging}"
service="${SCANNER_SERVICE_NAME:-spb-document-scanner-staging}"
repository="${ARTIFACT_REGISTRY_REPOSITORY:-spb-services}"
image_tag="${IMAGE_TAG:-staging}"
image="${SCANNER_IMAGE:-${region}-docker.pkg.dev/${project}/${repository}/document-scanner:${image_tag}}"
service_account="${SCANNER_SERVICE_ACCOUNT:-spb-document-scanner-staging@${project}.iam.gserviceaccount.com}"
ai_service_account="${AI_SERVICE_ACCOUNT:-spb-ai-service-staging@${project}.iam.gserviceaccount.com}"
timeout_seconds="${DOCUMENT_SCANNER_TIMEOUT_SECONDS:-10}"
token="${SCANNER_BEARER_TOKEN:-}"

if [[ -z "$token" ]]; then
  token="$(openssl rand -base64 48)"
fi

if ! gcloud iam service-accounts describe "$service_account" --project="$project" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${service_account%@*}" \
    --project="$project" \
    --display-name="SPB document scanner ${environment}"
fi

if ! gcloud artifacts repositories describe "$repository" \
  --project="$project" \
  --location="$region" \
  >/dev/null 2>&1; then
  echo "Artifact Registry repository '${repository}' was not found in ${project}/${region}." >&2
  echo "Create it first or set ARTIFACT_REGISTRY_REPOSITORY to an existing Docker repository." >&2
  exit 1
fi

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
    --labels="app=spb-ai,environment=${environment},service=document-scanner" \
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

ensure_secret "$token_secret"
ensure_secret "$timeout_secret"
add_secret_version "$token_secret" "$token"
add_secret_version "$timeout_secret" "$timeout_seconds"

gcloud secrets add-iam-policy-binding "$token_secret" \
  --project="$project" \
  --member="serviceAccount:${service_account}" \
  --role="roles/secretmanager.secretAccessor" \
  >/dev/null

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  gcloud builds submit . \
    --project="$project" \
    --config="apps/document-scanner/cloudbuild.yaml" \
    --substitutions="_IMAGE=${image}"
fi

gcloud run deploy "$service" \
  --project="$project" \
  --region="$region" \
  --image="$image" \
  --service-account="$service_account" \
  --memory=2Gi \
  --cpu=1 \
  --timeout=60 \
  --min-instances=1 \
  --max-instances=2 \
  --no-allow-unauthenticated \
  --set-secrets="SCANNER_BEARER_TOKEN=${token_secret}:latest" \
  --set-env-vars="MAX_SCAN_BYTES=26214400,CLAMD_TIMEOUT_MS=60000" \
  >/dev/null

scanner_url="$(
  gcloud run services describe "$service" \
    --project="$project" \
    --region="$region" \
    --format='value(status.url)'
)"

DOCUMENT_SCANNER_ENDPOINT="${scanner_url}/scan" \
DOCUMENT_SCANNER_TOKEN="$token" \
DOCUMENT_SCANNER_TIMEOUT_SECONDS="$timeout_seconds" \
GCP_PROJECT="$project" \
DEPLOY_ENV="$environment" \
"$(dirname "$0")/put-scanner-secrets.sh" >/dev/null

for secret_name in \
  "spb-ai-${environment}-document-scanner-endpoint" \
  "$token_secret" \
  "$timeout_secret"; do
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project="$project" \
    --member="serviceAccount:${ai_service_account}" \
    --role="roles/secretmanager.secretAccessor" \
    >/dev/null
done

gcloud run services add-iam-policy-binding "$service" \
  --project="$project" \
  --region="$region" \
  --member="serviceAccount:${ai_service_account}" \
  --role="roles/run.invoker" \
  >/dev/null

echo "Deployed ${service} in ${project}/${region}."
echo "Scanner URL: ${scanner_url}"
echo "Secret Manager entries are ready for the staging AI service."
