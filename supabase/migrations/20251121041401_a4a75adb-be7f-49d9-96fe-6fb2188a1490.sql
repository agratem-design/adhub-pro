-- Partnership Contract Integration System
-- This migration adds support for partnership billboards in contracts with dynamic capital tracking

-- Add columns to contracts for partnership management
ALTER TABLE "Contract" 
  ADD COLUMN IF NOT EXISTS partnership_operating_fee_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partnership_data jsonb;

COMMENT ON COLUMN "Contract".partnership_operating_fee_rate IS 'Custom operating fee rate for partnership billboards';
COMMENT ON COLUMN "Contract".partnership_data IS 'Stores partner share details per billboard in contract';

-- Add tracking columns to shared_billboards
ALTER TABLE shared_billboards
  ADD COLUMN IF NOT EXISTS reserved_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_amount numeric DEFAULT 0;

COMMENT ON COLUMN shared_billboards.reserved_amount IS 'Amount temporarily reserved when billboard added to contract';
COMMENT ON COLUMN shared_billboards.confirmed_amount IS 'Amount confirmed after installation task completion';

-- Function to reserve capital when billboard added to contract
CREATE OR REPLACE FUNCTION reserve_partnership_capital()
RETURNS TRIGGER AS $$
DECLARE
  billboard_ids_array bigint[];
  billboard_id bigint;
  contract_start_date date;
  contract_end_date date;
  duration_months numeric;
  monthly_rent numeric;
  billboard_price numeric;
  total_deduction numeric;
BEGIN
  -- Only process if contract has billboard_ids
  IF NEW.billboard_ids IS NULL OR TRIM(NEW.billboard_ids) = '' THEN
    RETURN NEW;
  END IF;

  -- Get contract dates
  contract_start_date := COALESCE(NEW."Contract Date", CURRENT_DATE);
  contract_end_date := COALESCE(NEW."End Date", contract_start_date + INTERVAL '30 days');
  
  -- Calculate duration in months
  duration_months := EXTRACT(EPOCH FROM (contract_end_date - contract_start_date)) / (30.44 * 86400);
  IF duration_months < 1 THEN
    duration_months := 1;
  END IF;

  -- Parse billboard IDs
  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint))
  INTO billboard_ids_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id
  WHERE TRIM(id) ~ '^\d+$';

  -- Process each billboard
  FOR billboard_id IN SELECT unnest(billboard_ids_array)
  LOOP
    -- Check if this billboard has partnerships
    IF EXISTS (
      SELECT 1 FROM shared_billboards sb
      WHERE sb.billboard_id = billboard_id AND sb.status = 'active'
    ) THEN
      -- Get billboard price
      SELECT COALESCE(b."Price", 0) INTO billboard_price
      FROM billboards b WHERE b."ID" = billboard_id;

      -- Calculate total deduction (monthly rent * duration)
      total_deduction := (billboard_price * duration_months);

      -- Reserve capital for each partner
      UPDATE shared_billboards
      SET reserved_amount = COALESCE(reserved_amount, 0) + (total_deduction * (partner_pre_pct / 100.0))
      WHERE billboard_id = billboard_id 
        AND status = 'active';

      -- Update billboard capital_remaining
      UPDATE billboards
      SET capital_remaining = GREATEST(0, capital - COALESCE(
        (SELECT SUM(confirmed_amount + reserved_amount) FROM shared_billboards WHERE billboard_id = billboard_id),
        0
      ))
      WHERE "ID" = billboard_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to confirm capital deduction after installation
CREATE OR REPLACE FUNCTION confirm_partnership_capital()
RETURNS TRIGGER AS $$
DECLARE
  v_contract_id bigint;
  v_billboard_id bigint;
BEGIN
  -- Only process when task item is completed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Get contract ID from installation task
    SELECT contract_id INTO v_contract_id
    FROM installation_tasks
    WHERE id = NEW.task_id;

    v_billboard_id := NEW.billboard_id;

    -- Check if this billboard has partnerships
    IF EXISTS (
      SELECT 1 FROM shared_billboards sb
      WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active'
    ) THEN
      -- Confirm the reserved amount
      UPDATE shared_billboards
      SET 
        confirmed_amount = COALESCE(confirmed_amount, 0) + COALESCE(reserved_amount, 0),
        reserved_amount = 0,
        capital_remaining = GREATEST(0, capital_remaining - COALESCE(reserved_amount, 0))
      WHERE billboard_id = v_billboard_id AND status = 'active';

      -- Update billboard capital_remaining
      UPDATE billboards
      SET capital_remaining = COALESCE(
        (SELECT SUM(capital_remaining) FROM shared_billboards WHERE billboard_id = v_billboard_id),
        0
      )
      WHERE "ID" = v_billboard_id;

      -- Record transaction for each partner
      INSERT INTO shared_transactions (
        billboard_id,
        contract_id,
        partner_company_id,
        beneficiary,
        amount,
        type,
        transaction_date,
        notes
      )
      SELECT 
        v_billboard_id,
        v_contract_id,
        sb.partner_company_id,
        COALESCE(p.name, 'الفارس'),
        sb.reserved_amount * (sb.partner_pre_pct / 100.0),
        'capital_deduction',
        CURRENT_DATE,
        'خصم رأس المال عند إكمال التركيب للعقد ' || v_contract_id
      FROM shared_billboards sb
      LEFT JOIN partners p ON p.id = sb.partner_company_id
      WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to release reserved capital if contract deleted
CREATE OR REPLACE FUNCTION release_partnership_capital()
RETURNS TRIGGER AS $$
DECLARE
  billboard_ids_array bigint[];
  billboard_id bigint;
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
  FOR billboard_id IN SELECT unnest(billboard_ids_array)
  LOOP
    -- Release reserved capital for this contract
    UPDATE shared_billboards
    SET reserved_amount = GREATEST(0, reserved_amount - COALESCE(
      (SELECT reserved_amount FROM shared_billboards 
       WHERE billboard_id = billboard_id AND status = 'active' LIMIT 1),
      0
    ))
    WHERE billboard_id = billboard_id AND status = 'active';

    -- Update billboard capital_remaining
    UPDATE billboards
    SET capital_remaining = COALESCE(
      (SELECT SUM(capital_remaining + reserved_amount) FROM shared_billboards WHERE billboard_id = billboard_id),
      capital
    )
    WHERE "ID" = billboard_id;
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_reserve_partnership_capital ON "Contract";
CREATE TRIGGER trg_reserve_partnership_capital
  AFTER INSERT OR UPDATE OF billboard_ids, "Contract Date", "End Date"
  ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION reserve_partnership_capital();

DROP TRIGGER IF EXISTS trg_confirm_partnership_capital ON installation_task_items;
CREATE TRIGGER trg_confirm_partnership_capital
  AFTER UPDATE OF status
  ON installation_task_items
  FOR EACH ROW
  EXECUTE FUNCTION confirm_partnership_capital();

DROP TRIGGER IF EXISTS trg_release_partnership_capital ON "Contract";
CREATE TRIGGER trg_release_partnership_capital
  BEFORE DELETE
  ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION release_partnership_capital();

-- View to show partnership status per billboard
CREATE OR REPLACE VIEW billboard_partnership_status AS
SELECT 
  b."ID" as billboard_id,
  b."Billboard_Name" as billboard_name,
  b.is_partnership,
  b.capital,
  b.capital_remaining,
  COUNT(sb.id) as partners_count,
  COALESCE(SUM(sb.capital_contribution), 0) as total_capital_contributions,
  COALESCE(SUM(sb.capital_remaining), 0) as total_capital_remaining,
  COALESCE(SUM(sb.reserved_amount), 0) as total_reserved,
  COALESCE(SUM(sb.confirmed_amount), 0) as total_confirmed,
  ARRAY_AGG(
    jsonb_build_object(
      'partner_id', sb.partner_company_id,
      'partner_name', p.name,
      'capital_contribution', sb.capital_contribution,
      'capital_remaining', sb.capital_remaining,
      'reserved_amount', sb.reserved_amount,
      'confirmed_amount', sb.confirmed_amount,
      'pre_pct', sb.partner_pre_pct,
      'post_pct', sb.partner_post_pct
    )
  ) FILTER (WHERE sb.id IS NOT NULL) as partners
FROM billboards b
LEFT JOIN shared_billboards sb ON sb.billboard_id = b."ID" AND sb.status = 'active'
LEFT JOIN partners p ON p.id = sb.partner_company_id
WHERE b.is_partnership = true
GROUP BY b."ID", b."Billboard_Name", b.is_partnership, b.capital, b.capital_remaining;