ALTER TABLE public.installation_task_items 
ADD COLUMN IF NOT EXISTS reinstalled_faces text DEFAULT 'both' 
CHECK (reinstalled_faces IN ('face_a', 'face_b', 'both'));