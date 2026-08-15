-- إزالة الصفوف المكررة من جدول billboards مع الاحتفاظ بواحد فقط من كل ID
DELETE FROM billboards 
WHERE ctid NOT IN (
  SELECT MIN(ctid) 
  FROM billboards 
  GROUP BY "ID"
);