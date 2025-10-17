-- Add detailed profile columns to casts table
ALTER TABLE public.casts 
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS height integer,
ADD COLUMN IF NOT EXISTS bust integer,
ADD COLUMN IF NOT EXISTS cup_size text,
ADD COLUMN IF NOT EXISTS waist integer,
ADD COLUMN IF NOT EXISTS hip integer,
ADD COLUMN IF NOT EXISTS body_type text,
ADD COLUMN IF NOT EXISTS experience_years integer,
ADD COLUMN IF NOT EXISTS specialties text,
ADD COLUMN IF NOT EXISTS blood_type text,
ADD COLUMN IF NOT EXISTS favorite_food text,
ADD COLUMN IF NOT EXISTS ideal_type text,
ADD COLUMN IF NOT EXISTS celebrity_lookalike text,
ADD COLUMN IF NOT EXISTS day_off_activities text,
ADD COLUMN IF NOT EXISTS hobbies text,
ADD COLUMN IF NOT EXISTS message text;