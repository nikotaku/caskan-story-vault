-- Add display_order to casts
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_casts_display_order ON public.casts(display_order);

-- Initialize display_order based on created_at (newest first stays top)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn FROM public.casts
)
UPDATE public.casts c SET display_order = o.rn FROM ordered o WHERE c.id = o.id;

-- Banners table
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  link_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Banners are viewable by everyone"
  ON public.banners FOR SELECT USING (true);

CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for banners
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Banner images publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'banners');

CREATE POLICY "Admins can upload banners"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update banner files"
  ON storage.objects FOR UPDATE USING (bucket_id = 'banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banner files"
  ON storage.objects FOR DELETE USING (bucket_id = 'banners' AND has_role(auth.uid(), 'admin'::app_role));