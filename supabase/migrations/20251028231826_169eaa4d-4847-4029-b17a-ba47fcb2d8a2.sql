-- Create table for management phone numbers
CREATE TABLE IF NOT EXISTS public.management_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  label text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.management_phones ENABLE ROW LEVEL SECURITY;

-- Create policies for management_phones
CREATE POLICY "Allow all operations on management_phones"
ON public.management_phones
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index on phone_number
CREATE INDEX IF NOT EXISTS idx_management_phones_phone ON public.management_phones(phone_number);

-- Add trigger for updated_at
CREATE TRIGGER update_management_phones_updated_at
  BEFORE UPDATE ON public.management_phones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();