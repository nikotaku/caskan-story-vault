-- Add room column to shifts table
ALTER TABLE public.shifts
ADD COLUMN room text;

-- Add comment to the column
COMMENT ON COLUMN public.shifts.room IS 'Room assignment for the shift (インルーム or ラスルーム)';
