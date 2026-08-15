-- Change default to null (no override)
ALTER TABLE public.billboards ALTER COLUMN is_visible_in_available SET DEFAULT null;

-- Reset all billboards to null (normal logic applies)
UPDATE public.billboards SET is_visible_in_available = null;

-- Hide friend company billboards from available
UPDATE public.billboards SET is_visible_in_available = false WHERE friend_company_id IS NOT NULL;