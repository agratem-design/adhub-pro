-- Add model_link and has_cutout columns to print_task_items
ALTER TABLE print_task_items 
ADD COLUMN IF NOT EXISTS model_link text,
ADD COLUMN IF NOT EXISTS has_cutout boolean DEFAULT false;