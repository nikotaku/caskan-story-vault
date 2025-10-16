-- シフトテーブル
CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cast_id UUID NOT NULL REFERENCES public.casts(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (cast_id, shift_date, start_time)
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- 誰でもシフト閲覧可能
CREATE POLICY "Shifts are viewable by everyone"
ON public.shifts
FOR SELECT
USING (true);

-- 管理者のみシフト追加・更新・削除可能
CREATE POLICY "Admins can insert shifts"
ON public.shifts
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update shifts"
ON public.shifts
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete shifts"
ON public.shifts
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- 更新日時トリガー
CREATE TRIGGER update_shifts_updated_at
BEFORE UPDATE ON public.shifts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- リアルタイム更新を有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;