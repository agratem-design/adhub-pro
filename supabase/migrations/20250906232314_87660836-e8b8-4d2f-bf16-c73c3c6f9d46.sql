-- First, let's create RLS policies to allow public read access
ALTER TABLE billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contract" ENABLE ROW LEVEL SECURITY;  
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to billboards" ON billboards FOR SELECT USING (true);
CREATE POLICY "Allow public read access to contracts" ON "Contract" FOR SELECT USING (true);
CREATE POLICY "Allow public read access to pricing" ON pricing FOR SELECT USING (true);

-- Insert sample billboard data with correct column names
INSERT INTO billboards (
  "Billboard_Name", "City", "District", "Size", "Status", "Price", "Level", 
  "Image_URL", "GPS_Coordinates", "GPS_Link", "Nearest_Landmark", "Faces_Count",
  "Contract_Number", "Customer_Name", "Rent_Start_Date", "Rent_End_Date", "Days_Count"
) VALUES 
('لوحة الكورنيش الرئيسية', 'الرياض', 'الملز', '4x6', 'متاح', '5000', 'A', 
 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400', '24.7136,46.6753', 
 'https://maps.google.com/?q=24.7136,46.6753', 'مجمع الأفنيوز', '2', NULL, NULL, NULL, NULL, NULL),

('لوحة شارع التحلية', 'الرياض', 'العليا', '3x5', 'مؤجر', '4000', 'B',
 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400', '24.6877,46.6857',
 'https://maps.google.com/?q=24.6877,46.6857', 'برج المملكة', '1', 'C001', 'شركة الأنوار',
 '2024-01-15', '2024-09-15', '243'),

('لوحة طريق الملك فهد', 'الرياض', 'السليمانية', '5x8', 'مؤجر', '7500', 'A',
 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400', '24.7033,46.6728',
 'https://maps.google.com/?q=24.7033,46.6728', 'مول الرياض جاليري', '3', 'C002', 'مؤسسة التقنية',
 '2024-08-01', '2024-09-25', '55'),

('لوحة الطريق الدائري الشرقي', 'الرياض', 'الربوة', '4x7', 'متاح', '6000', 'A',
 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400', '24.7743,46.7386',
 'https://maps.google.com/?q=24.7743,46.7386', 'مركز الراشد مول', '2', NULL, NULL, NULL, NULL, NULL),

('لوحة شارع العروبة', 'الرياض', 'النخيل', '3x4', 'مؤجر', '3500', 'B',
 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400', '24.6906,46.6994',
 'https://maps.google.com/?q=24.6906,46.6994', 'مستشفى الملك فيصل', '1', 'C003', 'شركة الإبداع',
 '2024-07-10', '2024-09-20', '72');

-- Insert sample contract data
INSERT INTO "Contract" (
  "Contract Number", "Customer Name", "Contract Date", "Duration", "End Date",
  "Ad Type", "Total Rent", "Installation Cost", "Total", "Payment 1", "Payment 2", 
  "Payment 3", "Total Paid", "Remaining", "Level", "Phone", "Company"
) VALUES 
('C001', 'شركة الأنوار', '2024-01-15', '8 أشهر', '2024-09-15', 'إعلان تجاري', 
 32000, 2000, '34000', '15000', '10000', '9000', '34000', '0', 'B', '0501234567', 'شركة الأنوار للإعلان'),

('C002', 'مؤسسة التقنية', '2024-08-01', '55 يوم', '2024-09-25', 'إعلان منتج', 
 12375, 1500, '13875', '7000', '3875', '3000', '13875', '0', 'A', '0509876543', 'مؤسسة التقنية المتقدمة'),

('C003', 'شركة الإبداع', '2024-07-10', '72 يوم', '2024-09-20', 'إعلان خدمة',
 8400, 800, '9200', '5000', '2200', '2000', '9200', '0', 'B', '0551122334', 'شركة الإبداع للتسويق');

-- Insert sample pricing data
INSERT INTO pricing (
  size, "Billboard_Level", "Customer_Category", "One_Day", "One_Month", "2_Months", 
  "3_Months", "6_Months", "Full_Year"
) VALUES 
('3x4', 'A', 'شركة', 200, 5000, 9500, 14000, 26000, 50000),
('3x4', 'B', 'شركة', 150, 4000, 7500, 11000, 20000, 38000),
('4x6', 'A', 'شركة', 300, 7500, 14000, 21000, 39000, 75000),
('4x6', 'B', 'شركة', 250, 6000, 11500, 17000, 32000, 60000),
('5x8', 'A', 'شركة', 400, 10000, 19000, 28000, 52000, 100000),
('5x8', 'B', 'شركة', 350, 8500, 16000, 24000, 45000, 85000);