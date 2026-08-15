
-- تعيين "شركة الفارس الذهبي" لجميع اللوحات غير الصديقة ما عدا بلدية أبوسليم
UPDATE billboards 
SET own_company_id = '2fbd993c-ecfb-4379-aabe-e9f3b3d47c96'
WHERE friend_company_id IS NULL 
  AND (own_company_id IS NULL)
  AND ("Municipality" IS NULL OR "Municipality" NOT LIKE '%أبو سليم%');

-- تعيين "الإبداع الراقي" للوحات بلدية أبوسليم
UPDATE billboards 
SET own_company_id = 'a14e2260-c663-4ec2-a8ff-97d89929727e'
WHERE friend_company_id IS NULL 
  AND (own_company_id IS NULL)
  AND "Municipality" LIKE '%أبو سليم%';
