-- إضافة عمود installation_enabled لتتبع حالة التركيب
ALTER TABLE "Contract" 
ADD COLUMN IF NOT EXISTS installation_enabled boolean DEFAULT true;

-- إضافة تعليق توضيحي للعمود
COMMENT ON COLUMN "Contract".installation_enabled IS 'يحدد إذا كان العقد يشمل تكلفة التركيب أم لا';
