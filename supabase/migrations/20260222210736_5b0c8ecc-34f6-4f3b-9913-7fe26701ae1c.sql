-- Update all contracts to default: operating fee NOT including installation or print
UPDATE "Contract" 
SET include_operating_in_installation = false, 
    include_operating_in_print = false 
WHERE include_operating_in_installation = true 
   OR include_operating_in_print = true;

-- Set default values for NULL entries
UPDATE "Contract"
SET include_operating_in_installation = false
WHERE include_operating_in_installation IS NULL;

UPDATE "Contract"
SET include_operating_in_print = false
WHERE include_operating_in_print IS NULL;

-- Set column defaults
ALTER TABLE "Contract" ALTER COLUMN include_operating_in_installation SET DEFAULT false;
ALTER TABLE "Contract" ALTER COLUMN include_operating_in_print SET DEFAULT false;