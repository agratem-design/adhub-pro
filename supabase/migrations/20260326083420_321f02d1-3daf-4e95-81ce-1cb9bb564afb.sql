
-- تحديث اللوحات الصديقة الموجودة لإخفائها من المتاح
UPDATE billboards 
SET is_visible_in_available = false 
WHERE friend_company_id IS NOT NULL 
  AND (is_visible_in_available IS NULL OR is_visible_in_available = true);

-- trigger لضبط is_visible_in_available تلقائياً عند ربط لوحة بشركة صديقة
CREATE OR REPLACE FUNCTION auto_hide_friend_billboard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.friend_company_id IS NOT NULL AND (OLD.friend_company_id IS NULL OR OLD.friend_company_id != NEW.friend_company_id) THEN
    NEW.is_visible_in_available := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_hide_friend_billboard ON billboards;
CREATE TRIGGER trg_auto_hide_friend_billboard
  BEFORE UPDATE ON billboards
  FOR EACH ROW
  EXECUTE FUNCTION auto_hide_friend_billboard();
