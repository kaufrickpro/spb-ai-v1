# ADR 1: Use Supabase Auth And Postgres

## Status

Accepted

## Context

The platform needs authentication, relational application data, Row Level Security, migrations, and generated TypeScript types. The team wants fast startup speed without building identity and database infrastructure from scratch.

## Decision

Use Supabase Auth for identity and Supabase Postgres for application data. Mirror authenticated users into `profiles`, and enforce client-accessible data rules with Row Level Security.

## Consequences

- Faster implementation for auth, database, and local development.
- RLS must be designed carefully before exposing tables to the browser.
- Service-role keys must never be used in frontend code.
- Migrations are the executable database source of truth.
