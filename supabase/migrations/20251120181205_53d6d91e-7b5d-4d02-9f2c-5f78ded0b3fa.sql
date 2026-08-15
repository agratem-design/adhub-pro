-- Add print_cost_details column to Contract table to store detailed print costs per size
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS print_cost_details jsonb DEFAULT NULL;

COMMENT ON COLUMN "Contract".print_cost_details IS 'Detailed print costs per billboard size: { "6x3": { "quantity": 2, "unitCost": 150, "totalCost": 300 }, ... }';