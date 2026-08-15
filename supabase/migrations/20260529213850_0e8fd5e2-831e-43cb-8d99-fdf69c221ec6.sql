UPDATE billboards b
SET is_visible_in_available = NULL
WHERE b.is_visible_in_available = true
  AND b."Contract_Number" IS NOT NULL
  AND b."Rent_End_Date"::date >= CURRENT_DATE
  AND EXISTS (
    SELECT 1 FROM billboards b2
    WHERE b2."Contract_Number" = b."Contract_Number"
      AND COALESCE(b2.is_visible_in_available, false) = false
  );