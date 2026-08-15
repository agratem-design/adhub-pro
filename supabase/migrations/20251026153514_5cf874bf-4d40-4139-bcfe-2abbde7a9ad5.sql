-- Add printer_id to customers table for linking suppliers to printers
ALTER TABLE public.customers 
ADD COLUMN printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_customers_printer_id ON public.customers(printer_id);

-- Add comments for documentation
COMMENT ON COLUMN public.customers.printer_id IS 'Links supplier customers to printer records for tracking print invoices';