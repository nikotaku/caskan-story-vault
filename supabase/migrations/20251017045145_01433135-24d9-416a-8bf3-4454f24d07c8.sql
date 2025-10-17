-- Add access_token column to casts table for therapist portal access
ALTER TABLE public.casts 
ADD COLUMN access_token text UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_casts_access_token ON public.casts(access_token);

-- Add comment
COMMENT ON COLUMN public.casts.access_token IS 'Unique token for therapist portal access';