-- 予約テーブル
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cast_id UUID NOT NULL REFERENCES public.casts(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  course_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- 誰でも予約閲覧可能
CREATE POLICY "Reservations are viewable by everyone"
ON public.reservations
FOR SELECT
USING (true);

-- 管理者のみ予約追加・更新・削除可能
CREATE POLICY "Admins can insert reservations"
ON public.reservations
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reservations"
ON public.reservations
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reservations"
ON public.reservations
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 更新日時トリガー
CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- リアルタイム更新を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;

-- 店舗設定テーブル
CREATE TABLE public.shop_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_name TEXT NOT NULL,
  shop_phone TEXT,
  shop_email TEXT,
  shop_address TEXT,
  business_hours TEXT,
  description TEXT,
  logo_url TEXT,
  updated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- 誰でも店舗設定閲覧可能
CREATE POLICY "Shop settings are viewable by everyone"
ON public.shop_settings
FOR SELECT
USING (true);

-- 管理者のみ店舗設定更新可能
CREATE POLICY "Admins can insert shop settings"
ON public.shop_settings
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update shop settings"
ON public.shop_settings
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 更新日時トリガー
CREATE TRIGGER update_shop_settings_updated_at
BEFORE UPDATE ON public.shop_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 初期店舗設定データ
INSERT INTO public.shop_settings (shop_name, shop_phone, shop_email, shop_address, business_hours, description, updated_by)
VALUES (
  '全力エステ 仙台',
  '022-XXX-XXXX',
  'info@zenryoku-esthe.com',
  '宮城県仙台市青葉区',
  '13:00 - 25:00',
  '仙台で人気のメンズエステ店です。',
  '57a7f7ab-0d99-4ee2-aa75-0540cdf6ac18'
);