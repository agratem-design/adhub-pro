-- Fix duration calc and store full financial/design data + add triggers

-- 1) Recreate function: create_billboard_history_on_completion
CREATE OR REPLACE FUNCTION public.create_billboard_history_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- فقط عند تحديث حالة المهمة إلى completed
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    -- إدراج سجل في billboard_history لكل billboard مكتمل ضمن المهمة
    INSERT INTO public.billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      rent_amount,
      billboard_rent_price,
      installation_cost,
      discount_amount,
      discount_percentage,
      total_before_discount,
      installation_date,
      design_face_a_url,
      design_face_b_url,
      design_name,
      installed_image_face_a_url,
      installed_image_face_b_url,
      team_name,
      notes
    )
    SELECT 
      iti.billboard_id,
      c."Contract_Number",
      c."Customer Name",
      c."Ad Type",
      c."Contract Date",
      c."End Date",
      CASE 
        WHEN c."End Date" IS NOT NULL AND c."Contract Date" IS NOT NULL 
          THEN GREATEST((c."End Date" - c."Contract Date"), 0)
        ELSE NULL
      END::INTEGER AS duration_days,
      c."Total Rent" AS rent_amount,
      b."Price" AS billboard_rent_price,
      c.installation_cost,
      COALESCE(c."Discount", 0) AS discount_amount,
      CASE 
        WHEN c."Total Rent" IS NOT NULL AND c."Total Rent" > 0 AND c."Discount" IS NOT NULL 
          THEN ROUND((c."Discount" / c."Total Rent") * 100, 2)
        ELSE NULL
      END AS discount_percentage,
      CASE 
        WHEN c."Total" IS NOT NULL AND c."Discount" IS NOT NULL THEN (c."Total" + c."Discount")
        WHEN c."Total Rent" IS NOT NULL THEN c."Total Rent"
        ELSE NULL
      END AS total_before_discount,
      iti.installation_date,
      COALESCE(td.design_face_a_url, iti.design_face_a, b.design_face_a) AS design_face_a_url,
      COALESCE(td.design_face_b_url, iti.design_face_b, b.design_face_b) AS design_face_b_url,
      td.design_name,
      iti.installed_image_face_a_url,
      iti.installed_image_face_b_url,
      team.team_name,
      iti.notes
    FROM public.installation_task_items iti
    LEFT JOIN public.task_designs td ON td.id = iti.selected_design_id
    LEFT JOIN public.installation_teams team ON team.id = NEW.team_id
    LEFT JOIN public."Contract" c ON c."Contract_Number" = NEW.contract_id
    LEFT JOIN public.billboards b ON b."ID" = iti.billboard_id
    WHERE iti.task_id = NEW.id
      AND iti.status = 'completed'
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2) Recreate function: save_billboard_history_on_completion (item-level)
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_billboard RECORD;
  v_contract RECORD;
  v_task RECORD;
  v_team_name TEXT;
  v_duration_days INTEGER;
BEGIN
  -- فقط عندما تصبح حالة العنصر مكتملة وبها تاريخ تركيب
  IF NEW.status = 'completed' THEN
    SELECT * INTO v_billboard FROM public.billboards WHERE "ID" = NEW.billboard_id;

    SELECT it.*, itt.team_name INTO v_task
    FROM public.installation_tasks it
    LEFT JOIN public.installation_teams itt ON it.team_id = itt.id
    WHERE it.id = NEW.task_id;

    v_team_name := v_task.team_name;

    SELECT * INTO v_contract
    FROM public."Contract"
    WHERE "Contract_Number" = v_task.contract_id;

    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := GREATEST((v_contract."End Date" - v_contract."Contract Date"), 0);
    ELSE
      v_duration_days := NULL;
    END IF;

    INSERT INTO public.billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      rent_amount,
      billboard_rent_price,
      installation_cost,
      discount_amount,
      discount_percentage,
      total_before_discount,
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
      v_contract."Total Rent",
      v_billboard."Price",
      v_contract.installation_cost,
      COALESCE(v_contract."Discount", 0),
      CASE 
        WHEN v_contract."Total Rent" IS NOT NULL AND v_contract."Total Rent" > 0 AND v_contract."Discount" IS NOT NULL 
          THEN ROUND((v_contract."Discount" / v_contract."Total Rent") * 100, 2)
        ELSE NULL
      END,
      CASE 
        WHEN v_contract."Total" IS NOT NULL AND v_contract."Discount" IS NOT NULL THEN (v_contract."Total" + v_contract."Discount")
        WHEN v_contract."Total Rent" IS NOT NULL THEN v_contract."Total Rent"
        ELSE NULL
      END,
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
$$;

-- 3) Trigger to save history when a task is marked completed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_installation_task_completed'
  ) THEN
    CREATE TRIGGER tr_installation_task_completed
    AFTER UPDATE ON public.installation_tasks
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
    EXECUTE FUNCTION public.create_billboard_history_on_completion();
  END IF;
END$$;

-- 4) Trigger to save history when an item is marked completed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_installation_item_completed'
  ) THEN
    CREATE TRIGGER tr_installation_item_completed
    AFTER UPDATE ON public.installation_task_items
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed'))
    EXECUTE FUNCTION public.save_billboard_history_on_completion();
  END IF;
END$$;

-- 5) Trigger to delete history on revert from completed -> pending
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_installation_item_revert'
  ) THEN
    CREATE TRIGGER tr_installation_item_revert
    AFTER UPDATE ON public.installation_task_items
    FOR EACH ROW
    WHEN (OLD.status = 'completed' AND NEW.status = 'pending')
    EXECUTE FUNCTION public.handle_installation_revert();
  END IF;
END$$;