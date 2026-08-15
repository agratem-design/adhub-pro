-- التحقق من وجود primary key في جدول customers وإضافته إذا لم يكن موجود
DO $$ 
BEGIN
    -- تأكد من أن id هو primary key
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_pkey') THEN
        ALTER TABLE customers ADD PRIMARY KEY (id);
    END IF;
END $$;

-- إضافة العلاقات بشكل منفصل
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS billboard_id BIGINT;