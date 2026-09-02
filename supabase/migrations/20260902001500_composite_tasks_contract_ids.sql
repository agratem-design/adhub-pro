-- إضافة عمود contract_ids لجدول composite_tasks لدعم المهام المجمعة متعددة العقود
ALTER TABLE IF EXISTS public.composite_tasks 
ADD COLUMN IF NOT EXISTS contract_ids integer[];

-- فهرس لتسريع الاستعلامات على مصفوفة العقود
CREATE INDEX IF NOT EXISTS idx_composite_tasks_contract_ids ON public.composite_tasks USING GIN(contract_ids);

-- مزامنة المهام المجمعة الموجودة من مهام التركيب المرتبطة بها
UPDATE public.composite_tasks ct
SET contract_ids = it.contract_ids
FROM public.installation_tasks it
WHERE ct.installation_task_id = it.id
  AND it.contract_ids IS NOT NULL
  AND it.contract_ids != '{}'
  AND (ct.contract_ids IS NULL OR ct.contract_ids = '{}');

-- المهام التي ليس لها مصفوفة متعددة، تعيين contract_id الفردي
UPDATE public.composite_tasks
SET contract_ids = ARRAY[contract_id]
WHERE (contract_ids IS NULL OR contract_ids = '{}')
  AND contract_id IS NOT NULL;

-- تصحيح هوية مهام إعادة التركيب التاريخية.
-- اللوحة قد تكون موجودة في عقد أحدث اليوم؛ لذلك نأخذ أحدث عقد للزبون
-- كان قد بدأ فعلاً وقت إنشاء المهمة، ولا نعتمد على Contract_Number الحالي للوحة.
WITH historical_candidates AS (
  SELECT
    it.id AS task_id,
    iti.billboard_id,
    c."Contract_Number"::integer AS candidate_contract_id,
    ROW_NUMBER() OVER (
      PARTITION BY it.id, iti.billboard_id
      ORDER BY
        CASE
          WHEN NULLIF(BTRIM(COALESCE(c."End Date"::text, '')), '') IS NULL THEN 1
          WHEN LEFT(c."End Date"::text, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            AND LEFT(c."End Date"::text, 10)::date >= it.created_at::date THEN 1
          ELSE 0
        END DESC,
        CASE
          WHEN LEFT(c."Contract Date"::text, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            THEN LEFT(c."Contract Date"::text, 10)::date
          ELSE NULL
        END DESC NULLS LAST,
        c."Contract_Number" DESC
    ) AS candidate_rank
  FROM public.installation_tasks it
  JOIN public.installation_task_items iti ON iti.task_id = it.id
  JOIN public."Contract" base_contract ON base_contract."Contract_Number" = it.contract_id
  JOIN public."Contract" c
    ON (
      (base_contract.customer_id IS NOT NULL AND c.customer_id = base_contract.customer_id)
      OR (
        base_contract.customer_id IS NULL
        AND LOWER(REGEXP_REPLACE(BTRIM(COALESCE(c."Customer Name", '')), '\s+', ' ', 'g'))
          = LOWER(REGEXP_REPLACE(BTRIM(COALESCE(base_contract."Customer Name", '')), '\s+', ' ', 'g'))
      )
    )
   AND iti.billboard_id::text = ANY(
     STRING_TO_ARRAY(REGEXP_REPLACE(COALESCE(c.billboard_ids::text, ''), '\s+', '', 'g'), ',')
   )
  WHERE it.task_type = 'reinstallation'
    AND COALESCE(ARRAY_LENGTH(it.contract_ids, 1), 0) <= 1
    AND (
      c."Contract_Number" = it.contract_id
      OR (
        LEFT(c."Contract Date"::text, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND LEFT(c."Contract Date"::text, 10)::date <= it.created_at::date
      )
    )
), historical_identity AS (
  SELECT task_id, candidate_contract_id AS contract_id
  FROM historical_candidates
  WHERE candidate_rank = 1
  UNION
  SELECT id AS task_id, contract_id::integer
  FROM public.installation_tasks
  WHERE task_type = 'reinstallation' AND contract_id IS NOT NULL
), historical_contract_arrays AS (
  SELECT task_id, ARRAY_AGG(DISTINCT contract_id ORDER BY contract_id) AS contract_ids
  FROM historical_identity
  GROUP BY task_id
)
UPDATE public.installation_tasks it
SET contract_ids = h.contract_ids
FROM historical_contract_arrays h
WHERE it.id = h.task_id
  AND COALESCE(ARRAY_LENGTH(h.contract_ids, 1), 0) > 0;

-- إبقاء المهمة المجمعة على نفس اللقطة التاريخية المحفوظة في مهمة التركيب.
UPDATE public.composite_tasks ct
SET contract_ids = it.contract_ids
FROM public.installation_tasks it
WHERE ct.installation_task_id = it.id
  AND it.contract_ids IS NOT NULL
  AND COALESCE(ARRAY_LENGTH(it.contract_ids, 1), 0) > 0;
