-- Add columns for friend rental data settings
ALTER TABLE public."Contract" 
ADD COLUMN IF NOT EXISTS friend_rental_includes_installation BOOLEAN DEFAULT false;