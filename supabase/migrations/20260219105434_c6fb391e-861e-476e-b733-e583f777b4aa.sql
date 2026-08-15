
-- Fix auto_create_installation_tasks to consider team city specialization
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
      -- For each team, assign billboards matching BOTH size AND city specialization
      FOR team_rec IN
        SELECT t.id, t.team_name, t.sizes, t.cities
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
      LOOP
        -- Check if this team handles any of the new billboards:
        -- Size must match, AND (team has no city restriction OR billboard city is in team's cities)
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

          -- Insert only billboards matching both size AND city for this team
          INSERT INTO installation_task_items (task_id, billboard_id, status)
          SELECT task_id_var, b."ID", 'pending'
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
    -- New task creation: assign each billboard to the right team by size AND city
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

        INSERT INTO installation_task_items (task_id, billboard_id, status)
        SELECT task_id_var, b."ID", 'pending'
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
