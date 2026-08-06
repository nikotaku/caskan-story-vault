-- 艶華のWセラピスト専用予約フォームにだけ表示する料金。
-- 通常の料金ページと通常予約フォームからは is_visible=false により除外する。

insert into public.back_rates (
  course_type,
  duration,
  customer_price,
  therapist_back,
  shop_back,
  display_order,
  is_visible,
  description,
  store_id
)
select
  rates.course_type,
  rates.duration,
  rates.customer_price,
  rates.therapist_back,
  rates.shop_back,
  rates.display_order,
  false,
  'Wセラピスト2人同時施術（バックは2人合計）',
  stores.id
from (
  values
    ('全力W', 100, 40000, 24000, 16000, 100),
    ('全力W', 120, 46000, 28000, 18000, 101)
) as rates(course_type, duration, customer_price, therapist_back, shop_back, display_order)
cross join public.stores
where stores.slug = 'tsuyaka'
  and stores.custom_domain = 'enka-salon.jp'
on conflict (store_id, course_type, duration) do update
set
  customer_price = excluded.customer_price,
  therapist_back = excluded.therapist_back,
  shop_back = excluded.shop_back,
  display_order = excluded.display_order,
  is_visible = excluded.is_visible,
  description = excluded.description;

insert into public.option_rates (
  option_name,
  customer_price,
  therapist_back,
  shop_back,
  display_order,
  is_visible,
  extension_minutes,
  store_id
)
select
  options.option_name,
  options.customer_price,
  options.therapist_back,
  0,
  options.display_order,
  false,
  0,
  stores.id
from (
  values
    ('全力PKG1W', 20000, 20000, 100),
    ('全力PKG2W', 16000, 16000, 101)
) as options(option_name, customer_price, therapist_back, display_order)
cross join public.stores
where stores.slug = 'tsuyaka'
  and stores.custom_domain = 'enka-salon.jp'
on conflict (store_id, option_name) do update
set
  customer_price = excluded.customer_price,
  therapist_back = excluded.therapist_back,
  shop_back = excluded.shop_back,
  display_order = excluded.display_order,
  is_visible = excluded.is_visible,
  extension_minutes = excluded.extension_minutes;
