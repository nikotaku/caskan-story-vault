-- エステ魂からの取込行を、削除と追加が分かれない1トランザクションで置き換える。
create or replace function public.replace_imported_cast_diaries(
  p_cast_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer := 0;
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) > 12 then
    raise exception '取込データが不正です';
  end if;
  if not exists (select 1 from public.casts where id = p_cast_id) then
    raise exception 'キャストが見つかりません';
  end if;

  delete from public.cast_diaries
  where cast_id = p_cast_id
    and source_post_id is null;

  insert into public.cast_diaries (
    cast_id, title, category, image_url, body, posted_at,
    external_url, display_order
  )
  select
    p_cast_id,
    row.title,
    row.category,
    row.image_url,
    coalesce(row.body, ''),
    coalesce(row.posted_at, now()),
    row.external_url,
    row.display_order
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as row(
    title text,
    category text,
    image_url text,
    body text,
    posted_at timestamptz,
    external_url text,
    display_order integer
  )
  where row.display_order between 0 and 11;

  get diagnostics v_inserted = row_count;
  if v_inserted <> jsonb_array_length(coalesce(p_rows, '[]'::jsonb)) then
    raise exception '取込データの件数が一致しません';
  end if;
  return v_inserted;
end;
$$;

revoke all on function public.replace_imported_cast_diaries(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.replace_imported_cast_diaries(uuid, jsonb)
  to service_role;
