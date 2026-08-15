-- Fix billboard TR-HA0063 (ID=63) to reflect current contract #1189
UPDATE billboards 
SET "Status" = 'مؤجر', 
    "Contract_Number" = 1189, 
    "Customer_Name" = 'محمد البحباح', 
    "Rent_Start_Date" = '2026-01-18', 
    "Rent_End_Date" = '2026-07-17'
WHERE "ID" = 63;