-- Create roles table for managing user roles and their permissions
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Roles are viewable by authenticated users"
ON public.roles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage roles"
ON public.roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default roles
INSERT INTO public.roles (name, display_name, description, permissions) VALUES
('admin', 'مدير', 'مدير النظام - صلاحيات كاملة', ARRAY['dashboard', 'billboards', 'contracts', 'customers', 'reports', 'tasks', 'expenses', 'salaries', 'settings', 'users', 'roles', 'pricing']),
('user', 'مستخدم', 'مستخدم عادي - صلاحيات محدودة', ARRAY[]::TEXT[]);

-- Create trigger for updated_at
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();