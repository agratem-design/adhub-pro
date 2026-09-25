-- The catalog default is separate from a physical billboard's optional override.
ALTER TABLE public.sizes ADD COLUMN IF NOT EXISTS print_size text;
ALTER TABLE public.billboards ADD COLUMN IF NOT EXISTS print_size text;
COMMENT ON COLUMN public.sizes.print_size IS 'Default production print dimensions in metres; null means not specified.';
COMMENT ON COLUMN public.billboards.print_size IS 'Optional production print dimensions in metres; null inherits from the linked size.';
NOTIFY pgrst, 'reload schema';
