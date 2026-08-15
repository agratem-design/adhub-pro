-- تحديث الـ trigger لحفظ صور التركيب والتصميم والخصم في الهيستوري
CREATE OR REPLACE FUNCTION save_billboard_history_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_billboard RECORD;
  v_contract RECORD;
  v_task RECORD;
  v_team_name TEXT;
  v_duration_days INTEGER;
BEGIN
  -- التحقق من أن المهمة مكتملة ولديها تاريخ تركيب
  IF NEW.status = 'completed' AND NEW.installation_date IS NOT NULL THEN
    
    -- جلب معلومات اللوحة
    SELECT * INTO v_billboard
    FROM billboards
    WHERE "ID" = NEW.billboard_id;
    
    -- جلب معلومات المهمة والفريق
    SELECT it.*, itt.team_name INTO v_task
    FROM installation_tasks it
    LEFT JOIN installation_teams itt ON it.team_id = itt.id
    WHERE it.id = NEW.task_id;
    
    v_team_name := v_task.team_name;
    
    -- جلب معلومات العقد
    SELECT * INTO v_contract
    FROM "Contract"
    WHERE "Contract_Number" = v_task.contract_id;
    
    -- حساب مدة العقد بالأيام
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := EXTRACT(DAY FROM (v_contract."End Date" - v_contract."Contract Date"));
    ELSE
      v_duration_days := 0;
    END IF;
    
    -- إدراج السجل في جدول الهيستوري
    INSERT INTO billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      rent_amount,
      discount_amount,
      installation_date,
      design_face_a_url,
      design_face_b_url,
      installed_image_face_a_url,
      installed_image_face_b_url,
      team_name,
      notes
    ) VALUES (
      NEW.billboard_id,
      v_contract."Contract_Number",
      v_contract."Customer Name",
      v_contract."Ad Type",
      v_contract."Contract Date",
      v_contract."End Date",
      v_duration_days,
      v_billboard."Price",
      v_contract."Discount",
      NEW.installation_date,
      COALESCE(NEW.design_face_a, v_billboard.design_face_a),
      COALESCE(NEW.design_face_b, v_billboard.design_face_b),
      NEW.installed_image_face_a_url,
      NEW.installed_image_face_b_url,
      v_team_name,
      NEW.notes
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف الـ trigger القديم إن وجد وإنشاء واحد جديد
DROP TRIGGER IF EXISTS trg_save_billboard_history ON installation_task_items;
CREATE TRIGGER trg_save_billboard_history
  AFTER UPDATE ON installation_task_items
  FOR EACH ROW
  EXECUTE FUNCTION save_billboard_history_on_completion();