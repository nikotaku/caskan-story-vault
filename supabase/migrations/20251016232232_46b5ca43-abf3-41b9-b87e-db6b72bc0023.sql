-- Remove unused columns from casts table
ALTER TABLE public.casts DROP COLUMN IF EXISTS age;
ALTER TABLE public.casts DROP COLUMN IF EXISTS measurements;
ALTER TABLE public.casts DROP COLUMN IF EXISTS waiting_time;
ALTER TABLE public.casts DROP COLUMN IF EXISTS month_sales;
ALTER TABLE public.casts DROP COLUMN IF EXISTS total_sales;
ALTER TABLE public.casts DROP COLUMN IF EXISTS work_days;

-- Add new columns based on Notion structure
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS execution_date_start date;
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS execution_date_end date;
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS hp_notice text;
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS upload_check text;
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS photos text[];
ALTER TABLE public.casts ADD COLUMN IF NOT EXISTS x_account text;

-- Update photo column to be nullable (will migrate to photos array)
ALTER TABLE public.casts ALTER COLUMN photo DROP NOT NULL;

COMMENT ON COLUMN public.casts.room IS 'Room type: インルーム or ラスルーム';
COMMENT ON COLUMN public.casts.execution_date_start IS 'Execution date range start';
COMMENT ON COLUMN public.casts.execution_date_end IS 'Execution date range end';
COMMENT ON COLUMN public.casts.hp_notice IS 'HP notice status: 登録済み or 未着手';
COMMENT ON COLUMN public.casts.upload_check IS 'Upload check status: 登録済み or 未着手';
COMMENT ON COLUMN public.casts.photos IS 'Array of photo URLs (up to 5)';
COMMENT ON COLUMN public.casts.x_account IS 'X (Twitter) account URL';