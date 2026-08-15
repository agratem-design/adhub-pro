-- حذف الـ trigger المكرر الذي يسبب إنشاء مهام منفصلة لكل لوحة
DROP TRIGGER IF EXISTS trigger_create_installation_task ON "Contract";

-- تحسين function لإنشاء مهام التركيب بذكاء
CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks()
RETURNS trigger
LANGUAGE plpgsql
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
  -- فقط للعقود من رقم 1161 فصاعداً
  IF NEW."Contract_Number" < 1161 THEN
    RETURN NEW;
  END IF;

  -- التحقق من تفعيل التركيب
  IF COALESCE(NEW.installation_enabled, true) = false THEN
    -- حذف المهام إذا تم تعطيل التركيب
    DELETE FROM installation_task_items 
    WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;

  -- تحويل billboard_ids من نص إلى مصفوفة
  IF NEW.billboard_ids IS NULL OR NEW.billboard_ids = '' THEN
    -- حذف المهام إذا لم يعد هناك لوحات
    DELETE FROM installation_task_items 
    WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;

  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint))
  INTO billboard_id_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id
  WHERE TRIM(id) ~ '^\d+$';

  -- التحقق من وجود مهام سابقة
  SELECT ARRAY_AGG(DISTINCT billboard_id)
  INTO existing_billboard_ids
  FROM installation_task_items iti
  JOIN installation_tasks it ON iti.task_id = it.id
  WHERE it.contract_id = NEW."Contract_Number";

  is_update := (existing_billboard_ids IS NOT NULL);

  IF is_update THEN
    -- حساب اللوحات الجديدة والمحذوفة
    SELECT ARRAY_AGG(x)
    INTO new_billboard_ids
    FROM unnest(billboard_id_array) x
    WHERE NOT (x = ANY(existing_billboard_ids));

    SELECT ARRAY_AGG(x)
    INTO removed_billboard_ids
    FROM unnest(existing_billboard_ids) x
    WHERE NOT (x = ANY(billboard_id_array));

    -- حذف اللوحات المحذوفة من المهام
    IF removed_billboard_ids IS NOT NULL THEN
      DELETE FROM installation_task_items
      WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
      AND billboard_id = ANY(removed_billboard_ids);
    END IF;

    -- إضافة اللوحات الجديدة فقط
    IF new_billboard_ids IS NOT NULL THEN
      FOR team_rec IN 
        SELECT DISTINCT t.id, t.team_name, t.sizes
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
      LOOP
        IF EXISTS (
          SELECT 1 FROM billboards b
          WHERE b."ID" = ANY(new_billboard_ids)
          AND b."Size" = ANY(team_rec.sizes)
        ) THEN
          -- البحث عن مهمة موجودة أو إنشاء واحدة جديدة
          SELECT id INTO task_id_var
          FROM installation_tasks
          WHERE contract_id = NEW."Contract_Number" AND team_id = team_rec.id
          LIMIT 1;

          IF task_id_var IS NULL THEN
            INSERT INTO installation_tasks (contract_id, team_id, status)
            VALUES (NEW."Contract_Number", team_rec.id, 'pending')
            RETURNING id INTO task_id_var;
          END IF;

          -- إضافة اللوحات الجديدة فقط
          INSERT INTO installation_task_items (task_id, billboard_id, status)
          SELECT task_id_var, b."ID", 'pending'
          FROM billboards b
          WHERE b."ID" = ANY(new_billboard_ids)
          AND b."Size" = ANY(team_rec.sizes)
          ON CONFLICT (task_id, billboard_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;

    -- حذف المهام الفارغة
    DELETE FROM installation_tasks
    WHERE contract_id = NEW."Contract_Number"
    AND id NOT IN (
      SELECT DISTINCT task_id 
      FROM installation_task_items 
      WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
    );

  ELSE
    -- إنشاء مهام جديدة للعقد الجديد
    FOR team_rec IN 
      SELECT DISTINCT t.id, t.team_name, t.sizes
      FROM installation_teams t
      WHERE array_length(t.sizes, 1) > 0
    LOOP
      IF EXISTS (
        SELECT 1 FROM billboards b
        WHERE b."ID" = ANY(billboard_id_array)
        AND b."Size" = ANY(team_rec.sizes)
      ) THEN
        INSERT INTO installation_tasks (contract_id, team_id, status)
        VALUES (NEW."Contract_Number", team_rec.id, 'pending')
        RETURNING id INTO task_id_var;
        
        INSERT INTO installation_task_items (task_id, billboard_id, status)
        SELECT task_id_var, b."ID", 'pending'
        FROM billboards b
        WHERE b."ID" = ANY(billboard_id_array)
        AND b."Size" = ANY(team_rec.sizes);
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;