-- Add paid_amount column to composite_tasks for tracking payments
ALTER TABLE composite_tasks 
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Add composite_task_id to customer_payments for direct payment linking
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS composite_task_id UUID REFERENCES composite_tasks(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_payments_composite_task_id 
ON customer_payments(composite_task_id) 
WHERE composite_task_id IS NOT NULL;