-- Add support for multiple partners in distributions
ALTER TABLE public.distributions 
ADD COLUMN IF NOT EXISTS partner_names jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS partner_counts jsonb DEFAULT '{}'::jsonb;

-- Migrate existing data
UPDATE public.distributions 
SET partner_names = jsonb_build_array(partner_a_name, partner_b_name),
    partner_counts = jsonb_build_object('0', partner_a_count, '1', partner_b_count)
WHERE partner_names = '[]'::jsonb;