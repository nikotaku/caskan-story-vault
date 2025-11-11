-- Make created_by nullable in shifts table for automated sync
ALTER TABLE public.shifts 
ALTER COLUMN created_by DROP NOT NULL;

-- Add a comment to document this is for automated syncs
COMMENT ON COLUMN public.shifts.created_by IS 'User who created the shift. NULL for automated syncs from external sources.';
