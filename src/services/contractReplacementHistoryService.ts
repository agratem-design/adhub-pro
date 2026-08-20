import { supabase } from '@/integrations/supabase/client';

export interface BillboardReplacementHistoryItem {
  id: string;
  contractNumber: number;
  
  // Old Billboard
  oldBillboardId: string;
  oldBillboardName: string;
  oldBillboardSize?: string;
  oldBillboardCity?: string;
  oldBillboardLocation?: string;
  oldBillboardImage?: string;

  // New Billboard
  newBillboardId: string;
  newBillboardName: string;
  newBillboardSize?: string;
  newBillboardCity?: string;
  newBillboardLocation?: string;
  newBillboardImage?: string;

  replacedAt: string;
  source: 'legacy' | 'instant';
  notes?: string;
  preservedPrice?: number;
}

/**
 * Loads all replacement history records for a contract by aggregating:
 * 1. Legacy replacements from `paused_billboard_replacements` + `paused_billboards`
 * 2. Instant swaps from `activity_log` where `action = 'instant_billboard_swap'`
 */
export async function getContractReplacementHistory(
  contractNumber: number
): Promise<BillboardReplacementHistoryItem[]> {
  if (!contractNumber) return [];

  try {
    const [legacyReplsRes, instantLogsRes] = await Promise.all([
      supabase
        .from('paused_billboard_replacements' as any)
        .select('*')
        .eq('contract_number', contractNumber),
      supabase
        .from('activity_log')
        .select('*')
        .eq('action', 'instant_billboard_swap')
        .or(`contract_number.eq.${contractNumber},entity_id.eq.${contractNumber}`)
        .order('created_at', { ascending: false }),
    ]);

    const legacyRepls = legacyReplsRes.data || [];
    const instantLogs = instantLogsRes.data || [];

    // Collect all billboard IDs to fetch their details in bulk
    const billboardIdsToFetch = new Set<string>();

    // 1. Process Legacy Replacements
    const pausedIds = Array.from(
      new Set(legacyRepls.map((r: any) => r.paused_billboard_id).filter(Boolean))
    );

    let pausedRecordsMap = new Map<string, any>();
    if (pausedIds.length > 0) {
      const { data: pausedData } = await supabase
        .from('paused_billboards' as any)
        .select('*')
        .in('id', pausedIds as any);
      (pausedData || []).forEach((p: any) => {
        pausedRecordsMap.set(String(p.id), p);
        if (p.billboard_id) billboardIdsToFetch.add(String(p.billboard_id));
      });
    }

    legacyRepls.forEach((r: any) => {
      if (r.replacement_billboard_id) {
        billboardIdsToFetch.add(String(r.replacement_billboard_id));
      }
    });

    // 2. Process Instant Logs
    instantLogs.forEach((log: any) => {
      let details: any = {};
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
      } catch {
        details = {};
      }
      if (details.original_billboard_id) {
        billboardIdsToFetch.add(String(details.original_billboard_id));
      }
      if (details.replacement_billboard_id) {
        billboardIdsToFetch.add(String(details.replacement_billboard_id));
      }
    });

    // Fetch billboard details
    let billboardsMap = new Map<string, any>();
    if (billboardIdsToFetch.size > 0) {
      const { data: bbData } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, City, Nearest_Landmark, Image_URL, image_name')
        .in('ID', Array.from(billboardIdsToFetch) as any);
      (bbData || []).forEach((b: any) => {
        billboardsMap.set(String(b.ID), b);
      });
    }

    const items: BillboardReplacementHistoryItem[] = [];

    // Assemble Legacy Replacements
    legacyRepls.forEach((r: any) => {
      const paused = pausedRecordsMap.get(String(r.paused_billboard_id)) || {};
      const oldBb = billboardsMap.get(String(paused.billboard_id)) || {};
      const newBb = billboardsMap.get(String(r.replacement_billboard_id)) || {};

      items.push({
        id: `legacy-${r.id}`,
        contractNumber,
        oldBillboardId: String(paused.billboard_id || oldBb.ID || ''),
        oldBillboardName: oldBb.Billboard_Name || paused.billboard_name || `لوحة #${paused.billboard_id}`,
        oldBillboardSize: oldBb.Size,
        oldBillboardCity: oldBb.City,
        oldBillboardLocation: oldBb.Nearest_Landmark,
        oldBillboardImage: oldBb.Image_URL || oldBb.image_name,

        newBillboardId: String(r.replacement_billboard_id || newBb.ID || ''),
        newBillboardName: newBb.Billboard_Name || r.replacement_billboard_name || `لوحة #${r.replacement_billboard_id}`,
        newBillboardSize: newBb.Size,
        newBillboardCity: newBb.City,
        newBillboardLocation: newBb.Nearest_Landmark,
        newBillboardImage: newBb.Image_URL || newBb.image_name,

        replacedAt: r.created_at || paused.pause_date || '',
        source: 'legacy',
        notes: r.notes || paused.notes || undefined,
        preservedPrice: Number(r.allocated_amount) || undefined,
      });
    });

    // Assemble Instant Swaps with validation
    instantLogs.forEach((log: any) => {
      let details: any = {};
      try {
        details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
      } catch {
        details = {};
      }

      // Extract IDs resiliently
      const oldId = String(
        details.original_billboard_id ||
        details.old_billboard_id ||
        details.oldBillboardId ||
        details.originalBillboardId ||
        ''
      ).trim();

      const newId = String(
        details.replacement_billboard_id ||
        details.new_billboard_id ||
        details.newBillboardId ||
        details.replacementBillboardId ||
        ''
      ).trim();

      // Validate IDs: must exist and cannot be identical
      if (!oldId || !newId || oldId === newId) {
        return; // Ignore malformed log safely
      }

      const oldBb = billboardsMap.get(oldId) || {};
      const newBb = billboardsMap.get(newId) || {};

      items.push({
        id: `instant-${log.id}`,
        contractNumber,
        oldBillboardId: oldId,
        oldBillboardName: oldBb.Billboard_Name || details.original_billboard_name || `لوحة #${oldId}`,
        oldBillboardSize: oldBb.Size,
        oldBillboardCity: oldBb.City,
        oldBillboardLocation: oldBb.Nearest_Landmark,
        oldBillboardImage: oldBb.Image_URL || oldBb.image_name,

        newBillboardId: newId,
        newBillboardName: newBb.Billboard_Name || details.replacement_billboard_name || `لوحة #${newId}`,
        newBillboardSize: newBb.Size,
        newBillboardCity: newBb.City,
        newBillboardLocation: newBb.Nearest_Landmark,
        newBillboardImage: newBb.Image_URL || newBb.image_name,

        replacedAt: log.created_at || '',
        source: 'instant',
        notes: details.notes || undefined,
        preservedPrice: Number(details.preserved_contract_price) || undefined,
      });
    });

    // Deduplication: If the exact same (oldBillboardId -> newBillboardId) is represented
    // in both Legacy and Instant tables, keep only the canonical most recent one.
    const dedupedMap = new Map<string, BillboardReplacementHistoryItem>();
    items.forEach((item) => {
      const key = `${item.oldBillboardId}->${item.newBillboardId}`;
      const existing = dedupedMap.get(key);
      if (!existing) {
        dedupedMap.set(key, item);
      } else {
        // If an existing record is legacy and the new one is instant (or has a newer timestamp), prefer the newer one
        const existingTime = new Date(existing.replacedAt).getTime();
        const currentTime = new Date(item.replacedAt).getTime();
        if (currentTime >= existingTime) {
          dedupedMap.set(key, item);
        }
      }
    });

    const dedupedList = Array.from(dedupedMap.values());

    // Sort newest first with deterministic secondary sort by ID
    dedupedList.sort((a, b) => {
      const timeDiff = new Date(b.replacedAt).getTime() - new Date(a.replacedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return String(b.id).localeCompare(String(a.id));
    });

    return dedupedList;
  } catch (err) {
    console.error('Failed to get contract replacement history:', err);
    return [];
  }
}
