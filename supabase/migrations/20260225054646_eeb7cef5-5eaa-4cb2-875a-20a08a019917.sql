ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS single_face_billboards text;

NOTIFY pgrst, 'reload schema';