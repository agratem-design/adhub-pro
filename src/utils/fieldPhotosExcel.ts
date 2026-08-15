import * as XLSX from 'xlsx';
import type { FieldPhoto } from '@/hooks/useFieldPhotos';

const COLUMNS = ['file_name', 'bucket_url', 'lat', 'lng', 'direction_degrees', 'captured_at', 'device_model', 'device_make', 'notes'];

export function exportFieldPhotosToExcel(photos: FieldPhoto[]): void {
  const rows = photos.map(p => ({
    file_name: p.file_name,
    bucket_url: p.bucket_url || '',
    lat: p.lat,
    lng: p.lng,
    direction_degrees: p.direction_degrees,
    captured_at: p.captured_at || '',
    device_model: p.device_model || '',
    device_make: p.device_make || '',
    notes: p.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Field Photos');
  XLSX.writeFile(wb, `field_photos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export interface FieldPhotoImportRow {
  file_name: string;
  bucket_url: string;
  lat: number | null;
  lng: number | null;
  direction_degrees: number | null;
  captured_at: string | null;
  device_model: string | null;
  device_make: string | null;
  notes: string | null;
}

export function parseFieldPhotosExcel(file: File): Promise<FieldPhotoImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<any>(ws);

        const rows: FieldPhotoImportRow[] = raw
          .filter((r: any) => r.file_name || r.bucket_url)
          .map((r: any) => ({
            file_name: String(r.file_name || '').trim(),
            bucket_url: String(r.bucket_url || '').trim(),
            lat: r.lat != null ? Number(r.lat) : null,
            lng: r.lng != null ? Number(r.lng) : null,
            direction_degrees: r.direction_degrees != null ? Number(r.direction_degrees) : null,
            captured_at: r.captured_at ? String(r.captured_at) : null,
            device_model: r.device_model ? String(r.device_model) : null,
            device_make: r.device_make ? String(r.device_make) : null,
            notes: r.notes ? String(r.notes) : null,
          }));

        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
