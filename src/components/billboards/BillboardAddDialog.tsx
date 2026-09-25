import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { 
  Upload, 
  Loader2, 
  ClipboardList, 
  MapPin, 
  Ruler, 
  ImageIcon, 
  Handshake, 
  Sparkles, 
  CheckCircle2, 
  Building, 
  Plus,
  Hash,
  RotateCcw,
  AlertCircle,
  Search,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { uploadToImgbb } from '@/services/imgbbService';
import { 
  QuickAddSizeDialog, 
  QuickAddMunicipalityDialog, 
  QuickAddCityDialog, 
  QuickAddTypeDialog, 
  QuickAddLevelDialog, 
  QuickAddFaceDialog 
} from './QuickAddDialogs';

interface BillboardAddDialogProps {
  addOpen: boolean;
  setAddOpen: (open: boolean) => void;
  addForm: any;
  setAddForm: (form: any) => void;
  adding: boolean;
  setAdding: (adding: boolean) => void;
  imagePreview: string;
  setImagePreview: (preview: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  uploadingImage: boolean;
  generateImageName: (name: string) => string;
  municipalities: any[];
  sizes: any[];
  levels: string[];
  citiesList: string[];
  faces: any[];
  billboardTypes: string[];
 billboards: any[]; // NEW: Add billboards prop for district suggestions
  setMunicipalities: (municipalities: any[]) => void;
  setSizes: (sizes: any[]) => void;
  setLevels: (levels: string[]) => void;
  setBillboardTypes: (types: string[]) => void;
  setDbMunicipalities: (municipalities: string[]) => void;
  setDbSizes: (sizes: string[]) => void;
  loadBillboards: (options?: { silent?: boolean }) => Promise<void>;
  uploadImageToFolder: (file: File, fileName: string) => Promise<boolean>;
  addMunicipalityIfNew: (name: string, municipalities: any[], setMunicipalities: any, setDbMunicipalities: any) => Promise<void>;
  addSizeIfNew: (sizeName: string, level: string, sizes: any[], setSizes: any, setDbSizes: any) => Promise<void>;
  addLevelIfNew: (level: string, levels: string[], setLevels: any) => Promise<void>;
  addBillboardTypeIfNew: (typeName: string, billboardTypes: string[], setBillboardTypes: any) => Promise<void>;
  loadCities?: () => Promise<void>;
  loadMunicipalities?: () => Promise<void>;
  loadSizes?: () => Promise<void>;
  loadLevels?: () => Promise<void>;
  loadFaces?: () => Promise<void>;
  loadBillboardTypes?: () => Promise<void>;
}

export const BillboardAddDialog: React.FC<BillboardAddDialogProps> = ({
  addOpen,
  setAddOpen,
  addForm,
  setAddForm,
  adding,
  setAdding,
  imagePreview,
  setImagePreview,
  selectedFile,
  setSelectedFile,
  uploadingImage,
  generateImageName,
  municipalities,
  sizes,
  levels,
  citiesList,
  faces,
  billboardTypes,
 billboards = [], // NEW: Default empty array
  setMunicipalities,
  setSizes,
  setLevels,
  setBillboardTypes,
  setDbMunicipalities,
  setDbSizes,
  loadBillboards,
  uploadImageToFolder,
  addMunicipalityIfNew,
  addSizeIfNew,
  addLevelIfNew,
  addBillboardTypeIfNew,
  loadCities,
  loadMunicipalities,
  loadSizes,
  loadLevels,
  loadFaces,
  loadBillboardTypes
}) => {
  // Sub-dialog states for quick add
  const [sizeQuickAddOpen, setSizeQuickAddOpen] = useState(false);
  const [munQuickAddOpen, setMunQuickAddOpen] = useState(false);
  const [cityQuickAddOpen, setCityQuickAddOpen] = useState(false);
  const [typeQuickAddOpen, setTypeQuickAddOpen] = useState(false);
  const [levelQuickAddOpen, setLevelQuickAddOpen] = useState(false);
  const [faceQuickAddOpen, setFaceQuickAddOpen] = useState(false);

  // ✅ NEW: State for district input and suggestions
  const [districtInput, setDistrictInput] = useState('');
  const [showDistrictSuggestions, setShowDistrictSuggestions] = useState(false);

  // ✅ NEW: Own companies
  const [ownCompanies, setOwnCompanies] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!addOpen) return;
    supabase.from('friend_companies').select('id, name').eq('company_type', 'own').order('name')
      .then(({ data }) => setOwnCompanies(data || []));
  }, [addOpen]);

  // ✅ NEW: Partners options
  const [partnersOptions, setPartnersOptions] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    const loadPartners = async () => {
      try {
        const { data, error } = await supabase.from('partners').select('name').order('name');
        if (!error) {
          const opts = (data || [])
            .map((p: any) => String(p?.name || '').trim())
            .filter(Boolean)
            .map((name: string) => ({ label: name, value: name }));
          setPartnersOptions(opts);
        }
      } catch {}
    };
    if (addOpen && addForm.is_partnership) loadPartners();
  }, [addOpen, addForm.is_partnership]);

  // ✅ NEW: Get unique districts from all billboards
  const availableDistricts = useMemo(() => {
    const districts = new Set<string>();
    billboards.forEach(billboard => {
      const district = billboard.District || billboard.district;
      if (district && String(district).trim()) {
        districts.add(String(district).trim());
      }
    });
    return Array.from(districts).sort();
  }, [billboards]);

  // ✅ NEW: Filter districts based on input
  const filteredDistricts = useMemo(() => {
    if (!districtInput.trim()) return availableDistricts.slice(0, 10); // Show first 10 if no input
    return availableDistricts.filter(district => 
      district.toLowerCase().includes(districtInput.toLowerCase())
    ).slice(0, 10); // Limit to 10 suggestions
  }, [districtInput, availableDistricts]);

  // ✅ NEW: Handle district input change
  const handleDistrictChange = (value: string) => {
    setDistrictInput(value);
    setAddForm((p: any) => ({ ...p, District: value }));
    setShowDistrictSuggestions(true);
  };

  // ✅ NEW: Handle district suggestion selection
  const handleDistrictSelect = (district: string) => {
    setDistrictInput(district);
    setAddForm((p: any) => ({ ...p, District: district }));
    setShowDistrictSuggestions(false);
  };

  // ✅ NEW: Empty numbers (gaps) from previous and sequence management
  const [allBillboards, setAllBillboards] = useState<{ ID: number; Billboard_Name: string }[]>([]);
  const [loadingBillboardsList, setLoadingBillboardsList] = useState(false);
  const [isGapPopoverOpen, setIsGapPopoverOpen] = useState(false);
  const [gapSearchQuery, setGapSearchQuery] = useState('');

  // Fetch all existing billboard IDs to identify empty/missing numbers from previously
  useEffect(() => {
    if (!addOpen) return;
    let isCancelled = false;

    const fetchAllBillboards = async () => {
      setLoadingBillboardsList(true);
      try {
        const { data, error } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name')
          .not('ID', 'is', null)
          .order('ID', { ascending: true });

        if (!error && data && !isCancelled) {
          setAllBillboards(
            data.map((b: any) => ({
              ID: Number(b.ID),
              Billboard_Name: b.Billboard_Name || ''
            })).filter((b: any) => !isNaN(b.ID) && b.ID > 0)
          );
          setLoadingBillboardsList(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to load billboards for gap calculation:', err);
      }

      if (!isCancelled) {
        const mapped = (billboards || []).map((b: any) => ({
          ID: Number(b.ID),
          Billboard_Name: b.Billboard_Name || b.billboard_name || ''
        })).filter((b: any) => !isNaN(b.ID) && b.ID > 0);
        setAllBillboards(mapped);
        setLoadingBillboardsList(false);
      }
    };

    fetchAllBillboards();
    return () => {
      isCancelled = true;
    };
  }, [addOpen, billboards]);

  // Map of occupied IDs -> Billboard_Name
  const occupiedMap = useMemo(() => {
    const map = new Map<number, string>();
    allBillboards.forEach(b => {
      map.set(b.ID, b.Billboard_Name);
    });
    return map;
  }, [allBillboards]);

  // Calculate highest ID, empty numbers (gaps from 1 to max), and next sequential ID
  const { maxExistingId, emptyNumbers, nextSequentialId } = useMemo(() => {
    if (allBillboards.length === 0) {
      return { maxExistingId: 0, emptyNumbers: [] as number[], nextSequentialId: 1 };
    }
    let max = 0;
    allBillboards.forEach(b => {
      if (b.ID > max) max = b.ID;
    });

    const gaps: number[] = [];
    for (let i = 1; i < max; i++) {
      if (!occupiedMap.has(i)) {
        gaps.push(i);
      }
    }

    return {
      maxExistingId: max,
      emptyNumbers: gaps,
      nextSequentialId: max + 1
    };
  }, [allBillboards, occupiedMap]);

  // Filtered empty numbers by search query
  const filteredEmptyNumbers = useMemo(() => {
    if (!gapSearchQuery.trim()) return emptyNumbers;
    const q = gapSearchQuery.trim();
    return emptyNumbers.filter(num => String(num).includes(q));
  }, [emptyNumbers, gapSearchQuery]);

  // Current ID status checks
  const currentIdNum = Number(addForm.ID);
  const isIdEmptyOrInvalid = !addForm.ID || isNaN(currentIdNum) || currentIdNum <= 0;
  const isCurrentIdOccupied = !isIdEmptyOrInvalid && occupiedMap.has(currentIdNum);
  const occupiedBillboardName = isCurrentIdOccupied ? occupiedMap.get(currentIdNum) : null;
  const isCurrentIdGap = !isIdEmptyOrInvalid && emptyNumbers.includes(currentIdNum);
  const isCurrentIdSequential = !isIdEmptyOrInvalid && currentIdNum === nextSequentialId;

  // Resolve municipality code
  const getMunicipalityCode = (munName?: string) => {
    const mName = munName || addForm.Municipality;
    if (!mName) return 'XX';
    const found = municipalities.find((m: any) => m.name === mName || m.name_ar === mName);
    return found?.code || 'XX';
  };

  // Update billboard ID and sync billboard name & image name
  const updateBillboardId = (newId: number | string) => {
    const numId = typeof newId === 'string' ? (newId === '' ? '' : parseInt(newId, 10)) : newId;

    setAddForm((prev: any) => {
      if (numId === '' || isNaN(numId as number)) {
        return { ...prev, ID: '' };
      }

      const munCode = getMunicipalityCode(prev.Municipality);
      const paddedId = String(numId).padStart(4, '0');
      const newBillboardName = `${munCode}${paddedId}`;
      const keepImage = prev.hasCustomImage || (prev.Image_URL && !prev.Image_URL.startsWith('/image/'));

      return {
        ...prev,
        ID: numId,
        Billboard_Name: newBillboardName,
        image_name: keepImage ? prev.image_name : generateImageName(newBillboardName),
        Image_URL: keepImage ? prev.Image_URL : `/image/${generateImageName(newBillboardName)}`
      };
    });
  };

  // Select a specific empty gap number
  const handleSelectGapId = (gapId: number) => {
    updateBillboardId(gapId);
    setIsGapPopoverOpen(false);
    toast.success(`تم اختيار الرقم الشاغر السابق: #${gapId}`);
  };

  // Select the next sequential number
  const handleSelectSequentialId = () => {
    updateBillboardId(nextSequentialId);
    setIsGapPopoverOpen(false);
    toast.success(`تم اختيار الرقم التسلسلي الجديد: #${nextSequentialId}`);
  };

  const [imgbbUploading, setImgbbUploading] = useState(false);

  // Upload image to imgbb with professional naming
  const handleImgbbUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صحيح');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 25MB');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setSelectedFile(file);
    setImgbbUploading(true);

    const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
    const progress = createUploadProgressTracker();
    const fileSizeKB = Math.round(file.size / 1024);

    const bbName = addForm.Billboard_Name || 'billboard';
    const imageName = `${bbName.replace(/\s+/g, '-')}-${Date.now()}.jpg`;
    progress.start(imageName, fileSizeKB);

    let pct = 5;
    const interval = setInterval(() => {
      if (pct < 30) pct += 5;
      else if (pct < 70) pct += 3;
      else if (pct < 90) pct += 1;
      progress.update(pct);
    }, 250);

    try {
      const { uploadImageWithFallback } = await import('@/services/imageUploadService');
      const imageUrl = await uploadImageWithFallback(file, imageName, 'billboard-photos');
      
      clearInterval(interval);
      progress.update(100);
      progress.complete(true, 'تم رفع الصورة بنجاح');

      setAddForm((prev: any) => ({ ...prev, Image_URL: imageUrl, image_name: imageName }));
      setSelectedFile(null);
    } catch (error: any) {
      clearInterval(interval);
      console.error('Upload error:', error);
      progress.complete(false, error.message || 'فشل رفع الصورة. يمكنك الإضافة لحفظها عند الإضافة.');
      setAddForm((prev: any) => ({ ...prev, image_name: imageName }));
    } finally {
      setImgbbUploading(false);
    }
  };

  // Handle image selection (file input)
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleImgbbUpload(file);
  };

  // Handle paste from clipboard
  const handleBillboardImagePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await handleImgbbUpload(file);
        return;
      }
    }
    // Check for URL text
    const text = e.clipboardData?.getData('text');
    if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
      e.preventDefault();
      setAddForm((prev: any) => ({ ...prev, Image_URL: text }));
      setImagePreview(text);
      toast.success('تم لصق رابط الصورة');
    }
  };

  // Add billboard function
  const addBillboard = async () => {
    // Validate required fields
    if (!addForm.Municipality || !addForm.Level || !addForm.Size) {
      toast.error('يرجى تحديد البلدية والمستوى والمقاس');
      return;
    }

    const targetIdNum = Number(addForm.ID);
    if (!addForm.ID || isNaN(targetIdNum) || targetIdNum <= 0) {
      toast.error('يرجى تحديد رقم لوحة صحيح');
      return;
    }

    if (occupiedMap.has(targetIdNum)) {
      toast.error(`رقم اللوحة (${targetIdNum}) مستخدم بالفعل للوحة "${occupiedMap.get(targetIdNum)}". يرجى اختيار رقم فارغ أو رقم تسلسلي جديد.`);
      return;
    }

    // Direct check in DB to prevent duplicate key error
    try {
      const { data: collision } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name')
        .eq('ID', targetIdNum)
        .maybeSingle();

      if (collision) {
        toast.error(`رقم اللوحة (${targetIdNum}) مسجل مسبقاً للوحة "${collision.Billboard_Name}". يرجى اختيار رقم آخر.`);
        return;
      }
    } catch (colErr) {
      console.warn('Collision check warning:', colErr);
    }

    setAdding(true);
    const { ID, Billboard_Name, City, Municipality, District, Nearest_Landmark, GPS_Coordinates, Faces_Count, Size, Level, Image_URL, image_name, billboard_type, is_partnership, partner_companies, capital, capital_remaining } = addForm as any;
    
    // Add new items if they don't exist
    await addMunicipalityIfNew(Municipality, municipalities, setMunicipalities, setDbMunicipalities);
    await addSizeIfNew(Size, Level, sizes, setSizes, setDbSizes);
    await addLevelIfNew(Level, levels, setLevels);
    await addBillboardTypeIfNew(billboard_type, billboardTypes, setBillboardTypes);
    
    // Ensure image_name is always set
    let finalImageName = image_name;
    if (!finalImageName && Billboard_Name) {
      finalImageName = generateImageName(Billboard_Name);
    }
    
    let finalImageUrl = Image_URL;
    // Upload image if a file was selected
    if (selectedFile) {
      const { uploadImageWithFallback } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();
      const finalName = finalImageName || `${(Billboard_Name || 'billboard').replace(/\s+/g, '-')}-${Date.now()}.jpg`;
      progress.start(finalName, Math.round(selectedFile.size / 1024));
      
      let pct = 5;
      const interval = setInterval(() => {
        if (pct < 85) pct += 5;
        progress.update(pct);
      }, 200);

      try {
        finalImageUrl = await uploadImageWithFallback(selectedFile, finalName, 'billboard-photos');
        clearInterval(interval);
        progress.update(100);
        progress.complete(true, 'تم رفع الصورة وإضافة اللوحة بنجاح');
        setSelectedFile(null);
      } catch (uploadErr: any) {
        clearInterval(interval);
        console.error('Add billboard upload failed:', uploadErr);
        progress.complete(false, uploadErr.message || 'فشل رفع الصورة عند الإضافة');
        setAdding(false);
        return;
      }
    }
    
    // ✅ Resolve size_id from database (sizes table), with robust fallbacks
    let sizeId: number | null = null;
    if (Size) {
      try {
        const raw = String(Size).trim();
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[×\*]/g, 'x');
        const norm = normalize(raw);
        const m = norm.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
        const variants = new Set<string>([norm, raw]);
        if (m) {
          const a = m[1];
          const b = m[2];
          variants.add(`${a}x${b}`);
          variants.add(`${b}x${a}`);
          variants.add(`${a}*${b}`);
          variants.add(`${b}*${a}`);
        }

        // 1) Try sizes table by exact/variant name
        const { data: sizesByName, error: sizesByNameErr } = await supabase
          .from('sizes')
          .select('id, name')
          .in('name', Array.from(variants));

        if (!sizesByNameErr && sizesByName && sizesByName.length > 0) {
          sizeId = Number(sizesByName[0].id);
          console.log('✅ size_id resolved from sizes.name:', { sizeId, matched: sizesByName[0].name });
        }

        // 2) If still null and we have numbers, try width/height match (both orientations)
        if (!sizeId && m) {
          const a = Number(m[1]);
          const b = Number(m[2]);
          const { data: sizesByDim } = await supabase
            .from('sizes')
            .select('id, name, width, height')
            .or(`and(width.eq.${a},height.eq.${b}),and(width.eq.${b},height.eq.${a})`);
          if (sizesByDim && sizesByDim.length > 0) {
            sizeId = Number(sizesByDim[0].id);
            console.log('✅ size_id resolved from sizes dimensions:', { sizeId, match: sizesByDim[0] });
          }
        }

        // 3) Fallback: try installation_print_pricing.size -> size_id
        if (!sizeId) {
          const { data: pricingByName } = await supabase
            .from('installation_print_pricing')
            .select('size_id, size')
            .in('size', Array.from(variants));
          const rowWithId = pricingByName?.find((r: any) => r.size_id);
          if (rowWithId) {
            sizeId = Number(rowWithId.size_id);
            console.log('✅ size_id resolved from installation_print_pricing:', rowWithId);
          }
        }

        // 4) Last resort: look at existing billboards with same Size text
        if (!sizeId) {
          const { data: bbMatch } = await supabase
            .from('billboards')
            .select('size_id')
            .eq('Size', raw)
            .not('size_id', 'is', null)
            .limit(1);
          if (bbMatch && bbMatch.length > 0) {
            sizeId = Number(bbMatch[0].size_id);
            console.log('✅ size_id copied from existing billboard record:', sizeId);
          }
        }

        if (!sizeId) {
          console.warn('⚠️ size_id could not be resolved for Size:', raw);
        }
      } catch (e) {
        console.error('❌ Exception resolving size_id:', e);
      }
    }

    const payload: any = {
      ID: Number(ID),
      Billboard_Name,
      ...(addForm.print_size?.trim() ? { print_size: addForm.print_size.trim() } : {}),
      City,
      Municipality,
      District,
      Nearest_Landmark,
      GPS_Coordinates: GPS_Coordinates || null,
      Faces_Count: Faces_Count ? parseInt(String(Faces_Count)) : null,
      Size,
 size_id: sizeId, // سيتم حفظه بشكل صحيح
      Level,
      Image_URL: finalImageUrl,
      image_name: finalImageName,
      billboard_type,
      Status: 'متاح',
      is_partnership: !!is_partnership,
      partner_companies: Array.isArray(partner_companies) ? partner_companies : String(partner_companies).split(',').map(s=>s.trim()).filter(Boolean),
      capital: Number(capital)||0,
      capital_remaining: Number(capital_remaining)||Number(capital)||0,
      own_company_id: (addForm as any).own_company_id || null
    };

    console.log('🔧 Add billboard payload with size_id:', {
      ...payload,
 size_id_check: sizeId ? ' موجود' : ' غير موجود'
    });
    
    try {
      const { error } = await supabase.from('billboards').insert(payload).select().single();
      if (error) throw error;
      toast.success('تم إضافة اللوحة مع حفظ اسم الصورة');
      await loadBillboards({ silent: true });
      setAddOpen(false);
      setImagePreview('');
      setSelectedFile(null);
      // ✅ NEW: Reset district input
      setDistrictInput('');
    } catch (e: any) {
      console.error('❌ Add billboard error:', e);
      toast.error(e?.message || 'فشل الإضافة');
    } finally {
      setAdding(false);
    }
  };

  // Update image name when billboard name changes
  useEffect(() => {
    if (addForm.Billboard_Name && selectedFile && addForm.image_name && !addForm.image_name.includes(addForm.Billboard_Name)) {
      const imageName = generateImageName(addForm.Billboard_Name);
      setAddForm((prev: any) => ({ ...prev, image_name: imageName, Image_URL: `/image/${imageName}` }));
    }
  }, [addForm.Billboard_Name, selectedFile]);

  // ✅ NEW: Sync district input with form
  useEffect(() => {
    if (addForm.District !== districtInput) {
      setDistrictInput(addForm.District || '');
    }
  }, [addForm.District]);

  // ✅ Clean up pointer-events on body when dialog is closed to prevent UI freeze
  useEffect(() => {
    if (!addOpen) {
      const t = setTimeout(() => {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
        document.body.style.removeProperty('overflow');
      }, 250);
      return () => clearTimeout(t);
    }
  }, [addOpen]);

  return (
    <Dialog open={addOpen} onOpenChange={setAddOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            إضافة لوحة جديدة
          </DialogTitle>
          <DialogDescription className="sr-only">نموذج إضافة لوحة إعلانية جديدة</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4 px-1">
          
          {/* القسم 1: المعلومات الأساسية */}
          <fieldset className="rounded-xl border border-border p-4 space-y-4">
            <legend className="text-sm font-semibold text-primary px-2 flex items-center gap-1.5"><ClipboardList className="h-4 w-4" /> المعلومات الأساسية</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-start">
              {/* رقم اللوحة مع ميزة اختيار الأرقام الفارغة من السابق */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5 text-primary" />
                    رقم اللوحة *
                  </Label>
                  {/* Status Badge */}
                  {isCurrentIdOccupied ? (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-tajawal">
                      <AlertCircle className="h-2.5 w-2.5" />
                      مستخدم
                    </Badge>
                  ) : isCurrentIdGap ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-tajawal">
                      <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                      شاغر سابق
                    </Badge>
                  ) : isCurrentIdSequential ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 bg-primary/10 text-primary border-primary/20 font-tajawal">
                      تسلسلي جديد
                    </Badge>
                  ) : !isIdEmptyOrInvalid ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-tajawal">
                      <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                      متاح
                    </Badge>
                  ) : null}
                </div>

                <div className="flex gap-1 items-center">
                  <Input 
                    type="number" 
                    value={addForm.ID ?? ''} 
                    onChange={(e) => updateBillboardId(e.target.value)}
                    className={cn(
                      "text-sm h-9 flex-1 font-mono transition-colors",
                      isCurrentIdOccupied && "border-destructive focus-visible:ring-destructive text-destructive font-bold bg-destructive/5",
                      isCurrentIdGap && "border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold bg-amber-500/5"
                    )}
                    placeholder={nextSequentialId ? String(nextSequentialId) : "رقم اللوحة"} 
                  />

                  {/* Popover for selecting empty numbers */}
                  <Popover open={isGapPopoverOpen} onOpenChange={setIsGapPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={cn(
                          "h-9 w-9 shrink-0 cursor-pointer transition-all duration-200",
                          emptyNumbers.length > 0
                            ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title={emptyNumbers.length > 0 ? `الأرقام الفارغة (${emptyNumbers.length} متوفر)` : "الأرقام الفارغة من السابق"}
                      >
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 sm:w-96 p-3 bg-card border-border shadow-xl z-50">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">الأرقام الفارغة السابقة</h4>
                              <p className="text-[11px] text-muted-foreground">
                                {emptyNumbers.length > 0 
                                  ? `${emptyNumbers.length} رقم شاغر متاح لإعادة الاستخدام`
                                  : 'لا توجد أرقام فارغة سابقة في النظام'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Quick action buttons */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {emptyNumbers.length > 0 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSelectGapId(emptyNumbers[0])}
                              className="h-8 text-xs font-semibold gap-1.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                              <span>أول فارغ (#{emptyNumbers[0]})</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleSelectSequentialId}
                            className={cn(
                              "h-8 text-xs font-semibold gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground",
                              emptyNumbers.length === 0 && "col-span-2"
                            )}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>التسلسلي (#{nextSequentialId})</span>
                          </Button>
                        </div>

                        {/* Search if more than 8 gaps */}
                        {emptyNumbers.length > 8 && (
                          <div className="relative">
                            <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              value={gapSearchQuery}
                              onChange={(e) => setGapSearchQuery(e.target.value)}
                              placeholder="بحث عن رقم محدد..."
                              className="h-8 pr-8 text-xs font-mono"
                            />
                          </div>
                        )}

                        {/* Numbers Grid */}
                        {emptyNumbers.length > 0 ? (
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                              <span>قائمة الأرقام الشاغرة:</span>
                              {gapSearchQuery && (
                                <span>{filteredEmptyNumbers.length} نتيجة</span>
                              )}
                            </div>
                            <div className="max-h-40 overflow-y-auto pr-1">
                              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                                {filteredEmptyNumbers.map((num) => {
                                  const isSelected = Number(addForm.ID) === num;
                                  return (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => handleSelectGapId(num)}
                                      className={cn(
                                        "h-8 rounded-md text-xs font-mono font-bold flex items-center justify-center transition-all duration-200 cursor-pointer border",
                                        isSelected
                                          ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                                          : "bg-muted/40 hover:bg-amber-500/20 hover:border-amber-500/40 text-foreground border-border"
                                      )}
                                    >
                                      #{num}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            جميع الأرقام السابقة من 1 إلى {maxExistingId} مستخدمة.
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Sub-label quick suggestion or warning */}
                {isCurrentIdOccupied ? (
                  <p className="text-[11px] text-destructive flex items-center gap-1 font-medium leading-tight mt-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>مستخدم بالفعل: {occupiedBillboardName}</span>
                  </p>
                ) : emptyNumbers.length > 0 ? (
                  !isCurrentIdGap ? (
                    <button
                      type="button"
                      onClick={() => handleSelectGapId(emptyNumbers[0])}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 font-medium mt-1 transition-colors"
                    >
                      <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />
                      <span>اختر أول فارغ: #{emptyNumbers[0]} (متوفر {emptyNumbers.length})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSelectSequentialId}
                      className="text-[11px] text-primary hover:underline cursor-pointer flex items-center gap-1 font-medium mt-1 transition-colors"
                    >
                      <RotateCcw className="h-3 w-3 shrink-0" />
                      <span>التبديل للتسلسلي الجديد: #{nextSequentialId}</span>
                    </button>
                  )
                ) : null}
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">اسم اللوحة (تلقائي)</Label>
                <Input 
                  value={addForm.Billboard_Name || ''} 
                  onChange={(e) => setAddForm((p: any) => ({ ...p, Billboard_Name: e.target.value }))}
                  className="bg-muted/50 text-sm font-mono text-foreground h-9"
                  placeholder="تلقائي" 
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">نوع اللوحة</Label>
                <div className="flex gap-1 items-center">
                  <Select 
                    value={addForm.billboard_type || ''} 
                    onValueChange={(v) => setAddForm((p: any) => ({ ...p, billboard_type: v }))}
                  >
                    <SelectTrigger className="text-sm h-9 flex-1">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      {billboardTypes.filter(type => type && String(type).trim()).map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 cursor-pointer hover:text-primary hover:border-primary transition-all duration-200"
                    onClick={() => setTypeQuickAddOpen(true)}
                    title="إضافة نوع جديد"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </fieldset>

          {/* القسم 2: الموقع */}
          <fieldset className="rounded-xl border border-border p-4 space-y-4">
            <legend className="text-sm font-semibold text-primary px-2 flex items-center gap-1.5"><MapPin className="h-4 w-4" /> الموقع</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">المدينة</Label>
                <div className="flex gap-1 items-center">
                  <Select value={addForm.City || ''} onValueChange={(v) => setAddForm((p: any) => ({ ...p, City: v }))}>
                    <SelectTrigger className="text-sm h-9 flex-1">
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesList.filter(c => c && String(c).trim()).map((c) => (
                        <SelectItem key={c} value={c as string}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 cursor-pointer hover:text-primary hover:border-primary transition-all duration-200"
                    onClick={() => setCityQuickAddOpen(true)}
                    title="إضافة مدينة جديدة"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">البلدية *</Label>
                <div className="flex gap-1 items-center">
                  <Select value={addForm.Municipality || ''} onValueChange={(v) => setAddForm((p: any) => ({ ...p, Municipality: v }))}>
                    <SelectTrigger className="text-sm h-9 flex-1">
                      <SelectValue placeholder="اختر البلدية" />
                    </SelectTrigger>
                    <SelectContent>
                      {municipalities.filter(m => m && m.id && m.name && String(m.name).trim()).map((m) => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 cursor-pointer hover:text-primary hover:border-primary transition-all duration-200"
                    onClick={() => setMunQuickAddOpen(true)}
                    title="إضافة بلدية جديدة"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Label className="text-xs text-muted-foreground">المنطقة</Label>
                <Input 
                  className="text-sm h-9" 
                  value={districtInput} 
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  onFocus={() => setShowDistrictSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDistrictSuggestions(false), 200)}
                  placeholder="اكتب المنطقة" 
                />
                {showDistrictSuggestions && filteredDistricts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredDistricts.map((district, index) => (
                      <div
                        key={index}
                        className="px-3 py-1.5 text-xs cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => handleDistrictSelect(district)}
                      >
                        {district}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">أقرب معلم</Label>
                <Input 
                  className="text-sm h-9" 
                  value={addForm.Nearest_Landmark || ''} 
                  onChange={(e) => setAddForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} 
                  placeholder="مثال: بجانب مسجد..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">الإحداثيات</Label>
                <Input 
                  className="text-sm h-9 font-mono" 
                  value={addForm.GPS_Coordinates || ''} 
                  onChange={(e) => setAddForm((p: any) => ({ ...p, GPS_Coordinates: e.target.value }))} 
                  placeholder="lat, lng" 
                  dir="ltr"
                />
              </div>
            </div>
          </fieldset>

          {/* القسم 3: المواصفات */}
          <fieldset className="rounded-xl border border-border p-4 space-y-4">
            <legend className="text-sm font-semibold text-primary px-2 flex items-center gap-1.5"><Ruler className="h-4 w-4" /> المواصفات الفنية</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">المقاس *</Label>
                <div className="flex gap-1 items-center">
                  <Select 
                    value={addForm.Size || ''} 
                    onValueChange={(v) => setAddForm((p: any) => ({ ...p, Size: v }))}
                  >
                    <SelectTrigger className="text-sm h-9 flex-1">
                      <SelectValue placeholder="المقاس" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.filter(s => s && s.id && s.name && String(s.name).trim()).map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 cursor-pointer hover:text-primary hover:border-primary transition-all duration-200"
                    onClick={() => setSizeQuickAddOpen(true)}
                    title="إضافة مقاس جديد"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">المستوى *</Label>
                <div className="flex gap-1 items-center">
                  <Select 
                    value={addForm.Level || ''} 
                    onValueChange={(v) => setAddForm((p: any) => ({ ...p, Level: v }))}
                  >
                    <SelectTrigger className="text-sm h-9 flex-1">
                      <SelectValue placeholder="المستوى" />
                    </SelectTrigger>
                    <SelectContent>
                      {levels.filter(lv => lv && String(lv).trim()).map((lv) => (
                        <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 cursor-pointer hover:text-primary hover:border-primary transition-all duration-200"
                    onClick={() => setLevelQuickAddOpen(true)}
                    title="إضافة مستوى جديد"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="addForm-print-size" className="text-xs text-muted-foreground">مقاس الطباعة (متر)</Label>
                <Input id="addForm-print-size" dir="ltr" value={addForm.print_size || ''} onChange={e => setAddForm((p: any) => ({ ...p, print_size: e.target.value }))} maxLength={100} placeholder={sizes.find(s => s.name === addForm.Size)?.print_size || 'مثال: 4.20 × 3.20'} />
                <p className="text-[11px] text-muted-foreground mt-1">اختياري؛ يُستخدم مقاس الطباعة من إعدادات المقاس عند تركه فارغًا.</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">عدد الأوجه</Label>
                <div className="flex gap-1 items-center">
                  <Select value={String(addForm.Faces_Count || '')} onValueChange={(v) => setAddForm((p: any) => ({ ...p, Faces_Count: v }))}>
                    <SelectTrigger className="text-sm h-9 flex-1">
                      <SelectValue placeholder="الأوجه" />
                    </SelectTrigger>
                    <SelectContent>
                      {faces.filter(face => face && face.id && (face.count != null || face.face_count != null)).map((face) => {
                        const faceCount = face.count || face.face_count;
                        return (
                          <SelectItem key={face.id} value={String(faceCount)}>
                            {face.name} ({faceCount})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 cursor-pointer hover:text-primary hover:border-primary transition-all duration-200"
                    onClick={() => setFaceQuickAddOpen(true)}
                    title="إضافة خيار أوجه جديد"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </fieldset>

          {/* القسم 4: الصورة */}
          <fieldset className="rounded-xl border border-border p-4 space-y-3" onPaste={handleBillboardImagePaste} tabIndex={0}>
            <legend className="text-sm font-semibold text-primary px-2 flex items-center gap-1.5"><ImageIcon className="h-4 w-4" /> صورة اللوحة</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">رفع صورة أو لصق (Ctrl+V)</Label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="billboard-image-file"
                    onChange={handleImageSelect}
                    disabled={uploadingImage || imgbbUploading}
                  />
                  <div
                    onClick={() => !(uploadingImage || imgbbUploading) && document.getElementById('billboard-image-file')?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleImgbbUpload(file);
                    }}
                    className="flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    {imgbbUploading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary mb-1" />
                        <span className="text-xs text-muted-foreground">جاري الرفع...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">اسحب أو انقر أو الصق</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">أو رابط خارجي للصورة</Label>
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={addForm.Image_URL || ''}
                    onChange={(e) => { setAddForm((p: any) => ({ ...p, Image_URL: e.target.value })); if (e.target.value) setImagePreview(e.target.value); }}
                    className="text-sm h-9 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="flex items-center justify-center">
                {(imagePreview || addForm.Image_URL) ? (
                  <div className="w-full h-32 bg-muted rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview || addForm.Image_URL} alt="معاينة" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }} />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-muted/30 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">معاينة الصورة</span>
                  </div>
                )}
              </div>
            </div>
          </fieldset>

          {/* القسم 5: الشراكة (اختياري) */}
          <fieldset className="rounded-xl border border-border p-4 space-y-3">
            <legend className="text-sm font-semibold text-primary px-2 flex items-center gap-1.5"><Handshake className="h-4 w-4" /> الشراكة</legend>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-foreground">لوحة شراكة</Label>
              <input 
                type="checkbox" 
                checked={!!addForm.is_partnership} 
                onChange={(e)=> setAddForm((p:any)=>({...p, is_partnership: e.target.checked}))} 
                className="accent-primary"
              />
            </div>

            {addForm.is_partnership && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">الشركات المشاركة</Label>
                  <MultiSelect
                    options={partnersOptions}
                    value={Array.isArray(addForm.partner_companies) ? addForm.partner_companies : (String(addForm.partner_companies||'').split(',').map(s=>s.trim()).filter(Boolean))}
                    onChange={(vals)=> setAddForm((p:any)=>({...p, partner_companies: vals}))}
                    placeholder={partnersOptions.length ? 'اختر شركات' : 'لا توجد شركات'}
                    emptyText="لا توجد شركات"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">رأس المال</Label>
                  <Input 
                    className="text-sm h-9" 
                    type="number" 
                    value={addForm.capital || 0} 
                    onChange={(e)=> setAddForm((p:any)=>({...p, capital: Number(e.target.value)}))} 
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* القسم 6: الشركة المالكة */}
          <fieldset className="rounded-xl border border-border p-4 space-y-3">
            <legend className="text-sm font-semibold text-primary px-2 flex items-center gap-1.5"><Building className="h-4 w-4" /> الشركة المالكة</legend>
            <Select
              value={(addForm as any).own_company_id || 'none'}
              onValueChange={(v) => setAddForm((p: any) => ({ ...p, own_company_id: v === 'none' ? null : v }))}
            >
              <SelectTrigger className="text-sm bg-background border-border text-foreground h-9">
                <SelectValue placeholder="اختر الشركة المالكة" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="none">بدون تحديد</SelectItem>
                {ownCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* معاينة الاسم المقترح */}
          {addForm.Municipality && addForm.Level && addForm.Size && (
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-xs text-primary/70">الاسم المقترح للوحة</Label>
                <div className="text-primary font-mono text-lg font-bold">{addForm.Billboard_Name}</div>
              </div>
            </div>
          )}
        </div>

        {/* أزرار الحفظ */}
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <Button variant="outline" onClick={() => {
            setAddOpen(false);
            setImagePreview('');
            setSelectedFile(null);
            setDistrictInput('');
          }}>
            إلغاء
          </Button>
          <Button onClick={addBillboard} disabled={adding || uploadingImage || imgbbUploading} className="min-w-[120px]">
            {adding ? 'جاري الإضافة...' : (uploadingImage || imgbbUploading) ? 'رفع الصورة...' : <><CheckCircle2 className="h-4 w-4 ml-1" /> إضافة اللوحة</>}
          </Button>
        </div>
        {/* Quick Add Dialogs */}
        <QuickAddSizeDialog
          open={sizeQuickAddOpen}
          onOpenChange={setSizeQuickAddOpen}
          onSuccess={(val) => setAddForm((prev: any) => ({ ...prev, Size: val }))}
          onRefresh={loadSizes || (() => Promise.resolve())}
        />
        <QuickAddMunicipalityDialog
          open={munQuickAddOpen}
          onOpenChange={setMunQuickAddOpen}
          onSuccess={(val) => setAddForm((prev: any) => ({ ...prev, Municipality: val }))}
          onRefresh={loadMunicipalities || (() => Promise.resolve())}
        />
        <QuickAddCityDialog
          open={cityQuickAddOpen}
          onOpenChange={setCityQuickAddOpen}
          onSuccess={(val) => setAddForm((prev: any) => ({ ...prev, City: val }))}
          onRefresh={loadCities || (() => Promise.resolve())}
        />
        <QuickAddTypeDialog
          open={typeQuickAddOpen}
          onOpenChange={setTypeQuickAddOpen}
          onSuccess={(val) => setAddForm((prev: any) => ({ ...prev, billboard_type: val }))}
          onRefresh={loadBillboardTypes || (() => Promise.resolve())}
        />
        <QuickAddLevelDialog
          open={levelQuickAddOpen}
          onOpenChange={setLevelQuickAddOpen}
          onSuccess={(val) => setAddForm((prev: any) => ({ ...prev, Level: val }))}
          onRefresh={loadLevels || (() => Promise.resolve())}
        />
        <QuickAddFaceDialog
          open={faceQuickAddOpen}
          onOpenChange={setFaceQuickAddOpen}
          onSuccess={(val) => setAddForm((prev: any) => ({ ...prev, Faces_Count: val }))}
          onRefresh={loadFaces || (() => Promise.resolve())}
        />
      </DialogContent>
    </Dialog>
  );
};
