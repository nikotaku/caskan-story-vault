-- Retry WEB booking notifications that were missed because the client closed,
-- LINE temporarily rejected the push, or an email provider was unavailable.
-- The Edge Function atomically claims each reservation, so manual and scheduled
-- retries cannot send the same notification concurrently.

do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'booking_notification_publishable_key'
  ) then
    if not exists (
      select 1 from vault.secrets where name = 'estama_review_sync_publishable_key'
    ) then
      raise exception 'The publishable key required for booking notification retries is not configured';
    end if;

    perform vault.create_secret(
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'estama_review_sync_publishable_key'
      ),
      'booking_notification_publishable_key',
      'Publishable key for scheduled WEB booking notification retries'
    );
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'retry-failed-booking-notifications'
  ) then
    perform cron.unschedule('retry-failed-booking-notifications');
  end if;

  perform cron.schedule(
    'retry-failed-booking-notifications',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := 'https://imrxzkivwrkqbhqfbbes.supabase.co/functions/v1/notify-line-booking',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'booking_notification_publishable_key'
          )
        ),
        body := jsonb_build_object('reservation_id', r.id),
        timeout_milliseconds := 30000
      ) as request_id
      from (
        select id
        from public.reservations
        where booking_origin in ('web_form', 'cast_form')
          and (line_notification_status <> 'sent' or email_notification_status not in ('sent'))
          and notification_attempt_count < 4
          and (
            (notification_attempt_count = 0 and created_at <= now() - interval '2 minutes')
            or (notification_attempt_count = 1 and notification_last_attempt_at <= now() - interval '5 minutes')
            or (notification_attempt_count = 2 and notification_last_attempt_at <= now() - interval '15 minutes')
            or (notification_attempt_count = 3 and notification_last_attempt_at <= now() - interval '60 minutes')
          )
        order by created_at
        limit 10
      ) r;
    $job$
  );
end;
$$;
