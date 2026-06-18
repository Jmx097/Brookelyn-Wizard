CREATE TABLE public.enrichment_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  domain text NOT NULL,
  site_markdown text,
  job_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  execs jsonb NOT NULL DEFAULT '{}'::jsonb,
  scored jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

ALTER TABLE public.enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own enrichment_cache"
ON public.enrichment_cache
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER enrichment_cache_updated_at
BEFORE UPDATE ON public.enrichment_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_enrichment_cache_user_domain ON public.enrichment_cache(user_id, domain);