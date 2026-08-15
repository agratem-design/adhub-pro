-- 1) قيود فريدة وعلاقات أساسية قبل أي upsert
-- installation_tasks: unique (contract_id, team_id)
ALTER TABLE installation_tasks 
DROP CONSTRAINT IF EXISTS installation_tasks_contract_team_unique;
ALTER TABLE installation_tasks
ADD CONSTRAINT installation_tasks_contract_team_unique UNIQUE (contract_id, team_id);

-- installation_task_items: unique (task_id, billboard_id)
ALTER TABLE installation_task_items
DROP CONSTRAINT IF EXISTS installation_task_items_task_billboard_unique;
ALTER TABLE installation_task_items
ADD CONSTRAINT installation_task_items_task_billboard_unique UNIQUE (task_id, billboard_id);

-- 2) علاقات المفاتيح الأجنبية لتفعيل العلاقات في PostgREST
-- installation_tasks.contract_id -> Contract.Contract_Number
ALTER TABLE installation_tasks
DROP CONSTRAINT IF EXISTS installation_tasks_contract_fk;
ALTER TABLE installation_tasks
ADD CONSTRAINT installation_tasks_contract_fk
FOREIGN KEY (contract_id) REFERENCES "Contract"("Contract_Number") ON DELETE CASCADE;

-- installation_tasks.team_id -> installation_teams.id
ALTER TABLE installation_tasks
DROP CONSTRAINT IF EXISTS installation_tasks_team_fk;
ALTER TABLE installation_tasks
ADD CONSTRAINT installation_tasks_team_fk
FOREIGN KEY (team_id) REFERENCES installation_teams(id) ON DELETE SET NULL;

-- installation_task_items.task_id -> installation_tasks.id
ALTER TABLE installation_task_items
DROP CONSTRAINT IF EXISTS installation_task_items_task_fk;
ALTER TABLE installation_task_items
ADD CONSTRAINT installation_task_items_task_fk
FOREIGN KEY (task_id) REFERENCES installation_tasks(id) ON DELETE CASCADE;

-- installation_task_items.billboard_id -> billboards.ID
ALTER TABLE installation_task_items
DROP CONSTRAINT IF EXISTS installation_task_items_billboard_fk;
ALTER TABLE installation_task_items
ADD CONSTRAINT installation_task_items_billboard_fk
FOREIGN KEY (billboard_id) REFERENCES billboards("ID") ON DELETE CASCADE;

-- 3) Trigger تحديث updated_at لمهام التركيب
DROP TRIGGER IF EXISTS update_installation_tasks_updated_at_trigger ON installation_tasks;
CREATE TRIGGER update_installation_tasks_updated_at_trigger
BEFORE UPDATE ON installation_tasks
FOR EACH ROW
EXECUTE FUNCTION update_installation_tasks_updated_at();

-- 4) Trigger إنشاء مهام التركيب تلقائياً عند العقود
DROP TRIGGER IF EXISTS trigger_create_installation_task ON "Contract";
CREATE TRIGGER trigger_create_installation_task
AFTER INSERT OR UPDATE OF billboard_ids, installation_enabled ON "Contract"
FOR EACH ROW
WHEN (NEW.installation_enabled IS DISTINCT FROM FALSE AND NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids <> '')
EXECUTE FUNCTION create_installation_task_for_contract();

-- 5) تعبئة رجعية للمهام والعناصر من العقود الحالية
DO $$
DECLARE
  v_contract RECORD;
  v_billboard_id bigint;
  v_task_id uuid;
  v_team_id uuid;
  v_size text;
BEGIN
  FOR v_contract IN 
    SELECT "Contract_Number", billboard_ids
    FROM "Contract"
    WHERE installation_enabled = true 
      AND billboard_ids IS NOT NULL 
      AND TRIM(billboard_ids) <> ''
  LOOP
    FOR v_billboard_id IN 
      SELECT unnest(string_to_array(v_contract.billboard_ids, ',')::bigint[])
    LOOP
      SELECT "Size" INTO v_size
      FROM billboards
      WHERE "ID" = v_billboard_id;
      
      IF v_size IS NULL THEN
        CONTINUE;
      END IF;
      
      SELECT id INTO v_team_id
      FROM installation_teams
      WHERE v_size = ANY(sizes)
      LIMIT 1;
      
      IF v_team_id IS NULL THEN
        SELECT id INTO v_team_id FROM installation_teams LIMIT 1;
      END IF;
      
      IF v_team_id IS NULL THEN
        CONTINUE;
      END IF;
      
      INSERT INTO installation_tasks (contract_id, team_id, status)
      VALUES (v_contract."Contract_Number", v_team_id, 'pending')
      ON CONFLICT (contract_id, team_id) DO NOTHING
      RETURNING id INTO v_task_id;
      
      IF v_task_id IS NULL THEN
        SELECT id INTO v_task_id
        FROM installation_tasks
        WHERE contract_id = v_contract."Contract_Number"
          AND team_id = v_team_id
        LIMIT 1;
      END IF;
      
      IF v_task_id IS NOT NULL THEN
        INSERT INTO installation_task_items (task_id, billboard_id, status)
        VALUES (v_task_id, v_billboard_id, 'pending')
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;