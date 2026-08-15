import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BillboardBulkPrintDialog } from '@/components/billboards/BillboardBulkPrintDialog';

interface OfferBillboardPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: {
    offer_number: number;
    customer_name: string;
    ad_type?: string;
    start_date?: string;
    billboards_data?: string;
  } | null;
}

export function OfferBillboardPrintDialog({ open, onOpenChange, offer }: OfferBillboardPrintDialogProps) {
  // Parse billboard IDs from offer data
  const offerBillboardIds = React.useMemo(() => {
    if (!offer?.billboards_data) return [];
    try {
      const parsed = JSON.parse(offer.billboards_data);
      return parsed.map((b: any) => parseInt(b.ID || b.id)).filter((id: number) => !isNaN(id) && id > 0);
    } catch {
      return [];
    }
  }, [offer?.billboards_data]);

  // Parse offer billboards data for designs
  const offerBillboardsDesigns = React.useMemo(() => {
    if (!offer?.billboards_data) return {};
    try {
      const parsed = JSON.parse(offer.billboards_data);
      const designsMap: Record<number, any> = {};
      parsed.forEach((b: any) => {
        const id = parseInt(b.ID || b.id);
        if (!isNaN(id)) {
          designsMap[id] = {
            design_face_a: b.design_face_a || b.designFaceA,
            design_face_b: b.design_face_b || b.designFaceB,
            installed_image_url: b.installed_image_url,
            installed_image_face_a_url: b.installed_image_face_a_url,
            installed_image_face_b_url: b.installed_image_face_b_url,
            cutout_image_url: b.cutout_image_url,
          };
        }
      });
      return designsMap;
    } catch {
      return {};
    }
  }, [offer?.billboards_data]);

  // Fetch billboards from database with ALL required fields
  const { data: billboards = [] } = useQuery({
    queryKey: ['offer-billboards-print', offerBillboardIds],
    queryFn: async () => {
      if (offerBillboardIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('billboards')
        .select(`
          ID, 
          Billboard_Name, 
          Size, 
          Level, 
          Faces_Count, 
          Municipality, 
          District, 
          Nearest_Landmark, 
          Image_URL, 
          GPS_Coordinates, 
          GPS_Link, 
          has_cutout, 
          design_face_a, 
          design_face_b
        `)
        .in('ID', offerBillboardIds);
      
      if (error) {
        console.error('Error fetching billboards:', error);
        return [];
      }
      
      // Merge with offer designs if available - prefer offer data over database data
      return (data || []).map((bb: any) => {
        const offerDesigns = offerBillboardsDesigns[bb.ID] || {};
        return {
          ...bb,
          // Prefer offer designs/images over database designs
          design_face_a: offerDesigns.design_face_a || bb.design_face_a,
          design_face_b: offerDesigns.design_face_b || bb.design_face_b,
          // صور التركيب من العرض (إن وجدت)
          installed_image_url: offerDesigns.installed_image_url || null,
          installed_image_face_a_url: offerDesigns.installed_image_face_a_url || null,
          installed_image_face_b_url: offerDesigns.installed_image_face_b_url || null,
          // صورة المجسم
          cutout_image_url: offerDesigns.cutout_image_url || null,
        };
      });
    },
    enabled: open && offerBillboardIds.length > 0,
  });

  if (!offer) return null;

  return (
    <BillboardBulkPrintDialog
      open={open}
      onOpenChange={onOpenChange}
      billboards={billboards}
      contractInfo={{
        number: offer.offer_number,
        customerName: offer.customer_name,
        adType: offer.ad_type,
        startDate: offer.start_date,
      }}
      isOffer={true}
    />
  );
}
