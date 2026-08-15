import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FieldPhoto {
  id: string;
  file_name: string;
  file_path: string;
  bucket_url: string | null;
  lat: number | null;
  lng: number | null;
  captured_at: string | null;
  device_make: string | null;
  device_model: string | null;
  direction_degrees: number | null;
  focal_length: number | null;
  zoom_ratio: number | null;
  orbit_radius_meters: number | null;
  notes: string | null;
  linked_billboard_id: number | null;
  user_id: string | null;
  created_at: string | null;
}

export function useFieldPhotos() {
  return useQuery({
    queryKey: ['field-photos'],
    queryFn: async (): Promise<FieldPhoto[]> => {
      const { data, error } = await (supabase as any)
        .from('field_photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[field_photos] Query error:', error);
        throw error;
      }
      console.log('[field_photos] Loaded:', data?.length, 'photos, with GPS:', data?.filter((p: any) => p.lat && p.lng).length, 'with bucket_url:', data?.filter((p: any) => p.bucket_url).length);
      if (data?.length > 0) {
        console.log('[field_photos] Sample:', { id: data[0].id, file_name: data[0].file_name, bucket_url: data[0].bucket_url?.substring(0, 80), lat: data[0].lat, lng: data[0].lng });
      }
      return data || [];
    },
  });
}

export function useInsertFieldPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photo: Omit<FieldPhoto, 'id' | 'created_at'>) => {
      const { data, error } = await (supabase as any)
        .from('field_photos')
        .insert(photo)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-photos'] });
    },
  });
}

export function useUpdateAllOrbitRadius() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (radius: number) => {
      const { error } = await (supabase as any)
        .from('field_photos')
        .update({ orbit_radius_meters: radius })
        .neq('id', '');

      if (error) throw error;
      return radius;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-photos'] });
    },
  });
}

export function useDeleteFieldPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('field_photos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-photos'] });
    },
  });
}
