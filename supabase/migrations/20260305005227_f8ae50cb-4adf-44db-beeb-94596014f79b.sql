-- Fix faces_to_install and company_installation_cost for reinstalled single-face items
-- TR-TG0350: 8x3, base=300, per_face=150, 1 face * 1.5x = 225
UPDATE installation_task_items 
SET faces_to_install = 1,
    company_installation_cost = 225
WHERE id = 'c07d1b9f-e5ed-451f-b410-25b3efaf7345';

-- HA1003: 4x3, base=160, per_face=80, 1 face * 1.5x = 120
UPDATE installation_task_items 
SET faces_to_install = 1,
    company_installation_cost = 120
WHERE id = '6262a0ed-d28b-4a3e-ad9f-ee4f92613c66';