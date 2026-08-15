ALTER TABLE public."Contract"
ADD COLUMN IF NOT EXISTS include_installation_in_price boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS include_print_in_billboard_price boolean NOT NULL DEFAULT false;