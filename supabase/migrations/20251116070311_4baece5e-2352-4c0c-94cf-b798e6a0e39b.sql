-- Add new columns to rooms table
ALTER TABLE rooms
ADD COLUMN address text,
ADD COLUMN equipment_costumes text,
ADD COLUMN garbage_disposal text,
ADD COLUMN equipment_placement text,
ADD COLUMN room_photos text[];