UPDATE paused_billboards pb
SET original_start_date = COALESCE(pb.original_start_date, c."Contract Date"::date),
    original_end_date   = COALESCE(pb.original_end_date, c."End Date"::date)
FROM "Contract" c
WHERE pb.contract_number = c."Contract_Number"
  AND (pb.original_start_date IS NULL OR pb.original_end_date IS NULL);