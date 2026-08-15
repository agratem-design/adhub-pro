-- 1. تحديث دالة المزامنة بين العقد واللوحات
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_contract RECORD;
  v_billboard_ids bigint[];
  v_updated_count integer := 0;
  v_newest_contract RECORD;
  v_start_date date;
  v_end_date date;
  v_custom_start date;
  v_custom_end date;
BEGIN
  SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = p_contract_number;
  IF v_contract IS NULL THEN 
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.billboard_ids IS NULL OR v_contract.billboard_ids = '' THEN 
    RETURN json_build_object('success', true, 'updated', 0);
  END IF;
  
  SELECT ARRAY_AGG(CAST(TRIM(x) AS bigint)) INTO v_billboard_ids
  FROM unnest(string_to_array(v_contract.billboard_ids, ',')) x WHERE TRIM(x) ~ '^\d+$';
  
  IF v_billboard_ids IS NULL THEN 
    RETURN json_build_object('success', true, 'updated', 0);
  END IF;
  
  FOR v_newest_contract IN
    SELECT b."ID" as billboard_id, c."Contract_Number", c."Customer Name", c."Contract Date", c."End Date", c.billboard_prices
    FROM unnest(v_billboard_ids) AS b("ID")
    LEFT JOIN LATERAL (
      SELECT cc."Contract_Number", cc."Customer Name", cc."Contract Date", cc."End Date", cc.billboard_prices
      FROM "Contract" cc
      WHERE cc.billboard_ids IS NOT NULL
        AND b."ID" = ANY(string_to_array(cc.billboard_ids, ',')::bigint[])
        AND cc."End Date" IS NOT NULL
      ORDER BY cc."End Date" DESC, cc."Contract_Number" DESC
      LIMIT 1
    ) c ON true
  LOOP
    IF v_newest_contract."Contract_Number" = p_contract_number THEN
      -- التواريخ الافتراضية للعقد
      v_start_date := v_newest_contract."Contract Date";
      v_end_date := v_newest_contract."End Date";
      
      -- التحقق من وجود تواريخ مخصصة داخل حقل الأسعار الموحد
      IF v_newest_contract.billboard_prices IS NOT NULL AND v_newest_contract.billboard_prices <> '' THEN
        BEGIN
          SELECT (elem->>'startDate')::date, (elem->>'endDate')::date
            INTO v_custom_start, v_custom_end
            FROM jsonb_array_elements(v_newest_contract.billboard_prices::jsonb) AS elem
           WHERE elem->>'billboardId' = v_newest_contract.billboard_id::text;
           
          IF v_custom_start IS NOT NULL THEN
            v_start_date := v_custom_start;
          END IF;
          IF v_custom_end IS NOT NULL THEN
            v_end_date := v_custom_end;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- تجاهل الأخطاء والرجوع للتواريخ الافتراضية
        END;
      END IF;

      -- تحديث اللوحات مباشرة بالنوع date دون التحويل إلى text
      UPDATE billboards 
      SET "Status" = CASE 
            WHEN v_end_date < CURRENT_DATE THEN 'متاح'
            ELSE 'مؤجر'
          END,
          "Contract_Number" = CASE 
            WHEN v_end_date < CURRENT_DATE THEN NULL
            ELSE v_newest_contract."Contract_Number"
          END,
          "Customer_Name" = CASE 
            WHEN v_end_date < CURRENT_DATE THEN NULL
            ELSE v_newest_contract."Customer Name"
          END,
          "Rent_Start_Date" = CASE 
            WHEN v_end_date < CURRENT_DATE THEN NULL
            ELSE v_start_date
          END,
          "Rent_End_Date" = CASE 
            WHEN v_end_date < CURRENT_DATE THEN NULL
            ELSE v_end_date
          END
      WHERE "ID" = v_newest_contract.billboard_id;
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object('success', true, 'updated', v_updated_count);
END;
$$;


-- 2. تحديث دالة حفظ سجل اللوحة التاريخي عند إكمال التركيب
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE 
  v_billboard RECORD; 
  v_contract RECORD; 
  v_task RECORD; 
  v_team_name TEXT; 
  v_duration_days INTEGER;
  v_start_date date;
  v_end_date date;
  v_custom_start date;
  v_custom_end date;
  v_custom_reason text;
  v_custom_notes text;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT * INTO v_billboard FROM public.billboards WHERE "ID" = NEW.billboard_id;
    SELECT it.*, itt.team_name INTO v_task FROM public.installation_tasks it LEFT JOIN public.installation_teams itt ON it.team_id = itt.id WHERE it.id = NEW.task_id;
    v_team_name := v_task.team_name;
    SELECT * INTO v_contract FROM public."Contract" WHERE "Contract_Number" = v_task.contract_id;
    
    -- التواريخ الافتراضية للعقد
    v_start_date := v_contract."Contract Date";
    v_end_date := v_contract."End Date";
    v_custom_notes := NEW.notes;

    -- التحقق من وجود تواريخ مخصصة والسبب
    IF v_contract.billboard_prices IS NOT NULL AND v_contract.billboard_prices <> '' THEN
      BEGIN
        SELECT (elem->>'startDate')::date, (elem->>'endDate')::date, elem->>'startDateReason'
          INTO v_custom_start, v_custom_end, v_custom_reason
          FROM jsonb_array_elements(v_contract.billboard_prices::jsonb) AS elem
         WHERE elem->>'billboardId' = NEW.billboard_id::text;
         
        IF v_custom_start IS NOT NULL THEN
          v_start_date := v_custom_start;
        END IF;
        IF v_custom_end IS NOT NULL THEN
          v_end_date := v_custom_end;
        END IF;
        IF v_custom_reason IS NOT NULL AND v_custom_reason <> '' THEN
          v_custom_notes := COALESCE(v_custom_notes || ' — ', '') || 'سبب تعديل البداية: ' || v_custom_reason;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- تجاهل الأخطاء والرجوع للقيم العامة
      END;
    END IF;

    IF v_end_date IS NOT NULL AND v_start_date IS NOT NULL THEN 
      v_duration_days := GREATEST((v_end_date - v_start_date), 0); 
    ELSE 
      v_duration_days := NULL; 
    END IF;
    
    INSERT INTO public.billboard_history (
      billboard_id, contract_number, customer_name, ad_type, start_date, end_date, 
      duration_days, rent_amount, billboard_rent_price, installation_cost, 
      discount_amount, discount_percentage, total_before_discount, installation_date, 
      design_face_a_url, design_face_b_url, installed_image_face_a_url, 
      installed_image_face_b_url, team_name, notes
    )
    VALUES (
      NEW.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", 
      v_start_date::text, v_end_date::text, v_duration_days, v_contract."Total Rent", v_billboard."Price", 
      v_contract.installation_cost, COALESCE(v_contract."Discount", 0), 
      CASE WHEN v_contract."Total Rent" IS NOT NULL AND v_contract."Total Rent" > 0 AND v_contract."Discount" IS NOT NULL THEN ROUND((v_contract."Discount" / v_contract."Total Rent") * 100, 2) ELSE NULL END, 
      CASE WHEN v_contract."Total" IS NOT NULL AND v_contract."Discount" IS NOT NULL THEN (v_contract."Total" + v_contract."Discount") WHEN v_contract."Total Rent" IS NOT NULL THEN v_contract."Total Rent" ELSE NULL END, 
      NEW.installation_date, COALESCE(NEW.design_face_a, v_billboard.design_face_a), COALESCE(NEW.design_face_b, v_billboard.design_face_b), 
      NEW.installed_image_face_a_url, NEW.installed_image_face_b_url, v_team_name, v_custom_notes
    );
  END IF;
  RETURN NEW;
END;
$$;
