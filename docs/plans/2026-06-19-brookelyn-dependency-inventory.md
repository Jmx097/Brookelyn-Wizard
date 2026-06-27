# Brookelyn Dependency Inventory

## Purpose

Separate what is required for independent persistence from what is optional enrichment or still Lovable-specific.

## Core persistence/auth dependencies

### Supabase
Role:
- primary database
- auth / magic links
- row-level security
- persistent user-owned records

Required for:
- login
- leads
- saved views
- contact status
- outreach tracking
- search queries
- source/article records
- inbound email state

Env:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Status:
- hard requirement
- cannot remove without major rewrite

## AI / enrichment dependencies

### Anthropic API
Role:
- lead extraction from digests/search
- outreach generation
- enrichment/classification logic

Files observed:
- `lib/ingest.functions.ts`
- `lib/lead-enrich.functions.ts`
- `lib/outreach.functions.ts`
- `lib/import-companies.server.ts`
- `routes/api/public/hooks/run-daily-search.ts`

Env:
- `ANTHROPIC_API_KEY`

Status:
- replaceable dependency
- required for current AI features
- not required for basic persistence/auth alone

Notes:
- keeping this means independent of Lovable Cloud while using your own provider account
- the Lovable-hosted AI gateway has already been removed from active app code

### Bright Data
Role:
- LinkedIn contact discovery / SERP-backed contact enrichment

Files observed:
- `lib/contacts.server.ts`

Env:
- `BRIGHTDATA_API_KEY`
- `BRIGHTDATA_SERP_ZONE`

Status:
- optional enhancement for contact enrichment
- not required for core persistence/auth

### Firecrawl
Role:
- scrape/import article bodies and company context

Files observed:
- `lib/ingest.functions.ts`
- `lib/import-companies.server.ts`
- `lib/lead-enrich.functions.ts`

Env:
- `FIRECRAWL_API_KEY`

Status:
- optional enhancement
- not required for basic persistence/auth
- required for best enrichment/import behavior

## Public ingress dependencies

### Inbound email webhook caller
Role:
- posts inbound email payloads to `/api/public/inbound-email`

Examples mentioned in UI/code:
- Postmark
- SendGrid Inbound Parse
- Mailgun
- Cloudflare Email Worker

Env:
- `INBOUND_EMAIL_SECRET`
- `INBOUND_EMAIL_WEBHOOK_URL`
- `INBOUND_FORWARDING_ADDRESS`

Status:
- optional workflow dependency
- required only if inbound email ingestion is part of your ops model

### Scheduler / automation caller
Role:
- posts to `/api/public/hooks/run-daily-search`

Expected future env:
- `RUN_DAILY_SEARCH_SECRET`

Status:
- optional workflow dependency
- required only if you want recurring automated search ingestion

## Hosting/runtime dependencies

### Node/Vite app host
Role:
- serves app + SSR/server functions

Status:
- hard requirement
- replaceable host choice

### Lovable Cloud
Role:
- previous prototype/runtime host

Status:
- not required for persistence independence
- should be treated as removable once standalone deployment is verified

## Independence summary

### Needed for independent persistence
- Supabase
- app host
- documented env contract
- repo-managed schema/RLS state

### Needed for current feature completeness
- Anthropic API
- Bright Data
- optionally Firecrawl

### Not required if goal is only to be independent of Lovable Cloud
- Lovable Cloud hosting/runtime

### Fully Lovable-free status
- completed for AI: active app code now calls Anthropic directly instead of the Lovable gateway
