
-- 1. حذف الفاتورة اليتيمة (مهمة طباعة منفصلة غير مرتبطة بمهمة مجمعة بشكل صحيح)
DELETE FROM printed_invoices WHERE id = '3341dd87-0e3f-4671-bc13-4641259c88cc';

-- 2. تحديث حالة مهمة التركيب إلى مكتملة (كل بنودها مكتملة)
UPDATE installation_tasks SET status = 'completed' WHERE id = 'b757382d-ac3d-42c1-b4ff-819c9163de6e';

-- 3. تحديث حالة المهمة المجمعة المرتبطة إلى مكتملة
UPDATE composite_tasks SET status = 'completed' WHERE id = 'bda778cd-9264-4661-89f5-d193b729eea3';

-- 4. إزالة ربط الفاتورة اليتيمة من مهمة الطباعة
UPDATE print_tasks SET invoice_id = NULL WHERE id = '3f22ec68-ec72-4aa4-a9fd-b8492eef9622' AND invoice_id = '3341dd87-0e3f-4671-bc13-4641259c88cc';
