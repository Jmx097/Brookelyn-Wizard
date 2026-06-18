
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.linkedin_outreach_status AS ENUM
    ('queued','sent','replied','meeting','no_response','passed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.linkedin_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_role text,
  approach smallint NOT NULL CHECK (approach BETWEEN 1 AND 5),
  status public.linkedin_outreach_status NOT NULL DEFAULT 'sent',
  message_text text,
  sent_at timestamptz,
  replied_at timestamptz,
  meeting_at timestamptz,
  last_status_change_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_id, contact_name, approach)
);

CREATE INDEX IF NOT EXISTS linkedin_outreach_user_sent_idx
  ON public.linkedin_outreach (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS linkedin_outreach_user_status_idx
  ON public.linkedin_outreach (user_id, status);
CREATE INDEX IF NOT EXISTS linkedin_outreach_lead_idx
  ON public.linkedin_outreach (user_id, lead_id);

ALTER TABLE public.linkedin_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo read linkedin_outreach"
  ON public.linkedin_outreach FOR SELECT
  USING (true);

CREATE POLICY "own linkedin_outreach"
  ON public.linkedin_outreach FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER linkedin_outreach_set_updated_at
  BEFORE UPDATE ON public.linkedin_outreach
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
