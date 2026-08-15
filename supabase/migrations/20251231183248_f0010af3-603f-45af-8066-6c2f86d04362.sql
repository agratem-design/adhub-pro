-- Add cities column to installation_teams table for team city specialization
ALTER TABLE public.installation_teams 
ADD COLUMN IF NOT EXISTS cities text[] DEFAULT '{}';