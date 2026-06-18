
-- enums
CREATE TYPE public.lead_status AS ENUM ('new','pursuing','contacted','passed');
CREATE TYPE public.article_source AS ENUM ('alert_email','web_search','manual');
CREATE TYPE public.outreach_channel AS ENUM ('email','linkedin');

-- icp_config (single-row config per user)
CREATE TABLE public.icp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  industries TEXT[] NOT NULL DEFAULT '{}',
  funding_stages TEXT[] NOT NULL DEFAULT '{}',
  regions TEXT[] NOT NULL DEFAULT '{}',
  company_size_min INT,
  company_size_max INT,
  scoring_prompt TEXT NOT NULL DEFAULT '',
  outreach_voice TEXT NOT NULL DEFAULT 'Warm, concise, consultative. Reference the trigger event and how GoGlobal helps with international hiring/expansion via EOR.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- search_queries
CREATE TABLE public.search_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_search_queries_user ON public.search_queries(user_id);

-- leads
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  hq TEXT,
  industry TEXT,
  company_size TEXT,
  funding_stage TEXT,
  funding_amount TEXT,
  expansion_signals TEXT[] NOT NULL DEFAULT '{}',
  fit_score INT NOT NULL DEFAULT 0,
  fit_reasoning TEXT,
  status public.lead_status NOT NULL DEFAULT 'new',
  trigger_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_user_status ON public.leads(user_id, status);
CREATE INDEX idx_leads_user_score ON public.leads(user_id, fit_score DESC);
CREATE UNIQUE INDEX idx_leads_user_company ON public.leads(user_id, lower(company_name));

-- articles
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  raw_content TEXT,
  source public.article_source NOT NULL,
  trigger_type TEXT,
  published_at TIMESTAMPTZ,
  processed BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_articles_user_created ON public.articles(user_id, created_at DESC);
CREATE INDEX idx_articles_lead ON public.articles(lead_id);
CREATE UNIQUE INDEX idx_articles_user_url ON public.articles(user_id, url);

-- outreach_drafts
CREATE TABLE public.outreach_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel public.outreach_channel NOT NULL DEFAULT 'email',
  subject TEXT,
  body TEXT NOT NULL,
  edited_body TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outreach_lead ON public.outreach_drafts(lead_id);

-- notes
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_lead ON public.notes(lead_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_outreach_updated BEFORE UPDATE ON public.outreach_drafts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_icp_updated BEFORE UPDATE ON public.icp_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.icp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Policies: owner-only
CREATE POLICY "own icp" ON public.icp_config FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own queries" ON public.search_queries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own leads" ON public.leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own articles" ON public.articles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own outreach" ON public.outreach_drafts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own notes" ON public.notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- on signup, seed defaults
CREATE OR REPLACE FUNCTION public.seed_user_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.icp_config (user_id, industries, funding_stages, regions, company_size_min, company_size_max, scoring_prompt)
  VALUES (
    NEW.id,
    ARRAY['SaaS','Fintech','HealthTech','AI/ML','E-commerce','Climate Tech','Marketplaces'],
    ARRAY['Series B','Series C','Series D','Series E'],
    ARRAY['North America','Europe','APAC','LATAM'],
    50, 2000,
    'Score 0-100 how strongly this company signals a need for international expansion services (EOR / global hiring / setting up entities abroad). Reward: recent Series B-E funding, explicit international expansion language, opening offices abroad, hiring outside home country, leadership hires for international markets, M&A across borders. Penalize: very early stage, single-country focus, already-global enterprises, irrelevant industries.'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.search_queries (user_id, query) VALUES
    (NEW.id, 'startup raised Series B funding international expansion'),
    (NEW.id, 'startup raised Series C funding global expansion'),
    (NEW.id, 'company opens new office Europe APAC hiring'),
    (NEW.id, 'tech company expanding internationally new market entry'),
    (NEW.id, 'startup hiring outside US first international employee');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.seed_user_defaults();
