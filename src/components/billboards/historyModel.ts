export interface HistoryRecord {
  id: string;
  contract_number: number;
  customer_name: string;
  ad_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  rent_amount: number;
  discount_amount?: number;
  discount_percentage?: number;
  installation_date?: string;
  installation_cost?: number;
  billboard_rent_price?: number;
  total_before_discount?: number;
  design_face_a_url?: string;
  design_face_b_url?: string;
  design_name?: string;
  installed_image_face_a_url?: string;
  installed_image_face_b_url?: string;
  team_name?: string;
  notes?: string;
  created_at?: string;
  print_cost?: number;
  include_installation_in_price?: boolean;
  include_print_in_price?: boolean;
  pricing_category?: string;
  pricing_mode?: string;
  contract_total?: number;
  contract_total_rent?: number;
  contract_discount?: number;
  individual_billboard_data?: { type?: string; refundAmount?: number; pauseDate?: string; elapsedDays?: number; totalDays?: number; startDateReason?: string };
  net_rental_amount?: number;
  task_type?: string;
}

export function historyStatus(record: HistoryRecord, today = new Date().toLocaleDateString('en-CA')) {
  if (record.notes?.includes('إيقاف') || record.individual_billboard_data?.type === 'pause') return 'paused';
  if (record.start_date?.slice(0, 10) > today) return 'upcoming';
  if (String(record.id).startsWith('current-') && (!record.end_date || record.end_date.slice(0, 10) >= today)) return 'current';
  return 'completed';
}

export const statusLabels = { current: 'حالي', upcoming: 'قادم', paused: 'موقوف', completed: 'سابق' };
export function historyTotals(records: HistoryRecord[]) {
  return {
    count: records.length,
    revenue: records.reduce((sum, r) => sum + (Number(r.rent_amount) || 0), 0),
    days: records.reduce((sum, r) => sum + (Number(r.duration_days) || 0), 0),
  };
}

export function escapeHistoryHTML(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function historyImageURL(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? escapeHistoryHTML(url.href) : '';
  } catch { return ''; }
}
