-- Add is_visible column to casts table for display ON/OFF
ALTER TABLE public.casts ADD COLUMN is_visible boolean NOT NULL DEFAULT true;