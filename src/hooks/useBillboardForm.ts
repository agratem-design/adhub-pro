import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useBillboardForm = (municipalities: any[]) => {
  // Add form state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<any>({});
  const [adding, setAdding] = useState(false);

  // Edit form state
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Image handling
  const [imagePreview, setImagePreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // ✅ FIXED: Get next billboard ID and municipality code
  const getNextBillboardData = async (municipalityName: string) => {
    try {
      // Get municipality code
      const { data: municipalityData, error: municipalityError } = await supabase
        .from('municipalities')
        .select('id, name, code')
        .eq('name', municipalityName)
        .single();

      if (municipalityError || !municipalityData) {
        console.warn('Municipality not found:', municipalityName);
        return { nextId: 1, municipalityCode: 'XX', billboardName: 'XX0001' };
      }

      const municipalityCode = municipalityData.code || 'XX';

      // Get highest billboard ID to generate next ID
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('ID')
        .order('ID', { ascending: false })
        .limit(1);

      let nextId = 1;
      if (!billboardsError && billboardsData && billboardsData.length > 0) {
        nextId = (billboardsData[0].ID || 0) + 1;
      }

      // Generate billboard name: MunicipalityCode + ID (padded to 4 digits)
      const paddedId = String(nextId).padStart(4, '0');
      const billboardName = `${municipalityCode}${paddedId}`;

      console.log('✅ Generated billboard data:', { nextId, municipalityCode, billboardName });

      return { nextId, municipalityCode, billboardName };
    } catch (error) {
      console.error('Error generating billboard data:', error);
      return { nextId: 1, municipalityCode: 'XX', billboardName: 'XX0001' };
    }
  };

  // Generate image name based on billboard name
  const generateImageName = (billboardName: string) => {
    if (!billboardName) return '';
    return `${billboardName}.jpg`;
  };

  // ✅ FIXED: Initialize add form with auto-generated values
  const initializeAddForm = async (initialValues?: any) => {
    // Start with basic form structure
    const basicForm = {
      ID: '',
      Billboard_Name: '',
      City: '',
      Municipality: '',
      District: '',
      Nearest_Landmark: '',
      GPS_Coordinates: '',
      Faces_Count: '',
      Size: '',
      Level: '',
      Image_URL: '',
      image_name: '',
      billboard_type: '',
      is_partnership: false,
      partner_companies: [],
      capital: 0,
      capital_remaining: 0,
      ...initialValues
    };

    setAddForm(basicForm);
    setImagePreview('');
    setSelectedFile(null);
  };

  // ✅ FIXED: Auto-generate billboard name when municipality changes
  useEffect(() => {
    const updateBillboardData = async () => {
      if (addForm.Municipality) {
        const { nextId, municipalityCode, billboardName } = await getNextBillboardData(addForm.Municipality);
        
        setAddForm(prev => {
          const keepImage = prev.hasCustomImage || (prev.Image_URL && !prev.Image_URL.startsWith('/image/'));
          return {
            ...prev,
            ID: nextId,
            Billboard_Name: billboardName,
            image_name: keepImage ? prev.image_name : generateImageName(billboardName),
            Image_URL: keepImage ? prev.Image_URL : `/image/${generateImageName(billboardName)}`
          };
        });
      }
    };

    updateBillboardData();
  }, [addForm.Municipality]);

  return {
    // Add form
    addOpen,
    setAddOpen,
    addForm,
    setAddForm,
    adding,
    setAdding,
    initializeAddForm,

    // Edit form
    editOpen,
    setEditOpen,
    editing,
    setEditing,
    editForm,
    setEditForm,
    saving,
    setSaving,

    // Image handling
    imagePreview,
    setImagePreview,
    selectedFile,
    setSelectedFile,
    uploadingImage,
    setUploadingImage,
    generateImageName,

    // Helper functions
    getNextBillboardData
  };
};