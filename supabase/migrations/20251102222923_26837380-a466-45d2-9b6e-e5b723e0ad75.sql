-- Add design columns to print_task_items table
ALTER TABLE print_task_items
ADD COLUMN IF NOT EXISTS design_face_a TEXT,
ADD COLUMN IF NOT EXISTS design_face_b TEXT;