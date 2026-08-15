-- إنشاء دالة لحفظ بيانات اللوحة في الهيستوري عند إتمام التركيب
CREATE OR REPLACE FUNCTION save_billboard_history_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  billboard_rec RECORD;
  contract_rec RECORD;
  task_rec RECORD;
  team_name_val TEXT;
BEGIN
  -- التحقق من أن الحالة تم تغييرها إلى completed وأن التاريخ موجود
  IF NEW.status = 'completed' AND NEW.installation_date IS NOT NULL AND 
     (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- جلب بيانات اللوحة
    SELECT * INTO billboard_rec
    FROM billboards
    WHERE "ID" = NEW.billboard_id;
    
    -- جلب بيانات المهمة والفريق
    SELECT it.*, t.team_name INTO task_rec
    FROM installation_tasks it
    LEFT JOIN installation_teams t ON t.id = it.team_id
    WHERE it.id = NEW.task_id;
    
    -- جلب بيانات العقد المرتبط باللوحة
    SELECT * INTO contract_rec
    FROM "Contract"
    WHERE "Contract_Number" = billboard_rec."Contract_Number"
    LIMIT 1;
    
    -- حساب مدة الإيجار
    DECLARE
      duration_days_val INTEGER;
    BEGIN
      IF contract_rec."End Date" IS NOT NULL AND billboard_rec."Rent_Start_Date" IS NOT NULL THEN
        duration_days_val := (contract_rec."End Date" - billboard_rec."Rent_Start_Date");
      ELSE
        duration_days_val := 0;
      END IF;
      
      -- إدراج السجل في تاريخ اللوحة
      INSERT INTO billboard_history (
        billboard_id,
        contract_number,
        customer_name,
        ad_type,
        start_date,
        end_date,
        duration_days,
        rent_amount,
        installation_date,
        design_face_a_url,
        design_face_b_url,
        design_name,
        installed_image_face_a_url,
        installed_image_face_b_url,
        team_name,
        notes
      ) VALUES (
        NEW.billboard_id,
        billboard_rec."Contract_Number",
        billboard_rec."Customer_Name",
        billboard_rec."Ad_Type",
        billboard_rec."Rent_Start_Date",
        billboard_rec."Rent_End_Date",
        duration_days_val,
        billboard_rec."Price",
        NEW.installation_date,
        NEW.design_face_a,
        NEW.design_face_b,
        (SELECT design_name FROM task_designs WHERE id = NEW.selected_design_id),
        NEW.installed_image_face_a_url,
        NEW.installed_image_face_b_url,
        task_rec.team_name,
        NEW.notes
      )
      ON CONFLICT DO NOTHING;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- حذف المشغل القديم إذا كان موجوداً
DROP TRIGGER IF EXISTS trg_save_billboard_history ON installation_task_items;

-- إنشاء مشغل لتنفيذ الدالة عند تحديث installation_task_items
CREATE TRIGGER trg_save_billboard_history
AFTER UPDATE ON installation_task_items
FOR EACH ROW
EXECUTE FUNCTION save_billboard_history_on_completion();