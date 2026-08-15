
-- 1. توحيد اسم المدينة: مصراتة → مصراته
UPDATE billboards SET "City" = 'مصراته' WHERE "City" = 'مصراتة';

-- 2. تحديث التريقر لإضافة fallback عند عدم وجود فريق مطابق
CREATE OR REPLACE FUNCTION auto_create_installation_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  billboard_id_array int[];
  bb RECORD;
  best_team_id uuid;
  task_id_var uuid;
BEGIN
  IF NEW.billboard_ids IS NULL OR NEW.billboard_ids = '' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(trim(val)::int)
  INTO billboard_id_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS val
  WHERE trim(val) ~ '^\d+$';

  IF billboard_id_array IS NULL OR array_length(billboard_id_array, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids THEN
    DECLARE
      old_ids int[];
      removed_ids int[];
    BEGIN
      IF OLD.billboard_ids IS NOT NULL AND OLD.billboard_ids != '' THEN
        SELECT array_agg(trim(val)::int)
        INTO old_ids
        FROM unnest(string_to_array(OLD.billboard_ids, ',')) AS val
        WHERE trim(val) ~ '^\d+$';
      END IF;

      IF old_ids IS NOT NULL THEN
        SELECT array_agg(oid)
        INTO removed_ids
        FROM unnest(old_ids) AS oid
        WHERE oid != ALL(billboard_id_array);

        IF removed_ids IS NOT NULL AND array_length(removed_ids, 1) > 0 THEN
          DELETE FROM installation_task_items
          WHERE billboard_id = ANY(removed_ids)
            AND task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
        END IF;
      END IF;
    END;

    FOR bb IN
      SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(billboard_id_array)
        AND b."ID" NOT IN (
          SELECT iti.billboard_id FROM installation_task_items iti
          JOIN installation_tasks it ON iti.task_id = it.id
          WHERE it.contract_id = NEW."Contract_Number"
        )
    LOOP
      best_team_id := NULL;
      
      -- Step 1: match by friend_company + size + city
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      -- Step 2: match by size + city (no friend company)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 3 (FALLBACK): match by size only, ignore city
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 4 (LAST RESORT): pick any team, ignore size and city
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF best_team_id IS NOT NULL THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = best_team_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF task_id_var IS NULL THEN
          INSERT INTO installation_tasks (contract_id, team_id, status)
          VALUES (NEW."Contract_Number", best_team_id, 'pending')
          RETURNING id INTO task_id_var;
        END IF;

        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        VALUES (task_id_var, bb."ID", 'pending', bb.faces)
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;

    DELETE FROM installation_tasks
    WHERE contract_id = NEW."Contract_Number"
      AND id NOT IN (
        SELECT DISTINCT task_id FROM installation_task_items
        WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
      );
  ELSE
    FOR bb IN
      SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(billboard_id_array)
    LOOP
      best_team_id := NULL;
      
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Fallback: size only
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Last resort: any team
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF best_team_id IS NOT NULL THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = best_team_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF task_id_var IS NULL THEN
          INSERT INTO installation_tasks (contract_id, team_id, status)
          VALUES (NEW."Contract_Number", best_team_id, 'pending')
          RETURNING id INTO task_id_var;
        END IF;

        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        VALUES (task_id_var, bb."ID", 'pending', bb.faces)
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
