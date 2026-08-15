
-- Create sync function
CREATE OR REPLACE FUNCTION sync_billboard_size_id()
RETURNS TRIGGER AS $$
DECLARE
  matched_id integer;
  matched_name text;
BEGIN
  -- If Size text changed, update size_id to match
  IF TG_OP = 'INSERT' OR NEW."Size" IS DISTINCT FROM OLD."Size" THEN
    SELECT id INTO matched_id FROM sizes WHERE name = NEW."Size" LIMIT 1;
    IF matched_id IS NOT NULL THEN
      NEW.size_id := matched_id;
    END IF;
  -- If size_id changed, update Size text to match
  ELSIF NEW.size_id IS DISTINCT FROM OLD.size_id THEN
    SELECT name INTO matched_name FROM sizes WHERE id = NEW.size_id LIMIT 1;
    IF matched_name IS NOT NULL THEN
      NEW."Size" := matched_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_sync_billboard_size ON billboards;
CREATE TRIGGER trigger_sync_billboard_size
BEFORE INSERT OR UPDATE ON billboards
FOR EACH ROW EXECUTE FUNCTION sync_billboard_size_id();

-- One-time fix: sync all mismatched size_id values
UPDATE billboards SET size_id = s.id
FROM sizes s WHERE s.name = billboards."Size"
AND (billboards.size_id IS NULL OR billboards.size_id != s.id);
