-- إزالة الصفوف المكررة من جدول billboards مع الاحتفاظ بواحد فقط من كل ID
WITH duplicates AS (
  SELECT ID, 
         ROW_NUMBER() OVER (PARTITION BY ID ORDER BY ID) as row_num
  FROM billboards
)
DELETE FROM billboards 
WHERE ID IN (
  SELECT ID 
  FROM duplicates 
  WHERE row_num > 1
);