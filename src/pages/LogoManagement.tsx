import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Download, Upload, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string | null;
  company_type: string | null;
}

const getContrastColor = (hex: string) => {
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#ffffff';
  } catch { return '#ffffff'; }
};

const LogoManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('friend_companies')
      .select('id, name, logo_url, brand_color, company_type')
      .order('company_type')
      .order('name');
    if (!error) setCompanies(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleExport = () => {
    const rows = companies.map(c => ({
      'اسم الشركة': c.name,
      'نوع الشركة': c.company_type === 'own' ? 'شركاتنا' : 'صديقة',
      'رابط الشعار': c.logo_url || '',
      'لون العلامة': c.brand_color || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الشعارات');
    XLSX.writeFile(wb, 'company_logos.xlsx');
    toast.success('تم تصدير الملف');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      let updated = 0;
      for (const row of rows) {
        const name = String(row['اسم الشركة'] || '').trim();
        const logoUrl = String(row['رابط الشعار'] || '').trim();
        const brandColor = String(row['لون العلامة'] || '').trim();
        if (!name) continue;

        const updatePayload: any = {};
        if (logoUrl) updatePayload.logo_url = logoUrl;
        if (brandColor) updatePayload.brand_color = brandColor;
        if (Object.keys(updatePayload).length === 0) continue;

        const { error } = await supabase
          .from('friend_companies')
          .update(updatePayload)
          .eq('name', name);
        if (!error) updated++;
      }
      toast.success(`تم تحديث ${updated} شركة`);
      loadCompanies();
    } catch (err: any) {
      toast.error('خطأ في الاستيراد: ' + (err.message || ''));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-primary" />
            إدارة الشعارات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">عرض وتصدير واستيراد شعارات الشركات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            تصدير Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => document.getElementById('logo-import')?.click()}
            disabled={importing}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'جاري الاستيراد...' : 'استيراد Excel'}
          </Button>
          <input
            id="logo-import"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">جميع الشركات ({companies.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-right font-medium text-muted-foreground">الشعار</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">اسم الشركة</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">النوع</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">لون العلامة</th>
                    <th className="p-3 text-right font-medium text-muted-foreground">رابط الشعار</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt={c.name} className="w-10 h-10 rounded-md object-contain bg-white border border-border p-0.5" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border border-border">
                            <Building className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-medium text-foreground">{c.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {c.company_type === 'own' ? 'شركاتنا' : 'صديقة'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {c.brand_color ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded border border-border"
                              style={{ backgroundColor: c.brand_color }}
                            />
                            <span className="text-xs text-muted-foreground font-mono">{c.brand_color}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.logo_url ? (
                          <a
                            href={c.logo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            {c.logo_url.split('/').pop()}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">لا يوجد</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LogoManagement;
