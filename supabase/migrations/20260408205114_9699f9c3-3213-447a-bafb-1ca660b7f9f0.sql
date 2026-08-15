-- Change default for is_visible_in_available to false
ALTER TABLE public.billboards ALTER COLUMN is_visible_in_available SET DEFAULT false;

-- Set all existing billboards to not visible in available
UPDATE public.billboards SET is_visible_in_available = false WHERE is_visible_in_available = true;