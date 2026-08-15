-- Fix incorrect customer_installation_cost for 3 billboards where stored value doesn't match meter calculation
-- Billboard 720: stored=180, should be 360 (15 * 3 * 4 * 2 = 360)
-- Billboard 738: stored=240, should be 480 (20 * 3 * 4 * 2 = 480)  
-- Billboard 783: stored=180, should be 360 (15 * 3 * 4 * 2 = 360)

UPDATE installation_task_items 
SET customer_installation_cost = 360
WHERE task_id = '086b5189-d569-4c1e-a39d-ef60ff0f0a79'
AND billboard_id = 720;

UPDATE installation_task_items 
SET customer_installation_cost = 360
WHERE task_id = '086b5189-d569-4c1e-a39d-ef60ff0f0a79'
AND billboard_id = 783;

UPDATE installation_task_items 
SET customer_installation_cost = 480
WHERE task_id = '086b5189-d569-4c1e-a39d-ef60ff0f0a79'
AND billboard_id = 738;

-- Update the composite task to reflect the correct total (20460 instead of 19860)
UPDATE composite_tasks 
SET customer_installation_cost = 20460
WHERE id = '27e9d63f-e8b3-4a40-9b62-f3813089b7a1';