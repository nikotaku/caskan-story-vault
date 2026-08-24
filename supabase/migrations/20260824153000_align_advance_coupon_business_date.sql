-- Early-morning reservations are stored on their actual calendar date, while
-- coupon lead time follows the business date shown in the booking form.
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

REVOKE ALL ON FUNCTION public.validate_public_booking_price() FROM PUBLIC;
