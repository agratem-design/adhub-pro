
-- Create a view that aggregates contract data with customer info, payments, and expenses
CREATE OR REPLACE VIEW public.contract_summary AS
SELECT 
  c."Contract_Number",
  c.id,
  c."Customer Name",
  c.customer_id,
  c.customer_category,
  c."Contract Date",
  c."End Date",
  c."Ad Type",
  c."Total Rent",
  c."Total",
  c."Discount",
  c."Total Paid",
  c."Remaining",
  c.installation_cost,
  c.print_cost,
  c.print_cost_enabled,
  c.print_price_per_meter,
  c.fee,
  c.operating_fee_rate,
  c.payment_status,
  c."Renewal Status",
  c."Print Status",
  c.billboard_ids,
  c.billboards_count,
  c.billboard_prices,
  c.billboards_data,
  c.installments_data,
  c.design_data,
  c.contract_currency,
  c.exchange_rate,
  c.billboard_id,
  c.base_rent,
  c."Duration",
  c."Phone",
  c."Company",
  c.single_face_billboards,
  c.billboards_released,
  c.installation_enabled,
  c.include_installation_in_price,
  c.include_print_in_billboard_price,
  c.include_operating_in_installation,
  c.include_operating_in_print,
  c.level_discounts,
  c.partnership_data,
  c.partnership_operating_data,
  c.partnership_operating_fee_rate,
  c.friend_rental_data,
  c.friend_rental_includes_installation,
  c.friend_rental_operating_fee_enabled,
  c.friend_rental_operating_fee_rate,
  c.installment_count,
  c.installment_interval,
  c.installment_auto_calculate,
  c.installment_distribution_type,
  c.installment_first_at_signing,
  c.installment_first_payment_amount,
  c.installment_first_payment_type,
  c."Payment 1",
  c."Payment 2",
  c."Payment 3",
  -- Customer data
  cust.phone AS customer_phone,
  cust.company AS customer_company,
  -- Aggregated payments
  COALESCE(pay.total_paid_amount, 0) AS actual_paid,
  -- Aggregated expenses  
  COALESCE(exp.total_expenses, 0) AS total_expenses
FROM public."Contract" c
LEFT JOIN public.customers cust ON cust.id = c.customer_id
LEFT JOIN (
  SELECT contract_number, SUM(amount) AS total_paid_amount
  FROM public.customer_payments
  GROUP BY contract_number
) pay ON pay.contract_number = c."Contract_Number"
LEFT JOIN (
  SELECT contract_number, SUM(amount) AS total_expenses
  FROM public.contract_expenses
  GROUP BY contract_number
) exp ON exp.contract_number = c."Contract_Number";
