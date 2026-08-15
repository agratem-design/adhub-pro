
-- إضافة حقول فصل تكاليف التركيب الأصلي وإعادة التركيب
ALTER TABLE installation_task_items 
  ADD COLUMN IF NOT EXISTS customer_original_install_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_reinstall_cost numeric DEFAULT 0;

-- تحديث البيانات الحالية: اللوحات المعاد تركيبها
-- التكلفة الأصلية = السعر الأساسي من جدول الأحجام
-- تكلفة إعادة التركيب = الإجمالي - الأصلي
UPDATE installation_task_items iti
SET 
  customer_original_install_cost = COALESCE(
    (SELECT s.installation_price FROM sizes s 
     JOIN billboards b ON b."Size" = s.name 
     WHERE b."ID" = iti.billboard_id LIMIT 1), 0),
  customer_reinstall_cost = COALESCE(iti.customer_installation_cost, 0) - COALESCE(
    (SELECT s.installation_price FROM sizes s 
     JOIN billboards b ON b."Size" = s.name 
     WHERE b."ID" = iti.billboard_id LIMIT 1), 0)
WHERE iti.reinstall_count > 0 AND iti.reinstall_count IS NOT NULL;

-- اللوحات العادية (بدون إعادة تركيب): التكلفة الأصلية = تكلفة الزبون
UPDATE installation_task_items iti
SET 
  customer_original_install_cost = COALESCE(iti.customer_installation_cost, 0),
  customer_reinstall_cost = 0
WHERE (iti.reinstall_count IS NULL OR iti.reinstall_count = 0);
