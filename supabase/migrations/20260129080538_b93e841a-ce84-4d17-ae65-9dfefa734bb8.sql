
-- Fix RLS policies for expenses_withdrawals to allow users with 'expenses' or 'custody' permission
DROP POLICY IF EXISTS "Admins manage expense withdrawals" ON expenses_withdrawals;

CREATE POLICY "Users with expenses or custody permission can access withdrawals"
ON expenses_withdrawals
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_permission(auth.uid(), 'expenses') 
  OR has_permission(auth.uid(), 'custody')
);

-- Fix RLS policies for expenses table
DROP POLICY IF EXISTS "Admins manage expenses" ON expenses;

CREATE POLICY "Users with expenses permission can access expenses"
ON expenses
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_permission(auth.uid(), 'expenses')
);

-- Fix RLS policies for expense_categories table
DROP POLICY IF EXISTS "Admins manage expense categories" ON expense_categories;

CREATE POLICY "Users with expenses permission can access expense categories"
ON expense_categories
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_permission(auth.uid(), 'expenses')
);

-- Fix RLS policies for expenses_flags table
DROP POLICY IF EXISTS "Admins manage expenses_flags" ON expenses_flags;

CREATE POLICY "Users with expenses permission can access expenses flags"
ON expenses_flags
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_permission(auth.uid(), 'expenses')
);

-- Fix RLS policies for employee_advances
DROP POLICY IF EXISTS "Admins manage advances" ON employee_advances;

CREATE POLICY "Users with custody or salaries permission can access advances"
ON employee_advances
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_permission(auth.uid(), 'custody')
  OR has_permission(auth.uid(), 'salaries')
);
