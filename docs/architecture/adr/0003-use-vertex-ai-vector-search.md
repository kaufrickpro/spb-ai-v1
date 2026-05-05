# ADR 3: Use Vertex AI Vector Search

## Status

Accepted

## Context

The platform needs semantic matching between manuscript data and publisher preferences, with a path to scale beyond small local vector tables.

## Decision

Use Vertex AI Vector Search for vector retrieval. Store vector datapoint identifiers and metadata in Postgres, but store vector indexes in Google Cloud.

## Consequences

- Keeps vector retrieval cloud-native and scalable.
- Adds operational complexity around index updates and environment separation.
- Postgres remains the relational/audit source of truth.
- Matching explanations must be persisted in `match_candidates`.
