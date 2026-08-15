
-- تحديث سعر المتر للمهام التي لديها مساحة وتكلفة لكن بدون سعر متر
UPDATE print_tasks 
SET price_per_meter = total_cost / total_area 
WHERE (price_per_meter IS NULL OR price_per_meter = 0) 
  AND total_area > 0 
  AND total_cost > 0;
