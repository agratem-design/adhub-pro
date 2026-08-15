
-- جدول إعادة الطباعة لتتبع الطباعات الإضافية للوحات
CREATE TABLE public.print_reprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.print_tasks(id) ON DELETE CASCADE,
  print_task_item_id UUID NOT NULL REFERENCES public.print_task_items(id) ON DELETE CASCADE,
  billboard_id BIGINT,
  face_type TEXT NOT NULL CHECK (face_type IN ('A', 'B', 'both')),
  reason TEXT NOT NULL,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('customer', 'loss', 'printer')),
  area NUMERIC NOT NULL DEFAULT 0,
  printer_cost NUMERIC NOT NULL DEFAULT 0,
  customer_charge NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.print_reprints ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required for this app)
CREATE POLICY "Allow all operations on print_reprints"
ON public.print_reprints FOR ALL USING (true) WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_print_reprints_updated_at
BEFORE UPDATE ON public.print_reprints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
