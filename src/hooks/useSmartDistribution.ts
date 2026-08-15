import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  Municipality: string;
  City: string;
  GPS_Coordinates: string;
  [key: string]: any;
}

interface DistributionItem {
  id?: string;
  distribution_id?: string;
  billboard_id: number;
  partner: string; // '0', '1', '2', etc.
  site_group: string;
  size_group: string;
  municipality_group: string;
  is_random: boolean;
}

interface Distribution {
  id: string;
  name: string;
  size_filter: string;
  municipality_filter?: string;
  city_filter?: string;
  status_filter?: string;
  ad_type_filter?: string;
  distance_threshold: number;
  partner_a_name: string;
  partner_b_name: string;
  partner_names: string[];
  partner_counts: Record<string, number>;
  is_active: boolean;
  total_billboards: number;
  partner_a_count: number;
  partner_b_count: number;
  random_seed?: string;
  created_at: string;
  items?: DistributionItem[];
}

// Haversine distance in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseCoordinates(coords: string | null | undefined): { lat: number; lon: number } | null {
  if (!coords || coords === 'undefined' || coords === 'null') return null;
  const parts = coords.split(',').map(s => parseFloat(s.trim()));
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lon: parts[1] };
  }
  return null;
}

// Cluster billboards by proximity using union-find, with nearest-neighbor fallback
function clusterByProximity(billboards: Billboard[], threshold: number): Billboard[][] {
  const n = billboards.length;
  if (n === 0) return [];
  
  const parent = Array.from({ length: n }, (_, i) => i);
  
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number) { parent[find(a)] = find(b); }

  const coords = billboards.map(b => parseCoordinates(b.GPS_Coordinates));

  for (let i = 0; i < n; i++) {
    if (!coords[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (!coords[j]) continue;
      if (haversineDistance(coords[i]!.lat, coords[i]!.lon, coords[j]!.lat, coords[j]!.lon) <= threshold) {
        union(i, j);
      }
    }
  }

  // Merge isolated billboards with nearest
  const clusterSizes: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    const root = find(i);
    clusterSizes[root] = (clusterSizes[root] || 0) + 1;
  }

  for (let i = 0; i < n; i++) {
    if (clusterSizes[find(i)] > 1 || !coords[i]) continue;
    let nearestIdx = -1;
    let nearestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j || !coords[j]) continue;
      const d = haversineDistance(coords[i]!.lat, coords[i]!.lon, coords[j]!.lat, coords[j]!.lon);
      if (d < nearestDist) { nearestDist = d; nearestIdx = j; }
    }
    if (nearestIdx !== -1) {
      union(i, nearestIdx);
      const newRoot = find(i);
      clusterSizes[newRoot] = 0;
      for (let k = 0; k < n; k++) {
        if (find(k) === newRoot) clusterSizes[newRoot]++;
      }
    }
  }

  const groups: Record<number, Billboard[]> = {};
  for (let i = 0; i < n; i++) {
    const root = find(i);
    (groups[root] ||= []).push(billboards[i]);
  }
  return Object.values(groups);
}

// Seeded random for reproducibility
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

/**
 * Improved distribution algorithm:
 * 1. Group by Size first
 * 2. For each size, calculate target count per partner (total / numPartners)
 * 3. Group by Municipality → Proximity clusters
 * 4. Assign clusters to the partner with the most remaining quota
 * 5. Cross-municipality fallback: if a size has odd remainders, balance across municipalities
 */
export function generateDistribution(
  billboards: Billboard[],
  threshold: number,
  seed: string,
  numPartners: number = 2
): DistributionItem[] {
  const rng = seededRandom(seed);
  const items: DistributionItem[] = [];

  // Track total allocation per partner across all sizes for global balance
  const globalPartnerCounts = Array(numPartners).fill(0);

  // Step 1: Group by size
  const bySize: Record<string, Billboard[]> = {};
  for (const b of billboards) {
    const size = b.Size || 'unknown';
    (bySize[size] ||= []).push(b);
  }

  for (const [size, sizeBillboards] of Object.entries(bySize)) {
    const totalForSize = sizeBillboards.length;
    const targetPerPartner = Math.floor(totalForSize / numPartners);
    const remainder = totalForSize % numPartners;
    
    // Each partner's quota for this size
    const sizeQuota = Array(numPartners).fill(targetPerPartner);
    // Distribute remainder to partners with fewest global assignments
    const partnersByGlobalCount = Array.from({ length: numPartners }, (_, i) => i)
      .sort((a, b) => globalPartnerCounts[a] - globalPartnerCounts[b]);
    for (let r = 0; r < remainder; r++) {
      sizeQuota[partnersByGlobalCount[r]]++;
    }

    const sizeRemaining = [...sizeQuota];

    // Step 2: Group by municipality
    const byMunicipality: Record<string, Billboard[]> = {};
    for (const b of sizeBillboards) {
      const muni = b.Municipality || 'unknown';
      (byMunicipality[muni] ||= []).push(b);
    }

    // Collect all clusters across municipalities for this size
    const allClusters: { cluster: Billboard[]; municipality: string; siteIdx: number }[] = [];

    for (const [muni, muniBillboards] of Object.entries(byMunicipality)) {
      const sites = clusterByProximity(muniBillboards, threshold);
      // Shuffle clusters
      sites.sort(() => rng() - 0.5);
      sites.forEach((cluster, idx) => {
        // Shuffle within cluster
        cluster.sort(() => rng() - 0.5);
        allClusters.push({ cluster, municipality: muni, siteIdx: idx });
      });
    }

    // Sort clusters by size descending (assign larger clusters first for better balance)
    allClusters.sort((a, b) => b.cluster.length - a.cluster.length);

    // Assign each cluster to partners
    for (const { cluster, municipality, siteIdx } of allClusters) {
      const siteGroup = `${size}_${municipality}_site${siteIdx}`;
      
      // For each billboard in the cluster, assign to the partner with most remaining quota
      for (const billboard of cluster) {
        // Find partner with highest remaining quota
        let bestPartner = 0;
        let bestRemaining = sizeRemaining[0];
        for (let p = 1; p < numPartners; p++) {
          if (sizeRemaining[p] > bestRemaining) {
            bestRemaining = sizeRemaining[p];
            bestPartner = p;
          } else if (sizeRemaining[p] === bestRemaining && globalPartnerCounts[p] < globalPartnerCounts[bestPartner]) {
            bestPartner = p;
          }
        }

        items.push({
          billboard_id: billboard.ID,
          partner: String(bestPartner),
          site_group: siteGroup,
          size_group: size,
          municipality_group: municipality,
          is_random: bestRemaining <= 0,
        });

        sizeRemaining[bestPartner]--;
        globalPartnerCounts[bestPartner]++;
      }
    }
  }

  return items;
}

export function useSmartDistribution() {
  const [loading, setLoading] = useState(false);
  const [distributions, setDistributions] = useState<Distribution[]>([]);

  const fetchDistributions = useCallback(async (sizeFilter?: string) => {
    try {
      let query = supabase.from('distributions').select('*').order('created_at', { ascending: false });
      if (sizeFilter) query = query.eq('size_filter', sizeFilter);
      const { data, error } = await query;
      if (error) throw error;
      setDistributions((data as any[])?.map(d => ({
        ...d,
        partner_names: d.partner_names || [d.partner_a_name, d.partner_b_name],
        partner_counts: d.partner_counts || { '0': d.partner_a_count, '1': d.partner_b_count },
      })) || []);
    } catch (err) {
      console.error('Error fetching distributions:', err);
    }
  }, []);

  const fetchDistributionItems = useCallback(async (distributionId: string) => {
    const { data, error } = await supabase
      .from('distribution_items')
      .select('*')
      .eq('distribution_id', distributionId);
    if (error) throw error;
    return (data as any[]) || [];
  }, []);

  const generateAndSave = useCallback(async (
    billboards: Billboard[],
    filters: { municipality: string; city: string; size: string; status: string; adType: string },
    threshold: number,
    partnerNames: string[]
  ) => {
    setLoading(true);
    try {
      if (billboards.length === 0) {
        toast.error('لا توجد لوحات لتوزيعها');
        return null;
      }
      if (partnerNames.length < 2) {
        toast.error('يجب إضافة شريكين على الأقل');
        return null;
      }

      const seed = `dist_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const items = generateDistribution(billboards, threshold, seed, partnerNames.length);
      
      const partnerCounts: Record<string, number> = {};
      partnerNames.forEach((_, idx) => {
        partnerCounts[String(idx)] = items.filter(i => i.partner === String(idx)).length;
      });

      // Deactivate previous active distributions for this size
      if (filters.size !== 'all') {
        await supabase
          .from('distributions')
          .update({ is_active: false })
          .eq('size_filter', filters.size)
          .eq('is_active', true);
      }

      const { data: dist, error: distError } = await supabase
        .from('distributions')
        .insert({
          name: `توزيع ${filters.size !== 'all' ? filters.size : 'الكل'} - ${new Date().toLocaleDateString('ar-LY')}`,
          size_filter: filters.size || 'all',
          municipality_filter: filters.municipality || 'all',
          city_filter: filters.city || 'all',
          status_filter: filters.status || 'all',
          ad_type_filter: filters.adType || 'all',
          distance_threshold: threshold,
          partner_a_name: partnerNames[0] || 'الشريك أ',
          partner_b_name: partnerNames[1] || 'الشريك ب',
          partner_names: partnerNames,
          partner_counts: partnerCounts,
          is_active: true,
          total_billboards: items.length,
          partner_a_count: partnerCounts['0'] || 0,
          partner_b_count: partnerCounts['1'] || 0,
          random_seed: seed,
        })
        .select()
        .single();

      if (distError) throw distError;

      const itemsToInsert = items.map(item => ({
        distribution_id: dist.id,
        billboard_id: item.billboard_id,
        partner: item.partner,
        site_group: item.site_group,
        size_group: item.size_group,
        municipality_group: item.municipality_group,
        is_random: item.is_random,
      }));

      const { error: itemsError } = await supabase
        .from('distribution_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      const summary = partnerNames.map((name, idx) => `${name} (${partnerCounts[String(idx)]})`).join(' - ');
      toast.success(`تم التوزيع: ${summary}`);
      await fetchDistributions(filters.size !== 'all' ? filters.size : undefined);
      return dist;
    } catch (err) {
      console.error('Distribution error:', err);
      toast.error('فشل في إنشاء التوزيع');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchDistributions]);

  const setActive = useCallback(async (distributionId: string, sizeFilter: string) => {
    try {
      await supabase
        .from('distributions')
        .update({ is_active: false })
        .eq('size_filter', sizeFilter);
      
      await supabase
        .from('distributions')
        .update({ is_active: true })
        .eq('id', distributionId);

      toast.success('تم تفعيل التوزيع');
      await fetchDistributions(sizeFilter !== 'all' ? sizeFilter : undefined);
    } catch (err) {
      toast.error('فشل في تفعيل التوزيع');
    }
  }, [fetchDistributions]);

  const swapBillboards = useCallback(async (
    distributionId: string,
    billboardAId: number,
    billboardBId: number
  ) => {
    try {
      const { data: items, error } = await supabase
        .from('distribution_items')
        .select('*')
        .eq('distribution_id', distributionId)
        .in('billboard_id', [billboardAId, billboardBId]);

      if (error || !items || items.length !== 2) {
        toast.error('لم يتم العثور على اللوحتين');
        return false;
      }

      const itemA = items.find((i: any) => i.billboard_id === billboardAId);
      const itemB = items.find((i: any) => i.billboard_id === billboardBId);

      if (!itemA || !itemB || itemA.partner === itemB.partner) {
        toast.error('اللوحتان يجب أن تكونا من شريكين مختلفين');
        return false;
      }

      await supabase.from('distribution_items').update({ partner: itemB.partner, swap_count: (itemA.swap_count || 0) + 1 }).eq('id', itemA.id);
      await supabase.from('distribution_items').update({ partner: itemA.partner, swap_count: (itemB.swap_count || 0) + 1 }).eq('id', itemB.id);

      toast.success('تم تبديل اللوحتين بنجاح');
      return true;
    } catch (err) {
      toast.error('فشل في التبديل');
      return false;
    }
  }, []);

  const deleteDistribution = useCallback(async (id: string) => {
    try {
      await supabase.from('distributions').delete().eq('id', id);
      toast.success('تم حذف التوزيع');
    } catch (err) {
      toast.error('فشل في الحذف');
    }
  }, []);

  const removeItemsBySize = useCallback(async (distributionId: string, size: string) => {
    try {
      const { data: items } = await supabase
        .from('distribution_items')
        .select('id, billboard_id')
        .eq('distribution_id', distributionId)
        .eq('size_group', size);
      
      if (!items || items.length === 0) {
        toast.error('لا توجد لوحات بهذا المقاس');
        return false;
      }

      const { error } = await supabase
        .from('distribution_items')
        .delete()
        .eq('distribution_id', distributionId)
        .eq('size_group', size);
      
      if (error) throw error;

      const { data: remaining } = await supabase
        .from('distribution_items')
        .select('partner')
        .eq('distribution_id', distributionId);
      
      const counts: Record<string, number> = {};
      (remaining || []).forEach((r: any) => { counts[r.partner] = (counts[r.partner] || 0) + 1; });
      const total = (remaining || []).length;
      
      await supabase.from('distributions').update({
        total_billboards: total,
        partner_a_count: counts['0'] || counts['A'] || 0,
        partner_b_count: counts['1'] || counts['B'] || 0,
        partner_counts: counts,
      }).eq('id', distributionId);

      toast.success(`تم حذف ${items.length} لوحة بمقاس ${size}`);
      return true;
    } catch (err) {
      toast.error('فشل في حذف المقاس');
      return false;
    }
  }, []);

  const removeItemsByMunicipality = useCallback(async (distributionId: string, municipality: string) => {
    try {
      const { data: items } = await supabase
        .from('distribution_items')
        .select('id, billboard_id')
        .eq('distribution_id', distributionId)
        .eq('municipality_group', municipality);
      
      if (!items || items.length === 0) {
        toast.error('لا توجد لوحات بهذه البلدية');
        return false;
      }

      const { error } = await supabase
        .from('distribution_items')
        .delete()
        .eq('distribution_id', distributionId)
        .eq('municipality_group', municipality);
      
      if (error) throw error;

      const { data: remaining } = await supabase
        .from('distribution_items')
        .select('partner')
        .eq('distribution_id', distributionId);
      
      const counts: Record<string, number> = {};
      (remaining || []).forEach((r: any) => { counts[r.partner] = (counts[r.partner] || 0) + 1; });
      const total = (remaining || []).length;
      
      await supabase.from('distributions').update({
        total_billboards: total,
        partner_a_count: counts['0'] || counts['A'] || 0,
        partner_b_count: counts['1'] || counts['B'] || 0,
        partner_counts: counts,
      }).eq('id', distributionId);

      toast.success(`تم حذف ${items.length} لوحة من بلدية ${municipality}`);
      return true;
    } catch (err) {
      toast.error('فشل في حذف البلدية');
      return false;
    }
  }, []);

  const redistributeExisting = useCallback(async (distributionId: string, threshold: number, partnerNames?: string[]) => {
    try {
      setLoading(true);
      
      const { data: currentItems, error: fetchErr } = await supabase
        .from('distribution_items')
        .select('billboard_id')
        .eq('distribution_id', distributionId);
      
      if (fetchErr || !currentItems || currentItems.length === 0) {
        toast.error('لا توجد لوحات لإعادة التوزيع');
        return false;
      }

      const billboardIds = currentItems.map((i: any) => i.billboard_id);
      
      const { data: bbData } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);
      
      if (!bbData || bbData.length === 0) {
        toast.error('لم يتم العثور على بيانات اللوحات');
        return false;
      }

      const numPartners = partnerNames?.length || 2;
      const seed = `redist_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const newItems = generateDistribution(bbData as any, threshold, seed, numPartners);

      await supabase.from('distribution_items').delete().eq('distribution_id', distributionId);

      const itemsToInsert = newItems.map(item => ({
        distribution_id: distributionId,
        billboard_id: item.billboard_id,
        partner: item.partner,
        site_group: item.site_group,
        size_group: item.size_group,
        municipality_group: item.municipality_group,
        is_random: item.is_random,
      }));

      const { error: insertErr } = await supabase.from('distribution_items').insert(itemsToInsert);
      if (insertErr) throw insertErr;

      const counts: Record<string, number> = {};
      newItems.forEach(i => { counts[i.partner] = (counts[i.partner] || 0) + 1; });
      
      await supabase.from('distributions').update({
        total_billboards: newItems.length,
        partner_a_count: counts['0'] || 0,
        partner_b_count: counts['1'] || 0,
        partner_counts: counts,
        random_seed: seed,
        ...(partnerNames ? { partner_names: partnerNames } : {}),
      }).eq('id', distributionId);

      const summary = Object.entries(counts).map(([k, v]) => `${partnerNames?.[Number(k)] || `شريك ${Number(k) + 1}`}(${v})`).join(' - ');
      toast.success(`تمت إعادة التوزيع: ${summary}`);
      return true;
    } catch (err) {
      console.error('Redistribute error:', err);
      toast.error('فشل في إعادة التوزيع');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    distributions,
    fetchDistributions,
    fetchDistributionItems,
    generateAndSave,
    setActive,
    swapBillboards,
    deleteDistribution,
    removeItemsBySize,
    removeItemsByMunicipality,
    redistributeExisting,
  };
}
