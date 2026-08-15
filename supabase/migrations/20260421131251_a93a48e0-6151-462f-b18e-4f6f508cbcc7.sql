-- Clean stale friend_rental_data for ALL contracts: keep only entries where billboard still has friend_company_id
UPDATE "Contract" c
SET friend_rental_data = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(
    CASE 
      WHEN jsonb_typeof(c.friend_rental_data::jsonb) = 'array' THEN c.friend_rental_data::jsonb
      ELSE '[]'::jsonb
    END
  ) elem
  WHERE EXISTS (
    SELECT 1 FROM billboards b
    WHERE b."ID"::text = elem->>'billboardId'
      AND b.friend_company_id IS NOT NULL
  )
)
WHERE friend_rental_data IS NOT NULL
  AND friend_rental_data::text NOT IN ('', 'null', '[]');

-- Set to NULL where the result is an empty array
UPDATE "Contract"
SET friend_rental_data = NULL
WHERE friend_rental_data IS NOT NULL
  AND (friend_rental_data::jsonb = '[]'::jsonb OR friend_rental_data::text = 'null');