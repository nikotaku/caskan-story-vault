-- Store-specific LINE destinations used by booking and operations notifications.
CREATE TABLE IF NOT EXISTS public.line_notification_destinations (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  destination_key text NOT NULL,
  line_group_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, destination_key)
);

ALTER TABLE public.line_notification_destinations ENABLE ROW LEVEL SECURITY;

-- Edge Functions access this table with the service-role key. Keep destinations
-- (LINE group identifiers) unavailable through the public Data API.
REVOKE ALL ON TABLE public.line_notification_destinations FROM anon, authenticated;
