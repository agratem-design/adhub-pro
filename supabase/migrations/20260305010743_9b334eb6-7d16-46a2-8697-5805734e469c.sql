-- Fix TR-TG0350: total = 2 (original install) + 1 (reinstall face_b) = 3, cost = 300 × 1.5 = 450
UPDATE installation_task_items 
SET total_reinstalled_faces = 3,
    company_installation_cost = 450
WHERE id = 'c07d1b9f-e5ed-451f-b410-25b3efaf7345';

-- Fix HA1003: reinstall_count=1 (was incorrectly set to 2), total = 2 (original) + 1 (reinstall face_b) = 3
UPDATE installation_task_items 
SET reinstall_count = 1,
    total_reinstalled_faces = 3,
    company_installation_cost = 240
WHERE id = '6262a0ed-d28b-4a3e-ad9f-ee4f92613c66';

-- Fix all other reinstalled items: add original faces to total
UPDATE installation_task_items 
SET total_reinstalled_faces = COALESCE((
    SELECT b."Faces_Count" FROM billboards b WHERE b."ID" = installation_task_items.billboard_id
  ), 2) + CASE 
    WHEN reinstalled_faces = 'both' THEN COALESCE(faces_to_install, 2)
    WHEN reinstalled_faces IN ('face_a', 'face_b') THEN 1
    ELSE 0
  END
WHERE reinstall_count > 0 
AND id NOT IN ('6262a0ed-d28b-4a3e-ad9f-ee4f92613c66', 'c07d1b9f-e5ed-451f-b410-25b3efaf7345')
AND total_reinstalled_faces < COALESCE((
    SELECT b."Faces_Count" FROM billboards b WHERE b."ID" = installation_task_items.billboard_id
  ), 2);