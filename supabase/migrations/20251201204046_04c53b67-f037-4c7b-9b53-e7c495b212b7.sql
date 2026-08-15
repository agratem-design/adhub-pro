-- Add column to link employee to operating expenses
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS linked_to_operating_expenses BOOLEAN DEFAULT false;

-- Add unique constraint to ensure only one employee can be linked to operating expenses
CREATE UNIQUE INDEX idx_unique_operating_expenses_employee 
  ON employees (linked_to_operating_expenses) 
  WHERE linked_to_operating_expenses = true;

-- Add comment to explain the purpose
COMMENT ON COLUMN employees.linked_to_operating_expenses IS 'Indicates if this employee is linked to operating expenses account. Only one employee can be linked.';