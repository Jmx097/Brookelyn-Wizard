# Brookelyn Table and RLS Inventory

## Scope

Inventory based on exported repo code and checked-in Supabase migrations.

## Summary

The repo does contain substantial schema + RLS state. Earlier uncertainty was partly because the initial SQL search was too narrow.

However, the exported policy set still includes multiple prototype-era `demo read ... USING (true)` policies that are incompatible with a clean multi-tenant independent deployment.

So the situation is:
- schema is more complete than it first looked
- RLS exists in repo-managed SQL
- but several policies must be tightened before the app is safely independent

## Table inventory

### `icp_config`
Used by:
- `lib/icp.functions.ts`
- `lib/ingest.functions.ts`
- `routes/api/public/hooks/run-daily-search.ts`
- `routes/api/public/inbound-email.ts` indirectly for user resolution assumptions

Migration evidence:
- `supabase/migrations/20260509201119_3d433d21-9370-416d-b8c2-92e49b821bff.sql`

RLS evidence:
- enabled
- owner policy exists: `own icp`
- also has prototype `demo read icp` policy from `20260509211521_55d9fda1-47e4-4443-8c2b-c99b2d8113ae.sql`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed for independent deployment

### `search_queries`
Used by:
- `routes/sources.tsx`
- `lib/ingest.functions.ts`
- `routes/api/public/hooks/run-daily-search.ts`

Migration evidence:
- `20260509201119_3d433d21-9370-416d-b8c2-92e49b821bff.sql`

RLS evidence:
- enabled
- owner policy exists: `own queries`
- also has prototype `demo read queries`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `leads`
Used by:
- `routes/pipeline.tsx`
- `routes/my-leads.tsx`
- `routes/consolidation.tsx`
- `routes/linkedin-messages.tsx`
- `routes/leads.$leadId.tsx`
- multiple server functions

Migration evidence:
- `20260509201119_3d433d21-9370-416d-b8c2-92e49b821bff.sql`

RLS evidence:
- enabled
- owner policy exists: `own leads`
- also has prototype `demo read leads`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `articles`
Used by:
- `routes/sources.tsx`
- `routes/pipeline.tsx`
- `routes/my-leads.tsx`
- ingestion/search flows

Migration evidence:
- `20260509201119_3d433d21-9370-416d-b8c2-92e49b821bff.sql`

RLS evidence:
- enabled
- owner policy exists: `own articles`
- also has prototype `demo read articles`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `saved_views`
Used by:
- `routes/pipeline.tsx`

Migration evidence:
- `20260509220512_55d9fda1-47e4-4443-8c2b-c99b2d8113ae.sql`

RLS evidence:
- enabled
- owner policy exists: `own saved_views`
- also has `demo read saved_views`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `job_postings`
Used by:
- `routes/leads.$leadId.tsx`

Migration evidence:
- `20260509212334_d6ab65a6-e264-46c6-9971-a3b527a6a112.sql`
- follow-up alteration in `20260527130339_07d9bebf-0df8-43b6-8db3-4a8693ad56ce.sql`

RLS evidence:
- enabled
- owner policy exists: `own job postings`
- also has `demo read job postings`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `linkedin_outreach`
Used by:
- `routes/leads.$leadId.tsx`
- `lib/linkedin-tracker.functions.ts`
- `routes/api/public/inbound-email.ts`

Migration evidence:
- `20260523151033_d83e5def-b042-4dcf-a09c-a84c3c1f9823.sql`

RLS evidence:
- enabled
- owner policy exists: `own linkedin_outreach`
- also has `demo read linkedin_outreach`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `contact_status`
Used by:
- `lib/contact-status.functions.ts`

Migration evidence:
- `20260524152508_d51f7e04-86cc-4719-b137-175c2b1b7055.sql`

RLS evidence:
- enabled
- owner policy exists: `own contact_status`
- also has `demo read contact_status`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `gmail_forwarding_confirmations`
Used by:
- `routes/sources.tsx`
- `routes/api/public/inbound-email.ts`

Migration evidence:
- `20260527204228_a61c1e1b-feec-484a-a01e-e066354232ea.sql`

RLS evidence:
- enabled
- owner policy exists: `own gmail confirmations`
- also has `demo read gmail confirmations`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

### `lead_contacts`
Used by:
- `lib/contacts.functions.ts`
- contact enrichment flows

Migration evidence:
- `20260529134127_850ca904-61f7-4f9d-9e5e-a750d1da16b5.sql`

RLS evidence:
- enabled
- owner policy exists: `own lead_contacts`
- also has `demo read lead_contacts`

Verdict:
- schema present
- RLS present
- unsafe demo-read policy should be removed

## Other tables seen in migrations but not primary focus yet
- `notes`
- `outreach_drafts`

These should also be checked if they remain part of the product surface.

## Seed/bootstrap behavior already present
Migration `20260509201119_3d433d21-9370-416d-b8c2-92e49b821bff.sql` includes:
- `seed_user_defaults()` trigger on `auth.users`
- automatic `icp_config` seed
- automatic default `search_queries` seed

Verdict:
- this is useful for independence
- but should be documented explicitly in setup docs

## Main RLS remediation needed for independent deployment

### Remove all prototype demo-read policies
These are the biggest persistence-safety issue.

Policies to drop/replace include patterns like:
- `demo read leads`
- `demo read articles`
- `demo read queries`
- `demo read icp`
- `demo read saved_views`
- `demo read job postings`
- `demo read linkedin_outreach`
- `demo read contact_status`
- `demo read gmail confirmations`
- `demo read lead_contacts`

### Re-verify frontend browser query paths after tightening RLS
Because many routes query Supabase directly from the browser client, once demo-read policies are removed we must verify:
- the authenticated user still sees their own data
- cross-user reads fail
- any route relying on hidden demo permissiveness gets fixed

## Final verdict

The exported repo is closer to independent persistence than it first appeared.

Good:
- schema exists
- RLS exists
- user-default seeding exists

Bad:
- many tables still allow broad `SELECT USING (true)` demo reads
- user-facing server functions still contain prototype authorization shortcuts

Conclusion:
- independent persistence is absolutely achievable
- but not yet safe until demo-read policies and app-layer shortcuts are removed
