# ADR 2: Separate Node API And FastAPI AI Service

## Status

Accepted

## Context

The product needs a TypeScript web/API surface and Python-friendly AI workflows for ingestion, retrieval, and matching.

## Decision

Use a Node.js TypeScript API for product/backend orchestration and a separate FastAPI service for AI pipelines. AI-generated reports and Google ADK workflows are deferred to V1.5.

## Consequences

- TypeScript remains the main product API language.
- Python can use mature AI and document processing tooling.
- Cross-service contracts must be explicit and versioned.
- The AI service should be private and invoked only by trusted backend paths.
