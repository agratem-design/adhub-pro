-- وظيفة RPC لإنشاء مهام التركيب يدوياً لعقد محدد
CREATE OR REPLACE FUNCTION public.create_installation_tasks_for_contract(p_contract_number bigint)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract RECORD;
  v_billboard_id bigint;
  v_size text;
  v_team_id uuid;
  v_task_id uuid;
  tasks_created int := 0;
  items_created int := 0;
BEGIN
  SELECT "Contract_Number", billboard_ids, installation_enabled
  INTO v_contract
  FROM "Contract"
  WHERE "Contract_Number" = p_contract_number;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'contract_not_found');
  END IF;

  IF COALESCE(v_contract.installation_enabled, true) = false THEN
    RETURN json_build_object('ok', false, 'error', 'installation_disabled');
  END IF;

  IF v_contract.billboard_ids IS NULL OR TRIM(v_contract.billboard_ids) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'no_billboards');
  END IF;

  FOR v_billboard_id IN 
    SELECT unnest(string_to_array(v_contract.billboard_ids, ',')::bigint[])
  LOOP
    SELECT "Size" INTO v_size FROM billboards WHERE "ID" = v_billboard_id;
    IF v_size IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_team_id
    FROM installation_teams
    WHERE v_size = ANY(sizes)
    LIMIT 1;

    IF v_team_id IS NULL THEN
      SELECT id INTO v_team_id FROM installation_teams LIMIT 1;
    END IF;

    IF v_team_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO installation_tasks (contract_id, team_id, status)
    VALUES (p_contract_number, v_team_id, 'pending')
    ON CONFLICT (contract_id, team_id) DO NOTHING
    RETURNING id INTO v_task_id;

    IF v_task_id IS NULL THEN
      SELECT id INTO v_task_id
      FROM installation_tasks
      WHERE contract_id = p_contract_number AND team_id = v_team_id
      LIMIT 1;
    ELSE
      tasks_created := tasks_created + 1;
    END IF;

    IF v_task_id IS NOT NULL THEN
      INSERT INTO installation_task_items (task_id, billboard_id, status)
      VALUES (v_task_id, v_billboard_id, 'pending')
      ON CONFLICT (task_id, billboard_id) DO NOTHING;
      IF FOUND THEN items_created := items_created + 1; END IF;
    END IF;
  END LOOP;

  RETURN json_build_object('ok', true, 'tasks_created', tasks_created, 'items_created', items_created);
END;
$$;