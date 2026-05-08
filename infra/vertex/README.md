# Vertex AI Vector Search

This directory stores non-secret operational inputs for Vertex AI Vector Search.

Staging currently uses direct `gcloud` provisioning because `infra/terraform/`
does not yet own Vertex PSC resources. Import these resources into Terraform
before treating the setup as fully reproducible infrastructure as code.

Current staging metadata:

- Project: `spb-ai`
- Project number: `937194608067`
- Region: `europe-west3`
- VPC: `spb-ai-staging-vpc`
- Cloud Run subnet: `spb-ai-staging-run-euw3` (`10.42.0.0/26`)
- PSC endpoint subnet: `spb-ai-staging-psc-euw3` (`10.42.1.0/28`)
- Service connection policy: `spb-ai-staging-vertex-psc`
- Streaming index ID: `6107839868853813248`
- Index endpoint ID: `737156575726141440`
- Deployed index ID: `publisher_author_staging_v1`
- PSC match address: `10.42.1.2`
- Synthetic smoke datapoint ID: `smoke-match-signal-staging-001`
- AI service image digest:
  `sha256:0f512722eced03a41d00dfe12104ae9e4777035f7c20a0d95d799a37d0cac262`
- Ready AI service revision: `spb-ai-service-staging-00003-wgf`

Validated on 2026-05-08:

- Authenticated `GET /health` and `GET /ready` on `spb-ai-service-staging`
  returned ok.
- Cloud Run job execution `spb-vector-search-smoke-staging-l95v7` ran from
  `spb-ai-staging-run-euw3`, called PSC-backed Vector Search with
  `psc_network=projects/spb-ai/global/networks/spb-ai-staging-vpc`, and
  returned neighbor `smoke-match-signal-staging-001`.
