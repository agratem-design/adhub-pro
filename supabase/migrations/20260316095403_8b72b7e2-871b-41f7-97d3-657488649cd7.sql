-- Create a separate sequence for the id column to prevent it from consuming Contract_Number values
CREATE SEQUENCE IF NOT EXISTS "Contract_internal_id_seq";
SELECT setval('"Contract_internal_id_seq"', (SELECT MAX(id) FROM "Contract"), true);

-- Change id column to use its own sequence
ALTER TABLE "Contract" ALTER COLUMN id SET DEFAULT nextval('"Contract_internal_id_seq"');

-- Update the sync trigger to also reset the id sequence
CREATE OR REPLACE FUNCTION public.sync_contract_seq()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM setval('"Contract_id_seq"', (SELECT MAX("Contract_Number") FROM "Contract"));
  PERFORM setval('"Contract_internal_id_seq"', (SELECT MAX(id) FROM "Contract"));
  RETURN NEW;
END;
$function$;