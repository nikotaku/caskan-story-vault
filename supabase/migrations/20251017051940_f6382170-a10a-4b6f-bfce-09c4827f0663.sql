-- セラピストの写真用のストレージバケットを作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('cast-photos', 'cast-photos', true);

-- 誰でも写真を閲覧できるポリシー
CREATE POLICY "Cast photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'cast-photos');

-- 管理者のみ写真をアップロードできるポリシー
CREATE POLICY "Admins can upload cast photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cast-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 管理者のみ写真を更新できるポリシー
CREATE POLICY "Admins can update cast photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cast-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- 管理者のみ写真を削除できるポリシー
CREATE POLICY "Admins can delete cast photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cast-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);