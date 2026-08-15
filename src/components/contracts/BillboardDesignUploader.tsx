import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';

interface BillboardDesignUploaderProps {
  billboardId: number;
  billboardName: string;
  contractNumber: string;
  onDesignUploaded: (billboardId: number, faceType: 'a' | 'b', path: string) => void;
  currentDesignA?: string;
  currentDesignB?: string;
}

export const BillboardDesignUploader: React.FC<BillboardDesignUploaderProps> = ({
  billboardId,
  billboardName,
  contractNumber,
  onDesignUploaded,
  currentDesignA,
  currentDesignB
}) => {

  const handleRemoveDesign = async (faceType: 'a' | 'b') => {
    try {
      const columnName = faceType === 'a' ? 'design_face_a' : 'design_face_b';
      const { error } = await supabase
        .from('billboards')
        .update({ [columnName]: null } as any)
        .eq('ID', billboardId);

      if (error) throw error;

      onDesignUploaded(billboardId, faceType, '');
      toast.success(`تم حذف تصميم الوجه ${faceType === 'a' ? 'الأمامي' : 'الخلفي'}`);
    } catch (error) {
      console.error('خطأ في حذف التصميم:', error);
      toast.error('فشل حذف التصميم');
    }
  };

  const renderFace = (faceType: 'a' | 'b', currentDesign?: string) => {
    const label = faceType === 'a' ? 'الوجه الأمامي' : 'الوجه الخلفي';

    return (
      <div>
        <Label className="text-xs mb-2 block">{label}</Label>
        {currentDesign ? (
          <div className="relative">
            <img src={currentDesign} alt={label} className="w-full h-24 object-cover rounded border" />
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="absolute top-1 right-1 h-6 w-6 p-0"
              onClick={() => handleRemoveDesign(faceType)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <ImageUploadZone
            onChange={(url) => {
              onDesignUploaded(billboardId, faceType, url);
              // Also update billboard in DB
              const columnName = faceType === 'a' ? 'design_face_a' : 'design_face_b';
              supabase.from('billboards').update({ [columnName]: url } as any).eq('ID', billboardId).then(({ error }) => {
                if (error) toast.error('فشل حفظ التصميم');
              });
            }}
            imageName={`billboard-${billboardId}_face-${faceType}`}
            folder={`contract-designs/C${contractNumber}`}
            showUrlInput={false}
            showPreview={false}
            dropZoneHeight="h-24"
            label=""
          />
        )}
      </div>
    );
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h4 className="font-medium mb-3 text-sm">{billboardName}</h4>
      <div className="grid grid-cols-2 gap-4">
        {renderFace('a', currentDesignA)}
        {renderFace('b', currentDesignB)}
      </div>
    </div>
  );
};
