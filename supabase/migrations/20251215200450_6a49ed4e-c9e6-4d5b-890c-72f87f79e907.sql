-- إنشاء دالة لجلب معلومات هيكل الجدول
CREATE OR REPLACE FUNCTION public.get_table_schema(p_table_name TEXT)
RETURNS TABLE (
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT,
  column_default TEXT,
  is_primary BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT,
    COALESCE(
      EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = p_table_name
          AND kcu.column_name = c.column_name
      ), false
    ) as is_primary
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' 
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
END;
$$;