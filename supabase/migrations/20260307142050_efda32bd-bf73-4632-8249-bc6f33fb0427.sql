-- Fix stuck paid_amount for composite task #17
UPDATE composite_tasks 
SET paid_amount = 0 
WHERE id = '27e9d63f-e8b3-4a40-9b62-f3813089b7a1' 
AND NOT EXISTS (
  SELECT 1 FROM customer_payments WHERE composite_task_id = '27e9d63f-e8b3-4a40-9b62-f3813089b7a1'
);