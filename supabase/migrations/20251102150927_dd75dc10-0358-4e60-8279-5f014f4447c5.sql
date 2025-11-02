-- Add tags column to casts table to store popular/new therapist tags
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.casts.tags IS 'Tags like "人気セラピスト", "新人" from estama.jp';