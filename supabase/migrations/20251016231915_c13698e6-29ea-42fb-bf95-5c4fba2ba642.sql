-- Remove phone, price, and rating columns from casts table
ALTER TABLE public.casts DROP COLUMN IF EXISTS phone;
ALTER TABLE public.casts DROP COLUMN IF EXISTS price;
ALTER TABLE public.casts DROP COLUMN IF EXISTS rating;