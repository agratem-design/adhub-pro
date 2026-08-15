-- Fix contract number: rename 1238 to 1224
-- First update activity_log
UPDATE activity_log SET contract_number = 1224, 
  description = REPLACE(description, '#1238', '#1224'),
  entity_id = '1224'
WHERE contract_number = 1238;

-- Update the contract itself
UPDATE "Contract" SET "Contract_Number" = 1224, id = 1225 WHERE "Contract_Number" = 1238;

-- Reset the sequence to the correct value
SELECT setval('"Contract_id_seq"', 1224, true);