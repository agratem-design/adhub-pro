-- Fix contract 1185: set friend_rental_cost = customer_rental_price where friend_rental_cost is 0
UPDATE public.friend_billboard_rentals 
SET friend_rental_cost = customer_rental_price,
    updated_at = now(),
    notes = 'تصحيح تلقائي - تعيين تكلفة الشركة الصديقة من سعر الإيجار'
WHERE contract_number = 1185 
  AND friend_rental_cost = 0;