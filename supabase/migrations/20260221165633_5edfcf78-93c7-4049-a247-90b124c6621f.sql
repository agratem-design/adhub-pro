-- Fix doubled area and quantity in print_task_items where faces_count > 1
-- Each item represents ONE face (face_a or face_b separately), so area should be width*height, not width*height*faces_count
UPDATE print_task_items
SET 
  area = width * height,
  quantity = 1,
  faces_count = 1,
  total_cost = COALESCE(
    (SELECT pt.price_per_meter FROM print_tasks pt WHERE pt.id = print_task_items.task_id),
    CASE WHEN (width * height) > 0 THEN total_cost / (width * height * faces_count) * (width * height) ELSE total_cost END
  ) * (width * height) / NULLIF(width * height, 0) * 1
WHERE faces_count > 1;

-- Recalculate total_cost for items: unit_cost stays same, total_cost = unit_cost (since quantity=1)
UPDATE print_task_items
SET total_cost = COALESCE(unit_cost, total_cost)
WHERE faces_count = 1 AND quantity = 1 AND unit_cost IS NOT NULL AND unit_cost != total_cost;

-- Fix print_tasks total_area: recalculate from items
UPDATE print_tasks pt
SET total_area = (
  SELECT COALESCE(SUM(pti.width * pti.height), 0)
  FROM print_task_items pti
  WHERE pti.task_id = pt.id
)
WHERE EXISTS (SELECT 1 FROM print_task_items pti WHERE pti.task_id = pt.id);

-- Recalculate total_cost for print_tasks based on corrected area
UPDATE print_tasks pt
SET total_cost = total_area * CASE WHEN price_per_meter > 0 THEN price_per_meter ELSE 13 END
WHERE total_area > 0 AND EXISTS (
  SELECT 1 FROM print_task_items pti WHERE pti.task_id = pt.id AND pti.faces_count = 1
);