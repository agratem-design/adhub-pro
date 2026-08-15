-- Add collection_date column to customer_payments table for intermediary collection date
ALTER TABLE customer_payments 
ADD COLUMN collection_date date;