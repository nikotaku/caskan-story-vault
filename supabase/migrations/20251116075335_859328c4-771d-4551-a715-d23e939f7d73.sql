-- Add room column to reservations table
ALTER TABLE reservations
ADD COLUMN room text;