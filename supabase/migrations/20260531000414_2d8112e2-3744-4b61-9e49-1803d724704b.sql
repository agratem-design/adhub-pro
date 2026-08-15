
-- Add UPDATE/DELETE policies for maintenance_statuses
CREATE POLICY "Authenticated can update maintenance_statuses"
ON public.maintenance_statuses FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete maintenance_statuses"
ON public.maintenance_statuses FOR DELETE TO authenticated
USING (true);
