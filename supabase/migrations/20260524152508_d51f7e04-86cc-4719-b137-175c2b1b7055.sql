CREATE TYPE public.contact_progress_status AS ENUM ('not_responded','engaged','meeting','no_show','opportunity');

CREATE TABLE public.contact_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  contact_name text NOT NULL,
  status public.contact_progress_status NOT NULL DEFAULT 'not_responded',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_id, contact_name)
);

ALTER TABLE public.contact_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo read contact_status" ON public.contact_status FOR SELECT USING (true);
CREATE POLICY "own contact_status" ON public.contact_status FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_contact_status_updated_at BEFORE UPDATE ON public.contact_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();