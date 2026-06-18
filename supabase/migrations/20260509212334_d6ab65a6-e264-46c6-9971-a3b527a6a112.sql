CREATE TABLE public.job_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  board TEXT,
  location TEXT,
  country TEXT,
  seniority TEXT,
  posted_at TIMESTAMPTZ,
  is_out_of_hq BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_postings_lead ON public.job_postings(lead_id);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo read job postings"
ON public.job_postings FOR SELECT
USING (true);

CREATE POLICY "own job postings"
ON public.job_postings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);