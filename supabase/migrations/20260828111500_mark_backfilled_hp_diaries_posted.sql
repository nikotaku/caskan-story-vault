-- 20260828110000 の初回本番適用時、同一SQL文内で追加した日記が
-- MVCCスナップショット上まだ見えず、hp_statusだけskippedのまま残った行を補正する。
update public.cast_posts p
set hp_status = 'posted', hp_error = null
where p.hp_status = 'skipped'
  and p.o2_status = 'posted'
  and p.esutama_status = 'posted'
  and cardinality(p.image_urls) = 1
  and exists (
    select 1
    from public.cast_diaries d
    where d.source_post_id = p.id
  );
