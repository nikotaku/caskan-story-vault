-- エスたまの「セラピストアピール」を、公開HPと同じ出勤表示を基準に
-- 1営業日3回まで安全に実行する。営業日はJST 06:00で切り替える。
--
-- Vercelには管理鍵を渡さず、pg_cronが発行する一回限りのdispatch tokenと、
-- dispatchをclaimした時だけ返す短時間のrun tokenでRPCを保護する。

alter table public.estama_sync_tokens
  drop constraint if exists estama_sync_tokens_purpose_check;

alter table public.estama_sync_tokens
  add constraint estama_sync_tokens_purpose_check
  check (
    purpose in (
      'dispatcher',
      'worker',
      'profile-worker',
      'availability-refresh',
      'therapist-appeal'
    )
    or purpose like 'report:%'
    or purpose like 'notify:%'
    or purpose like 'continue:%'
  );

create table if not exists private.estama_appeal_dispatch_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  token_hash text not null unique,
  dispatch_token_hash text not null,
  business_date date not null,
  store_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists estama_appeal_dispatch_runs_expires_idx
  on private.estama_appeal_dispatch_runs (expires_at);

revoke all on table private.estama_appeal_dispatch_runs
  from public, anon, authenticated;

create table if not exists public.estama_therapist_appeal_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  appeal_date date not null,
  slot smallint not null check (slot between 1 and 3),
  scheduled_for timestamptz not null,
  cast_id uuid references public.casts(id) on delete set null,
  cast_name text not null,
  shift_id uuid references public.shifts(id) on delete set null,
  connection_id uuid references public.automation_connections(id) on delete set null,
  external_cast_id text not null,
  remote_name text,
  status text not null check (
    status in ('running', 'success', 'skipped', 'error', 'uncertain')
  ),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  dispatch_run_id uuid,
  report_id uuid references public.estama_sync_reports(id) on delete set null,
  started_at timestamptz not null default now(),
  click_started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, appeal_date, slot)
);

create index if not exists estama_therapist_appeal_runs_store_date_idx
  on public.estama_therapist_appeal_runs (store_id, appeal_date desc, slot);

create index if not exists estama_therapist_appeal_runs_cast_success_idx
  on public.estama_therapist_appeal_runs (store_id, appeal_date, cast_id)
  where status = 'success';

create index if not exists estama_therapist_appeal_runs_cast_id_idx
  on public.estama_therapist_appeal_runs (cast_id)
  where cast_id is not null;

create index if not exists estama_therapist_appeal_runs_shift_id_idx
  on public.estama_therapist_appeal_runs (shift_id)
  where shift_id is not null;

create index if not exists estama_therapist_appeal_runs_connection_id_idx
  on public.estama_therapist_appeal_runs (connection_id)
  where connection_id is not null;

create index if not exists estama_therapist_appeal_runs_report_id_idx
  on public.estama_therapist_appeal_runs (report_id)
  where report_id is not null;

alter table public.estama_therapist_appeal_runs enable row level security;

drop policy if exists estama_therapist_appeal_runs_store_managers_read
  on public.estama_therapist_appeal_runs;
create policy estama_therapist_appeal_runs_store_managers_read
  on public.estama_therapist_appeal_runs
  for select
  to authenticated
  using ((select public.can_manage_store(store_id)));

revoke all on table public.estama_therapist_appeal_runs
  from public, anon, authenticated;
grant select on table public.estama_therapist_appeal_runs
  to authenticated;
grant select, insert, update, delete on table public.estama_therapist_appeal_runs
  to service_role;

comment on table public.estama_therapist_appeal_runs is
  'エスたまのセラピストアピール自動実行履歴。JST 06:00始まりの営業日ごとに最大3枠を記録する。';
comment on column public.estama_therapist_appeal_runs.click_started_at is
  '外部サイトでクリックする直前に記録する。以後の失敗は重複防止のためuncertainで確定する。';
comment on column public.estama_therapist_appeal_runs.attempt_count is
  'クリック前エラーの再試行回数を含む実行回数。恒久エラー時の外部ブラウザ消費を防ぐため最大3回。';

create or replace function private.guard_estama_job_context_lease()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider <> 'estama'
     or old.status <> 'queued'
     or new.status <> 'running'
     or new.store_id is null then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estama-context:' || new.store_id::text, 0)
  );

  if exists (
    select 1
    from private.estama_context_leases as lease
    where lease.store_id = new.store_id
      and lease.expires_at > now()
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_estama_job_context_lease()
  from public, anon, authenticated;

drop trigger if exists guard_estama_job_context_lease
  on public.automation_jobs;
create trigger guard_estama_job_context_lease
before update of status on public.automation_jobs
for each row
when (
  old.status = 'queued'
  and new.status = 'running'
  and new.provider = 'estama'
)
execute function private.guard_estama_job_context_lease();

create or replace function public.claim_estama_appeal_dispatch(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch_hash text;
  v_business_date date := (
    timezone('Asia/Tokyo', now()) - interval '6 hours'
  )::date;
  v_run_id uuid;
  v_run_token text;
  v_run_hash text;
  v_store_ids uuid[] := '{}'::uuid[];
  v_connections jsonb := '[]'::jsonb;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update public.estama_sync_tokens
  set used_at = now()
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and purpose = 'therapist-appeal'
    and used_at is null
    and expires_at > now()
  returning token_hash into v_dispatch_hash;

  if v_dispatch_hash is null then
    return null;
  end if;

  delete from private.estama_appeal_dispatch_runs
  where expires_at <= now();
  delete from private.estama_context_leases
  where expires_at <= now();

  v_run_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_run_hash := encode(extensions.digest(v_run_token, 'sha256'), 'hex');

  select coalesce(array_agg(connection.store_id order by connection.created_at), '{}'::uuid[])
  into v_store_ids
  from public.automation_connections as connection
  where connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null;

  insert into private.estama_appeal_dispatch_runs (
    token_hash,
    dispatch_token_hash,
    business_date,
    store_ids,
    expires_at
  ) values (
    v_run_hash,
    v_dispatch_hash,
    v_business_date,
    v_store_ids,
    now() + interval '20 minutes'
  )
  returning id into v_run_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', connection.id,
        'store_id', connection.store_id,
        'status', connection.status,
        'browserbase_context_id', connection.browserbase_context_id,
        'setup_session_id', connection.setup_session_id,
        'shop_id', connection.shop_id,
        'configuration', '{}'::jsonb,
        'shifts', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'shiftId', shift_row.id,
                'castId', cast_row.id,
                'castName', cast_row.name,
                'startTime', shift_row.start_time::text,
                'endTime', shift_row.end_time::text,
                'externalId', profile.external_cast_id,
                'remoteName', profile.remote_name,
                'syncStatus', profile.sync_status
              ) order by shift_row.start_time, cast_row.name, shift_row.id
            ),
            '[]'::jsonb
          )
          from public.shifts as shift_row
          join public.casts as cast_row
            on cast_row.id = shift_row.cast_id
           and cast_row.store_id = connection.store_id
          left join lateral (
            select
              external_profile.external_cast_id,
              external_profile.remote_name,
              external_profile.sync_status
            from public.external_cast_profiles as external_profile
            where external_profile.store_id = connection.store_id
              and external_profile.cast_id = cast_row.id
              and external_profile.provider = 'estama'
            order by external_profile.updated_at desc, external_profile.id
            limit 1
          ) as profile on true
          where shift_row.store_id = connection.store_id
            and shift_row.shift_date = v_business_date
            -- 公開HPと同じ条件。approval_status/statusはHPが絞っていないため
            -- ここでも追加条件にしない。
            and cast_row.is_active = true
            and cast_row.is_visible = true
            and shift_row.end_time <> shift_row.start_time
        ),
        'slots', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'slot', appeal.slot,
                'status', appeal.status,
                'attemptCount', appeal.attempt_count,
                'scheduledFor', appeal.scheduled_for,
                'castId', appeal.cast_id,
                'castName', appeal.cast_name,
                'clickStartedAt', appeal.click_started_at,
                'finishedAt', appeal.finished_at
              ) order by appeal.slot
            ),
            '[]'::jsonb
          )
          from public.estama_therapist_appeal_runs as appeal
          where appeal.store_id = connection.store_id
            and appeal.appeal_date = v_business_date
        )
      ) order by connection.created_at, connection.id
    ),
    '[]'::jsonb
  )
  into v_connections
  from public.automation_connections as connection
  where connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null
    and connection.store_id = any(v_store_ids);

  return jsonb_build_object(
    'runToken', v_run_token,
    'businessDate', v_business_date,
    'connections', v_connections
  );
end;
$$;

revoke all on function public.claim_estama_appeal_dispatch(text)
  from public, anon, authenticated;
grant execute on function public.claim_estama_appeal_dispatch(text)
  to anon, authenticated, service_role;

create or replace function public.claim_estama_appeal_slot(
  p_run_token text,
  p_store_id uuid,
  p_slot integer,
  p_scheduled_for timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch_run_id uuid;
  v_run_hash text;
  v_business_date date;
  v_business_start timestamptz;
  v_business_end timestamptz;
  v_connection public.automation_connections%rowtype;
  v_existing public.estama_therapist_appeal_runs%rowtype;
  v_has_existing boolean := false;
  v_shift_id uuid;
  v_cast_id uuid;
  v_cast_name text;
  v_external_cast_id text;
  v_remote_name text;
  v_report_id uuid;
  v_attempt_id uuid;
  v_lease_rows integer := 0;
begin
  if p_store_id is null
     or p_slot is null
     or p_slot not between 1 and 3
     or p_scheduled_for is null
     or coalesce(p_run_token, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_request');
  end if;

  select dispatch_run.id, dispatch_run.token_hash, dispatch_run.business_date
  into v_dispatch_run_id, v_run_hash, v_business_date
  from private.estama_appeal_dispatch_runs as dispatch_run
  where dispatch_run.token_hash = encode(
      extensions.digest(p_run_token, 'sha256'),
      'hex'
    )
    and dispatch_run.expires_at > now()
    and p_store_id = any(dispatch_run.store_ids);

  if v_dispatch_run_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_run_token');
  end if;

  v_business_start := (
    v_business_date::timestamp + time '06:00'
  ) at time zone 'Asia/Tokyo';
  v_business_end := v_business_start + interval '1 day';

  if now() < v_business_start
     or now() >= v_business_end
     or p_scheduled_for < v_business_start
     or p_scheduled_for >= v_business_end
     or p_scheduled_for > now() + interval '1 minute' then
    return jsonb_build_object('claimed', false, 'reason', 'slot_not_due');
  end if;

  -- Serialize the running-job check with the queued -> running trigger so a
  -- regular Estama job cannot start in the gap before this appeal lease.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('estama-context:' || p_store_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'estama-appeal:' || p_store_id::text || ':' || v_business_date::text,
      0
    )
  );

  select connection.*
  into v_connection
  from public.automation_connections as connection
  where connection.store_id = p_store_id
    and connection.provider = 'estama'
    and connection.status = 'ready'
    and connection.browserbase_context_id is not null
  order by connection.updated_at desc, connection.id
  limit 1;

  if v_connection.id is null then
    return jsonb_build_object('claimed', false, 'reason', 'connection_not_ready');
  end if;

  if exists (
    select 1
    from public.automation_jobs as job
    where job.store_id = p_store_id
      and job.provider = 'estama'
      and job.status = 'running'
      and coalesce(job.started_at, job.updated_at, job.created_at)
        > now() - case
          when job.job_type = 'estama_sync_shift' then interval '3 hours'
          else interval '15 minutes'
        end
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'automation_running');
  end if;

  -- workerがクリック後に途切れた場合は再試行しない。クリック前だけerrorとして
  -- 同じslotを後続runが再claimできる。
  update public.estama_therapist_appeal_runs as stale
  set status = case
        when stale.click_started_at is null then 'error'
        else 'uncertain'
      end,
      finished_at = now(),
      error_message = case
        when stale.click_started_at is null
          then 'アピール処理がクリック前に中断されました'
        else 'クリック後に結果確認が中断されたため、重複防止のため再実行していません'
      end,
      result = stale.result || jsonb_build_object('reason', 'stale_worker'),
      updated_at = now()
  where stale.store_id = p_store_id
    and stale.appeal_date = v_business_date
    and stale.status = 'running'
    and greatest(
      stale.started_at,
      coalesce(stale.click_started_at, stale.started_at),
      stale.updated_at
    ) < now() - interval '12 minutes'
    and not exists (
      select 1
      from private.estama_context_leases as active_lease
      where active_lease.store_id = stale.store_id
        and active_lease.operation = 'therapist-appeal'
        and active_lease.expires_at > now()
    );

  update public.estama_sync_reports as report
  set status = 'error',
      finished_at = coalesce(appeal.finished_at, now()),
      total_count = 1,
      success_count = 0,
      cast_names = array[appeal.cast_name],
      summary = case
        when appeal.status = 'uncertain'
          then '⚠️ エスたま セラピストアピールの結果確認が必要です。' || E'\n'
            || appeal.cast_name || '：クリック後に処理が中断されました。'
        else '⚠️ エスたま セラピストアピールを実行できませんでした。' || E'\n'
            || appeal.cast_name || '：クリック前に処理が中断されました。'
      end,
      fatal_error = appeal.error_message,
      results = jsonb_build_object(
        'kind', 'therapist_appeal',
        'appealRunId', appeal.id,
        'appealDate', appeal.appeal_date,
        'slot', appeal.slot,
        'status', appeal.status,
        'castId', appeal.cast_id,
        'castName', appeal.cast_name
      )
  from public.estama_therapist_appeal_runs as appeal
  where report.id = appeal.report_id
    and appeal.store_id = p_store_id
    and appeal.appeal_date = v_business_date
    and appeal.status in ('error', 'uncertain')
    and report.status = 'warning';

  delete from private.estama_context_leases
  where expires_at <= now();

  select appeal.*
  into v_existing
  from public.estama_therapist_appeal_runs as appeal
  where appeal.store_id = p_store_id
    and appeal.appeal_date = v_business_date
    and appeal.slot = p_slot
  for update;
  v_has_existing := found;

  if v_has_existing and v_existing.status in ('success', 'skipped', 'uncertain') then
    return jsonb_build_object(
      'claimed', false,
      'reason', 'slot_finished',
      'status', v_existing.status
    );
  end if;

  if v_has_existing
     and v_existing.status = 'error'
     and v_existing.attempt_count >= 3 then
    return jsonb_build_object('claimed', false, 'reason', 'retry_exhausted');
  end if;

  if v_has_existing
     and v_existing.status = 'running'
     and v_existing.started_at >= now() - interval '12 minutes' then
    return jsonb_build_object('claimed', false, 'reason', 'slot_running');
  end if;

  if exists (
    select 1
    from public.estama_therapist_appeal_runs as active_run
    where active_run.store_id = p_store_id
      and active_run.appeal_date = v_business_date
      and active_run.status = 'running'
      and active_run.slot <> p_slot
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'store_running');
  end if;

  -- 公開HPと同じshift/cast条件のうち、現在の時刻が実際の出勤枠内で、
  -- エスたまプロフィールが同期済みの人だけを候補にする。
  -- 同日の成功回数が最少の人を優先し、同数ならランダムで選ぶ。
  select
    candidate.shift_id,
    candidate.cast_id,
    candidate.cast_name,
    candidate.external_cast_id,
    candidate.remote_name
  into
    v_shift_id,
    v_cast_id,
    v_cast_name,
    v_external_cast_id,
    v_remote_name
  from (
    select distinct on (cast_row.id)
      shift_row.id as shift_id,
      cast_row.id as cast_id,
      cast_row.name as cast_name,
      profile.external_cast_id,
      profile.remote_name,
      (
        select count(*)
        from public.estama_therapist_appeal_runs as prior
        where prior.store_id = p_store_id
          and prior.appeal_date = v_business_date
          and prior.cast_id = cast_row.id
          and prior.status = 'success'
      ) as successful_appeals
    from public.shifts as shift_row
    join public.casts as cast_row
      on cast_row.id = shift_row.cast_id
     and cast_row.store_id = p_store_id
    join lateral (
      select
        external_profile.external_cast_id,
        external_profile.remote_name
      from public.external_cast_profiles as external_profile
      where external_profile.store_id = p_store_id
        and external_profile.cast_id = cast_row.id
        and external_profile.provider = 'estama'
        and external_profile.sync_status = 'synced'
        and nullif(btrim(external_profile.external_cast_id), '') is not null
      order by external_profile.updated_at desc, external_profile.id
      limit 1
    ) as profile on true
    where shift_row.store_id = p_store_id
      and shift_row.shift_date = v_business_date
      and cast_row.is_active = true
      and cast_row.is_visible = true
      and shift_row.end_time <> shift_row.start_time
      and now() >= (
        shift_row.shift_date + shift_row.start_time
      ) at time zone 'Asia/Tokyo'
      and now() < (
        (shift_row.shift_date + shift_row.end_time)
        + case
            when shift_row.end_time < shift_row.start_time
              then interval '1 day'
            else interval '0 days'
          end
      ) at time zone 'Asia/Tokyo'
    order by cast_row.id, shift_row.start_time, shift_row.id
  ) as candidate
  order by candidate.successful_appeals, random()
  limit 1;

  if v_cast_id is null then
    return jsonb_build_object('claimed', false, 'reason', 'no_active_candidate');
  end if;

  insert into private.estama_context_leases as lease (
    store_id,
    owner_token,
    operation,
    acquired_at,
    expires_at
  ) values (
    p_store_id,
    v_run_hash,
    'therapist-appeal',
    now(),
    now() + interval '10 minutes'
  )
  on conflict (store_id) do update
  set owner_token = excluded.owner_token,
      operation = excluded.operation,
      acquired_at = excluded.acquired_at,
      expires_at = excluded.expires_at
  where lease.expires_at <= now()
     or lease.owner_token = excluded.owner_token;

  get diagnostics v_lease_rows = row_count;
  if v_lease_rows <> 1 then
    return jsonb_build_object('claimed', false, 'reason', 'connection_busy');
  end if;

  if v_has_existing and v_existing.report_id is not null then
    v_report_id := v_existing.report_id;
  else
    insert into public.estama_sync_reports (
      store_id,
      shop_id,
      status,
      started_at,
      finished_at,
      total_count,
      success_count,
      cast_names,
      summary,
      results,
      evidence,
      missing_profiles,
      fatal_error
    ) values (
      p_store_id,
      v_connection.shop_id,
      'warning',
      now(),
      now(),
      1,
      0,
      array[v_cast_name],
      '⏳ エスたま セラピストアピールを開始しました。' || E'\n'
        || v_cast_name || '（' || p_slot::text || '/3回目）',
      jsonb_build_object(
        'kind', 'therapist_appeal',
        'appealDate', v_business_date,
        'slot', p_slot,
        'scheduledFor', p_scheduled_for,
        'castId', v_cast_id,
        'castName', v_cast_name,
        'externalCastId', v_external_cast_id
      ),
      '[]'::jsonb,
      array[]::text[],
      null
    )
    returning id into v_report_id;
  end if;

  if v_has_existing then
    update public.estama_therapist_appeal_runs
    set scheduled_for = p_scheduled_for,
        cast_id = v_cast_id,
        cast_name = v_cast_name,
        shift_id = v_shift_id,
        connection_id = v_connection.id,
        external_cast_id = v_external_cast_id,
        remote_name = v_remote_name,
        status = 'running',
        attempt_count = least(attempt_count + 1, 3),
        dispatch_run_id = v_dispatch_run_id,
        report_id = v_report_id,
        started_at = now(),
        click_started_at = null,
        finished_at = null,
        error_message = null,
        result = '{}'::jsonb,
        updated_at = now()
    where id = v_existing.id
      and status = 'error'
      and click_started_at is null
    returning id into v_attempt_id;
  else
    insert into public.estama_therapist_appeal_runs (
      store_id,
      appeal_date,
      slot,
      scheduled_for,
      cast_id,
      cast_name,
      shift_id,
      connection_id,
      external_cast_id,
      remote_name,
      status,
      attempt_count,
      dispatch_run_id,
      report_id,
      started_at
    ) values (
      p_store_id,
      v_business_date,
      p_slot,
      p_scheduled_for,
      v_cast_id,
      v_cast_name,
      v_shift_id,
      v_connection.id,
      v_external_cast_id,
      v_remote_name,
      'running',
      1,
      v_dispatch_run_id,
      v_report_id,
      now()
    )
    returning id into v_attempt_id;
  end if;

  if v_attempt_id is null then
    delete from private.estama_context_leases
    where store_id = p_store_id
      and owner_token = v_run_hash;
    return jsonb_build_object('claimed', false, 'reason', 'slot_conflict');
  end if;

  update public.estama_sync_reports
  set status = 'warning',
      started_at = now(),
      finished_at = now(),
      total_count = 1,
      success_count = 0,
      cast_names = array[v_cast_name],
      summary = '⏳ エスたま セラピストアピールを開始しました。' || E'\n'
        || v_cast_name || '（' || p_slot::text || '/3回目）',
      results = jsonb_build_object(
        'kind', 'therapist_appeal',
        'appealRunId', v_attempt_id,
        'appealDate', v_business_date,
        'slot', p_slot,
        'attemptCount', (
          select appeal.attempt_count
          from public.estama_therapist_appeal_runs as appeal
          where appeal.id = v_attempt_id
        ),
        'scheduledFor', p_scheduled_for,
        'castId', v_cast_id,
        'castName', v_cast_name,
        'externalCastId', v_external_cast_id
      ),
      fatal_error = null
  where id = v_report_id;

  return jsonb_build_object(
    'claimed', true,
    'connection', jsonb_build_object(
      'id', v_connection.id,
      'store_id', v_connection.store_id,
      'status', v_connection.status,
      'browserbase_context_id', v_connection.browserbase_context_id,
      'setup_session_id', v_connection.setup_session_id,
      'shop_id', v_connection.shop_id,
      'configuration', '{}'::jsonb
    ),
    'target', jsonb_build_object(
      'appealRunId', v_attempt_id,
      'slot', p_slot,
      'attemptCount', (
        select appeal.attempt_count
        from public.estama_therapist_appeal_runs as appeal
        where appeal.id = v_attempt_id
      ),
      'businessDate', v_business_date,
      'scheduledFor', p_scheduled_for,
      'shiftId', v_shift_id,
      'castId', v_cast_id,
      'castName', v_cast_name,
      'externalId', v_external_cast_id,
      'remoteName', v_remote_name
    )
  );
end;
$$;

revoke all on function public.claim_estama_appeal_slot(text, uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_estama_appeal_slot(text, uuid, integer, timestamptz)
  to anon, authenticated, service_role;

create or replace function public.mark_estama_appeal_click(
  p_run_token text,
  p_store_id uuid,
  p_slot integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch_run_id uuid;
  v_run_hash text;
  v_business_date date;
  v_rows integer := 0;
begin
  if p_store_id is null
     or p_slot is null
     or p_slot not between 1 and 3
     or coalesce(p_run_token, '') !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select dispatch_run.id, dispatch_run.token_hash, dispatch_run.business_date
  into v_dispatch_run_id, v_run_hash, v_business_date
  from private.estama_appeal_dispatch_runs as dispatch_run
  where dispatch_run.token_hash = encode(
      extensions.digest(p_run_token, 'sha256'),
      'hex'
    )
    and dispatch_run.expires_at > now()
    and p_store_id = any(dispatch_run.store_ids);

  if v_dispatch_run_id is null
     or v_business_date <> (
       timezone('Asia/Tokyo', now()) - interval '6 hours'
     )::date
     or not exists (
       select 1
       from private.estama_context_leases as lease
       where lease.store_id = p_store_id
         and lease.owner_token = v_run_hash
         and lease.operation = 'therapist-appeal'
         and lease.expires_at > now()
     ) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'estama-appeal:' || p_store_id::text || ':' || v_business_date::text,
      0
    )
  );

  update public.estama_therapist_appeal_runs as appeal
  set click_started_at = now(),
      updated_at = now()
  where appeal.store_id = p_store_id
    and appeal.appeal_date = v_business_date
    and appeal.slot = p_slot
    and appeal.dispatch_run_id = v_dispatch_run_id
    and appeal.status = 'running'
    and appeal.click_started_at is null
    and exists (
      select 1
      from public.shifts as shift_row
      join public.casts as cast_row
        on cast_row.id = shift_row.cast_id
       and cast_row.store_id = p_store_id
       and cast_row.is_active = true
       and cast_row.is_visible = true
      join public.external_cast_profiles as profile
        on profile.store_id = p_store_id
       and profile.cast_id = cast_row.id
       and profile.provider = 'estama'
       and profile.sync_status = 'synced'
       and profile.external_cast_id = appeal.external_cast_id
      where shift_row.id = appeal.shift_id
        and shift_row.store_id = p_store_id
        and shift_row.shift_date = v_business_date
        and shift_row.end_time <> shift_row.start_time
        and now() >= (
          shift_row.shift_date + shift_row.start_time
        ) at time zone 'Asia/Tokyo'
        and now() < (
          (shift_row.shift_date + shift_row.end_time)
          + case
              when shift_row.end_time < shift_row.start_time
                then interval '1 day'
              else interval '0 days'
            end
        ) at time zone 'Asia/Tokyo'
    );

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    return false;
  end if;

  update private.estama_context_leases
  set expires_at = now() + interval '10 minutes'
  where store_id = p_store_id
    and owner_token = v_run_hash
    and operation = 'therapist-appeal';

  return true;
end;
$$;

revoke all on function public.mark_estama_appeal_click(text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.mark_estama_appeal_click(text, uuid, integer)
  to anon, authenticated, service_role;

create or replace function public.save_estama_appeal_result(
  p_run_token text,
  p_store_id uuid,
  p_slot integer,
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch_run_id uuid;
  v_run_hash text;
  v_business_date date;
  v_appeal public.estama_therapist_appeal_runs%rowtype;
  v_requested_status text;
  v_final_status text;
  v_error_message text;
  v_report_status text;
  v_summary text;
begin
  if p_store_id is null
     or p_slot is null
     or p_slot not between 1 and 3
     or coalesce(p_run_token, '') !~ '^[0-9a-f]{64}$'
     or p_payload is null
     or jsonb_typeof(p_payload) is distinct from 'object'
     or octet_length(p_payload::text) > 100000 then
    return false;
  end if;

  select dispatch_run.id, dispatch_run.token_hash, dispatch_run.business_date
  into v_dispatch_run_id, v_run_hash, v_business_date
  from private.estama_appeal_dispatch_runs as dispatch_run
  where dispatch_run.token_hash = encode(
      extensions.digest(p_run_token, 'sha256'),
      'hex'
    )
    and dispatch_run.expires_at > now()
    and p_store_id = any(dispatch_run.store_ids);

  if v_dispatch_run_id is null then
    return false;
  end if;
  if v_business_date <> (
    timezone('Asia/Tokyo', now()) - interval '6 hours'
  )::date then
    delete from private.estama_context_leases
    where store_id = p_store_id
      and owner_token = v_run_hash
      and operation = 'therapist-appeal';
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'estama-appeal:' || p_store_id::text || ':' || v_business_date::text,
      0
    )
  );

  select appeal.*
  into v_appeal
  from public.estama_therapist_appeal_runs as appeal
  where appeal.store_id = p_store_id
    and appeal.appeal_date = v_business_date
    and appeal.slot = p_slot
    and appeal.dispatch_run_id = v_dispatch_run_id
  for update;

  if v_appeal.id is null then
    return false;
  end if;
  if v_appeal.status <> 'running' then
    delete from private.estama_context_leases
    where store_id = p_store_id
      and owner_token = v_run_hash
      and operation = 'therapist-appeal';
    return true;
  end if;

  v_requested_status := case p_payload ->> 'status'
    when 'success' then 'success'
    when 'skipped' then 'skipped'
    else 'error'
  end;

  -- クリック記録後に成功確認できなかった場合は、再クリックを禁止するため
  -- error/skippedではなくuncertainを最終状態にする。
  v_final_status := case
    when v_requested_status = 'success' and v_appeal.click_started_at is not null
      then 'success'
    when v_appeal.click_started_at is not null
      then 'uncertain'
    when v_requested_status = 'skipped'
      then 'skipped'
    else 'error'
  end;

  v_error_message := nullif(
    left(
      coalesce(
        p_payload ->> 'error',
        p_payload ->> 'fatalError',
        p_payload ->> 'message',
        case
          when v_requested_status = 'success'
               and v_appeal.click_started_at is null
            then 'クリック開始記録がないため成功として保存しませんでした'
          else ''
        end
      ),
      1000
    ),
    ''
  );

  update public.estama_therapist_appeal_runs
  set status = v_final_status,
      finished_at = now(),
      error_message = case
        when v_final_status = 'success' then null
        else v_error_message
      end,
      result = p_payload,
      updated_at = now()
  where id = v_appeal.id;

  v_report_status := case
    when v_final_status = 'success' then 'success'
    when v_final_status = 'skipped' then 'warning'
    else 'error'
  end;

  v_summary := coalesce(
    nullif(left(coalesce(p_payload ->> 'summary', ''), 5000), ''),
    case
      when v_final_status = 'success'
        then '✅ エスたま セラピストアピール完了' || E'\n'
          || v_appeal.cast_name || '（' || p_slot::text || '/3回目）'
      when v_final_status = 'skipped'
        then 'ℹ️ エスたま セラピストアピールを見送りました。' || E'\n'
          || v_appeal.cast_name || '（' || p_slot::text || '/3回目）'
      when v_final_status = 'uncertain'
        then '⚠️ エスたま セラピストアピールの結果確認が必要です。' || E'\n'
          || v_appeal.cast_name || '：クリック後の完了表示を確認できませんでした。'
      else '⚠️ エスたま セラピストアピールを実行できませんでした。' || E'\n'
          || v_appeal.cast_name || '：クリック前に停止しました。'
    end
  );

  update public.estama_sync_reports
  set status = v_report_status,
      finished_at = now(),
      total_count = 1,
      success_count = case when v_final_status = 'success' then 1 else 0 end,
      cast_names = array[v_appeal.cast_name],
      summary = v_summary,
      results = jsonb_build_object(
        'kind', 'therapist_appeal',
        'appealRunId', v_appeal.id,
        'appealDate', v_business_date,
        'slot', p_slot,
        'scheduledFor', v_appeal.scheduled_for,
        'status', v_final_status,
        'castId', v_appeal.cast_id,
        'castName', v_appeal.cast_name,
        'externalCastId', v_appeal.external_cast_id,
        'result', p_payload
      ),
      fatal_error = case
        when v_final_status in ('error', 'uncertain') then v_error_message
        else null
      end
  where id = v_appeal.report_id;

  update public.automation_connections as connection
  set configuration = jsonb_set(
        case
          when jsonb_typeof(connection.configuration) = 'object'
            then connection.configuration
          else '{}'::jsonb
        end,
        '{therapist_appeal}',
        case
          when jsonb_typeof(connection.configuration -> 'therapist_appeal') = 'object'
            then connection.configuration -> 'therapist_appeal'
          else '{}'::jsonb
        end
        || case
             when jsonb_typeof(p_payload -> 'configuration') = 'object'
               then p_payload -> 'configuration'
             else '{}'::jsonb
           end
        || jsonb_build_object(
          'lastRunAt', now(),
          'lastStatus', v_final_status,
          'lastAppealDate', v_business_date,
          'lastSlot', p_slot,
          'lastCastId', v_appeal.cast_id,
          'lastCastName', v_appeal.cast_name
        ),
        true
      ),
      status = case
        when p_payload ->> 'connectionStatus' = 'login_in_progress'
          then 'login_in_progress'
        else connection.status
      end,
      last_error = case
        when p_payload ->> 'connectionStatus' = 'login_in_progress'
          then left(coalesce(
            p_payload ->> 'connectionError',
            p_payload ->> 'fatalError',
            v_error_message,
            ''
          ), 1000)
        else connection.last_error
      end,
      updated_at = now()
  where connection.id = v_appeal.connection_id
    and connection.store_id = p_store_id
    and connection.provider = 'estama';

  delete from private.estama_context_leases
  where store_id = p_store_id
    and owner_token = v_run_hash
    and operation = 'therapist-appeal';

  return true;
end;
$$;

revoke all on function public.save_estama_appeal_result(text, uuid, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_estama_appeal_result(text, uuid, integer, jsonb)
  to anon, authenticated, service_role;

create or replace function private.dispatch_estama_therapist_appeal()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_date date := (
    timezone('Asia/Tokyo', now()) - interval '6 hours'
  )::date;
  v_raw_token text;
  v_request_id bigint;
begin
  -- 期限切れworkerを安全側へ倒す。クリック前は再試行可能なerror、
  -- クリック後は再実行禁止のuncertainにする。
  update public.estama_therapist_appeal_runs as stale
  set status = case
        when stale.click_started_at is null then 'error'
        else 'uncertain'
      end,
      finished_at = now(),
      error_message = case
        when stale.click_started_at is null
          then 'アピール処理がクリック前に中断されました'
        else 'クリック後に結果確認が中断されたため、重複防止のため再実行していません'
      end,
      result = stale.result || jsonb_build_object('reason', 'stale_worker'),
      updated_at = now()
  where stale.status = 'running'
    and greatest(
      stale.started_at,
      coalesce(stale.click_started_at, stale.started_at),
      stale.updated_at
    ) < now() - interval '12 minutes'
    and not exists (
      select 1
      from private.estama_context_leases as active_lease
      where active_lease.store_id = stale.store_id
        and active_lease.operation = 'therapist-appeal'
        and active_lease.expires_at > now()
    );

  update public.estama_sync_reports as report
  set status = 'error',
      finished_at = coalesce(appeal.finished_at, now()),
      total_count = 1,
      success_count = 0,
      cast_names = array[appeal.cast_name],
      summary = case
        when appeal.status = 'uncertain'
          then '⚠️ エスたま セラピストアピールの結果確認が必要です。' || E'\n'
            || appeal.cast_name || '：クリック後に処理が中断されました。'
        else '⚠️ エスたま セラピストアピールを実行できませんでした。' || E'\n'
            || appeal.cast_name || '：クリック前に処理が中断されました。'
      end,
      fatal_error = appeal.error_message,
      results = jsonb_build_object(
        'kind', 'therapist_appeal',
        'appealRunId', appeal.id,
        'appealDate', appeal.appeal_date,
        'slot', appeal.slot,
        'status', appeal.status,
        'castId', appeal.cast_id,
        'castName', appeal.cast_name
      )
  from public.estama_therapist_appeal_runs as appeal
  where report.id = appeal.report_id
    and appeal.status in ('error', 'uncertain')
    and report.status = 'warning';

  delete from private.estama_context_leases
  where expires_at <= now();
  delete from private.estama_appeal_dispatch_runs
  where expires_at <= now();
  delete from public.estama_sync_tokens
  where expires_at < now() - interval '1 day';

  -- 現在HPに表示中かつ実際の出勤枠内で、同期済みプロフィールを持つ人が
  -- 一人もいない時はVercelを呼ばない。
  if not exists (
    select 1
    from public.automation_connections as connection
    join public.shifts as shift_row
      on shift_row.store_id = connection.store_id
     and shift_row.shift_date = v_business_date
    join public.casts as cast_row
      on cast_row.id = shift_row.cast_id
     and cast_row.store_id = connection.store_id
     and cast_row.is_active = true
     and cast_row.is_visible = true
    join public.external_cast_profiles as profile
      on profile.store_id = connection.store_id
     and profile.cast_id = cast_row.id
     and profile.provider = 'estama'
     and profile.sync_status = 'synced'
     and nullif(btrim(profile.external_cast_id), '') is not null
    where connection.provider = 'estama'
      and connection.status = 'ready'
      and connection.browserbase_context_id is not null
      and shift_row.end_time <> shift_row.start_time
      and now() >= (
        shift_row.shift_date + shift_row.start_time
      ) at time zone 'Asia/Tokyo'
      and now() < (
        (shift_row.shift_date + shift_row.end_time)
        + case
            when shift_row.end_time < shift_row.start_time
              then interval '1 day'
            else interval '0 days'
          end
      ) at time zone 'Asia/Tokyo'
      and (
        select count(*)
        from public.estama_therapist_appeal_runs as completed
        where completed.store_id = connection.store_id
          and completed.appeal_date = v_business_date
          and completed.status in ('success', 'skipped', 'uncertain')
      ) < 3
      and not exists (
        select 1
        from public.estama_therapist_appeal_runs as blocked
        where blocked.store_id = connection.store_id
          and blocked.appeal_date = v_business_date
          and (
            blocked.status in ('skipped', 'uncertain')
            or (blocked.status = 'error' and blocked.attempt_count >= 3)
          )
      )
  ) then
    return null;
  end if;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.estama_sync_tokens (token_hash, purpose, expires_at)
  values (
    encode(extensions.digest(v_raw_token, 'sha256'), 'hex'),
    'therapist-appeal',
    now() + interval '10 minutes'
  );

  select net.http_post(
    url := 'https://newkyasukan.vercel.app/api/cron/estama-appeal',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('token', v_raw_token),
    timeout_milliseconds := 300000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.dispatch_estama_therapist_appeal()
  from public, anon, authenticated;
grant execute on function private.dispatch_estama_therapist_appeal()
  to service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'estama-therapist-appeal'
  ) then
    perform cron.unschedule('estama-therapist-appeal');
  end if;

  perform cron.schedule(
    'estama-therapist-appeal',
    '*/5 * * * *',
    $job$select private.dispatch_estama_therapist_appeal();$job$
  );
end;
$$;
