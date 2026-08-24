-- 投稿フォームでは、在籍中のセラピストに設定された媒体別の認証情報だけを連携済みとして扱う。

create or replace function public.get_therapist_post_connections(p_token text)
returns table(site text, configured boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cast_id uuid;
  v_store_id uuid;
begin
  select c.id, c.store_id
  into v_cast_id, v_store_id
  from public.casts c
  where c.access_token = p_token
    and c.is_active = true;

  if v_cast_id is null then
    raise exception 'invalid_token';
  end if;

  return query
  select 'o2'::text,
         exists (
           select 1
           from public.cast_site_credentials credentials
           where credentials.cast_id = v_cast_id
             and credentials.store_id = v_store_id
             and credentials.site = 'o2'
             and nullif(trim(credentials.login_id), '') is not null
             and nullif(credentials.password, '') is not null
         )
  union all
  select 'esutama'::text,
         exists (
           select 1
           from public.external_cast_profiles profile
           join public.automation_connections connection
             on connection.store_id = profile.store_id
            and connection.provider = 'estama'
            and connection.status = 'ready'
           join public.cast_site_credentials credentials
             on credentials.cast_id = profile.cast_id
            and credentials.store_id = profile.store_id
            and credentials.site = 'esutama'
            and nullif(trim(credentials.login_id), '') is not null
            and nullif(credentials.password, '') is not null
           where profile.cast_id = v_cast_id
             and profile.store_id = v_store_id
             and profile.provider = 'estama'
             and profile.sync_status = 'synced'
         );
end;
$$;

revoke all on function public.get_therapist_post_connections(text)
  from public;
grant execute on function public.get_therapist_post_connections(text)
  to anon, authenticated;

create or replace function public.require_active_cast_for_new_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.casts c
    where c.id = new.cast_id
      and c.store_id = new.store_id
      and c.is_active = true
  ) then
    raise exception 'アーカイブ済みのセラピストには投稿できません';
  end if;
  return new;
end;
$$;

drop trigger if exists require_active_cast_for_new_post on public.cast_posts;
create trigger require_active_cast_for_new_post
before insert on public.cast_posts
for each row execute function public.require_active_cast_for_new_post();

revoke all on function public.require_active_cast_for_new_post()
  from public, anon, authenticated;

create or replace function public.require_active_cast_for_new_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.casts c
    where c.id = new.cast_id
      and c.store_id = new.store_id
      and c.is_active = true
  ) then
    raise exception 'アーカイブ済みのセラピストは予約できません';
  end if;
  return new;
end;
$$;

drop trigger if exists require_active_cast_for_new_reservation on public.reservations;
create trigger require_active_cast_for_new_reservation
before insert on public.reservations
for each row execute function public.require_active_cast_for_new_reservation();

revoke all on function public.require_active_cast_for_new_reservation()
  from public, anon, authenticated;
