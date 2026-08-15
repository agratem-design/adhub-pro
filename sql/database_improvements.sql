-- ملف يعرض التحسينات المقترحة لقاعدة بيانات Supabase (PostgreSQL)

-- ==============================================================================
-- 1. إنشاء View مجمع للعقود واللوحات (لمنع عمليات JOIN في الواجهة الأمامية N+1)
-- ==============================================================================
CREATE OR REPLACE VIEW contract_billboard_summary AS
SELECT 
    c.id AS contract_id,
    c."Contract_Number",
    c."Customer Name",
    c."Contract Date" AS "start_date",
    c."End Date" AS "end_date",
    c."Total Rent" AS "rent_cost",
    b.id AS billboard_id,
    b."Billboard_Name",
    b."City",
    b."Size",
    b."Status" AS "billboard_status"
FROM 
    "Contract" c
JOIN 
    "billboards" b ON (
        -- في حال كان billboard_ids نصاً يحتوي على فواصل
        b.id::text = ANY(string_to_array(c.billboard_ids, ','))
        OR 
        -- في حال كان هناك ربط مباشر
        b."Contract_Number" = c."Contract_Number"
    );

COMMENT ON VIEW contract_billboard_summary IS 'عرض مجمع للعقود مع اللوحات المرتبطة لتحسين الأداء وتجنب استرجاع كافة اللوحات في المتصفح.';

-- ==============================================================================
-- 2. تحويل الحقول النصية التي تحتوي على JSON إلى النوع الأصلي JSONB
-- ==============================================================================
-- ملاحظة: يُفضل إجراء نسخة احتياطية (Backup) قبل تنفيذ هذه الأوامر

-- أ- جدول العقود: تحويل installments_data إلى jsonb
/*
ALTER TABLE "Contract" 
ALTER COLUMN "installments_data" TYPE jsonb
USING "installments_data"::jsonb;
*/

-- ب- جدول العقود: تحويل billboards_data إلى jsonb
/*
ALTER TABLE "Contract" 
ALTER COLUMN "billboards_data" TYPE jsonb
USING "billboards_data"::jsonb;
*/

-- ==============================================================================
-- 3. إضافة دالة (Function) ونظام مراقبة (Trigger) لمزامنة حالات اللوحات
-- ==============================================================================
-- تضمن هذه الدالة أنه عند حجز عقد جديد بمعرفات لوحات محددة، تتغير حالتهم فوراً

CREATE OR REPLACE FUNCTION sync_billboard_status_on_contract()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.billboard_ids IS NOT NULL THEN
        -- تحويل معرفات اللوحات النصية إلى مصفوفة وتحديث حالة اللوحات إلى "محجوز"
        UPDATE "billboards"
        SET "Status" = 'محجوز',
            "Contract_Number" = NEW."Contract_Number",
            "Customer_Name" = NEW."Customer Name",
            "Rent_Start_Date" = NEW."Contract Date",
            "Rent_End_Date" = NEW."End Date"
        WHERE id::text = ANY(string_to_array(NEW.billboard_ids, ','));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بحدث إنشاء عقد جديد
-- DROP TRIGGER IF EXISTS trigger_sync_billboards ON "Contract";
/*
CREATE TRIGGER trigger_sync_billboards
AFTER INSERT OR UPDATE ON "Contract"
FOR EACH ROW
EXECUTE FUNCTION sync_billboard_status_on_contract();
*/
