-- Fix billboard_history RLS policies to use has_role function

-- Drop existing policies
DROP POLICY IF EXISTS "Admins manage billboard history" ON billboard_history;
DROP POLICY IF EXISTS "Authenticated users view billboard history" ON billboard_history;

-- Create new policies using has_role function
CREATE POLICY "Admins manage billboard history"
ON billboard_history
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view billboard history"
ON billboard_history
FOR SELECT
TO authenticated
USING (true);