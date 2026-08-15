UPDATE public.billboards
SET is_visible_in_available = NULL
WHERE "Contract_Number" = 1234
  AND is_visible_in_available = true;