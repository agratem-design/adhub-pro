-- إضافة سجلات في installation_team_accounts للمهام المكتملة السابقة

-- استخدام function لإضافة السجلات بشكل آمن
CREATE OR REPLACE FUNCTION backfill_team_accounts()
RETURNS TABLE(
  added_count INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_item RECORD;
  v_team_id UUID;
  v_contract_id BIGINT;
  v_installation_cost NUMERIC;
  v_billboard_size TEXT;
BEGIN
  -- حلقة على جميع مهام التركيب المكتملة التي ليس لها سجل في الحسابات
  FOR v_item IN
    SELECT 
      iti.id as item_id,
      iti.task_id,
      iti.billboard_id,
      iti.installation_date,
      it.contract_id,
      it.team_id
    FROM installation_task_items iti
    JOIN installation_tasks it ON it.id = iti.task_id
    WHERE iti.status = 'completed'
    AND iti.installation_date IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM installation_team_accounts 
      WHERE task_item_id = iti.id
    )
  LOOP
    -- جلب حجم اللوحة
    SELECT "Size" INTO v_billboard_size
    FROM billboards
    WHERE "ID" = v_item.billboard_id;
    
    -- جلب سعر التركيب من جدول الأسعار
    SELECT install_price INTO v_installation_cost
    FROM installation_print_pricing
    WHERE size = v_billboard_size
    LIMIT 1;
    
    -- إذا لم نجد في جدول الأسعار، نأخذ من العقد
    IF v_installation_cost IS NULL THEN
      SELECT 
        COALESCE(installation_cost, 0) / NULLIF(billboards_count, 0)::NUMERIC
      INTO v_installation_cost
      FROM "Contract"
      WHERE "Contract_Number" = v_item.contract_id;
    END IF;
    
    -- إضافة السجل
    INSERT INTO installation_team_accounts (
      team_id,
      task_item_id,
      billboard_id,
      contract_id,
      installation_date,
      amount,
      status,
      notes
    ) VALUES (
      v_item.team_id,
      v_item.item_id,
      v_item.billboard_id,
      v_item.contract_id,
      v_item.installation_date,
      COALESCE(v_installation_cost, 0),
      'pending',
      'تم الإضافة عبر backfill للمهام المكتملة'
    )
    ON CONFLICT (task_item_id) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN QUERY SELECT v_count, format('تم إضافة %s سجل بنجاح', v_count);
END;
$$;

-- تنفيذ الـ backfill
SELECT * FROM backfill_team_accounts();

-- حذف الـ function بعد الاستخدام
DROP FUNCTION IF EXISTS backfill_team_accounts();