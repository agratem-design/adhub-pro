
-- 1. Fix: Change default of faces_to_install to NULL so we can use billboard Faces_Count
-- and update the trigger to set faces_to_install from billboard data

-- Add defect_image_url column to print_task_items for reprint reason documentation
ALTER TABLE public.print_task_items ADD COLUMN IF NOT EXISTS defect_image_url TEXT;

-- Update auto_create_installation_tasks to include faces_to_install from billboard
CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  billboard_id_array bigint[];
  existing_billboard_ids bigint[];
  new_billboard_ids bigint[];
  removed_billboard_ids bigint[];
  team_rec RECORD;
  task_id_var uuid;
  is_update boolean;
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
      FOR team_rec IN
        SELECT t.id, t.team_name, t.sizes, t.cities
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
      LOOP
        IF EXISTS (
          SELECT 1 FROM billboards b
          WHERE b."ID" = ANY(new_billboard_ids)
            AND b."Size" = ANY(team_rec.sizes)
            AND (
              array_length(team_rec.cities, 1) IS NULL
              OR array_length(team_rec.cities, 1) = 0
              OR b."City" = ANY(team_rec.cities)
            )
        ) THEN
          SELECT id INTO task_id_var
          FROM installation_tasks
          WHERE contract_id = NEW."Contract_Number" AND team_id = team_rec.id
          LIMIT 1;

          IF task_id_var IS NULL THEN
            INSERT INTO installation_tasks (contract_id, team_id, status)
            VALUES (NEW."Contract_Number", team_rec.id, 'pending')
            RETURNING id INTO task_id_var;
          END IF;

          -- ✅ FIX: Include faces_to_install from billboard Faces_Count
          INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
          SELECT task_id_var, b."ID", 'pending', COALESCE(b."Faces_Count", 2)
          FROM billboards b
          WHERE b."ID" = ANY(new_billboard_ids)
            AND b."Size" = ANY(team_rec.sizes)
            AND (
              array_length(team_rec.cities, 1) IS NULL
              OR array_length(team_rec.cities, 1) = 0
              OR b."City" = ANY(team_rec.cities)
            )
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
    FOR team_rec IN
      SELECT t.id, t.team_name, t.sizes, t.cities
      FROM installation_teams t
      WHERE array_length(t.sizes, 1) > 0
    LOOP
      IF EXISTS (
        SELECT 1 FROM billboards b
        WHERE b."ID" = ANY(billboard_id_array)
          AND b."Size" = ANY(team_rec.sizes)
          AND (
            array_length(team_rec.cities, 1) IS NULL
            OR array_length(team_rec.cities, 1) = 0
            OR b."City" = ANY(team_rec.cities)
          )
      ) THEN
        INSERT INTO installation_tasks (contract_id, team_id, status)
        VALUES (NEW."Contract_Number", team_rec.id, 'pending')
        RETURNING id INTO task_id_var;

        -- ✅ FIX: Include faces_to_install from billboard Faces_Count
        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        SELECT task_id_var, b."ID", 'pending', COALESCE(b."Faces_Count", 2)
        FROM billboards b
        WHERE b."ID" = ANY(billboard_id_array)
          AND b."Size" = ANY(team_rec.sizes)
          AND (
            array_length(team_rec.cities, 1) IS NULL
            OR array_length(team_rec.cities, 1) = 0
            OR b."City" = ANY(team_rec.cities)
          );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
