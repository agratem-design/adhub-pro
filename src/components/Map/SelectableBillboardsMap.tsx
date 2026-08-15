import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Map as MapIcon, Globe, Filter, Check } from "lucide-react";
import type { Billboard } from "@/types";
import { MapSkeleton } from "@/components/Map/MapSkeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const GoogleMap = lazy(() => import("@/components/InteractiveMap"));
const OpenStreetMap = lazy(() => import("@/components/Map/OpenStreetBillboardsMap"));

type MapProvider = "google" | "osm";

interface SelectableBillboardsMapProps {
  billboards: Billboard[];
  onImageView?: (imageUrl: string) => void;
  className?: string;
  selectedBillboards?: Set<string>;
  onToggleSelection?: (billboardId: string) => void;
  onSelectMultiple?: (billboardIds: string[]) => void;
  showAvailableOnlyFilter?: boolean;
}

export default function SelectableBillboardsMap({ 
  billboards, 
  onImageView,
  className,
  selectedBillboards,
  onToggleSelection,
  onSelectMultiple,
  showAvailableOnlyFilter = false
}: SelectableBillboardsMapProps) {
  const [provider, setProvider] = useState<MapProvider>(() => {
    const saved = localStorage.getItem("selectable_map_provider");
    return saved === "osm" ? "osm" : "google";
  });

  const [ready, setReady] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  // societMode: 'hidden' (default — hide سوسيت), 'only' (show سوسيت only), 'with' (show سوسيت with all others)
  const [societMode, setSocietMode] = useState<'hidden' | 'only' | 'with'>('hidden');
  
  // Memoize selectedBillboards to avoid unnecessary re-renders
  const prevSelectedRef = useRef<Set<string>>(new Set());
  const stableSelectedBillboards = useMemo(() => {
    if (!selectedBillboards) return undefined;
    
    // Check if the set contents have changed
    const current = selectedBillboards;
    const prev = prevSelectedRef.current;
    
    if (current.size === prev.size && [...current].every(id => prev.has(id))) {
      return prev; // Return the same reference if contents are equal
    }
    
    prevSelectedRef.current = current;
    return current;
  }, [selectedBillboards]);

  useEffect(() => {
    localStorage.setItem("selectable_map_provider", provider);
    setReady(false);
  }, [provider]);

  // Filter billboards if showOnlyAvailable is true
  // ✅ إبقاء اللوحات المختارة ظاهرة حتى لو كانت غير متاحة
  const displayedBillboards = useMemo(() => {
    let filtered = billboards;
    
    // سوسيت filter:
    //  - hidden: exclude سوسيت
    //  - only:   show سوسيت only
    //  - with:   show all (سوسيت + باقي اللوحات)
    if (societMode === 'hidden') {
      filtered = filtered.filter(b => {
        const size = String((b as any).Size || (b as any).size || '').trim();
        return size !== 'سوسيت';
      });
    } else if (societMode === 'only') {
      filtered = filtered.filter(b => {
        const size = String((b as any).Size || (b as any).size || '').trim();
        return size === 'سوسيت';
      });
    }
    
    if (!showOnlyAvailable) return filtered;
    return filtered.filter(b => {
      const billboardId = String((b as any).ID || (b as any).id || '');
      if (selectedBillboards?.has(billboardId)) return true;
      const status = String((b as any).Status || (b as any).status || '').toLowerCase();
      return status === 'متاح' || status === 'available' || status === '';
    });
  }, [billboards, showOnlyAvailable, selectedBillboards, societMode]);

  // Count available and selected
  const availableCount = useMemo(() => {
    return billboards.filter(b => {
      const status = String((b as any).Status || (b as any).status || '').toLowerCase();
      return status === 'متاح' || status === 'available' || status === '';
    }).length;
  }, [billboards]);

  const selectedCount = selectedBillboards?.size || 0;

  return (
    <div className={"relative overflow-hidden rounded-lg border border-border h-[700px] " + (className ?? "")}
      dir="rtl"
    >
      {/* Top bar with filters */}
      <div className="absolute top-0 left-0 right-0 z-[1100] bg-background/95 backdrop-blur-sm border-b border-border p-2 flex flex-wrap items-center justify-between gap-2">
        {/* Left side - Provider toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={provider === "google" ? "default" : "outline"}
            onClick={() => startTransition(() => setProvider("google"))}
          >
            <MapIcon className="h-4 w-4 ml-1" />
            قوقل
          </Button>
          <Button
            size="sm"
            variant={provider === "osm" ? "default" : "outline"}
            onClick={() => startTransition(() => setProvider("osm"))}
          >
            <Globe className="h-4 w-4 ml-1" />
            OSM
          </Button>
          
          {/* Available only filter */}
          {showAvailableOnlyFilter && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5 border border-border">
              <Switch
                id="available-only-filter"
                checked={showOnlyAvailable}
                onCheckedChange={setShowOnlyAvailable}
              />
              <Label htmlFor="available-only-filter" className="text-sm font-medium cursor-pointer whitespace-nowrap">
                المتاحة فقط ({availableCount})
              </Label>
            </div>
          )}
          
          {/* سوسيت cycle button: مخفي → فقط → مع الكل → مخفي */}
          <Button
            size="sm"
            variant={societMode === 'hidden' ? 'outline' : 'default'}
            onClick={() => setSocietMode(
              societMode === 'hidden' ? 'only' : societMode === 'only' ? 'with' : 'hidden'
            )}
            className="whitespace-nowrap"
            title="اضغط للتبديل: مخفي / سوسيت فقط / سوسيت مع الكل"
          >
            {societMode === 'hidden' && 'سوسيت: مخفي'}
            {societMode === 'only' && 'سوسيت: فقط'}
            {societMode === 'with' && 'سوسيت: مع الكل'}
          </Button>
        </div>

        {/* Right side - Stats */}
        <div className="flex items-center gap-2 text-sm">
          <div className="bg-muted/50 rounded-md px-3 py-1.5 border border-border flex items-center gap-2">
            <span className="text-muted-foreground">المعروض:</span>
            <span className="font-bold">{displayedBillboards.length}</span>
          </div>
          {selectedCount > 0 && (
            <div className="bg-primary/10 text-primary rounded-md px-3 py-1.5 border border-primary/30 flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="font-bold">{selectedCount} محددة</span>
            </div>
          )}
        </div>
      </div>

      {/* Map content with fade-in - add padding top for the filter bar */}
      <div className="relative h-full pt-12">
        <div className={"transition-opacity duration-500 will-change-[opacity] h-full " + (ready ? "opacity-100" : "opacity-0")}
          aria-hidden={!ready}
        >
          <Suspense fallback={<MapSkeleton className="h-full" />}>
            {provider === "google" ? (
              <GoogleMap
                billboards={displayedBillboards}
                onImageView={onImageView || (() => {})}
                onReady={() => setReady(true)}
                selectedBillboards={stableSelectedBillboards}
                onToggleSelection={onToggleSelection}
                onSelectMultiple={onSelectMultiple}
              />
            ) : (
              <OpenStreetMap
                billboards={displayedBillboards}
                className="w-full h-full"
                onReady={() => setReady(true)}
                selectedBillboards={stableSelectedBillboards}
                onToggleSelection={onToggleSelection}
                onSelectMultiple={onSelectMultiple}
              />
            )}
          </Suspense>
        </div>

        {!ready && <MapSkeleton className="h-full absolute inset-0" />}
      </div>

      {/* Assistive label */}
      <div className="sr-only">مزوّد الخريطة الحالي: {provider === "google" ? "خرائط قوقل" : "OpenStreetMap"}</div>
    </div>
  );
}
