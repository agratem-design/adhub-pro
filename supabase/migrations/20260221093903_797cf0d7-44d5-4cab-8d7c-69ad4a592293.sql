
-- Fix: sizes table publicly modifiable without authentication
DROP POLICY IF EXISTS "Enable read access for all" ON sizes;
DROP POLICY IF EXISTS "Enable insert for all" ON sizes;
DROP POLICY IF EXISTS "Enable update for all" ON sizes;
DROP POLICY IF EXISTS "Enable delete for all" ON sizes;

-- Authenticated users can view sizes
CREATE POLICY "Authenticated users can view sizes"
  ON sizes FOR SELECT TO authenticated
  USING (true);

-- Only users with 'pricing' permission can modify sizes
CREATE POLICY "Users with permission can insert sizes"
  ON sizes FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'pricing'));

CREATE POLICY "Users with permission can update sizes"
  ON sizes FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'pricing'))
  WITH CHECK (has_permission(auth.uid(), 'pricing'));

CREATE POLICY "Users with permission can delete sizes"
  ON sizes FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'pricing'));
