import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, CheckCircle2, XCircle, AlertTriangle, Link2, ArrowLeftRight } from 'lucide-react';
import { type TaskImportPreview, type ColumnMappingEntry, reprocessWithMapping } from '@/utils/taskImagesExcel';

interface Props {
  preview: TaskImportPreview | null;
  importing: boolean;
  onClose: () => void;
  onExecute: () => void;
  onPreviewUpdate: (updated: TaskImportPreview) => void;
}

export default function TaskImportPreviewDialog({ preview, importing, onClose, onExecute, onPreviewUpdate }: Props) {
  const [activeTab, setActiveTab] = useState('overview');

  const allUpdates = useMemo(() => {
    if (!preview) return [];
    return [
      ...preview.designUpdates.map(d => ({ type: 'تصميم', id: d.designId, field: d.field, url: d.url })),
      ...preview.itemUpdates.map(i => ({ type: 'عنصر', id: i.itemId, field: i.field, url: i.url })),
      ...preview.contractDesignUpdates.map(c => ({ type: 'عقد', id: `${c.contractId}#${c.designIndex}`, field: c.field, url: c.url })),
    ];
  }, [preview]);

  const handleMappingChange = (expectedCol: string, newMappedCol: string) => {
    if (!preview) return;
    const newMapping: ColumnMappingEntry[] = preview.columnMapping.map(col =>
      col.expectedCol === expectedCol
        ? { ...col, mappedCol: newMappedCol === '__none__' ? null : newMappedCol }
        : col
    );
    const updated = reprocessWithMapping(preview, newMapping);
    onPreviewUpdate(updated);
  };

  if (!preview) return null;

  const totalContractDesigns = preview.contractDesignUpdates?.length || 0;

  return (
    <Dialog open={preview !== null} onOpenChange={() => !importing && onClose()}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0" dir="rtl">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/50 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            مراجعة الاستيراد
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Stats bar */}
          <div className="px-6 py-3 bg-muted/30 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center justify-between">
 <span className="text-sm font-medium truncate"> {preview.fileName}</span>
              {preview.isValidFormat ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">
                  <CheckCircle2 className="h-3 w-3 ml-1" /> ملف نظام
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 ml-1" /> ملف خارجي
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-sm">
              <StatChip label="الصفوف" value={preview.totalRows} />
              <StatChip label="صالحة" value={preview.validRows} color="text-emerald-600" />
              <StatChip label="تصاميم" value={preview.designUpdates.length} />
              <StatChip label="عناصر" value={preview.itemUpdates.length} />
              {totalContractDesigns > 0 && (
                <StatChip label="تصاميم عقود" value={totalContractDesigns} color="text-blue-600" />
              )}
            </div>
          </div>

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div className="px-6 py-2 bg-destructive/5 border-b border-destructive/20 flex-shrink-0">
              {preview.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive py-0.5">
                  <XCircle className="h-3 w-3 flex-shrink-0" /> {err}
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mx-6 mt-3 mb-0 flex-shrink-0 w-fit">
              <TabsTrigger value="overview" className="text-xs gap-1">
                <ArrowLeftRight className="h-3 w-3" /> ربط الأعمدة
              </TabsTrigger>
              <TabsTrigger value="data" className="text-xs gap-1">
                <Link2 className="h-3 w-3" /> التحديثات ({preview.validRows})
              </TabsTrigger>
              <TabsTrigger value="raw" className="text-xs gap-1">
                البيانات الخام ({preview.totalRows})
              </TabsTrigger>
            </TabsList>

            {/* Column Mapping Tab */}
            <TabsContent value="overview" className="flex-1 overflow-hidden m-0 px-6 py-3">
              <ScrollArea className="h-full">
                <div className="space-y-2 pb-4">
                  <p className="text-sm text-muted-foreground mb-3">
                    اختر العمود المناسب من الملف لكل حقل مطلوب. يمكنك تغيير الربط لإصلاح المطابقة.
                  </p>
                  {preview.columnMapping.map((col, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {col.required && <span className="text-destructive text-xs font-bold">*</span>}
                          <span className="text-sm font-medium">{col.expectedCol}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select
                          value={col.mappedCol || '__none__'}
                          onValueChange={(val) => handleMappingChange(col.expectedCol, val)}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="__none__">
                              <span className="text-muted-foreground">— غير محدد —</span>
                            </SelectItem>
                            {preview.fileHeaders.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {col.mappedCol ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Updates Tab */}
            <TabsContent value="data" className="flex-1 overflow-hidden m-0 px-6 py-3">
              <ScrollArea className="h-full">
                {allUpdates.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    لا توجد تحديثات صالحة
                  </div>
                ) : (
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-right font-medium w-8">#</th>
                          <th className="px-3 py-2 text-right font-medium">النوع</th>
                          <th className="px-3 py-2 text-right font-medium">المعرف</th>
                          <th className="px-3 py-2 text-right font-medium">الحقل</th>
                          <th className="px-3 py-2 text-right font-medium">الرابط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allUpdates.map((u, i) => (
                          <tr key={i} className="border-t border-border/20 hover:bg-muted/20">
                            <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-1.5">
                              <Badge variant="outline" className="text-[10px]">{u.type}</Badge>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-[10px] max-w-[120px] truncate">{u.id}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{u.field}</td>
                            <td className="px-3 py-1.5 max-w-[200px] truncate text-primary/70">
                              <a href={u.url} target="_blank" rel="noreferrer" className="hover:underline">{u.url}</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Raw Data Tab */}
            <TabsContent value="raw" className="flex-1 overflow-hidden m-0 px-6 py-3">
              <ScrollArea className="h-full">
                <div className="border border-border/50 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-right font-medium w-8">#</th>
                          {preview.fileHeaders.map((h, i) => (
                            <th key={i} className="px-2 py-2 text-right font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rawRows.map((row, ri) => (
                          <tr key={ri} className="border-t border-border/20 hover:bg-muted/20">
                            <td className="px-2 py-1 text-muted-foreground">{ri + 1}</td>
                            {preview.fileHeaders.map((h, ci) => (
                              <td key={ci} className="px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[180px] truncate">
                                {String(row[h] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 flex-shrink-0 gap-2">
          <Button variant="outline" onClick={onClose} disabled={importing}>
            إلغاء
          </Button>
          <Button
            onClick={onExecute}
            disabled={importing || !preview.validRows}
            className="gap-1.5"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            تنفيذ الاستيراد ({preview.validRows} تحديث)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span className={`flex items-center gap-1 ${color || ''}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}
