-- ✅ Migration: Link Friend Companies to Customers

-- 1. إضافة عمود linked_friend_company_id في جدول customers (للربط العكسي)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS linked_friend_company_id UUID REFERENCES friend_companies(id) ON DELETE SET NULL;

-- 2. إنشاء فهرس للأداء
CREATE INDEX IF NOT EXISTS idx_customers_linked_friend_company 
ON customers(linked_friend_company_id);

COMMENT ON COLUMN customers.linked_friend_company_id IS 'ربط الزبون بشركة صديقة (إذا كان الزبون يملك شركة صديقة)';

-- 3. تحديث view friend_company_financials ليأخذ في الاعتبار customer_id
DROP VIEW IF EXISTS friend_company_financials;

CREATE VIEW friend_company_financials AS
SELECT 
  fc.id as company_id,
  fc.name as company_name,
  COUNT(DISTINCT fbr.billboard_id) as total_billboards,
  COUNT(DISTINCT fbr.contract_number) as total_contracts,
  COALESCE(SUM(fbr.friend_rental_cost), 0) as total_paid_to_friend,
  COALESCE(SUM(fbr.customer_rental_price), 0) as total_revenue_from_customers,
  COALESCE(SUM(fbr.profit), 0) as total_profit,
  MIN(fbr.start_date) as first_rental_date,
  MAX(fbr.end_date) as last_rental_date
FROM friend_companies fc
LEFT JOIN friend_billboard_rentals fbr ON fc.id = fbr.friend_company_id
GROUP BY fc.id, fc.name;