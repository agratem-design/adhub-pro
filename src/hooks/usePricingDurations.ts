import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PricingDuration } from '@/utils/pricingDuration';
const empty: PricingDuration[] = [];
export function usePricingDurations() {
  const query = useQuery({
    queryKey: ['pricing-durations'],
    queryFn: async (): Promise<PricingDuration[]> => {
      const { data, error } = await supabase.from('pricing_durations').select('*').order('sort_order');
      if (error) throw error;
      return data || [];
    }, staleTime: 0,
  });
  return { ...query, data: query.data ?? empty };
}
