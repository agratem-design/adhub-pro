// @ts-nocheck
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MessageCircle, Save, Phone, MapPin, Users, ExternalLink, ChevronDown, ChevronLeft, CheckSquare, XSquare, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TaskDesign {
  id: string;
  task_id: string;
  design_name: string;
  design_face_a_url: string;
  design_face_b_url?: string;
  design_order: number;
}

interface ContractGroup {
  contractId: number | string;
  adType: string;
  designName: string;
  items: any[];
  byCity: Record<string, any[]>;
  total: number;
}

interface TeamData {
  teamName: string;
  phoneNumber: string;
  contracts: Record<string, ContractGroup>;
  total: number;
}

interface SendTeamInstallationReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: any[];
  allTaskItems: any[];
  billboardById: Record<number, any>;
  teamById: Record<string, any>;
  contractById: Record<number, any>;
  designsByTask: Record<string, TaskDesign[]>;
  teams: any[];
}

const openWhatsApp = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
};

/**
 * Generate an HTML report for a team's installation tasks, then convert to PDF blob
 */
const generateTeamPdfBlob = async (
  teamName: string,
  contractEntries: [string, ContractGroup][]
): Promise<Blob> => {
  let totalCount = 0;
  contractEntries.forEach(([, cg]) => { totalCount += cg.total; });

  const contractsHtml = contractEntries.map(([, cGroup]) => {
    const citiesHtml = Object.entries(cGroup.byCity).sort().map(([city, items]) => {
      const itemsHtml = items.map((item, i) => `
        <div style="padding: 2px 0; padding-right: 16px;">
          <span style="font-weight: 600;">${i + 1}. ${item.billboardName}</span>
          ${item.size ? `<span style="color: #6b7280; margin-right: 4px;">(${item.size})</span>` : ''}
          ${item.gpsLink ? `<br/><a href="${item.gpsLink}" style="color: #2563eb; font-size: 11px; text-decoration: underline;">الموقع على الخريطة</a>` : ''}
        </div>
      `).join('');

      return `
        <div style="border-right: 3px solid #3b82f6; padding-right: 12px; margin-bottom: 8px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
            المدينة: ${city} <span style="font-size: 11px; color: #6b7280;">(${items.length} لوحة)</span>
          </div>
          ${itemsHtml}
        </div>
      `;
    }).join('');

    return `
      <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; background: #f9fafb;">
        <div style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">
          عقد #${cGroup.contractId} - ${cGroup.adType}
        </div>
        <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">التصميم: ${cGroup.designName}</div>
        <div style="font-size: 11px; color: #374151; margin-bottom: 8px; font-weight: 600;">عدد اللوحات: ${cGroup.total}</div>
        ${citiesHtml}
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; font-size: 13px; color: #1f2937; padding: 24px; direction: rtl; }
        a { color: #2563eb; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 12px;">
        <h1 style="font-size: 20px; font-weight: 700; color: #1e3a5f;">مهام التركيب</h1>
        <h2 style="font-size: 16px; font-weight: 600; color: #3b82f6; margin-top: 4px;">فريق ${teamName}</h2>
        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
          إجمالي اللوحات: ${totalCount} | التاريخ: ${new Date().toLocaleDateString('ar-LY')}
        </div>
      </div>
      ${contractsHtml}
      <div style="text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
        تم إنشاء هذا التقرير آلياً
      </div>
    </body>
    </html>
  `;

  // Use html2pdf.js to convert to PDF
  const html2pdf = (await import('html2pdf.js')).default;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '794px'; // A4 width
  document.body.appendChild(container);

  try {
    const pdfBlob: Blob = await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: 'report.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .outputPdf('blob');
    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
};

export function SendTeamInstallationReportDialog({
  open, onOpenChange, tasks, allTaskItems, billboardById, teamById, contractById, designsByTask, teams
}: SendTeamInstallationReportDialogProps) {
  const [editingPhones, setEditingPhones] = useState<Record<string, string>>({});
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [openContracts, setOpenContracts] = useState<Set<string>>(new Set());
  const [sendingTeam, setSendingTeam] = useState<string | null>(null);

  // Group: team → contract → city → items
  const teamTasksData = useMemo(() => {
    const result: Record<string, TeamData> = {};

    const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');

    activeTasks.forEach(task => {
      const teamId = task.team_id;
      const team = teamById[teamId];
      if (!team) return;

      const taskItems = allTaskItems.filter(item => item.task_id === task.id && item.status !== 'completed');
      if (taskItems.length === 0) return;

      if (!result[teamId]) {
        result[teamId] = {
          teamName: team.team_name || 'غير محدد',
          phoneNumber: team.phone_number || '',
          contracts: {},
          total: 0,
        };
      }

      const contractId = task.contract_id || 'no-contract';
      const contract = contractById[task.contract_id];
      const designs = designsByTask[task.id] || [];
      const designName = designs.map(d => d.design_name).join(', ') || 'غير محدد';
      const adType = contract?.['Ad Type'] || 'غير محدد';

      const contractKey = String(contractId);

      if (!result[teamId].contracts[contractKey]) {
        result[teamId].contracts[contractKey] = {
          contractId,
          adType,
          designName,
          items: [],
          byCity: {},
          total: 0,
        };
      }

      taskItems.forEach(item => {
        const bb = billboardById[item.billboard_id];
        const city = bb?.City || 'غير محدد';

        const enrichedItem = {
          ...item,
          task,
          bb,
          city,
          designName,
          adType,
          gpsLink: (bb?.GPS_Link && !bb.GPS_Link.endsWith('q=0') && bb.GPS_Link !== '') 
            ? bb.GPS_Link 
            : (bb?.GPS_Coordinates && bb.GPS_Coordinates !== '0' && bb.GPS_Coordinates !== '') 
              ? `https://www.google.com/maps?q=${bb.GPS_Coordinates}` 
              : '',
          billboardName: bb?.Billboard_Name || `لوحة #${item.billboard_id}`,
          size: bb?.Size || '',
        };

        result[teamId].contracts[contractKey].items.push(enrichedItem);
        if (!result[teamId].contracts[contractKey].byCity[city]) {
          result[teamId].contracts[contractKey].byCity[city] = [];
        }
        result[teamId].contracts[contractKey].byCity[city].push(enrichedItem);
        result[teamId].contracts[contractKey].total++;
        result[teamId].total++;
      });
    });

    return result;
  }, [tasks, allTaskItems, billboardById, teamById, contractById, designsByTask]);

  // Select all contracts by default when data changes
  useEffect(() => {
    const allKeys = new Set<string>();
    Object.entries(teamTasksData).forEach(([teamId, data]) => {
      Object.keys(data.contracts).forEach(contractKey => {
        allKeys.add(`${teamId}-${contractKey}`);
      });
    });
    setSelectedContracts(allKeys);
  }, [teamTasksData]);

  const toggleContract = (teamId: string, contractKey: string) => {
    const key = `${teamId}-${contractKey}`;
    setSelectedContracts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleCollapsible = (key: string) => {
    setOpenContracts(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const selectAllForTeam = (teamId: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      Object.keys(teamTasksData[teamId]?.contracts || {}).forEach(ck => next.add(`${teamId}-${ck}`));
      return next;
    });
  };

  const deselectAllForTeam = (teamId: string) => {
    setSelectedContracts(prev => {
      const next = new Set(prev);
      Object.keys(teamTasksData[teamId]?.contracts || {}).forEach(ck => next.delete(`${teamId}-${ck}`));
      return next;
    });
  };

  const getSelectedCountForTeam = (teamId: string) => {
    const contracts = teamTasksData[teamId]?.contracts || {};
    return Object.keys(contracts).filter(ck => selectedContracts.has(`${teamId}-${ck}`)).length;
  };

  // Build text message (used as WhatsApp message body alongside the PDF link)
  const buildTeamMessage = (teamId: string) => {
    const data = teamTasksData[teamId];
    if (!data) return '';

    let msg = `*مهام التركيب - فريق ${data.teamName}*\n\n`;
    let totalCount = 0;

    const contractEntries = Object.entries(data.contracts)
      .filter(([ck]) => selectedContracts.has(`${teamId}-${ck}`));

    contractEntries.forEach(([_, cGroup], ci) => {
      msg += `━━━━━━━━━━━━━━━━━\n`;
      msg += `*عقد #${cGroup.contractId} - ${cGroup.adType}*\n`;
      msg += `التصميم: ${cGroup.designName}\n\n`;

      const cities = Object.keys(cGroup.byCity).sort();
      cities.forEach((city) => {
        const items = cGroup.byCity[city];
        msg += `*المدينة: ${city}*\n`;
        items.forEach((item, i) => {
          msg += `  ${i + 1}. ${item.billboardName}`;
          if (item.size) msg += ` (${item.size})`;
          msg += '\n';
          if (item.gpsLink) msg += `     الموقع: ${item.gpsLink}\n`;
        });
        msg += '\n';
      });

      totalCount += cGroup.total;
      if (ci < contractEntries.length - 1) msg += '\n';
    });

    msg += `━━━━━━━━━━━━━━━━━\n`;
    msg += `*الإجمالي: ${totalCount} لوحة*`;

    return msg;
  };

  const handleSavePhone = async (teamId: string) => {
    const phone = editingPhones[teamId];
    if (phone === undefined) return;
    setSavingPhone(teamId);
    try {
      const { error } = await (supabase as any)
        .from('installation_teams')
        .update({ phone_number: phone })
        .eq('id', teamId);
      if (error) throw error;
      toast.success('تم حفظ رقم الهاتف');
      if (teamById[teamId]) teamById[teamId].phone_number = phone;
    } catch {
      toast.error('فشل في حفظ الرقم');
    } finally {
      setSavingPhone(null);
    }
  };

  const handleSendToTeam = async (teamId: string) => {
    const data = teamTasksData[teamId];
    const phone = editingPhones[teamId] ?? data?.phoneNumber;
    if (!phone) {
      toast.error('يرجى إدخال رقم هاتف الفرقة أولاً');
      return;
    }
    const selectedCount = getSelectedCountForTeam(teamId);
    if (selectedCount === 0) {
      toast.error('يرجى تحديد عقد واحد على الأقل');
      return;
    }

    setSendingTeam(teamId);
    try {
      toast.info('جاري تحضير ملف PDF ورفعه...');

      // Get selected contracts for this team
      const contractEntries = Object.entries(data.contracts)
        .filter(([ck]) => selectedContracts.has(`${teamId}-${ck}`));

      // Generate PDF blob
      const pdfBlob = await generateTeamPdfBlob(data.teamName, contractEntries);

      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });

      // Upload PDF to Google Drive
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();
      const dateStr = new Date().toISOString().slice(0, 10);
      const pdfFileName = `مهام_تركيب_${data.teamName}_${dateStr}.pdf`;
      const pdfUrl = await uploadFileToGoogleDrive(base64Data, pdfFileName, 'application/pdf', 'installation-reports', false, progress);

      // Build WhatsApp message with PDF link
      let totalCount = 0;
      contractEntries.forEach(([, cg]) => { totalCount += cg.total; });

      const contractNumbers = contractEntries.map(([, cg]) => `#${cg.contractId}`).join(', ');
      const message = `*مهام التركيب - فريق ${data.teamName}*\n\n` +
        `العقود: ${contractNumbers}\n` +
        `إجمالي اللوحات: ${totalCount}\n\n` +
 ` ملف التفاصيل:\n${pdfUrl}\n\n` +
        `يرجى مراجعة الملف المرفق للتفاصيل الكاملة.`;

      openWhatsApp(phone, message);
      toast.success('تم رفع الملف وفتح واتساب بنجاح');
    } catch (error) {
      console.error('Error sending team report:', error);
      toast.error('حدث خطأ أثناء تحضير التقرير: ' + (error as Error).message);
    } finally {
      setSendingTeam(null);
    }
  };

  const teamEntries = Object.entries(teamTasksData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            إرسال مهام التركيب للفرق
          </DialogTitle>
        </DialogHeader>

        {teamEntries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            لا توجد مهام تركيب معلقة لأي فرقة
          </div>
        ) : (
          <ScrollArea className="max-h-[65vh]">
            <div className="space-y-4 pl-2">
              {teamEntries.map(([teamId, data]) => {
                const currentPhone = editingPhones[teamId] ?? data.phoneNumber;
                const phoneChanged = editingPhones[teamId] !== undefined && editingPhones[teamId] !== data.phoneNumber;
                const contractEntries = Object.entries(data.contracts);
                const selectedCount = getSelectedCountForTeam(teamId);
                const isSending = sendingTeam === teamId;

                return (
                  <div key={teamId} className="rounded-xl border-2 border-border bg-card p-4 space-y-3">
                    {/* Team header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-bold text-base">{data.teamName}</span>
                        <Badge variant="secondary">{data.total} لوحة</Badge>
                        <Badge variant="outline" className="text-xs">
                          {selectedCount}/{contractEntries.length} عقد
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleSendToTeam(teamId)}
                        disabled={!currentPhone || selectedCount === 0 || isSending}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            جاري التحضير...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            <MessageCircle className="h-4 w-4" />
                            إرسال PDF
                            <ExternalLink className="h-3 w-3" />
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Phone number */}
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={currentPhone}
                        onChange={(e) => setEditingPhones(prev => ({ ...prev, [teamId]: e.target.value }))}
                        placeholder="رقم هاتف الفرقة"
                        className="flex-1 text-sm h-8"
                        dir="ltr"
                      />
                      {phoneChanged && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 h-8"
                          onClick={() => handleSavePhone(teamId)}
                          disabled={savingPhone === teamId}
                        >
                          <Save className="h-3 w-3" />
                          حفظ
                        </Button>
                      )}
                    </div>

                    {/* Select/Deselect buttons */}
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => selectAllForTeam(teamId)}>
                        <CheckSquare className="h-3 w-3" /> تحديد الكل
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => deselectAllForTeam(teamId)}>
                        <XSquare className="h-3 w-3" /> إلغاء التحديد
                      </Button>
                    </div>

                    {/* Contracts (collapsible) */}
                    <div className="space-y-1.5">
                      {contractEntries.map(([contractKey, cGroup]) => {
                        const selKey = `${teamId}-${contractKey}`;
                        const isSelected = selectedContracts.has(selKey);
                        const isOpen = openContracts.has(selKey);

                        return (
                          <Collapsible key={contractKey} open={isOpen} onOpenChange={() => toggleCollapsible(selKey)}>
                            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleContract(teamId, contractKey)}
                                className="shrink-0"
                              />
                              <CollapsibleTrigger asChild>
                                <button className="flex items-center gap-2 flex-1 text-right text-sm">
                                  {isOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  ) : (
                                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="font-semibold">عقد #{cGroup.contractId}</span>
                                  <span className="text-muted-foreground">-</span>
                                  <Badge variant="secondary" className="text-xs font-normal">{cGroup.adType}</Badge>
                                  <Badge variant="outline" className="text-[10px]">{cGroup.total} لوحة</Badge>
                                  <span className="text-xs text-muted-foreground mr-auto truncate max-w-[120px]">
                                    {cGroup.designName}
                                  </span>
                                </button>
                              </CollapsibleTrigger>
                            </div>

                            <CollapsibleContent>
                              <div className="mr-8 mt-1 mb-2 space-y-1.5 text-xs">
                                {Object.entries(cGroup.byCity).sort().map(([city, items]) => (
                                  <div key={city} className="border-r-2 border-primary/20 pr-3">
                                    <div className="flex items-center gap-1 font-semibold text-sm mb-0.5">
                                      <MapPin className="h-3 w-3 text-blue-500" />
                                      {city}
                                      <Badge variant="outline" className="text-[10px] mr-1">{items.length}</Badge>
                                    </div>
                                    {items.map((item, i) => (
                                      <div key={item.id} className="py-0.5 pr-4">
                                        <div className="font-medium">
                                          {i + 1}. {item.billboardName}
                                          {item.size && <span className="text-muted-foreground mr-1">({item.size})</span>}
                                        </div>
                                        {item.gpsLink && (
                                          <a
                                            href={item.gpsLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline pr-3 inline-flex items-center gap-1"
                                          >
                                            <MapPin className="h-3 w-3" /> الموقع
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}