-- Add column to link employee advances to distributed payments
ALTER TABLE employee_advances 
ADD COLUMN IF NOT EXISTS distributed_payment_id text;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_employee_advances_distributed_payment 
ON employee_advances(distributed_payment_id);

-- Comment for clarity
COMMENT ON COLUMN employee_advances.distributed_payment_id IS 'Links advance to distributed payment for cascade deletion';