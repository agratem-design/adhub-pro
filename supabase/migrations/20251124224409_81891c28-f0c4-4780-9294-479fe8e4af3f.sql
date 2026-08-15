-- إصلاح: إضافة بنود لمهام الطباعة الفارغة

CREATE OR REPLACE FUNCTION backfill_print_task_items()
RETURNS TABLE(
  task_id_result UUID,
  items_added INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_print_task RECORD;
  v_items_added INT;
  v_installation_items RECORD;
  v_width NUMERIC;
  v_height NUMERIC;
  v_area NUMERIC;
  v_unit_cost NUMERIC := 10;
BEGIN
  FOR v_print_task IN
    SELECT 
      pt.id as print_task_id,
      pt.contract_id,
      pt.total_area,
      pt.total_cost
    FROM print_tasks pt
    WHERE NOT EXISTS (
      SELECT 1 FROM print_task_items pti WHERE pti.task_id = pt.id
    )
    AND pt.contract_id IS NOT NULL
  LOOP
    v_items_added := 0;
    
    FOR v_installation_items IN
      SELECT DISTINCT ON (iti.billboard_id, iti.design_face_a)
        iti.billboard_id,
        iti.design_face_a,
        iti.design_face_b,
        b."Size"
      FROM installation_task_items iti
      JOIN installation_tasks it ON it.id = iti.task_id
      JOIN billboards b ON b."ID" = iti.billboard_id
      WHERE it.contract_id = v_print_task.contract_id
      AND iti.status = 'completed'
      AND (iti.design_face_a IS NOT NULL OR iti.design_face_b IS NOT NULL)
    LOOP
      BEGIN
        v_width := CAST(SPLIT_PART(v_installation_items."Size", 'x', 1) AS NUMERIC);
        v_height := CAST(SPLIT_PART(v_installation_items."Size", 'x', 2) AS NUMERIC);
        v_area := v_width * v_height;
      EXCEPTION WHEN OTHERS THEN
        v_width := 4;
        v_height := 3;
        v_area := 12;
      END;
      
      IF v_print_task.total_area > 0 THEN
        v_unit_cost := v_print_task.total_cost / v_print_task.total_area;
      END IF;
      
      IF v_installation_items.design_face_a IS NOT NULL THEN
        INSERT INTO print_task_items (
          task_id,
          billboard_id,
          description,
          width,
          height,
          area,
          quantity,
          unit_cost,
          total_cost,
          design_face_a,
          status
        ) VALUES (
          v_print_task.print_task_id,
          v_installation_items.billboard_id,
          format('%sx%s - وجه أمامي', v_width, v_height),
          v_width,
          v_height,
          v_area,
          1,
          v_unit_cost * v_area,
          v_unit_cost * v_area,
          v_installation_items.design_face_a,
          'pending'
        );
        v_items_added := v_items_added + 1;
      END IF;
      
      IF v_installation_items.design_face_b IS NOT NULL 
         AND v_installation_items.design_face_b != v_installation_items.design_face_a THEN
        INSERT INTO print_task_items (
          task_id,
          billboard_id,
          description,
          width,
          height,
          area,
          quantity,
          unit_cost,
          total_cost,
          design_face_b,
          status
        ) VALUES (
          v_print_task.print_task_id,
          v_installation_items.billboard_id,
          format('%sx%s - وجه خلفي', v_width, v_height),
          v_width,
          v_height,
          v_area,
          1,
          v_unit_cost * v_area,
          v_unit_cost * v_area,
          v_installation_items.design_face_b,
          'pending'
        );
        v_items_added := v_items_added + 1;
      END IF;
    END LOOP;
    
    IF v_items_added > 0 THEN
      RETURN QUERY SELECT 
        v_print_task.print_task_id,
        v_items_added,
        format('تم إضافة %s بند', v_items_added);
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

SELECT * FROM backfill_print_task_items();

DROP FUNCTION IF EXISTS backfill_print_task_items();