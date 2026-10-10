/**
 * ألوان حالات اللوحات الموحدة في كل النظام (الدبابيس، دليل الخريطة، الفلاتر، الكروت).
 */
export type BillboardStatusKey = 'available' | 'rented' | 'reserved' | 'maintenance' | 'removed';

export const STATUS_PALETTE: Record<BillboardStatusKey, { hex: string; label: string; chip: string; dot: string }> = {
  available:   { hex: '#16a34a', label: 'متاح',  chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  rented:      { hex: '#dc2626', label: 'مؤجر',  chip: 'bg-rose-500/15 text-rose-400 border-rose-500/30',         dot: 'bg-rose-500' },
  reserved:    { hex: '#d97706', label: 'محجوز', chip: 'bg-amber-500/15 text-amber-400 border-amber-500/30',      dot: 'bg-amber-500' },
  maintenance: { hex: '#64748b', label: 'صيانة', chip: 'bg-slate-500/20 text-slate-300 border-slate-500/40',      dot: 'bg-slate-500' },
  removed:     { hex: '#4b5563', label: 'إزالة', chip: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',         dot: 'bg-zinc-500' },
};

export function statusKeyFromLabel(label: string | null | undefined): BillboardStatusKey {
  const l = String(label || '').trim();
  if (l === 'متاحة' || l === 'متاح') return 'available';
  if (l === 'محجوزة' || l === 'محجوز' || l === 'قريباً') return 'reserved';
  if (l === 'صيانة' || l === 'تحتاج صيانة' || l === 'قيد الصيانة' || l === 'متضررة اللوحة' || l === 'خارج الخدمة') return 'maintenance';
  if (l === 'إزالة') return 'removed';
  return 'rented';
}
