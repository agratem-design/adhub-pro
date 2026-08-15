-- إنشاء view لحسابات المطابع (printer_accounts)
CREATE OR REPLACE VIEW printer_accounts AS
SELECT 
  p.id as printer_id,
  p.name as printer_name,
  c.id as customer_id,
  c.name as customer_name,
  
  -- إجمالي تكاليف الطباعة المستحقة للمطبعة
  COALESCE(SUM(pt.total_cost), 0) as total_print_costs,
  
  -- إجمالي تكاليف القص المستحقة للمطبعة
  COALESCE(SUM(ctt.total_cost), 0) as total_cutout_costs,
  
  -- إجمالي المستحقات للمطبعة
  COALESCE(SUM(pt.total_cost), 0) + COALESCE(SUM(ctt.total_cost), 0) as total_supplier_debt,
  
  -- إجمالي المدفوعات للمطبعة (من customer_payments)
  COALESCE(
    (SELECT SUM(amount) 
     FROM customer_payments cp 
     WHERE cp.customer_id = c.id 
     AND cp.entry_type = 'payment' 
     AND cp.amount > 0),
    0
  ) as total_payments_to_printer,
  
  -- إجمالي ديون المطبعة كزبون (إذا كانت تستأجر لوحات)
  COALESCE(
    (SELECT SUM(con."Total") 
     FROM "Contract" con 
     WHERE con.customer_id = c.id),
    0
  ) as total_customer_debt,
  
  -- إجمالي مدفوعات المطبعة كزبون
  COALESCE(
    (SELECT SUM(ABS(amount)) 
     FROM customer_payments cp 
     WHERE cp.customer_id = c.id 
     AND cp.entry_type IN ('receipt', 'payment')
     AND cp.amount < 0),
    0
  ) as total_customer_payments,
  
  -- الرصيد النهائي (ما علينا ندفع للمطبعة - ما على المطبعة تدفع لنا)
  (COALESCE(SUM(pt.total_cost), 0) + COALESCE(SUM(ctt.total_cost), 0) - 
   COALESCE(
     (SELECT SUM(amount) 
      FROM customer_payments cp 
      WHERE cp.customer_id = c.id 
      AND cp.entry_type = 'payment' 
      AND cp.amount > 0),
     0
   )) - 
  (COALESCE(
    (SELECT SUM(con."Total") 
     FROM "Contract" con 
     WHERE con.customer_id = c.id),
    0
  ) - 
   COALESCE(
     (SELECT SUM(ABS(amount)) 
      FROM customer_payments cp 
      WHERE cp.customer_id = c.id 
      AND cp.entry_type IN ('receipt', 'payment')
      AND cp.amount < 0),
     0
   )) as final_balance,
  
  -- عدد مهام الطباعة
  COUNT(DISTINCT pt.id) as print_tasks_count,
  
  -- عدد مهام القص
  COUNT(DISTINCT ctt.id) as cutout_tasks_count

FROM printers p
LEFT JOIN customers c ON c.printer_id = p.id
LEFT JOIN print_tasks pt ON pt.printer_id = p.id
LEFT JOIN cutout_tasks ctt ON ctt.printer_id = p.id

GROUP BY p.id, p.name, c.id, c.name;

-- إضافة تعليق توضيحي
COMMENT ON VIEW printer_accounts IS 'عرض حسابات المطابع يوضح المستحقات والمدفوعات والرصيد النهائي';