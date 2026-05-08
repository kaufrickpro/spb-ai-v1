# Terraform Infrastructure

This directory will hold Terraform configuration for:

- Cloud Run services
- Cloud Tasks queues
- GCS buckets
- Secret Manager secrets
- IAM/service accounts
- Monitoring and DNS resources

Until Terraform owns Secret Manager resources, use
`infra/scripts/put-scanner-secrets.sh` to create or rotate the real document
scanner config secrets for Cloud Run deployments. The script creates
environment-scoped Secret Manager entries and adds new secret versions without
printing sensitive values.
