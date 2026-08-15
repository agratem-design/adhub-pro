-- إعادة احتساب رسوم التشغيل المخزّنة لجميع العقود لتتطابق مع منطق صفحة تعديل العقد
UPDATE "Contract" c
SET fee = ROUND(
  (
    COALESCE(c."Total Rent", 0) * COALESCE(c.operating_fee_rate, 3) / 100
    + CASE WHEN c.include_operating_in_installation = true AND COALESCE(c.installation_enabled, true) = true
           THEN COALESCE(c.installation_cost, 0) * COALESCE(c.operating_fee_rate_installation, c.operating_fee_rate, 3) / 100
           ELSE 0 END
    + CASE WHEN c.include_operating_in_print = true
           THEN COALESCE(c.print_cost, 0) * COALESCE(c.operating_fee_rate_print, c.operating_fee_rate, 3) / 100
           ELSE 0 END
    + COALESCE((
        SELECT SUM( (item->>'operating_fee_amount')::numeric )
        FROM jsonb_array_elements(
          CASE
            WHEN c.partnership_operating_data IS NULL THEN '[]'::jsonb
            WHEN jsonb_typeof(c.partnership_operating_data) = 'array' THEN c.partnership_operating_data
            ELSE '[]'::jsonb
          END
        ) AS item
      ), 0)
  )::numeric,
  2
)
WHERE COALESCE(c."Total Rent", 0) > 0;