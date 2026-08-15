-- Add cutout_image_url column to task_designs table
ALTER TABLE task_designs 
ADD COLUMN IF NOT EXISTS cutout_image_url TEXT;