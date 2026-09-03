-- Build the authoritative reservation context used by the therapist LINE notification.
-- Only the Edge Function service role can read this payload because it contains customer data.
create or replace function public.get_reservation_line_context(p_reservation_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  with target as materialized (
    select
      reservation.id,
      reservation.cast_id,
      reservation.store_id,
      reservation.customer_name,
      reservation.reservation_date,
      reservation.start_time,
      reservation.duration,
      reservation.course_name,
      reservation.room,
      reservation.options,
      reservation.notes,
      reservation.price,
      reservation.payment_fee,
      reservation.nomination_type,
      public.norm_phone(reservation.customer_phone) as phone_key,
      cast_record.name as cast_name,
      cast_record.line_group_id,
      case
        -- "過去データ" is the pre-renewal history for the current Enka shop.
        when reservation.store_id in (
          '00000000-0000-0000-0000-000000000001'::uuid,
          '404499ab-5350-490f-9608-5814faffda6f'::uuid
        ) then array[
          '00000000-0000-0000-0000-000000000001'::uuid,
          '404499ab-5350-490f-9608-5814faffda6f'::uuid
        ]
        else array[reservation.store_id]
      end as visit_store_ids
    from public.reservations as reservation
    left join public.casts as cast_record on cast_record.id = reservation.cast_id
    where reservation.id = p_reservation_id
  )
  select jsonb_build_object(
    'reservation_id', target.id,
    'cast_id', target.cast_id,
    'cast_name', target.cast_name,
    'line_group_id', target.line_group_id,
    'customer_name', target.customer_name,
    'reservation_date', target.reservation_date,
    'start_time', target.start_time,
    'duration', target.duration,
    'extension_minutes', coalesce((
      select sum(greatest(coalesce(option_rate.extension_minutes, 0), 0))::integer
      from unnest(coalesce(target.options, array[]::text[])) as requested_option(option_name)
      join public.option_rates as option_rate
        on option_rate.store_id = target.store_id
       and option_rate.option_name = requested_option.option_name
    ), 0),
    'course_name', target.course_name,
    'room', target.room,
    'options', coalesce(to_jsonb(target.options), '[]'::jsonb),
    'notes', target.notes,
    'price', target.price,
    'payment_fee', coalesce(target.payment_fee, 0),
    'nomination_type', target.nomination_type,
    'store_visit_count', case
      when length(target.phone_key) < 10 then null
      else (
        select count(*)::integer
        from public.reservations as history
        where history.store_id = any(target.visit_store_ids)
          and public.norm_phone(history.customer_phone) = target.phone_key
          and history.status = 'completed'
          and history.id <> target.id
      )
    end,
    'cast_visit_count', case
      when length(target.phone_key) < 10
        or target.cast_id is null
        or btrim(coalesce(target.nomination_type, '')) <> '本指名'
        then null
      else (
        select count(*)::integer
        from public.reservations as history
        where history.store_id = any(target.visit_store_ids)
          and history.cast_id = target.cast_id
          and public.norm_phone(history.customer_phone) = target.phone_key
          and history.status = 'completed'
          and history.id <> target.id
      )
    end,
    'cast_history', case
      when length(target.phone_key) < 10
        or target.cast_id is null
        or btrim(coalesce(target.nomination_type, '')) <> '本指名'
        then null
      else coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'reservation_date', recent_history.reservation_date,
            'start_time', recent_history.start_time,
            'course_name', recent_history.course_name,
            'duration', recent_history.duration
          )
          order by recent_history.reservation_date desc, recent_history.start_time desc, recent_history.created_at desc
        )
        from (
          select
            history.reservation_date,
            history.start_time,
            history.course_name,
            history.duration,
            history.created_at
          from public.reservations as history
          where history.store_id = any(target.visit_store_ids)
            and history.cast_id = target.cast_id
            and public.norm_phone(history.customer_phone) = target.phone_key
            and history.status = 'completed'
            and history.id <> target.id
          order by history.reservation_date desc, history.start_time desc, history.created_at desc
          limit 3
        ) as recent_history
      ), '[]'::jsonb)
    end
  )
  from target;
$function$;

revoke all on function public.get_reservation_line_context(uuid) from public;
revoke all on function public.get_reservation_line_context(uuid) from anon;
revoke all on function public.get_reservation_line_context(uuid) from authenticated;
grant execute on function public.get_reservation_line_context(uuid) to service_role;
