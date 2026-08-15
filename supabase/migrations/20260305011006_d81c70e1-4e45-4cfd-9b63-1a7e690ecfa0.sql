
-- Fix TR-HA0291: 2 original faces + 2 reinstalled (both) = 4 total, cost = 300 × (4 × 0.5) = 600
UPDATE installation_task_items 
SET total_reinstalled_faces = 4,
    company_installation_cost = 600
WHERE id = 'b6d2a06e-ed14-4d20-9fd1-5738deddca2c';

-- Fix TR-SJ0532: 2 original faces + 2 reinstalled (both) = 4 total, cost = 160 × (4 × 0.5) = 320 (cost already correct)
UPDATE installation_task_items 
SET total_reinstalled_faces = 4
WHERE id = 'ff513f7a-7fa6-46c1-9336-e097c6bf857c';
