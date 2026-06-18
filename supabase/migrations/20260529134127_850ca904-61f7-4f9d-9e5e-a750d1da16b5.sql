-- Add contacts_enriched_at to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contacts_enriched_at timestamptz;

-- Add auto-enrich threshold to icp_config
ALTER TABLE public.icp_config ADD COLUMN IF NOT EXISTS auto_enrich_contacts_min_score integer NOT NULL DEFAULT 0;

-- Create lead_contacts table
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  full_name text NOT NULL,
  title text,
  linkedin_url text,
  location text,
  seniority text,
  relevance_score integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'brightdata',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_contacts TO authenticated;
GRANT SELECT ON public.lead_contacts TO anon;
GRANT ALL ON public.lead_contacts TO service_role;

ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo read lead_contacts" ON public.lead_contacts FOR SELECT USING (true);
CREATE POLICY "own lead_contacts" ON public.lead_contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lead_contacts_lead_id ON public.lead_contacts(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_contacts_unique ON public.lead_contacts(lead_id, linkedin_url) WHERE linkedin_url IS NOT NULL;