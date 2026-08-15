-- Create management_contacts table for storing management phone numbers
CREATE TABLE IF NOT EXISTS public.management_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  position TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.management_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to read management contacts"
  ON public.management_contacts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert management contacts"
  ON public.management_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update management contacts"
  ON public.management_contacts
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete management contacts"
  ON public.management_contacts
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_management_contacts_updated_at
  BEFORE UPDATE ON public.management_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default management contacts
INSERT INTO public.management_contacts (name, phone, position, notes)
VALUES 
  ('إدارة المبيعات', '0912345678', 'مدير المبيعات', 'الرقم الرئيسي للإدارة'),
  ('المحاسبة', '0923456789', 'مدير المحاسبة', 'قسم المحاسبة والتحصيل')
ON CONFLICT DO NOTHING;