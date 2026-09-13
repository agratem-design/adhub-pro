import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Cache the database row; print-specific transformations belong in select.
export const contractTemplateQueryOptions = queryOptions({
  queryKey: ['contract-template-settings'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('contract_template_settings')
      .select('*')
      .eq('setting_key', 'default')
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },
});
