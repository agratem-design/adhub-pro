import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, Crosshair, MapPin, Navigation, Hash, Landmark, Globe, X, Loader2, Compass } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Billboard } from '@/types';
import { parseCoords } from '@/utils/parseCoords';

export interface SearchSuggestion {
  type: 'billboard' | 'landmark' | 'district' | 'coordinates' | 'place';
  label: string;
  sublabel?: string;
  billboard?: Billboard;
  coords?: { lat: number; lng: number };
  score?: number;
}

/**
 * دالة توحيد وتنسيق النصوص العربية للتغاضي عن الأخطاء الإملائية والتشكيل
 */
export function normalizeArabicText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    // إزالة التشكيل والحركات
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // توحيد الهمزات والألف
    .replace(/[أإآٱ]/g, 'ا')
    // توحيد التاء المربوطة والهاء
    .replace(/ة/g, 'ه')
    // توحيد الياء والألف المقصورة
    .replace(/[ىئ]/g, 'ي')
    // توحيد الواو الملموزة
    .replace(/ؤ/g, 'و')
    // إزالة الرموز الزائدة وتوحيد المسافات
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * خوارزمية حساب نسبة التشابه الضبابي بين كلمتين (Fuzzy Score)
 */
function getFuzzyScore(query: string, text: string): number {
  if (!query || !text) return 0;
  const normQ = normalizeArabicText(query);
  const normT = normalizeArabicText(text);

  if (!normQ || !normT) return 0;
  if (normT === normQ) return 100;
  if (normT.includes(normQ)) return 90;

  // إزالة "ال" التعريف للمقارنة المرنة (مثلاً: الشايب <-> شايب)
  const stripAL = (s: string) => s.replace(/\bال/g, '');
  const normQNoAL = stripAL(normQ);
  const normTNoAL = stripAL(normT);

  if (normTNoAL.includes(normQNoAL)) return 85;

  // مطابقة أجزاء الكلمات (Token Matching)
  const qTokens = normQNoAL.split(' ').filter(Boolean);
  const tTokens = normTNoAL.split(' ').filter(Boolean);

  let matchedTokens = 0;
  for (const qTok of qTokens) {
    if (qTok.length < 2) continue;
    const match = tTokens.some(tTok => tTok.includes(qTok) || qTok.includes(tTok) || levenshteinDistance(qTok, tTok) <= 1);
    if (match) matchedTokens++;
  }

  if (matchedTokens > 0) {
    const ratio = matchedTokens / qTokens.length;
    return Math.round(ratio * 80);
  }

  return 0;
}

/**
 * خوارزمية Levenshtein لحساب الفارق بين النصوص القصيرة
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyC7PTwYyPrIHL9njC3l-2PfpoTuN0-NTu4';
let searchGoogleCooldownUntil = 0;

/**
 * Search Google Places API (New: v1/places:searchText) for live verified Google Maps landmarks & places in Libya
 */
const searchGooglePlaces = async (query: string): Promise<SearchSuggestion[]> => {
  if (!query || query.trim().length < 2 || !GOOGLE_API_KEY) return [];
  if (Date.now() < searchGoogleCooldownUntil) return [];

  const cleanQ = query.trim();
  const searchQ = cleanQ.includes('ليبيا') ? cleanQ : `${cleanQ} ليبيا`;

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location'
      },
      body: JSON.stringify({
        textQuery: searchQ,
        languageCode: 'ar',
        regionCode: 'ly'
      })
    }).catch(() => null);

    if (!res) return [];
    if (res.status === 429 || res.status === 403) {
      searchGoogleCooldownUntil = Date.now() + 30 * 60 * 1000;
      return [];
    }
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.places || !Array.isArray(data.places)) return [];

    const results: SearchSuggestion[] = [];
    const addedLabels = new Set<string>();

    for (const place of data.places) {
      const title = place.displayName?.text || cleanQ;
      const addr = place.formattedAddress || 'معلم تجاري مسجل بـ Google Maps';

      if (!addedLabels.has(title)) {
        addedLabels.add(title);
        results.push({
          type: 'place',
          label: title,
          sublabel: addr,
          coords: {
            lat: place.location?.latitude || 32.8872,
            lng: place.location?.longitude || 13.1913
          },
          score: 98
        });
      }
    }

    return results;
  } catch {
    return [];
  }
};

// Nominatim geocoding search with debounce & Libya priority
const searchNominatim = async (query: string): Promise<SearchSuggestion[]> => {
  if (!query || query.trim().length < 2) return [];
  const cleanQ = query.trim();

  try {
    // المحاولة الأولى: بحث مباشر مع تحديد ليبيا والدول العربية
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQ)}&format=json&limit=6&accept-language=ar&countrycodes=ly,sa,eg,ae,tn,dz,ma&addressdetails=1`;
    let res = await fetch(url, { signal: AbortSignal.timeout(3500) }).catch(() => null);
    let data = (res && res.ok) ? await res.json().catch(() => []) : [];

    // إذا لم يجد أي نتائج وكانت كلمة البحث قصيرة أو بدون تحديد دولة، نجرب إضافة "ليبيا" تلقائياً
    if ((!data || data.length === 0) && !cleanQ.includes('ليبيا')) {
      const lyUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQ + ' ليبيا')}&format=json&limit=5&accept-language=ar`;
      const lyRes = await fetch(lyUrl, { signal: AbortSignal.timeout(3500) }).catch(() => null);
      if (lyRes && lyRes.ok) {
        data = await lyRes.json().catch(() => []);
      }
    }

    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      const displayParts = (item.display_name || '').split(',').map((s: string) => s.trim());
      const title = displayParts.slice(0, 2).join(' - ') || cleanQ;
      const subtitle = displayParts.slice(2, 5).join('، ') || 'موقع جغرافي / شارع على الخريطة';

      return {
        type: 'place' as const,
        label: title,
        sublabel: subtitle,
        coords: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
        score: 95
      };
    });
  } catch {
    return [];
  }
};

interface MapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onRequestLocation?: () => void;
  billboards?: Billboard[];
  onSelectBillboard?: (billboard: Billboard) => void;
  onNavigateToCoords?: (lat: number, lng: number) => void;
  placeholder?: string;
  className?: string;
}

const MapSearchBar = memo(function MapSearchBar({
  value,
  onChange,
  onRequestLocation,
  billboards = [],
  onSelectBillboard,
  onNavigateToCoords,
  placeholder = 'ابحث عن لوحة، شارع، معلم، منطقة (مثل: شارع الشائب)...',
  className = ''
}: MapSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= 2) {
      setIsSearchingPlaces(true);
      debounceRef.current = setTimeout(async () => {
        const [googlePlaces, nominatimPlaces] = await Promise.all([
          searchGooglePlaces(val),
          searchNominatim(val)
        ]);

        const combined = [...googlePlaces, ...nominatimPlaces];
        const unique = combined.filter((v, i, a) => a.findIndex(t => t.label === v.label) === i);

        setPlaceSuggestions(unique);
        setIsSearchingPlaces(false);
      }, 350);
    } else {
      setPlaceSuggestions([]);
      setIsSearchingPlaces(false);
    }
  }, [onChange]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // إغلاق المنسدلة عند النقر خارجها
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // نتائج البحث المحلية للوحات والمعالم والمدن مع دعم البحث الذكي Fuzzy Search
  const localSuggestions = useMemo((): SearchSuggestion[] => {
    const q = value.trim();
    if (!q || q.length < 1) return [];
    const results: SearchSuggestion[] = [];
    const seen = new Set<string>();

    // 1. فحص ما إذا كان المدخل إحداثيات جغرافية
    const coordObj = parseCoords({ GPS_Coordinates: q });
    if (coordObj) {
      results.push({
        type: 'coordinates',
        label: `التوجه إلى الإحداثي الجغرافي`,
        sublabel: `${coordObj.lat.toFixed(5)}, ${coordObj.lng.toFixed(5)}`,
        coords: coordObj,
        score: 100
      });
    }

    // 2. البحث الذكي في اللوحات (حسب الاسم، المعرف، التسلسل، العقد)
    const scoredBillboards: { suggestion: SearchSuggestion; score: number }[] = [];

    billboards.forEach(b => {
      const name = String((b as any).Billboard_Name || b.name || '');
      const id = String((b as any).ID || b.id || '');
      const seq = String((b as any).sequence_number || '');
      const contract = String((b as any).Contract_Number || (b as any).contract_number || '');
      const landmark = String((b as any).Nearest_Landmark || (b as any)['Nearest Landmark'] || '');
      const customer = String((b as any).Customer_Name || (b as any).customer_name || '');
      const city = String((b as any).City || b.city || '');
      const size = String((b as any).Size || b.size || '');

      const nameScore = getFuzzyScore(q, name);
      const landmarkScore = getFuzzyScore(q, landmark);
      const customerScore = getFuzzyScore(q, customer);
      const idMatch = id === q ? 100 : (id.includes(q) ? 90 : 0);
      const seqMatch = seq === q ? 100 : (seq.includes(q) ? 90 : 0);
      const contractMatch = contract && contract !== '0' && (contract === q ? 100 : contract.includes(q) ? 85 : 0);

      const maxScore = Math.max(nameScore, landmarkScore, customerScore, idMatch, seqMatch, contractMatch);

      if (maxScore > 35) {
        const key = `bb-${id}`;
        if (!seen.has(key)) {
          seen.add(key);
          const coords = parseCoords(b);
          scoredBillboards.push({
            score: maxScore,
            suggestion: {
              type: 'billboard',
              label: name || `لوحة #${id}`,
              sublabel: `${city} • ${size} • ${landmark ? `قرب ${landmark}` : `#${id}`}`,
              billboard: b,
              coords: coords || undefined,
              score: maxScore
            }
          });
        }
      }
    });

    // ترتيب نتائج اللوحات حسب الأعلى تطابقاً
    scoredBillboards.sort((a, b) => b.score - a.score);
    scoredBillboards.slice(0, 8).forEach(item => results.push(item.suggestion));

    // 3. البحث في المعالم والشهيرة والمدن والأحياء
    const districtSet = new Set<string>();
    billboards.forEach(b => {
      if (results.length >= 12) return;
      const district = String((b as any).District || '').trim();
      const municipality = String((b as any).Municipality || '').trim();
      const city = String((b as any).City || '').trim();

      [district, municipality, city].forEach(area => {
        if (!area || districtSet.has(area)) return;
        const score = getFuzzyScore(q, area);
        if (score > 40) {
          districtSet.add(area);
          const count = billboards.filter(bb => 
            String((bb as any).District || '').trim() === area || 
            String((bb as any).Municipality || '').trim() === area ||
            String((bb as any).City || '').trim() === area
          ).length;
          results.push({
            type: 'district',
            label: area,
            sublabel: `منطقة / بلدية تحتوي على ${count} لوحة إعلانية`,
            score
          });
        }
      });
    });

    return results;
  }, [value, billboards]);

  // دمج نتائج البحث الجغرافي للشوارع والأماكن مع نتائج اللوحات المحلية
  const suggestionsGrouped = useMemo(() => {
    const places = placeSuggestions;
    const billboardsList = localSuggestions.filter(s => s.type === 'billboard');
    const districtsList = localSuggestions.filter(s => s.type === 'district');
    const coordsList = localSuggestions.filter(s => s.type === 'coordinates');

    return {
      places,
      billboards: billboardsList,
      districts: districtsList,
      coords: coordsList,
      totalCount: places.length + billboardsList.length + districtsList.length + coordsList.length
    };
  }, [localSuggestions, placeSuggestions]);

  const handleSelect = useCallback((suggestion: SearchSuggestion) => {
    setShowDropdown(false);
    
    if ((suggestion.type === 'coordinates' || suggestion.type === 'place') && suggestion.coords && onNavigateToCoords) {
      onNavigateToCoords(suggestion.coords.lat, suggestion.coords.lng);
      onChange('');
    } else if (suggestion.type === 'billboard' && suggestion.billboard) {
      if (onSelectBillboard) {
        onSelectBillboard(suggestion.billboard);
      } else if (suggestion.coords && onNavigateToCoords) {
        onNavigateToCoords(suggestion.coords.lat, suggestion.coords.lng);
      }
      onChange('');
    } else if (suggestion.type === 'landmark' && suggestion.billboard && onSelectBillboard) {
      onSelectBillboard(suggestion.billboard);
      onChange('');
    } else if (suggestion.type === 'district') {
      // حساب المركز الجغرافي للوحات في هذه المنطقة
      const districtBillboards = billboards.filter(b => 
        String((b as any).District || '').trim() === String(suggestion.label).trim() || 
        String((b as any).Municipality || '').trim() === String(suggestion.label).trim() ||
        String((b as any).City || '').trim() === String(suggestion.label).trim()
      );
      if (districtBillboards.length > 0) {
        let latSum = 0;
        let lngSum = 0;
        let count = 0;
        districtBillboards.forEach(b => {
          const coords = parseCoords(b);
          if (coords) {
            latSum += coords.lat;
            lngSum += coords.lng;
            count++;
          }
        });
        if (count > 0 && onNavigateToCoords) {
          onNavigateToCoords(latSum / count, lngSum / count);
        }
      }
      onChange('');
    }
  }, [onNavigateToCoords, onSelectBillboard, onChange, billboards]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'billboard': return <MapPin className="w-4 h-4 text-amber-400" />;
      case 'landmark': return <Landmark className="w-4 h-4 text-amber-400" />;
      case 'district': return <Hash className="w-4 h-4 text-emerald-400" />;
      case 'coordinates': return <Navigation className="w-4 h-4 text-blue-400" />;
      case 'place': return <Globe className="w-4 h-4 text-violet-400" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'billboard': return 'لوحة';
      case 'landmark': return 'معلم';
      case 'district': return 'منطقة';
      case 'coordinates': return 'إحداثي';
      case 'place': return 'شارع/موقع';
      default: return '';
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="flex items-center gap-2">
        {onRequestLocation && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onRequestLocation}
            className="w-10 h-10 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-amber-500/30 text-slate-200 hover:text-amber-400 hover:border-amber-500/60 hover:shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all shadow-xl backdrop-blur-xl flex-shrink-0 cursor-pointer"
            title="تحديد موقعي الحالي على الخريطة"
          >
            <Crosshair className="w-5 h-5 text-amber-500 animate-pulse" />
          </Button>
        )}

        <div className={`relative flex-1 transition-all duration-300 ${isFocused ? 'scale-[1.005]' : ''}`}>
          <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/90 backdrop-blur-xl border transition-all shadow-xl ${
            isFocused 
              ? 'border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)] bg-slate-950' 
              : 'border-amber-500/30 hover:border-amber-500/50'
          }`}>
            <Search className="w-4 h-4 text-amber-500 flex-shrink-0" />
            
            <Input
              type="text"
              value={value}
              onChange={handleChange}
              onFocus={() => { setIsFocused(true); setShowDropdown(true); }}
              placeholder={placeholder}
              className="border-0 bg-transparent p-0 h-8 text-slate-100 placeholder:text-slate-400/60 focus-visible:ring-0 focus-visible:ring-offset-0 text-right font-bold text-xs"
              dir="rtl"
            />

            {isSearchingPlaces && (
              <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin flex-shrink-0" />
            )}

            {value && (
              <button
                onClick={() => { onChange(''); setPlaceSuggestions([]); }}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* قائمة اقتراحات البحث المنسدلة الذكية */}
      {showDropdown && suggestionsGrouped.totalCount > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950/95 backdrop-blur-2xl border border-amber-500/30 rounded-2xl shadow-2xl z-[2500] max-h-96 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
          
          {/* قسم الأماكن والشوارع من الخريطة (Geocoding) */}
          {suggestionsGrouped.places.length > 0 && (
            <div className="border-b border-white/5 last:border-0">
              <div className="px-3.5 py-1.5 bg-amber-500/10 text-[#f4c25a] font-extrabold text-[10px] flex items-center gap-1.5 border-b border-amber-500/15">
                <Globe className="w-3 h-3 text-amber-400" />
                <span>مواقف وشوارع على الخريطة (Search Map Places)</span>
              </div>
              {suggestionsGrouped.places.map((s, i) => (
                <button
                  key={`place-${i}`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-amber-500/15 hover:text-white transition-all text-right border-b border-white/5 last:border-0 group cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                    <Compass className="w-3.5 h-3.5 text-amber-400 group-hover:text-slate-950" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-300">{s.label}</p>
                    {s.sublabel && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.sublabel}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md flex-shrink-0 border border-amber-500/20">
                    انتقال للموقع
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* قسم اللوحات الإعلانية المطابقة */}
          {suggestionsGrouped.billboards.length > 0 && (
            <div className="border-b border-white/5 last:border-0">
              <div className="px-3.5 py-1.5 bg-slate-900/90 text-amber-400 font-extrabold text-[10px] flex items-center gap-1.5 border-b border-white/5">
                <MapPin className="w-3 h-3 text-amber-400" />
                <span>اللوحات الإعلانية المطابقة ({suggestionsGrouped.billboards.length})</span>
              </div>
              {suggestionsGrouped.billboards.map((s, i) => (
                <button
                  key={`bb-${i}`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-amber-500/10 hover:text-amber-300 transition-all text-right border-b border-white/5 last:border-0 group cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-amber-500/50">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-bold text-slate-100 truncate group-hover:text-amber-300">{s.label}</p>
                    {s.sublabel && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.sublabel}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-extrabold text-slate-300 bg-white/5 px-2 py-0.5 rounded-md flex-shrink-0 border border-white/10">
                    لوحة
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* قسم المناطق والبلديات والمعالم */}
          {suggestionsGrouped.districts.length > 0 && (
            <div className="border-b border-white/5 last:border-0">
              <div className="px-3.5 py-1.5 bg-slate-900/90 text-emerald-400 font-extrabold text-[10px] flex items-center gap-1.5 border-b border-white/5">
                <Landmark className="w-3 h-3 text-emerald-400" />
                <span>المناطق والبلديات</span>
              </div>
              {suggestionsGrouped.districts.map((s, i) => (
                <button
                  key={`dist-${i}`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all text-right border-b border-white/5 last:border-0 group cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-bold text-slate-100 truncate group-hover:text-emerald-300">{s.label}</p>
                    {s.sublabel && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.sublabel}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex-shrink-0 border border-emerald-500/20">
                    منطقة
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* قسم الإحداثيات */}
          {suggestionsGrouped.coords.length > 0 && (
            <div>
              {suggestionsGrouped.coords.map((s, i) => (
                <button
                  key={`coord-${i}`}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 hover:bg-blue-500/10 hover:text-blue-300 transition-all text-right border-b border-white/5 last:border-0 group cursor-pointer"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Navigation className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className="text-xs font-bold text-slate-100 truncate group-hover:text-blue-300">{s.label}</p>
                    {s.sublabel && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.sublabel}</p>
                    )}
                  </div>
                  <span className="text-[9px] font-extrabold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md flex-shrink-0 border border-blue-500/20">
                    إحداثيات
                  </span>
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
});

export default MapSearchBar;
