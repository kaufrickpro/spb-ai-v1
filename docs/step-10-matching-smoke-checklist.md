# Step 10 Matching Smoke Checklist

Run this checklist after applying the Step 10 migrations and starting the local
web/API/AI services.

## Public Directory

- Visit `/publishers` while logged out.
- Confirm each publisher card shows only logo, name, and an `https` website.
- Confirm there are no full profile links, genres, guidelines, contacts,
  matching details, or admin state.

## Profile Access

- As an unrelated authenticated user, open a publisher, author, or manuscript
  profile URL that was not revealed by a match.
- Confirm the API/UI deny access.
- As a publisher with an approved manuscript access request, open only that
  approved manuscript profile.
- Confirm private contact, sample downloads, and full manuscript text remain
  hidden.

## Match Runs

- As an eligible author with an eligible processed manuscript sample, run
  author-to-publisher matching from `/app/matches`.
- As an eligible publisher, run publisher-to-manuscript matching from
  `/app/matches`.
- Confirm result cards show score band, premise/voice/arc bands, top-10
  explanations, fit reasons, watch-outs, safe snippets, profile links, and a
  disabled Step 10 intro placeholder.
- Confirm ranks 11-25 remain inspectable without requiring an explanation
  paragraph.

## History And Rematch

- Open `/app/profile/history`.
- Confirm runs are newest-first and show direction, source title, created date,
  status, stale/current label, candidate count, view-results link, and rematch
  action.
- Edit a match-relevant manuscript or publisher field.
- Confirm older runs show stale and rematch creates a new run instead of
  replacing the old one.

## Redaction

- Inspect result cards, candidate detail, run detail, and profile pages.
- Confirm they do not show full manuscript text, sample URLs, private contact,
  secrets, admin notes, raw provider payloads, or raw final numeric scores.
