-- Reliable WEB booking notification state.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS line_notification_status text NOT NULL DEFAULT 'not_attempted',
  ADD COLUMN IF NOT EXISTS email_notification_status text NOT NULL DEFAULT 'not_attempted',
  ADD COLUMN IF NOT EXISTS line_notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_last_error text,
  ADD COLUMN IF NOT EXISTS notification_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_last_attempt_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_notification_attempt_count_check'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_notification_attempt_count_check
      CHECK (notification_attempt_count >= 0);
  END IF;
END $$;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_line_notification_status_check,
  DROP CONSTRAINT IF EXISTS reservations_email_notification_status_check;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_line_notification_status_check
    CHECK (line_notification_status IN ('not_attempted', 'sending', 'sent', 'failed', 'skipped')),
  ADD CONSTRAINT reservations_email_notification_status_check
    CHECK (email_notification_status IN ('not_attempted', 'sending', 'sent', 'failed', 'skipped'));

-- Metadata required to publish and validate coupons in the public booking form.
ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS public_booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_advance_days smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligible_course_type text,
  ADD COLUMN IF NOT EXISTS eligible_duration integer,
  ADD COLUMN IF NOT EXISTS stackable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_text text,
  ADD COLUMN IF NOT EXISTS terms text[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS discounts_store_code_unique
  ON public.discounts (store_id, code)
  WHERE code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discounts_min_advance_days_check'
  ) THEN
    ALTER TABLE public.discounts
      ADD CONSTRAINT discounts_min_advance_days_check CHECK (min_advance_days >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discounts_eligible_duration_check'
  ) THEN
    ALTER TABLE public.discounts
      ADD CONSTRAINT discounts_eligible_duration_check
      CHECK (eligible_duration IS NULL OR eligible_duration > 0);
  END IF;
END $$;

INSERT INTO public.discounts (
  store_id,
  code,
  name,
  discount_type,
  discount_value,
  is_active,
  public_booking_enabled,
  min_advance_days,
  eligible_course_type,
  eligible_duration,
  stackable,
  display_order,
  badge_text,
  terms
)
VALUES
  (
    '404499ab-5350-490f-9608-5814faffda6f',
    'advance_booking_1',
    '事前予約割限定クーポン❶',
    'fixed',
    1000,
    true,
    true,
    1,
    '艶華',
    80,
    false,
    1,
    '5% OFF',
    ARRAY['前日までの事前予約のみご使用可能', '当日予約での利用不可', '他のクーポンとの併用不可']
  ),
  (
    '404499ab-5350-490f-9608-5814faffda6f',
    'advance_booking_2',
    '事前予約限定クーポン❷',
    'fixed',
    2000,
    true,
    true,
    1,
    '艶華',
    80,
    false,
    2,
    '10% OFF',
    ARRAY['前日までの事前予約のみご使用可能', '当日予約での利用不可', '他のクーポンとの併用不可']
  )
ON CONFLICT (store_id, code) WHERE code IS NOT NULL DO UPDATE SET
  name = EXCLUDED.name,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  is_active = EXCLUDED.is_active,
  public_booking_enabled = EXCLUDED.public_booking_enabled,
  min_advance_days = EXCLUDED.min_advance_days,
  eligible_course_type = EXCLUDED.eligible_course_type,
  eligible_duration = EXCLUDED.eligible_duration,
  stackable = EXCLUDED.stackable,
  display_order = EXCLUDED.display_order,
  badge_text = EXCLUDED.badge_text,
  terms = EXCLUDED.terms;

-- Recalculate public booking prices from server-owned rate tables and enforce
-- coupon eligibility. Authenticated staff reservations keep their existing flow.
CREATE OR REPLACE FUNCTION public.validate_public_booking_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  request_role text := coalesce(auth.role(), '');
  base_price integer;
  option_total integer := 0;
  nomination_price integer := 0;
  applied_discount integer := 0;
  coupon public.discounts%ROWTYPE;
  requested_discount_count integer := coalesce(array_length(NEW.discount_ids, 1), 0);
  supplied_option_count integer := coalesce(array_length(NEW.options, 1), 0);
  matched_option_count integer := 0;
  payment_fee_percentage numeric := 0;
BEGIN
  IF request_role <> 'anon' THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    RAISE EXCEPTION 'Public reservations cannot set created_by';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.casts c WHERE c.id = NEW.cast_id AND c.store_id = NEW.store_id
  ) THEN
    RAISE EXCEPTION 'Invalid therapist for this store';
  END IF;

  SELECT br.customer_price
    INTO base_price
  FROM public.back_rates br
  WHERE br.store_id = NEW.store_id
    AND br.course_type = NEW.course_type
    AND br.duration = NEW.duration
  ORDER BY br.is_visible DESC, br.display_order
  LIMIT 1;

  IF base_price IS NULL THEN
    RAISE EXCEPTION 'Invalid course for this store';
  END IF;

  IF supplied_option_count > 0 THEN
    SELECT coalesce(sum(o.customer_price), 0), count(*)
      INTO option_total, matched_option_count
    FROM unnest(NEW.options) requested(option_name)
    JOIN public.option_rates o
      ON o.store_id = NEW.store_id
     AND o.option_name = requested.option_name;

    IF matched_option_count <> supplied_option_count THEN
      RAISE EXCEPTION 'Invalid option for this store';
    END IF;
  END IF;

  IF NEW.nomination_type IS NOT NULL AND NEW.nomination_type <> 'none' THEN
    SELECT nr.customer_price
      INTO nomination_price
    FROM public.nomination_rates nr
    WHERE nr.store_id = NEW.store_id
      AND nr.nomination_type = NEW.nomination_type
    LIMIT 1;

    IF nomination_price IS NULL THEN
      RAISE EXCEPTION 'Invalid nomination type for this store';
    END IF;
  END IF;

  IF requested_discount_count > 1 THEN
    RAISE EXCEPTION 'Public booking coupons cannot be combined';
  ELSIF requested_discount_count = 1 THEN
    BEGIN
      SELECT d.*
        INTO STRICT coupon
      FROM public.discounts d
      WHERE d.id = NEW.discount_ids[1]::uuid
        AND d.store_id = NEW.store_id
        AND d.is_active
        AND d.public_booking_enabled;
    EXCEPTION WHEN no_data_found OR invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid public booking coupon';
    END;

    IF coupon.discount_type <> 'fixed'
       OR (coupon.eligible_course_type IS NOT NULL AND coupon.eligible_course_type <> NEW.course_type)
       OR (coupon.eligible_duration IS NOT NULL AND coupon.eligible_duration <> NEW.duration)
       OR (CASE
             WHEN NEW.start_time < time '06:00' THEN NEW.reservation_date - 1
             ELSE NEW.reservation_date
           END) < ((now() AT TIME ZONE 'Asia/Tokyo')::date + coupon.min_advance_days) THEN
      RAISE EXCEPTION 'Coupon conditions are not met';
    END IF;

    applied_discount := greatest(0, coupon.discount_value::integer);
  END IF;

  NEW.course_name := NEW.course_type || ' ' || NEW.duration || '分';
  NEW.discount := least(applied_discount, base_price + option_total + nomination_price);
  NEW.price := greatest(0, base_price + option_total + nomination_price - NEW.discount);
  IF coalesce(NEW.payment_method, 'cash') ~* '^(card|カード|クレジットカード)$' THEN
    SELECT coalesce(ps.fee_percentage, 0)
      INTO payment_fee_percentage
    FROM public.payment_settings ps
    WHERE ps.store_id = NEW.store_id
      AND ps.is_active
      AND ps.payment_method ~* '(card|カード|クレジット)'
    LIMIT 1;
  ELSIF coalesce(NEW.payment_method, 'cash') ~* '^paypay$' THEN
    SELECT coalesce(ps.fee_percentage, 0)
      INTO payment_fee_percentage
    FROM public.payment_settings ps
    WHERE ps.store_id = NEW.store_id
      AND ps.is_active
      AND ps.payment_method ~* 'paypay'
    LIMIT 1;
  END IF;
  NEW.payment_fee := round(NEW.price * coalesce(payment_fee_percentage, 0) / 100.0)::integer;
  NEW.line_notification_status := 'not_attempted';
  NEW.email_notification_status := 'not_attempted';
  NEW.line_notification_sent_at := NULL;
  NEW.email_notification_sent_at := NULL;
  NEW.notification_last_error := NULL;
  NEW.notification_attempt_count := 0;
  NEW.notification_last_attempt_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_public_booking_price ON public.reservations;
CREATE TRIGGER trg_validate_public_booking_price
BEFORE INSERT ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.validate_public_booking_price();

REVOKE ALL ON FUNCTION public.validate_public_booking_price() FROM PUBLIC;

-- Public availability uses get_reservation_slots(), so personal reservation
-- details no longer need to be selectable by anonymous visitors.
DROP POLICY IF EXISTS "Reservations viewable by everyone" ON public.reservations;
DROP POLICY IF EXISTS "Reservations viewable by authenticated users" ON public.reservations;
CREATE POLICY "Reservations viewable by authenticated users"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON TABLE public.reservations FROM anon;
