
-- إصلاح بيانات تاريخ اللوحة TR-TC0017 (billboard_id = 17)

-- عقد #1208: القيمة الصحيحة من billboard_prices = 55,000، التركيب = 1,500
UPDATE billboard_history 
SET rent_amount = 55000,
    total_before_discount = 55000,
    installation_cost = 1500,
    discount_amount = 0,
    individual_billboard_data = '{"billboardId":"17","basePriceBeforeDiscount":55000,"priceBeforeDiscount":55000,"discountPerBillboard":0,"priceAfterDiscount":55000,"contractPrice":55000,"finalPrice":55000,"printCost":0,"installationCost":1500,"totalBillboardPrice":55000,"pricingCategory":"البحباح","pricingMode":"months","duration":12}'::jsonb
WHERE id = 'b5ee8096-a6b9-4c42-8b00-50fa5e0e3097';

-- عقد #1164: القيمة الصحيحة من billboard_prices = 29,000 (قبل الخصم)، بعد الخصم = 28,352، التركيب = 1,300
UPDATE billboard_history 
SET rent_amount = 28352,
    total_before_discount = 29000,
    installation_cost = 1300,
    discount_amount = 648,
    discount_percentage = 2.24,
    individual_billboard_data = '{"billboardId":"17","basePriceBeforeDiscount":29000,"priceBeforeDiscount":29000,"discountPerBillboard":648.04,"priceAfterDiscount":28351.96,"contractPrice":29000,"finalPrice":28351.96,"printCost":0,"installationCost":1300,"totalBillboardPrice":28351.96,"pricingCategory":"شركات","pricingMode":"months","duration":3}'::jsonb
WHERE id = 'fc1eebf8-3d2d-49f9-af00-fbb0265b9718';
