
-- 1) Restrict reservations: drop public SELECT, add admin-only SELECT
DROP POLICY IF EXISTS "Reservations are viewable by everyone" ON public.reservations;
DROP POLICY IF EXISTS "Anyone can view reservations" ON public.reservations;

CREATE POLICY "Admins can view reservations"
ON public.reservations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Provide a public-safe RPC returning only slot occupancy (no PII) for booking availability
CREATE OR REPLACE FUNCTION public.get_reservation_slots(p_date date, p_cast_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  cast_id uuid,
  reservation_date date,
  start_time time,
  duration integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, cast_id, reservation_date, start_time, duration
  FROM public.reservations
  WHERE reservation_date = p_date
    AND (p_cast_id IS NULL OR cast_id = p_cast_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_slots(date, uuid) TO anon, authenticated;

-- 2) Restrict casts.access_token: move to a separate admin-only table
CREATE TABLE IF NOT EXISTS public.cast_access_tokens (
  cast_id uuid PRIMARY KEY REFERENCES public.casts(id) ON DELETE CASCADE,
  access_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cast_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cast access tokens"
ON public.cast_access_tokens FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migrate existing tokens
INSERT INTO public.cast_access_tokens (cast_id, access_token)
SELECT id, access_token FROM public.casts
WHERE access_token IS NOT NULL
ON CONFLICT (cast_id) DO NOTHING;

-- Remove the column from casts
ALTER TABLE public.casts DROP COLUMN IF EXISTS access_token;

-- RPC for therapist portal lookup by token (no auth needed)
CREATE OR REPLACE FUNCTION public.get_cast_by_access_token(p_token text)
RETURNS TABLE (
  id uuid,
  name text,
  photo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.photo
  FROM public.casts c
  JOIN public.cast_access_tokens t ON t.cast_id = c.id
  WHERE t.access_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_cast_by_access_token(text) TO anon, authenticated;

-- RPC to set/regenerate token (admin only via has_role check inside)
CREATE OR REPLACE FUNCTION public.set_cast_access_token(p_cast_id uuid, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  INSERT INTO public.cast_access_tokens (cast_id, access_token)
  VALUES (p_cast_id, p_token)
  ON CONFLICT (cast_id) DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_cast_access_token(uuid, text) TO authenticated;

-- RPC for admin to read tokens (used by Staff list to display copy link)
CREATE OR REPLACE FUNCTION public.get_cast_access_tokens()
RETURNS TABLE (cast_id uuid, access_token text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  RETURN QUERY SELECT t.cast_id, t.access_token FROM public.cast_access_tokens t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cast_access_tokens() TO authenticated;

-- 3) Restrict back_rates financials: drop public SELECT, add admin-only
DROP POLICY IF EXISTS "Back rates are viewable by everyone" ON public.back_rates;
DROP POLICY IF EXISTS "Anyone can view back rates" ON public.back_rates;

CREATE POLICY "Admins can view back rates"
ON public.back_rates FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Public-safe RPC exposing only customer-facing pricing
CREATE OR REPLACE FUNCTION public.get_public_back_rates()
RETURNS TABLE (
  id uuid,
  course_type text,
  duration integer,
  customer_price integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, course_type, duration, customer_price
  FROM public.back_rates
  ORDER BY duration ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_back_rates() TO anon, authenticated;
