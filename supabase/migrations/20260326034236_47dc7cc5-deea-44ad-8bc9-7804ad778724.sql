
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_billboard RECORD;
  v_contract RECORD;
  v_task RECORD;
  v_team_name TEXT;
  v_duration_days INTEGER;
  v_billboard_prices JSONB;
  v_individual JSONB;
  v_rent_amount NUMERIC;
  v_installation_cost NUMERIC;
  v_print_cost NUMERIC;
  v_individual_price NUMERIC;
  v_individual_discount NUMERIC;
  v_net_rental NUMERIC;
  v_total_before_discount NUMERIC;
  v_include_installation BOOLEAN;
  v_include_print BOOLEAN;
  v_elem JSONB;
BEGIN
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

    -- استخراج السعر الفردي من billboard_prices JSON
    v_individual := NULL;
    v_individual_price := 0;
    v_individual_discount := 0;
    v_installation_cost := 0;
    v_print_cost := 0;

    BEGIN
      v_billboard_prices := v_contract.billboard_prices::jsonb;
      IF v_billboard_prices IS NOT NULL AND jsonb_typeof(v_billboard_prices) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_billboard_prices)
        LOOP
          IF (v_elem->>'billboardId')::int = NEW.billboard_id 
             OR (v_elem->>'billboard_id')::int = NEW.billboard_id THEN
            v_individual := v_elem;
            v_individual_price := COALESCE((v_elem->>'price')::numeric, (v_elem->>'rentPrice')::numeric, 0);
            v_individual_discount := COALESCE((v_elem->>'discount')::numeric, 0);
            v_installation_cost := COALESCE((v_elem->>'installationCost')::numeric, (v_elem->>'installation_cost')::numeric, 0);
            v_print_cost := COALESCE((v_elem->>'printCost')::numeric, (v_elem->>'print_cost')::numeric, 0);
            EXIT;
          END IF;
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_individual := NULL;
    END;

    -- حساب الإيجار الصافي
    IF v_individual IS NOT NULL THEN
      v_rent_amount := v_individual_price - v_individual_discount;
      v_net_rental := v_rent_amount;
      v_total_before_discount := v_individual_price;
    ELSE
      -- fallback: استخدام بيانات العقد العامة
      v_rent_amount := COALESCE(v_billboard."Price", v_contract."Total Rent");
      v_net_rental := v_rent_amount;
      v_total_before_discount := v_rent_amount;
      v_installation_cost := COALESCE(v_contract.installation_cost, 0);
      v_print_cost := 0;
      v_individual_discount := COALESCE(v_contract."Discount", 0);
    END IF;

    v_include_installation := COALESCE(v_contract.include_installation_in_price, false);
    v_include_print := COALESCE(v_contract.include_print_in_price, false);

    INSERT INTO public.billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      rent_amount,
      net_rental_amount,
      billboard_rent_price,
      installation_cost,
      print_cost,
      discount_amount,
      discount_percentage,
      total_before_discount,
      contract_total,
      contract_total_rent,
      contract_discount,
      individual_billboard_data,
      include_installation_in_price,
      include_print_in_price,
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
      v_rent_amount,
      v_net_rental,
      v_billboard."Price",
      v_installation_cost,
      v_print_cost,
      v_individual_discount,
      CASE 
        WHEN v_individual_price > 0 AND v_individual_discount > 0 
          THEN ROUND((v_individual_discount / v_individual_price) * 100, 2)
        ELSE NULL
      END,
      v_total_before_discount,
      v_contract."Total"::numeric,
      v_contract."Total Rent",
      COALESCE(v_contract."Discount", 0),
      v_individual,
      v_include_installation,
      v_include_print,
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
