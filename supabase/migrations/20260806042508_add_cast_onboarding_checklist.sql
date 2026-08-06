alter table public.casts
  add column if not exists o2_created boolean not null default false,
  add column if not exists o2_linkage_requested boolean not null default false,
  add column if not exists x_created boolean not null default false,
  add column if not exists x_list_added boolean not null default false,
  add column if not exists x_ff_completed boolean not null default false,
  add column if not exists self_intro_tweeted boolean not null default false;

comment on column public.casts.o2_created is '02アカウントの作成完了';
comment on column public.casts.o2_linkage_requested is '02アカウントの連携申請完了';
comment on column public.casts.x_created is 'Xアカウントの作成完了';
comment on column public.casts.x_list_added is 'Xリストへの追加完了';
comment on column public.casts.x_ff_completed is 'XのFF完了';
comment on column public.casts.self_intro_tweeted is '自己紹介ツイート完了';
