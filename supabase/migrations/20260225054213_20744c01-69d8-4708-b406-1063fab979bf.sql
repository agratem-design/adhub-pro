-- Fix billboard 69: update to reflect active contract 1143
UPDATE public.billboards 
SET "Status" = 'محجوز',
    "Contract_Number" = 1143,
    "Customer_Name" = 'محمد البحباح',
    "Rent_Start_Date" = '2025-10-20',
    "Rent_End_Date" = '2026-10-15',
    "updated_at" = now()
WHERE "ID" = 69;