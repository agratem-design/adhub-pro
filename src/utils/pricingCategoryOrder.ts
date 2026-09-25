import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_PRIMARY_CUSTOMERS: string[] = ['شركات', 'عادي', 'مسوق'];
export const CATEGORY_ORDER_STORAGE_KEY = 'pricing_categories_order';

/**
 * Resolves the final ordered list of categories.
 * Ensures 'شركات' is first by default, preserves custom order, and appends any unranked categories.
 */
export function resolveOrderedCategories(
  allCategoryNames: string[],
  customOrder: string[] = []
): string[] {
  const uniqueKnown = Array.from(new Set(allCategoryNames.filter(Boolean)));

  if (!customOrder || customOrder.length === 0) {
    const primary = DEFAULT_PRIMARY_CUSTOMERS.filter(c => uniqueKnown.includes(c));
    const others = uniqueKnown.filter(c => !DEFAULT_PRIMARY_CUSTOMERS.includes(c)).sort();
    return [...primary, ...others];
  }

  // Ordered items that currently exist
  const ordered = customOrder.filter(c => uniqueKnown.includes(c));
  // Any categories not in the custom order list
  const unranked = uniqueKnown.filter(c => !ordered.includes(c));

  return [...ordered, ...unranked];
}

/**
 * Loads cached category order from localStorage
 */
export function loadCachedCategoryOrder(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CATEGORY_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string' && x.trim() !== '') : [];
  } catch {
    return [];
  }
}

/**
 * Persists category order to localStorage and system_settings in Supabase
 */
export async function persistCategoryOrder(order: string[]): Promise<boolean> {
  const cleanOrder = Array.from(new Set(order.filter(Boolean)));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CATEGORY_ORDER_STORAGE_KEY, JSON.stringify(cleanOrder));
    } catch (e) {
      console.warn('Failed to save category order to localStorage:', e);
    }
  }

  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        {
          setting_key: CATEGORY_ORDER_STORAGE_KEY,
          setting_value: JSON.stringify(cleanOrder),
        },
        { onConflict: 'setting_key' }
      );

    if (error) {
      console.warn('Failed to save category order to system_settings:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Exception saving category order to system_settings:', error);
    return false;
  }
}
