
-- Fix the security definer view issue
ALTER VIEW public.contract_summary SET (security_invoker = on);
