
-- =====================================================================
-- إعادة توزيع عناصر مهام الإزالة المعلقة حسب (مقاس + مدينة)
-- مطابقة لمنطق trigger auto_create_installation_tasks
-- =====================================================================

DO $$
DECLARE
  v_item RECORD;
  v_billboard RECORD;
  v_correct_team_id UUID;
  v_correct_task_id UUID;
  v_old_task RECORD;
  v_contract_id INT;
  moved_count INT := 0;
  skipped_count INT := 0;
BEGIN

  -- جلب جميع عناصر الإزالة المعلقة مع معلومات اللوحة والمهمة الحالية
  FOR v_item IN
    SELECT 
      rti.id AS item_id,
      rti.task_id AS current_task_id,
      rti.billboard_id,
      rti.status,
      rti.design_face_a,
      rti.design_face_b,
      rti.installed_image_url,
      rti.notes,
      rt.team_id AS current_team_id,
      rt.contract_id,
      rt.contract_ids,
      rt.status AS task_status
    FROM removal_task_items rti
    JOIN removal_tasks rt ON rti.task_id = rt.id
    WHERE rt.status IN ('pending', 'in_progress')
      AND rti.status = 'pending'
  LOOP

    -- جلب بيانات اللوحة (المقاس + المدينة)
    SELECT "Size", "City" INTO v_billboard
    FROM billboards
    WHERE "ID" = v_item.billboard_id;

    IF v_billboard IS NULL THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- البحث عن الفريق الصحيح: مقاس يطابق + مدينة ضمن النطاق (أو بدون قيود مدن)
    SELECT id INTO v_correct_team_id
    FROM installation_teams
    WHERE v_billboard."Size" = ANY(sizes)
      AND (
        array_length(cities, 1) IS NULL
        OR array_length(cities, 1) = 0
        OR v_billboard."City" = ANY(cities)
      )
    LIMIT 1;

    -- إذا لم يجد بالمقاس+مدينة، ابحث بالمقاس فقط
    IF v_correct_team_id IS NULL THEN
      SELECT id INTO v_correct_team_id
      FROM installation_teams
      WHERE v_billboard."Size" = ANY(sizes)
      LIMIT 1;
    END IF;

    -- إذا لا يوجد فريق مناسب أصلاً، تخطّ
    IF v_correct_team_id IS NULL THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- إذا كان الفريق الحالي صحيحاً، لا نفعل شيئاً
    IF v_correct_team_id = v_item.current_team_id THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- البحث عن مهمة موجودة للفريق الصحيح + نفس العقد
    SELECT id INTO v_correct_task_id
    FROM removal_tasks
    WHERE team_id = v_correct_team_id
      AND contract_id = v_item.contract_id
      AND status IN ('pending', 'in_progress')
    LIMIT 1;

    -- إذا لم توجد مهمة للفريق الصحيح، أنشئ واحدة
    IF v_correct_task_id IS NULL THEN
      INSERT INTO removal_tasks (
        contract_id,
        contract_ids,
        team_id,
        status,
        created_at
      ) VALUES (
        v_item.contract_id,
        v_item.contract_ids,
        v_correct_team_id,
        'pending',
        NOW()
      )
      RETURNING id INTO v_correct_task_id;
    END IF;

    -- نقل العنصر للمهمة الصحيحة (إذا لم يكن موجوداً فيها مسبقاً)
    IF NOT EXISTS (
      SELECT 1 FROM removal_task_items
      WHERE task_id = v_correct_task_id AND billboard_id = v_item.billboard_id
    ) THEN
      UPDATE removal_task_items
      SET task_id = v_correct_task_id
      WHERE id = v_item.item_id;
      
      moved_count := moved_count + 1;
    ELSE
      -- اللوحة موجودة مسبقاً في المهمة الصحيحة، احذف النسخة المكررة
      DELETE FROM removal_task_items WHERE id = v_item.item_id;
      moved_count := moved_count + 1;
    END IF;

  END LOOP;

  -- حذف المهام الفارغة (التي أُخذت منها جميع العناصر)
  DELETE FROM removal_tasks
  WHERE status IN ('pending', 'in_progress')
    AND id NOT IN (
      SELECT DISTINCT task_id FROM removal_task_items
    );

  RAISE NOTICE 'تم: نقل % عنصر، تخطي % عنصر', moved_count, skipped_count;

END $$;
