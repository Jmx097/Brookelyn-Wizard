-- Explicit inbound-email routing per user/source for independent multi-tenant deployments.
-- One row = one accepted destination address / source combination.

CREATE TABLE IF NOT EXISTS public.inbound_email_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  route_key TEXT NOT NULL,
  destination_address TEXT,
  source_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inbound_email_routes_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE CASCADE,
  CONSTRAINT inbound_email_routes_route_key_not_blank
    CHECK (length(btrim(route_key)) > 0),
  CONSTRAINT inbound_email_routes_destination_address_not_blank
    CHECK (
      destination_address IS NULL
      OR length(btrim(destination_address)) > 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_email_routes_route_key_active
  ON public.inbound_email_routes (route_key)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_inbound_email_routes_user_id
  ON public.inbound_email_routes (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbound_email_routes TO authenticated;
GRANT ALL ON public.inbound_email_routes TO service_role;

ALTER TABLE public.inbound_email_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own inbound_email_routes" ON public.inbound_email_routes;
CREATE POLICY "own inbound_email_routes"
  ON public.inbound_email_routes FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_inbound_email_routes_updated_at ON public.inbound_email_routes;
CREATE TRIGGER set_inbound_email_routes_updated_at
BEFORE UPDATE ON public.inbound_email_routes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
