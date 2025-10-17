-- Delete existing pricing options
DELETE FROM public.pricing_options;

-- Insert new pricing options
INSERT INTO public.pricing_options (name, price, description) VALUES
  ('DR10min', 1000, NULL),
  ('極液', 2000, NULL),
  ('MB', 5000, NULL);