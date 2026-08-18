-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Print Task Database-Level Concurrency & Atomic Transaction RPC
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Partial Unique Index for Database-Level Concurrency & Idempotency
-- Guarantees at most ONE active (non-cancelled) print task per installation task.
-- Allows multiple standalone print tasks where installation_task_id IS NULL.
-- Allows creating a replacement print task if the previous one is 'cancelled' or 'canceled'.
CREATE UNIQUE INDEX IF NOT EXISTS idx_print_tasks_one_active_per_installation
ON public.print_tasks (installation_task_id)
WHERE installation_task_id IS NOT NULL AND status NOT IN ('cancelled', 'canceled');

-- 2. PostgreSQL Atomic Transaction RPC Function
-- Executes the entire print task creation orchestration in ONE ACID Transaction.
-- If any step fails, PostgreSQL automatically rolls back everything cleanly.
CREATE OR REPLACE FUNCTION public.create_print_task_atomic(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_installation_task_id UUID;
  v_customer_id TEXT;
  v_customer_name TEXT;
  v_contract_id NUMERIC;
  v_printer_id UUID;
  v_printer_name TEXT;
  v_is_reinstallation BOOLEAN;
  v_total_area NUMERIC;
  v_printer_total NUMERIC;
  v_customer_total NUMERIC;
  v_print_profit NUMERIC;
  v_existing_task_id UUID;
  v_print_invoice_id UUID;
  v_print_task_id UUID;
  v_cutout_invoice_id UUID;
  v_cutout_task_id UUID;
  v_item JSONB;
  v_cutout_item JSONB;
  v_cutout_total_qty INT;
  v_cutout_printer_total NUMERIC;
  v_cutout_customer_total NUMERIC;
  v_composite_id UUID;
  v_combined_inv_id UUID;
  v_company_install_cost NUMERIC;
  v_customer_install_cost NUMERIC;
  v_discount_amount NUMERIC;
  v_new_customer_total NUMERIC;
BEGIN
  -- Extract basic properties
  IF p_payload->>'installationTaskId' IS NOT NULL AND p_payload->>'installationTaskId' != '' THEN
    v_installation_task_id := (p_payload->>'installationTaskId')::UUID;
  END IF;
  
  v_customer_id := p_payload->>'customerId';
  v_customer_name := p_payload->>'customerName';
  v_contract_id := (p_payload->>'contractId')::NUMERIC;
  v_printer_id := (p_payload->>'printerId')::UUID;
  v_printer_name := COALESCE(p_payload->>'printerName', 'غير محدد');
  v_is_reinstallation := COALESCE((p_payload->>'isReinstallation')::BOOLEAN, false);
  v_total_area := COALESCE((p_payload->'totals'->>'totalArea')::NUMERIC, 0);
  v_printer_total := COALESCE((p_payload->'totals'->>'printerPrintTotal')::NUMERIC, 0);
  v_customer_total := COALESCE((p_payload->'totals'->>'customerPrintTotal')::NUMERIC, 0);
  v_print_profit := COALESCE((p_payload->'totals'->>'printProfit')::NUMERIC, 0);
  v_company_install_cost := COALESCE((p_payload->>'companyInstallationCost')::NUMERIC, 0);
  v_customer_install_cost := COALESCE((p_payload->>'customerInstallationCost')::NUMERIC, 0);

  -- 1. Database-Level Lock & Concurrency Check
  IF v_installation_task_id IS NOT NULL THEN
    SELECT id INTO v_existing_task_id
    FROM public.print_tasks
    WHERE installation_task_id = v_installation_task_id
      AND status NOT IN ('cancelled', 'canceled')
    FOR UPDATE;

    IF v_existing_task_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'DUPLICATE_TASK',
        'message', 'توجد مهمة طباعة فعالة لهذه المهمة بالفعل (مهمة #' || SUBSTRING(v_existing_task_id::TEXT FROM 1 FOR 8) || ')'
      );
    END IF;
  END IF;

  -- 2. Customer Integrity Check
  IF v_customer_id IS NULL OR v_customer_id = '' OR v_customer_id = 'unknown_customer' THEN
    RAISE EXCEPTION 'بيانات العميل غير مكتملة أو غير صالحة';
  END IF;

  -- 3. Create Printed Invoice
  INSERT INTO public.printed_invoices (
    contract_number,
    invoice_number,
    customer_id,
    customer_name,
    printer_id,
    printer_name,
    invoice_date,
    total_amount,
    printer_cost,
    invoice_type,
    notes
  ) VALUES (
    v_contract_id,
    'PT-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
    v_customer_id,
    v_customer_name,
    v_printer_id,
    v_printer_name,
    CURRENT_DATE,
    v_customer_total,
    v_printer_total,
    'print',
    'مهمة طباعة من التركيب ' || COALESCE(v_installation_task_id::TEXT, '')
  ) RETURNING id INTO v_print_invoice_id;

  -- 4. Create Print Task
  INSERT INTO public.print_tasks (
    invoice_id,
    contract_id,
    customer_id,
    customer_name,
    customer_total_amount,
    printer_id,
    status,
    total_area,
    total_cost,
    printer_total_cost,
    price_per_meter,
    priority,
    installation_task_id,
    is_composite,
    notes
  ) VALUES (
    v_print_invoice_id,
    v_contract_id,
    v_customer_id,
    v_customer_name,
    v_customer_total,
    v_printer_id,
    'pending',
    v_total_area,
    v_printer_total,
    v_printer_total,
    CASE WHEN v_total_area > 0 THEN v_printer_total / v_total_area ELSE 0 END,
    'normal',
    v_installation_task_id,
    true,
    'مهمة طباعة من التركيب - الربح: ' || ROUND(v_print_profit, 2) || ' د.ل'
  ) RETURNING id INTO v_print_task_id;

  -- 5. Update Source Installation Task
  IF v_installation_task_id IS NOT NULL THEN
    UPDATE public.installation_tasks
    SET print_task_id = v_print_task_id
    WHERE id = v_installation_task_id;
  END IF;

  -- 6. Insert Print Task Items with Contract Snapshot in Description
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO public.print_task_items (
      task_id,
      billboard_id,
      description,
      width,
      height,
      area,
      quantity,
      faces_count,
      unit_cost,
      printer_unit_cost,
      customer_unit_cost,
      total_cost,
      design_face_a,
      design_face_b,
      has_cutout,
      cutout_quantity,
      cutout_image_url,
      model_link,
      status
    ) VALUES (
      v_print_task_id,
      (v_item->>'billboardId')::INT,
      v_item->>'description',
      (v_item->>'width')::NUMERIC,
      (v_item->>'height')::NUMERIC,
      (v_item->>'area')::NUMERIC,
      COALESCE((v_item->>'quantity')::INT, 1),
      COALESCE((v_item->>'facesCount')::INT, 1),
      (v_item->>'printerUnitCost')::NUMERIC,
      (v_item->>'printerUnitCost')::NUMERIC,
      (v_item->>'customerUnitCost')::NUMERIC,
      (v_item->>'printerTotalCost')::NUMERIC,
      v_item->>'designFaceA',
      v_item->>'designFaceB',
      COALESCE((v_item->>'hasCutout')::BOOLEAN, false),
      CASE WHEN COALESCE((v_item->>'hasCutout')::BOOLEAN, false) THEN 1 ELSE 0 END,
      v_item->>'cutoutImageUrl',
      v_item->>'cutoutImageUrl',
      'pending'
    );
  END LOOP;

  -- 7. Cutouts handling if present
  IF jsonb_array_length(COALESCE(p_payload->'cutoutItems', '[]'::JSONB)) > 0 THEN
    v_cutout_printer_total := COALESCE((p_payload->'totals'->>'printerCutoutTotal')::NUMERIC, 0);
    v_cutout_customer_total := COALESCE((p_payload->'totals'->>'customerCutoutTotal')::NUMERIC, 0);
    v_cutout_total_qty := jsonb_array_length(p_payload->'cutoutItems');

    IF v_cutout_printer_total > 0 THEN
      INSERT INTO public.printed_invoices (
        contract_number,
        invoice_number,
        customer_id,
        customer_name,
        printer_id,
        printer_name,
        invoice_date,
        total_amount,
        printer_cost,
        invoice_type,
        notes
      ) VALUES (
        v_contract_id,
        'CT-' || EXTRACT(EPOCH FROM NOW())::BIGINT,
        v_customer_id,
        v_customer_name,
        COALESCE((p_payload->>'cutoutPrinterId')::UUID, v_printer_id),
        COALESCE(p_payload->>'cutoutPrinterName', v_printer_name),
        CURRENT_DATE,
        v_cutout_customer_total,
        v_cutout_printer_total,
        'cutout',
        'مهمة قص من التركيب ' || COALESCE(v_installation_task_id::TEXT, '')
      ) RETURNING id INTO v_cutout_invoice_id;

      INSERT INTO public.cutout_tasks (
        invoice_id,
        contract_id,
        customer_id,
        customer_name,
        customer_total_amount,
        printer_id,
        status,
        total_cost,
        total_quantity,
        unit_cost,
        priority,
        installation_task_id,
        is_composite,
        notes
      ) VALUES (
        v_cutout_invoice_id,
        v_contract_id,
        v_customer_id,
        v_customer_name,
        v_cutout_customer_total,
        COALESCE((p_payload->>'cutoutPrinterId')::UUID, v_printer_id),
        'pending',
        v_cutout_printer_total,
        v_cutout_total_qty,
        CASE WHEN v_cutout_total_qty > 0 THEN v_cutout_printer_total / v_cutout_total_qty ELSE 0 END,
        'normal',
        v_installation_task_id,
        true,
        'مهمة قص من التركيب'
      ) RETURNING id INTO v_cutout_task_id;

      IF v_installation_task_id IS NOT NULL THEN
        UPDATE public.installation_tasks
        SET cutout_task_id = v_cutout_task_id
        WHERE id = v_installation_task_id;
      END IF;

      FOR v_cutout_item IN SELECT * FROM jsonb_array_elements(p_payload->'cutoutItems')
      LOOP
        INSERT INTO public.cutout_task_items (
          task_id,
          billboard_id,
          description,
          quantity,
          faces_count,
          unit_cost,
          total_cost,
          cutout_image_url,
          status
        ) VALUES (
          v_cutout_task_id,
          (v_cutout_item->>'billboardId')::INT,
          v_cutout_item->>'description',
          COALESCE((v_cutout_item->>'quantity')::INT, 1),
          COALESCE((v_cutout_item->>'facesCount')::INT, 1),
          (v_cutout_item->>'unitCost')::NUMERIC,
          (v_cutout_item->>'totalCost')::NUMERIC,
          v_cutout_item->>'cutoutImageUrl',
          'pending'
        );
      END LOOP;
    END IF;
  END IF;

  -- 8. Composite Task Linking / Updating
  IF v_installation_task_id IS NOT NULL THEN
    SELECT id, combined_invoice_id, discount_amount
    INTO v_composite_id, v_combined_inv_id, v_discount_amount
    FROM public.composite_tasks
    WHERE installation_task_id = v_installation_task_id
    LIMIT 1;

    IF v_composite_id IS NOT NULL THEN
      UPDATE public.composite_tasks
      SET
        contract_id = v_contract_id,
        customer_id = v_customer_id,
        customer_name = v_customer_name,
        task_type = CASE WHEN v_is_reinstallation THEN 'reinstallation' ELSE 'new_installation' END,
        print_task_id = v_print_task_id,
        cutout_task_id = v_cutout_task_id,
        customer_installation_cost = v_customer_install_cost,
        customer_print_cost = v_customer_total,
        customer_cutout_cost = COALESCE(v_cutout_customer_total, 0),
        company_installation_cost = v_company_install_cost,
        company_print_cost = v_printer_total,
        company_cutout_cost = COALESCE(v_cutout_printer_total, 0),
        customer_total = v_customer_install_cost + v_customer_total + COALESCE(v_cutout_customer_total, 0),
        company_total = v_company_install_cost + v_printer_total + COALESCE(v_cutout_printer_total, 0),
        net_profit = (v_customer_install_cost + v_customer_total + COALESCE(v_cutout_customer_total, 0)) - (v_company_install_cost + v_printer_total + COALESCE(v_cutout_printer_total, 0)),
        status = 'pending'
      WHERE id = v_composite_id;

      IF v_combined_inv_id IS NOT NULL THEN
        -- Cleanup individual new invoices when combined invoice already exists
        DELETE FROM public.printed_invoices WHERE id = v_print_invoice_id;
        UPDATE public.print_tasks SET invoice_id = NULL WHERE id = v_print_task_id;
        IF v_cutout_invoice_id IS NOT NULL THEN
          DELETE FROM public.printed_invoices WHERE id = v_cutout_invoice_id;
          UPDATE public.cutout_tasks SET invoice_id = NULL WHERE id = v_cutout_task_id;
        END IF;

        v_new_customer_total := v_customer_install_cost + v_customer_total + COALESCE(v_cutout_customer_total, 0) - COALESCE(v_discount_amount, 0);

        UPDATE public.printed_invoices
        SET
          print_cost = v_printer_total + COALESCE(v_cutout_printer_total, 0),
          total_amount = v_new_customer_total,
          updated_at = NOW()
        WHERE id = v_combined_inv_id;

        UPDATE public.customer_payments
        SET amount = -v_new_customer_total
        WHERE printed_invoice_id = v_combined_inv_id AND entry_type = 'invoice';
      END IF;
    ELSE
      INSERT INTO public.composite_tasks (
        contract_id,
        customer_id,
        customer_name,
        task_type,
        installation_task_id,
        print_task_id,
        cutout_task_id,
        customer_installation_cost,
        customer_print_cost,
        customer_cutout_cost,
        company_installation_cost,
        company_print_cost,
        company_cutout_cost,
        customer_total,
        company_total,
        net_profit,
        status
      ) VALUES (
        v_contract_id,
        v_customer_id,
        v_customer_name,
        CASE WHEN v_is_reinstallation THEN 'reinstallation' ELSE 'new_installation' END,
        v_installation_task_id,
        v_print_task_id,
        v_cutout_task_id,
        v_customer_install_cost,
        v_customer_total,
        COALESCE(v_cutout_customer_total, 0),
        v_company_install_cost,
        v_printer_total,
        COALESCE(v_cutout_printer_total, 0),
        v_customer_install_cost + v_customer_total + COALESCE(v_cutout_customer_total, 0),
        v_company_install_cost + v_printer_total + COALESCE(v_cutout_printer_total, 0),
        (v_customer_install_cost + v_customer_total + COALESCE(v_cutout_customer_total, 0)) - (v_company_install_cost + v_printer_total + COALESCE(v_cutout_printer_total, 0)),
        'pending'
      ) RETURNING id INTO v_composite_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'printTaskId', v_print_task_id,
    'printInvoiceId', v_print_invoice_id,
    'cutoutTaskId', v_cutout_task_id,
    'cutoutInvoiceId', v_cutout_invoice_id,
    'compositeTaskId', v_composite_id
  );
END;
$$;
