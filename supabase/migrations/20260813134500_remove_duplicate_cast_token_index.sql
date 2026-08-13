-- 本番に既存のunique制約がある場合、互換migrationで作った重複indexだけを除去する。
do $$
begin
  if to_regclass('public.idx_casts_access_token') is not null
     and exists (
       select 1
       from pg_index i
       where i.indrelid = 'public.casts'::regclass
         and i.indexrelid <> 'public.idx_casts_access_token'::regclass
         and i.indisunique
         and (
           select array_agg(a.attname order by key_column.ordinality)
           from unnest(i.indkey) with ordinality as key_column(attnum, ordinality)
           join pg_attribute a
             on a.attrelid = i.indrelid
            and a.attnum = key_column.attnum
         ) = array['access_token']::name[]
     ) then
    drop index public.idx_casts_access_token;
  end if;
end;
$$;
