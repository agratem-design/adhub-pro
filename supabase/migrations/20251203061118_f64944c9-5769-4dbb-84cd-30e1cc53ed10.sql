-- إصلاح مشكلة ambiguous billboard_id في دالة release_partnership_capital
CREATE OR REPLACE FUNCTION release_partnership_capital()
RETURNS TRIGGER AS $$
DECLARE
  billboard_ids_array bigint[];
  v_billboard_id bigint;  -- تغيير اسم المتغير لتجنب التعارض
BEGIN
  -- Only process if contract had billboard_ids
  IF OLD.billboard_ids IS NULL OR TRIM(OLD.billboard_ids) = '' THEN
    RETURN OLD;
  END IF;

  -- Parse billboard IDs
  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint))
  INTO billboard_ids_array
  FROM unnest(string_to_array(OLD.billboard_ids, ',')) AS id
  WHERE TRIM(id) ~ '^\d+$';

  -- Process each billboard
  FOR v_billboard_id IN SELECT unnest(billboard_ids_array)
  LOOP
    -- Release reserved capital for this contract
    UPDATE shared_billboards sb
    SET reserved_amount = GREATEST(0, sb.reserved_amount - COALESCE(
      (SELECT sb2.reserved_amount FROM shared_billboards sb2
       WHERE sb2.billboard_id = v_billboard_id AND sb2.status = 'active' LIMIT 1),
      0
    ))
    WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active';

    -- Update billboard capital_remaining
    UPDATE billboards
    SET capital_remaining = COALESCE(
      (SELECT SUM(sb.capital_remaining + sb.reserved_amount) FROM shared_billboards sb WHERE sb.billboard_id = v_billboard_id),
      capital
    )
    WHERE "ID" = v_billboard_id;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;