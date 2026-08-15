
CREATE OR REPLACE FUNCTION public.create_installation_task_for_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billboard record;
  v_team_id uuid;
  v_task_id uuid;
  v_size text;
  v_city text;
  v_company_id text;
  v_installation_enabled boolean;
BEGIN
  v_installation_enabled := COALESCE(NEW.installation_enabled, true);
  
  IF NOT v_installation_enabled THEN
    RETURN NEW;
  END IF;
  
  IF NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids != '' THEN
    FOR v_billboard IN 
      SELECT b."ID", b."Size", b."Municipality", b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(string_to_array(NEW.billboard_ids, ',')::bigint[])
    LOOP
      v_size := v_billboard."Size";
      v_city := v_billboard."Municipality";
      v_company_id := v_billboard.friend_company_id;
      v_team_id := NULL;
      
      -- 1. Match: Size + City + Same friend company
      IF v_company_id IS NOT NULL AND v_city IS NOT NULL THEN
        SELECT id INTO v_team_id
        FROM installation_teams
        WHERE v_size = ANY(sizes)
          AND v_city = ANY(cities)
          AND v_company_id = ANY(friend_company_ids)
        ORDER BY priority DESC
        LIMIT 1;
      END IF;
      
      -- 2. Match: Size + City + General team (no company)
      IF v_team_id IS NULL AND v_city IS NOT NULL THEN
        SELECT id INTO v_team_id
        FROM installation_teams
        WHERE v_size = ANY(sizes)
          AND v_city = ANY(cities)
          AND (friend_company_ids IS NULL OR array_length(friend_company_ids, 1) IS NULL)
        ORDER BY priority DESC
        LIMIT 1;
      END IF;
      
      -- 3. Match: Size only + General team
      IF v_team_id IS NULL THEN
        SELECT id INTO v_team_id
        FROM installation_teams
        WHERE v_size = ANY(sizes)
          AND (friend_company_ids IS NULL OR array_length(friend_company_ids, 1) IS NULL)
        ORDER BY priority DESC
        LIMIT 1;
      END IF;
      
      -- 4. Ultimate fallback: any team
      IF v_team_id IS NULL THEN
        SELECT id INTO v_team_id
        FROM installation_teams
        ORDER BY priority DESC
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
$$;
