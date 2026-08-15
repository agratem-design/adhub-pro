-- Fix HA1003: reinstall_count=2 (2 reinstalls: both faces first, face_b second), cost = 160 * 1.5 = 240
UPDATE installation_task_items 
SET faces_to_install = 1,
    reinstall_count = 2,
    company_installation_cost = 240
WHERE id = '6262a0ed-d28b-4a3e-ad9f-ee4f92613c66';

-- Fix TR-TG0350: cost = 300 * 1.5 = 450 (full base price, no per-face division)
UPDATE installation_task_items 
SET company_installation_cost = 450
WHERE id = 'c07d1b9f-e5ed-451f-b410-25b3efaf7345';