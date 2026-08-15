-- Create table to track billboard rental extensions
CREATE TABLE public.billboard_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billboard_id BIGINT NOT NULL REFERENCES billboards("ID") ON DELETE CASCADE,
  contract_number BIGINT REFERENCES "Contract"("Contract_Number"),
  extension_days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  extension_type TEXT NOT NULL DEFAULT 'manual', -- 'public_event', 'installation_delay', 'manual'
  old_end_date DATE NOT NULL,
  new_end_date DATE NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.billboard_extensions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins manage billboard extensions" 
ON public.billboard_extensions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view billboard extensions" 
ON public.billboard_extensions 
FOR SELECT 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_billboard_extensions_billboard_id ON public.billboard_extensions(billboard_id);
CREATE INDEX idx_billboard_extensions_contract_number ON public.billboard_extensions(contract_number);