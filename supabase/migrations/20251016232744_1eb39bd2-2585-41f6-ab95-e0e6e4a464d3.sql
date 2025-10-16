-- Create pricing table for managing course prices
CREATE TABLE IF NOT EXISTS public.pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  duration integer NOT NULL,
  standard_price integer NOT NULL DEFAULT 0,
  premium_price integer NOT NULL DEFAULT 0,
  vip_price integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(duration)
);

-- Create options table for additional charges
CREATE TABLE IF NOT EXISTS public.pricing_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_options ENABLE ROW LEVEL SECURITY;

-- Pricing policies
CREATE POLICY "Pricing is viewable by everyone"
  ON public.pricing
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert pricing"
  ON public.pricing
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing"
  ON public.pricing
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing"
  ON public.pricing
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Pricing options policies
CREATE POLICY "Pricing options are viewable by everyone"
  ON public.pricing_options
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert pricing options"
  ON public.pricing_options
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing options"
  ON public.pricing_options
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing options"
  ON public.pricing_options
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_updated_at
  BEFORE UPDATE ON public.pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_options_updated_at
  BEFORE UPDATE ON public.pricing_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default pricing data
INSERT INTO public.pricing (duration, standard_price, premium_price, vip_price) VALUES
  (60, 12000, 15000, 18000),
  (90, 17000, 22000, 27000),
  (120, 22000, 28000, 35000),
  (150, 27000, 34000, 43000)
ON CONFLICT (duration) DO NOTHING;

-- Insert default options
INSERT INTO public.pricing_options (name, price, description) VALUES
  ('指名料', 1000, 'キャストを指名する場合'),
  ('本指名料', 2000, '本指名の場合'),
  ('写真指名料', 500, '写真での指名'),
  ('延長30分', 6000, '30分延長料金（ランクにより異なる）')
ON CONFLICT DO NOTHING;