
CREATE OR REPLACE FUNCTION auto_create_installation_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billboard_id_array bigint[];
  existing_billboard_ids bigint[];
  new_billboard_ids bigint[];
  removed_billboard_ids bigint[];
  team_rec RECORD;
  task_id_var uuid;
  is_update boolean;
  bb RECORD;
  best_team_id uuid;
BEGIN
  IF NEW."Contract_Number" < 1161 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.installation_enabled, true) = false THEN
    DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;
  IF NEW.billboard_ids IS NULL OR NEW.billboard_ids = '' THEN
    DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;

  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint)) INTO billboard_id_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id
  WHERE TRIM(id) ~ '^\d+$';

  SELECT ARRAY_AGG(DISTINCT billboard_id) INTO existing_billboard_ids
  FROM installation_task_items iti
  JOIN installation_tasks it ON iti.task_id = it.id
  WHERE it.contract_id = NEW."Contract_Number";

  is_update := (existing_billboard_ids IS NOT NULL);

  IF is_update THEN
    SELECT ARRAY_AGG(x) INTO new_billboard_ids FROM unnest(billboard_id_array) x WHERE NOT (x = ANY(existing_billboard_ids));
    SELECT ARRAY_AGG(x) INTO removed_billboard_ids FROM unnest(existing_billboard_ids) x WHERE NOT (x = ANY(billboard_id_array));
    IF removed_billboard_ids IS NOT NULL THEN
      DELETE FROM installation_task_items
      WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
        AND billboard_id = ANY(removed_billboard_ids);
    END IF;

    IF new_billboard_ids IS NOT NULL THEN
      FOR bb IN
        SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
        FROM billboards b
        WHERE b."ID" = ANY(new_billboard_ids)
      LOOP
        best_team_id := NULL;
        
        -- أولاً: إذا اللوحة لها شركة مالكة، ابحث عن فريق مرتبط بها
        IF bb.friend_company_id IS NOT NULL THEN
          SELECT t.id INTO best_team_id
          FROM installation_teams t
          WHERE array_length(t.sizes, 1) > 0
            AND bb."Size" = ANY(t.sizes)
            AND (
              array_length(t.cities, 1) IS NULL
              OR array_length(t.cities, 1) = 0
              OR bb."City" = ANY(t.cities)
            )
            AND t.friend_company_ids IS NOT NULL
            AND array_length(t.friend_company_ids, 1) > 0
            AND bb.friend_company_id = ANY(t.friend_company_ids)
          ORDER BY t.priority DESC
          LIMIT 1;
        END IF;
        
        -- ثانياً: fallback لفريق عام (بدون ربط شركة)
        IF best_team_id IS NULL THEN
          SELECT t.id INTO best_team_id
          FROM installation_teams t
          WHERE array_length(t.sizes, 1) > 0
            AND bb."Size" = ANY(t.sizes)
            AND (
              array_length(t.cities, 1) IS NULL
              OR array_length(t.cities, 1) = 0
              OR bb."City" = ANY(t.cities)
            )
            AND (
              t.friend_company_ids IS NULL
              OR array_length(t.friend_company_ids, 1) IS NULL
              OR array_length(t.friend_company_ids, 1) = 0
            )
          ORDER BY t.priority DESC
          LIMIT 1;
        END IF;

        IF best_team_id IS NOT NULL THEN
          SELECT id INTO task_id_var
          FROM installation_tasks
          WHERE contract_id = NEW."Contract_Number" AND team_id = best_team_id
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
      
      -- أولاً: فريق مرتبط بالشركة المالكة
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (
            array_length(t.cities, 1) IS NULL
            OR array_length(t.cities, 1) = 0
            OR bb."City" = ANY(t.cities)
          )
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      -- ثانياً: fallback لفريق عام
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (
            array_length(t.cities, 1) IS NULL
            OR array_length(t.cities, 1) = 0
            OR bb."City" = ANY(t.cities)
          )
          AND (
            t.friend_company_ids IS NULL
            OR array_length(t.friend_company_ids, 1) IS NULL
            OR array_length(t.friend_company_ids, 1) = 0
          )
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF best_team_id IS NOT NULL THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = best_team_id
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
