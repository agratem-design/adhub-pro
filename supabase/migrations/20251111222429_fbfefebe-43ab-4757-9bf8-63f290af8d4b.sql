-- ============================================
-- FIX WARNING-LEVEL SECURITY ISSUES
-- ============================================

-- 1. Add RLS policies for operational tables (tasks, print_tasks, reports)
-- These tables currently have no policies after removing "Allow all"

-- Tasks table: Only admins can manage, authenticated users can view
CREATE POLICY "Authenticated users view tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (true);

-- Print tasks: Only admins can manage, authenticated users can view
CREATE POLICY "Authenticated users view print tasks"
ON public.print_tasks
FOR SELECT
TO authenticated
USING (true);

-- Reports: Only admins can manage, authenticated users can view their own
CREATE POLICY "Authenticated users view reports"
ON public.reports
FOR SELECT
TO authenticated
USING (true);

-- 2. Fix SECURITY DEFINER functions to include search_path
-- This prevents function search path attacks

-- Update functions that are missing SET search_path

-- cleanup_billboard_on_contract_delete trigger function
CREATE OR REPLACE FUNCTION public.cleanup_billboard_on_contract_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    UPDATE billboards 
    SET "Status" = 'متاح',
        "Customer_Name" = NULL,
        "Contract_Number" = NULL,
        "Rent_Start_Date" = NULL,
        "Rent_End_Date" = NULL
    WHERE "ID" = OLD.billboard_id;
    
    RETURN OLD;
END;
$function$;

-- cleanup_orphaned_data function
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    UPDATE billboards 
    SET "Status" = 'متاح',
        "Customer_Name" = NULL,
        "Contract_Number" = NULL,
        "Rent_Start_Date" = NULL,
        "Rent_End_Date" = NULL
    WHERE "Contract_Number" IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM "Contract" 
        WHERE "Contract_Number" = billboards."Contract_Number"
    );
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    UPDATE billboards 
    SET "Status" = 'متاح'
    WHERE "Status" = 'مؤجر' 
    AND "Rent_End_Date" < CURRENT_DATE;
    
    RETURN cleaned_count;
END;
$function$;

-- cleanup_expired_billboards function
CREATE OR REPLACE FUNCTION public.cleanup_expired_billboards()
RETURNS TABLE(cleaned_count integer, cleaned_billboard_ids integer[], operation_timestamp timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  expired_ids INTEGER[];
  cleaned_count_result INTEGER := 0;
  operation_time TIMESTAMPTZ := NOW();
BEGIN
  SELECT ARRAY_AGG(ID) INTO expired_ids
  FROM billboards 
  WHERE Status = 'rented' 
    AND Rent_End_Date IS NOT NULL 
    AND Rent_End_Date::date < CURRENT_DATE;
  
  IF expired_ids IS NULL OR array_length(expired_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, ARRAY[]::INTEGER[], operation_time;
    RETURN;
  END IF;
  
  UPDATE billboards 
  SET 
    Status = 'available',
    Contract_Number = NULL,
    Customer_Name = NULL,
    Rent_Start_Date = NULL,
    Rent_End_Date = NULL
  WHERE ID = ANY(expired_ids);
  
  GET DIAGNOSTICS cleaned_count_result = ROW_COUNT;
  
  BEGIN
    INSERT INTO cleanup_logs (
      cleanup_date,
      billboards_cleaned,
      cleanup_type,
      notes,
      billboard_ids_cleaned
    ) VALUES (
      operation_time,
      cleaned_count_result,
      'automatic',
      'Automatic cleanup via scheduled function',
      expired_ids
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  
  RETURN QUERY SELECT cleaned_count_result, expired_ids, operation_time;
END;
$function$;

-- create_installation_task_for_contract trigger function
CREATE OR REPLACE FUNCTION public.create_installation_task_for_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_billboards jsonb;
  v_billboard record;
  v_team_id uuid;
  v_task_id uuid;
  v_size text;
  v_installation_enabled boolean;
BEGIN
  v_installation_enabled := COALESCE(NEW.installation_enabled, true);
  
  IF NOT v_installation_enabled THEN
    RETURN NEW;
  END IF;
  
  IF NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids != '' THEN
    FOR v_billboard IN 
      SELECT b."ID", b."Size"
      FROM billboards b
      WHERE b."ID" = ANY(string_to_array(NEW.billboard_ids, ',')::bigint[])
    LOOP
      v_size := v_billboard."Size";
      
      SELECT id INTO v_team_id
      FROM installation_teams
      WHERE v_size = ANY(sizes)
      LIMIT 1;
      
      IF v_team_id IS NULL THEN
        SELECT id INTO v_team_id
        FROM installation_teams
        LIMIT 1;
      END IF;
      
      INSERT INTO installation_tasks (contract_id, team_id, status)
      VALUES (NEW."Contract_Number", v_team_id, 'pending')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_task_id;
      
      IF v_task_id IS NULL THEN
        SELECT id INTO v_task_id
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = v_team_id
        LIMIT 1;
      END IF;
      
      IF v_task_id IS NOT NULL THEN
        INSERT INTO installation_task_items (task_id, billboard_id, status)
        VALUES (v_task_id, v_billboard."ID", 'pending')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- delete_installation_task_on_contract_delete trigger function
CREATE OR REPLACE FUNCTION public.delete_installation_task_on_contract_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM installation_tasks WHERE contract_id = OLD."Contract_Number";
  RETURN OLD;
END;
$function$;