
-- إصلاح فوري: تحديث اللوحات التي لديها عقود نشطة لكن بيانات قديمة
UPDATE billboards b SET 
  "Contract_Number" = sub.active_cn,
  "Customer_Name" = sub.customer_name,
  "Ad_Type" = sub.ad_type,
  "Rent_End_Date" = sub.active_end,
  "Status" = 'محجوز'
FROM (
  SELECT DISTINCT ON (b2."ID")
    b2."ID" as bid,
    c."Contract_Number" as active_cn,
    c."Customer Name" as customer_name,
    c."Ad Type" as ad_type,
    c."End Date" as active_end
  FROM billboards b2
  JOIN "Contract" c ON b2."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[])
  WHERE c."End Date" >= CURRENT_DATE
    AND (b2."Rent_End_Date" IS NULL OR b2."Rent_End_Date" < c."End Date")
  ORDER BY b2."ID", c."End Date" DESC
) sub
WHERE b."ID" = sub.bid
