
-- جدول سجل النشاط
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL, -- 'create', 'update', 'delete'
  entity_type text NOT NULL, -- 'contract', 'payment', 'sales_invoice', 'printed_invoice', 'composite_task'
  entity_id text, -- معرف العنصر
  contract_number integer,
  customer_name text,
  ad_type text,
  description text NOT NULL, -- وصف الحدث
  details jsonb, -- تفاصيل إضافية
  user_id uuid REFERENCES auth.users(id)
);

-- فهرس للتاريخ
CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX idx_activity_log_entity_type ON public.activity_log (entity_type);

-- تمكين RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- سياسة: المصادقون يمكنهم القراءة
CREATE POLICY "Authenticated users can read activity_log"
  ON public.activity_log FOR SELECT TO authenticated USING (true);

-- سياسة: المصادقون يمكنهم الإدراج
CREATE POLICY "Authenticated users can insert activity_log"
  ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- ========== Triggers ==========

-- 1. تتبع تعديلات العقود
CREATE OR REPLACE FUNCTION public.log_contract_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, user_id)
    VALUES ('create', 'contract', NEW."Contract_Number"::text, NEW."Contract_Number", NEW."Customer Name", NEW."Ad Type",
            'إنشاء عقد جديد #' || NEW."Contract_Number" || COALESCE(' - ' || NEW."Customer Name", ''),
            auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- تسجيل فقط التغييرات المهمة
    IF OLD."Total" IS DISTINCT FROM NEW."Total"
       OR OLD."Customer Name" IS DISTINCT FROM NEW."Customer Name"
       OR OLD."End Date" IS DISTINCT FROM NEW."End Date"
       OR OLD."Discount" IS DISTINCT FROM NEW."Discount"
       OR OLD.payment_status IS DISTINCT FROM NEW.payment_status
       OR OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids THEN
      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, user_id)
      VALUES ('update', 'contract', NEW."Contract_Number"::text, NEW."Contract_Number", NEW."Customer Name", NEW."Ad Type",
              'تعديل عقد #' || NEW."Contract_Number" || COALESCE(' - ' || NEW."Customer Name", ''),
              auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, user_id)
    VALUES ('delete', 'contract', OLD."Contract_Number"::text, OLD."Contract_Number", OLD."Customer Name", OLD."Ad Type",
            'حذف عقد #' || OLD."Contract_Number" || COALESCE(' - ' || OLD."Customer Name", ''),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_contract_changes
  AFTER INSERT OR UPDATE OR DELETE ON public."Contract"
  FOR EACH ROW EXECUTE FUNCTION public.log_contract_changes();

-- 2. تتبع الدفعات
CREATE OR REPLACE FUNCTION public.log_payment_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_customer_name text;
  v_contract_num integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_contract_num := NEW.contract_number;
    v_customer_name := NEW.customer_name;
    IF v_customer_name IS NULL AND NEW.customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
    END IF;
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
    VALUES ('create', 'payment', NEW.id::text, v_contract_num, v_customer_name,
            'إضافة دفعة ' || COALESCE(NEW.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, ''),
            jsonb_build_object('amount', NEW.amount, 'method', NEW.method, 'entry_type', NEW.entry_type),
            auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      v_customer_name := NEW.customer_name;
      IF v_customer_name IS NULL AND NEW.customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
      END IF;
      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
      VALUES ('update', 'payment', NEW.id::text, NEW.contract_number, v_customer_name,
              'تعديل دفعة من ' || COALESCE(OLD.amount::text, '0') || ' إلى ' || COALESCE(NEW.amount::text, '0') || ' د.ل',
              jsonb_build_object('old_amount', OLD.amount, 'new_amount', NEW.amount),
              auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_customer_name := OLD.customer_name;
    IF v_customer_name IS NULL AND OLD.customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = OLD.customer_id;
    END IF;
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, user_id)
    VALUES ('delete', 'payment', OLD.id::text, OLD.contract_number, v_customer_name,
            'حذف دفعة ' || COALESCE(OLD.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, ''),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_payment_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_changes();

-- 3. تتبع فواتير المبيعات
CREATE OR REPLACE FUNCTION public.log_sales_invoice_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id)
    VALUES ('create', 'sales_invoice', NEW.id::text, NEW.customer_name,
            'إنشاء فاتورة مبيعات #' || NEW.invoice_number || COALESCE(' - ' || NEW.invoice_name, '') || COALESCE(' - ' || NEW.customer_name, ''),
            jsonb_build_object('total', NEW.total_amount, 'invoice_name', NEW.invoice_name),
            auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.paid IS DISTINCT FROM NEW.paid OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id)
      VALUES ('update', 'sales_invoice', NEW.id::text, NEW.customer_name,
              'تعديل فاتورة مبيعات #' || NEW.invoice_number || COALESCE(' - ' || NEW.invoice_name, ''),
              jsonb_build_object('total', NEW.total_amount, 'paid', NEW.paid),
              auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, user_id)
    VALUES ('delete', 'sales_invoice', OLD.id::text, OLD.customer_name,
            'حذف فاتورة مبيعات #' || OLD.invoice_number || COALESCE(' - ' || OLD.customer_name, ''),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_sales_invoice_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_sales_invoice_changes();

-- 4. تتبع فواتير الطباعة
CREATE OR REPLACE FUNCTION public.log_printed_invoice_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id)
    VALUES ('create', 'printed_invoice', NEW.id::text, NEW.customer_name,
            'إنشاء فاتورة طباعة #' || NEW.invoice_number || COALESCE(' - ' || NEW.printer_name, '') || COALESCE(' - ' || NEW.customer_name, ''),
            jsonb_build_object('total', NEW.total_amount, 'printer', NEW.printer_name),
            auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.paid IS DISTINCT FROM NEW.paid OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id)
      VALUES ('update', 'printed_invoice', NEW.id::text, NEW.customer_name,
              'تعديل فاتورة طباعة #' || NEW.invoice_number || COALESCE(' - ' || NEW.printer_name, ''),
              jsonb_build_object('total', NEW.total_amount, 'paid', NEW.paid),
              auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, user_id)
    VALUES ('delete', 'printed_invoice', OLD.id::text, OLD.customer_name,
            'حذف فاتورة طباعة #' || OLD.invoice_number || COALESCE(' - ' || OLD.customer_name, ''),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_printed_invoice_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.printed_invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_printed_invoice_changes();

-- 5. تتبع المهام المجمعة
CREATE OR REPLACE FUNCTION public.log_composite_task_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
    VALUES ('create', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name,
            'إنشاء مهمة مجمعة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, ''),
            jsonb_build_object('task_type', NEW.task_type, 'customer_total', NEW.customer_total),
            auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.customer_total IS DISTINCT FROM NEW.customer_total OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
      VALUES ('update', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name,
              'تعديل مهمة مجمعة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, ''),
              jsonb_build_object('status', NEW.status, 'customer_total', NEW.customer_total, 'paid_amount', NEW.paid_amount),
              auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, user_id)
    VALUES ('delete', 'composite_task', OLD.id::text, OLD.contract_id, OLD.customer_name,
            'حذف مهمة مجمعة #' || OLD.task_number || COALESCE(' - ' || OLD.customer_name, ''),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_composite_task_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.composite_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_composite_task_changes();
