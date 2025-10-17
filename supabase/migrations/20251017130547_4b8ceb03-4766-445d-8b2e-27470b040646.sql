-- Drop the unique constraint on duration
ALTER TABLE pricing DROP CONSTRAINT IF EXISTS pricing_duration_key;

-- Add course_type column if not exists
ALTER TABLE pricing ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'プロ手技';

-- Delete existing data
DELETE FROM pricing;

-- Insert Pro course data (プロ手技のコース)
INSERT INTO pricing (duration, standard_price, course_type) VALUES
(80, 13000, 'プロ手技'),
(100, 15000, 'プロ手技'),
(120, 18000, 'プロ手技');

-- Insert Zenryoku course data (全力コース)
INSERT INTO pricing (duration, standard_price, course_type) VALUES
(60, 15000, '全力'),
(80, 18000, '全力');

-- Create composite unique constraint on duration and course_type
ALTER TABLE pricing ADD CONSTRAINT pricing_duration_course_type_key UNIQUE (duration, course_type);