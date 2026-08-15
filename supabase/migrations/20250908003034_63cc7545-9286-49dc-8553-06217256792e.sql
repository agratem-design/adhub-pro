-- Add UPDATE policy for users table
CREATE POLICY "Allow authenticated users to update profiles" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
))
WITH CHECK (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
));