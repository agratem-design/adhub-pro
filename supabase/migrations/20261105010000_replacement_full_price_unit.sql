-- 27: سعر اللوحة البديلة = السعر الكامل للوحة المستبدلة (وحدة واحدة)
-- المشكلة: بعد التبديل الفوري للوحة مركبة كان سعر البديلة = الإيجار المتبقي فقط
-- (allocated_amount = refund)، بينما الواجهة لا تحسب الجزء المستهلك للموقوفة المستبدلة
-- (consumedSum يستثني المستبدلة لأنه يُفترض داخل سعر البديلة). فيظهر فرق سالب
-- بقيمة الجزء المستهلك «عن المحفوظ» رغم أن إجمالي العقد في قاعدة البيانات لم يتغير.
-- الحل (نفس تصحيح العقد #1320 في الملف 26): سعر البديلة = المتبقي + المستهلك،
-- و allocated_amount بنفس القيمة. إجمالي العقد (Total) لا يتغير.

-- 1) الغلاف: يطبّق السعر الكامل على التبديلات الجديدة (مرة واحدة لكل بديلة)
CREATE OR REPLACE FUNCTION public.replace_contract_billboard_lifecycle(
  p_contract_number bigint,
  p_original_billboard_id bigint,
  p_replacement_billboard_id bigint,
  p_user_id text DEFAULT NULL,
  p_swap_event_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  result jsonb;
  reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  pb public.paused_billboards%ROWTYPE;
  carry numeric;
BEGIN
  result := public.replace_contract_billboard_lifecycle_v1(
    p_contract_number, p_original_billboard_id, p_replacement_billboard_id, p_user_id, p_swap_event_id
  );

  IF result ? 'pause_id' AND (result->>'pause_id') IS NOT NULL THEN
    SELECT * INTO pb FROM public.paused_billboards WHERE id = (result->>'pause_id')::uuid;
    carry := round(COALESCE(pb.full_price, 0) - COALESCE(pb.refund_amount, 0), 2);

    -- remainingRental يميّز الصف المعالَج، فإعادة الطلب نفسه لا تضيف المستهلك مرتين
    IF FOUND AND EXISTS (
      SELECT 1
        FROM public."Contract" ct,
             jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
       WHERE ct."Contract_Number" = p_contract_number
         AND p->>'_replacement_of' = pb.id::text
         AND p->>'remainingRental' IS NULL
    ) THEN
      UPDATE public."Contract" ct
         SET billboard_prices = (
           SELECT COALESCE(jsonb_agg(
             CASE WHEN p->>'_replacement_of' = pb.id::text AND p->>'remainingRental' IS NULL
               THEN p || jsonb_build_object(
                 'remainingRental', COALESCE((p->>'finalPrice')::numeric, 0),
                 'consumedCarryover', carry,
                 'carriedFromBillboardId', pb.billboard_id,
                 'finalPrice', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'priceAfterDiscount', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'totalBillboardPrice', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'contractPrice', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'baseRental', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'basePriceBeforeDiscount', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'priceBeforeDiscount', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'pricingNote', 'السعر الكامل للوحة المستبدلة؛ الجزء المستهلك تكلفة إضافية')
               ELSE p END
           ), '[]'::jsonb)::text
           FROM jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
         )
       WHERE ct."Contract_Number" = p_contract_number;

      UPDATE public.paused_billboard_replacements
         SET allocated_amount = round(COALESCE(allocated_amount, 0) + carry, 2)
       WHERE paused_billboard_id = pb.id;
    END IF;
  END IF;

  IF reason IS NULL THEN
    RETURN result;
  END IF;

  UPDATE public.activity_log
     SET details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('reason', reason)
   WHERE action = 'installed_board_swap'
     AND contract_number = p_contract_number
     AND details->>'requestId' = p_swap_event_id;

  UPDATE public.installation_tasks t
     SET task_name = 'ملحق عقد #' || p_contract_number || COALESCE(' — تبديل لوحة: ' || reason, ''),
         task_type = 'reinstallation',
         reinstallation_number = (
           SELECT COALESCE(MAX(x.reinstallation_number), 0) + 1
             FROM public.installation_tasks x
            WHERE x.contract_id = p_contract_number
         )
    FROM public.installation_task_items i
   WHERE i.task_id = t.id
     AND t.contract_id = p_contract_number
     AND i.billboard_id = p_replacement_billboard_id
     AND COALESCE(i.status, '') <> 'completed';

  IF result ? 'pause_id' AND (result->>'pause_id') IS NOT NULL THEN
    UPDATE public.paused_billboards
       SET notes = reason
     WHERE id = (result->>'pause_id')::uuid;
  END IF;

  RETURN result || jsonb_build_object('reason', reason);
END $$;

REVOKE ALL ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text,text) TO authenticated;

-- 2) تصحيح التبديلات السابقة (مثل العقد #1303): صفوف فيها consumedCarryover بلا remainingRental
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT ct."Contract_Number" AS cn,
           (p->>'_replacement_of')::uuid AS pause_id,
           COALESCE((p->>'finalPrice')::numeric, 0) AS remaining,
           (p->>'consumedCarryover')::numeric AS carry
      FROM public."Contract" ct,
           jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
     WHERE p ? 'consumedCarryover'
       AND p->>'remainingRental' IS NULL
       AND p->>'_replacement_of' IS NOT NULL
  LOOP
    UPDATE public."Contract" ct
       SET billboard_prices = (
         SELECT COALESCE(jsonb_agg(
           CASE WHEN p->>'_replacement_of' = r.pause_id::text AND p->>'remainingRental' IS NULL
             THEN p || jsonb_build_object(
               'remainingRental', r.remaining,
               'finalPrice', round(r.remaining + r.carry, 2),
               'priceAfterDiscount', round(r.remaining + r.carry, 2),
               'totalBillboardPrice', round(r.remaining + r.carry, 2),
               'contractPrice', round(r.remaining + r.carry, 2),
               'baseRental', round(r.remaining + r.carry, 2),
               'basePriceBeforeDiscount', round(r.remaining + r.carry, 2),
               'priceBeforeDiscount', round(r.remaining + r.carry, 2),
               'pricingNote', 'السعر الكامل للوحة المستبدلة؛ الجزء المستهلك تكلفة إضافية')
             ELSE p END
         ), '[]'::jsonb)::text
         FROM jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
       )
     WHERE ct."Contract_Number" = r.cn;

    UPDATE public.paused_billboard_replacements
       SET allocated_amount = round(r.remaining + r.carry, 2)
     WHERE paused_billboard_id = r.pause_id
       AND round(COALESCE(allocated_amount, 0), 2) = round(r.remaining, 2);
  END LOOP;
END $$;
