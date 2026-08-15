-- مسح جميع مهام التركيب القديمة
DELETE FROM installation_task_items;
DELETE FROM installation_tasks;

-- إضافة دالة لإنشاء مهام التركيب تلقائياً من العقد
CREATE OR REPLACE FUNCTION auto_create_installation_tasks()
RETURNS TRIGGER AS $$
DECLARE
  billboard_id_array bigint[];
  billboard_rec RECORD;
  team_rec RECORD;
  task_id_var uuid;
BEGIN
  -- فقط للعقود الجديدة أو المحدثة من رقم 1161 فصاعداً
  IF NEW."Contract_Number" < 1161 THEN
    RETURN NEW;
  END IF;

  -- تحويل billboard_ids من نص إلى مصفوفة
  IF NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids != '' THEN
    SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint))
    INTO billboard_id_array
    FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id
    WHERE TRIM(id) ~ '^\d+$';
    
    -- حذف المهام القديمة لهذا العقد
    DELETE FROM installation_task_items 
    WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    
    -- إنشاء مهمة لكل فريق حسب المقاسات
    FOR team_rec IN 
      SELECT DISTINCT t.id, t.team_name, t.sizes
      FROM installation_teams t
      WHERE array_length(t.sizes, 1) > 0
    LOOP
      -- التحقق من وجود لوحات بمقاسات هذا الفريق
      IF EXISTS (
        SELECT 1 FROM billboards b
        WHERE b."ID" = ANY(billboard_id_array)
        AND b."Size" = ANY(team_rec.sizes)
      ) THEN
        -- إنشاء المهمة
        INSERT INTO installation_tasks (contract_id, team_id, status)
        VALUES (NEW."Contract_Number", team_rec.id, 'pending')
        RETURNING id INTO task_id_var;
        
        -- إضافة اللوحات المناسبة لهذا الفريق
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
$$ LANGUAGE plpgsql;

-- إنشاء trigger للعقود الجديدة والمحدثة
DROP TRIGGER IF EXISTS auto_create_tasks_trigger ON "Contract";
CREATE TRIGGER auto_create_tasks_trigger
AFTER INSERT OR UPDATE OF billboard_ids ON "Contract"
FOR EACH ROW
EXECUTE FUNCTION auto_create_installation_tasks();

-- إنشاء مهام لجميع العقود من 1161 فصاعداً
DO $$
DECLARE
  contract_rec RECORD;
  billboard_id_array bigint[];
  team_rec RECORD;
  task_id_var uuid;
BEGIN
  FOR contract_rec IN 
    SELECT "Contract_Number", billboard_ids, "Contract Date"
    FROM "Contract"
    WHERE "Contract_Number" >= 1161
    AND billboard_ids IS NOT NULL 
    AND billboard_ids != ''
    AND "Contract Date" >= '2025-10-01'
    ORDER BY "Contract_Number" DESC
  LOOP
    -- تحويل billboard_ids من نص إلى مصفوفة
    SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint))
    INTO billboard_id_array
    FROM unnest(string_to_array(contract_rec.billboard_ids, ',')) AS id
    WHERE TRIM(id) ~ '^\d+$';
    
    IF billboard_id_array IS NOT NULL AND array_length(billboard_id_array, 1) > 0 THEN
      -- إنشاء مهمة لكل فريق حسب المقاسات
      FOR team_rec IN 
        SELECT DISTINCT t.id, t.team_name, t.sizes
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
      LOOP
        -- التحقق من وجود لوحات بمقاسات هذا الفريق
        IF EXISTS (
          SELECT 1 FROM billboards b
          WHERE b."ID" = ANY(billboard_id_array)
          AND b."Size" = ANY(team_rec.sizes)
        ) THEN
          -- إنشاء المهمة
          INSERT INTO installation_tasks (contract_id, team_id, status)
          VALUES (contract_rec."Contract_Number", team_rec.id, 'pending')
          RETURNING id INTO task_id_var;
          
          -- إضافة اللوحات المناسبة لهذا الفريق
          INSERT INTO installation_task_items (task_id, billboard_id, status)
          SELECT task_id_var, b."ID", 'pending'
          FROM billboards b
          WHERE b."ID" = ANY(billboard_id_array)
          AND b."Size" = ANY(team_rec.sizes);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;