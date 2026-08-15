-- Create function to check user permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id AND permission = _permission
  )
$$;

-- Add policies for users with 'custody' permission on custody_accounts
CREATE POLICY "Users with custody permission can view custody accounts"
ON public.custody_accounts
FOR SELECT
USING (has_permission(auth.uid(), 'custody'));

CREATE POLICY "Users with custody permission can manage custody accounts"
ON public.custody_accounts
FOR ALL
USING (has_permission(auth.uid(), 'custody'))
WITH CHECK (has_permission(auth.uid(), 'custody'));

-- Add policies for users with 'custody' permission on custody_transactions
CREATE POLICY "Users with custody permission can view custody transactions"
ON public.custody_transactions
FOR SELECT
USING (has_permission(auth.uid(), 'custody'));

CREATE POLICY "Users with custody permission can manage custody transactions"
ON public.custody_transactions
FOR ALL
USING (has_permission(auth.uid(), 'custody'))
WITH CHECK (has_permission(auth.uid(), 'custody'));

-- Add policies for users with 'custody' permission on custody_expenses
CREATE POLICY "Users with custody permission can view custody expenses"
ON public.custody_expenses
FOR SELECT
USING (has_permission(auth.uid(), 'custody'));

CREATE POLICY "Users with custody permission can manage custody expenses"
ON public.custody_expenses
FOR ALL
USING (has_permission(auth.uid(), 'custody'))
WITH CHECK (has_permission(auth.uid(), 'custody'));