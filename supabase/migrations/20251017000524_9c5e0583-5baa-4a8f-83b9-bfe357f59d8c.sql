-- 一般ユーザーも予約を作成できるようにRLSポリシーを追加
CREATE POLICY "Anyone can create reservations"
ON public.reservations
FOR INSERT
TO anon, authenticated
WITH CHECK (true);