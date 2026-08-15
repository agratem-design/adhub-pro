import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Printer, Plus, FileSpreadsheet, Cloud, Camera, Share2, Settings2, Zap, Upload, Shuffle, Copy, MoreHorizontal, Globe, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ExportWithContractsDialog } from './billboards/ExportWithContractsDialog';
import { ExportMunicipalityDialog } from './billboards/ExportMunicipalityDialog';
import { UploadAvailablePreviewDialog } from './billboards/UploadAvailablePreviewDialog';

interface BillboardActionsProps {
  exportToExcel: () => void;
  exportAvailableToExcel: () => void;
  copyAvailableToClipboard: () => void;
  copyAllToClipboard: () => void;
  copyAvailableAndUpcomingToClipboard: (monthsAhead?: number) => void;
  copyAllWithEndDateToClipboard: () => void;
  copyFollowUpToClipboard: () => void;
  exportAllWithEndDate: () => void;
  exportAvailableAndUpcoming: (monthsAhead?: number) => void;
  exportFollowUpToExcel: () => void;
  exportRePhotographyToExcel: () => void;
  exportAvailableWithContracts?: (contractIds: number[], hideEndDateContractIds?: number[]) => void;
  exportAvailableAndUpcomingWithContracts?: (contractIds: number[], hideEndDateContractIds?: number[], monthsAhead?: number) => void;
  uploadAvailableToSite?: () => void;
  uploadAvailableAndUpcomingToSite?: (monthsAhead?: number) => void;
  uploadFollowUpToSite?: () => void;
  uploadAllToSite?: () => void;
  syncToGoogleSheets: () => Promise<void>;
  onAdvancedPrintClick?: () => void;
  availableBillboardsCount: number;
  initializeAddForm: () => void;
  setAddOpen: (open: boolean) => void;
  setBulkAddOpen?: (open: boolean) => void;
  setExcelImportOpen?: (open: boolean) => void;
  setExcelImageImportOpen?: (open: boolean) => void;
  setBatchPhotoImportOpen?: (open: boolean) => void;
  exportMunicipalityToExcel: (excludeHidden: boolean, selectedMunicipality: string) => void;
  municipalities: string[];
  billboards?: any[];
  isContractExpired?: (endDate: string | null) => boolean;
}

export const BillboardActions: React.FC<BillboardActionsProps> = ({
  exportToExcel,
  exportAvailableToExcel,
  copyAvailableToClipboard,
  copyAllToClipboard,
  copyAvailableAndUpcomingToClipboard,
  copyAllWithEndDateToClipboard,
  copyFollowUpToClipboard,
  exportAllWithEndDate,
  exportAvailableAndUpcoming,
  exportFollowUpToExcel,
  exportRePhotographyToExcel,
  exportAvailableWithContracts,
  exportAvailableAndUpcomingWithContracts,
  uploadAvailableToSite,
  uploadAvailableAndUpcomingToSite,
  uploadFollowUpToSite,
  uploadAllToSite,
  syncToGoogleSheets,
  onAdvancedPrintClick,
  availableBillboardsCount,
  initializeAddForm,
  setAddOpen,
  setBulkAddOpen,
  setExcelImportOpen,
  setExcelImageImportOpen,
  setBatchPhotoImportOpen,
  exportMunicipalityToExcel,
  municipalities,
  billboards = [],
  isContractExpired = () => false,
}) => {
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(false);
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [upcomingContractsDialogOpen, setUpcomingContractsDialogOpen] = useState(false);
  const [municipalityDialogOpen, setMunicipalityDialogOpen] = useState(false);
  const [uploadPreviewOpen, setUploadPreviewOpen] = useState(false);
  const [monthsAhead, setMonthsAhead] = useState<number>(4);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncToGoogleSheets();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      {/* Main Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold gap-1.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shadow-sm transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>تصدير</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="text-xs text-muted-foreground flex items-center justify-between">
            <span>تصدير البيانات</span>
            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 font-manrope">Excel</Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* تصدير المتاح كخيار أساسي بارز */}
          <DropdownMenuItem onClick={exportAvailableToExcel} className="cursor-pointer gap-2 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20">
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>تصدير المتاح فقط Excel</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyAvailableToClipboard} className="cursor-pointer gap-2 text-xs">
            <Copy className="h-3.5 w-3.5 text-emerald-500" />
            <span>نسخ المتاح فقط</span>
          </DropdownMenuItem>
          {uploadAvailableToSite && (
            <DropdownMenuItem onClick={uploadAvailableToSite} className="cursor-pointer gap-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              <span>تصدير المتاح إلى الموقع الإلكتروني</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-blue-500" />
            <span>تصدير جميع اللوحات Excel</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMunicipalityDialogOpen(true)} className="cursor-pointer gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>تنزيل لوحات البلدية Excel</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyAllToClipboard} className="cursor-pointer gap-2 text-xs">
            <Copy className="h-3.5 w-3.5 text-blue-500" />
            <span>نسخ جميع اللوحات</span>
          </DropdownMenuItem>
          {uploadAllToSite && (
            <DropdownMenuItem onClick={uploadAllToSite} className="cursor-pointer gap-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-blue-600" />
              <span>تصدير جميع اللوحات إلى الموقع</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <div
            className="px-2 py-1.5 flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
            <Label htmlFor="months-ahead-input" className="text-xs text-muted-foreground shrink-0">
              عدد الأشهر القادمة:
            </Label>
            <Input
              id="months-ahead-input"
              type="number"
              min={1}
              max={36}
              value={monthsAhead}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMonthsAhead(Number.isFinite(v) && v > 0 ? v : 4);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-16 text-xs text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <DropdownMenuItem onClick={() => exportAvailableAndUpcoming(monthsAhead)} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-emerald-500" />
            <span>تصدير المتاح والقادمة ({monthsAhead} {monthsAhead === 1 ? 'شهر' : monthsAhead === 2 ? 'شهرين' : monthsAhead <= 10 ? 'أشهر' : 'شهراً'})</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyAvailableAndUpcomingToClipboard(monthsAhead)} className="cursor-pointer gap-2 text-xs">
            <Copy className="h-3.5 w-3.5 text-emerald-500" />
            <span>نسخ المتاح والقادمة ({monthsAhead})</span>
          </DropdownMenuItem>
          {uploadAvailableAndUpcomingToSite && (
            <DropdownMenuItem onClick={() => setUploadPreviewOpen(true)} className="cursor-pointer gap-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              <span>تصدير المتاح والقادمة إلى الموقع ({monthsAhead})</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportAllWithEndDate} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-orange-500" />
            <span>الكل مع تاريخ الانتهاء</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyAllWithEndDateToClipboard} className="cursor-pointer gap-2 text-xs">
            <Copy className="h-3.5 w-3.5 text-orange-500" />
            <span>نسخ الكل مع تاريخ الانتهاء</span>
          </DropdownMenuItem>

          {(exportAvailableWithContracts || exportAvailableAndUpcomingWithContracts) && <DropdownMenuSeparator />}
          {exportAvailableWithContracts && (
            <DropdownMenuItem onClick={() => setContractsDialogOpen(true)} className="cursor-pointer gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              <span>المتاح + عقود محددة</span>
            </DropdownMenuItem>
          )}
          {exportAvailableAndUpcomingWithContracts && (
            <DropdownMenuItem onClick={() => setUpcomingContractsDialogOpen(true)} className="cursor-pointer gap-2">
              <Download className="h-4 w-4 text-purple-500" />
              <span>المتاح والقادمة + عقود محددة</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportFollowUpToExcel} className="cursor-pointer gap-2">
            <Download className="h-4 w-4 text-cyan-500" />
            <span>تصدير المتابعة</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyFollowUpToClipboard} className="cursor-pointer gap-2 text-xs">
            <Copy className="h-3.5 w-3.5 text-cyan-500" />
            <span>نسخ المتابعة</span>
          </DropdownMenuItem>
          {uploadFollowUpToSite && (
            <DropdownMenuItem onClick={uploadFollowUpToSite} className="cursor-pointer gap-2 text-xs">
              <Globe className="h-3.5 w-3.5 text-cyan-600" />
              <span>تصدير المتابعة إلى الموقع</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dedicated Import Dropdown */}
      {(setExcelImportOpen || setExcelImageImportOpen || setBatchPhotoImportOpen) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold gap-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-700 dark:text-blue-300 shadow-sm transition-all"
            >
              <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>استيراد</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
            <DropdownMenuLabel className="text-xs text-muted-foreground">استيراد البيانات والصور</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {setExcelImportOpen && (
              <DropdownMenuItem 
                onClick={() => setExcelImportOpen(true)} 
                className="cursor-pointer gap-2 font-medium"
              >
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>استيراد لوحات من Excel</span>
              </DropdownMenuItem>
            )}
            {setExcelImageImportOpen && (
              <DropdownMenuItem 
                onClick={() => setExcelImageImportOpen(true)} 
                className="cursor-pointer gap-2 font-medium"
              >
                <Upload className="h-4 w-4 text-purple-600" />
                <span>استيراد صور من Excel</span>
              </DropdownMenuItem>
            )}
            {setBatchPhotoImportOpen && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setBatchPhotoImportOpen(true)} 
                  className="cursor-pointer gap-2 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                >
                  <Camera className="h-4 w-4 text-amber-500" />
                  <span>إضافة لوحات من صور ميدانية</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Sync Button */}
      <Button 
        onClick={handleSync}
        disabled={isSyncing}
        variant="outline"
        size="sm"
        className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm font-semibold gap-1.5 bg-gradient-to-r from-sky-500/10 to-cyan-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-700 dark:text-sky-300 shadow-sm transition-all"
        title="مزامنة مع Google Sheets"
      >
        <Cloud className={`h-4 w-4 text-sky-600 dark:text-sky-400 ${isSyncing ? 'animate-pulse' : ''}`} />
        <span className="hidden xs:inline">{isSyncing ? 'جاري...' : 'مزامنة'}</span>
      </Button>

      {/* Print Button */}
      <Button 
        onClick={onAdvancedPrintClick}
        variant="outline"
        size="sm"
        className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold gap-1.5 bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:bg-violet-500/20 border-violet-500/30 text-violet-700 dark:text-violet-300 shadow-sm transition-all"
      >
        <Printer className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span>طباعة</span>
        <span className="bg-violet-500/20 text-violet-800 dark:text-violet-200 text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold font-manrope">
          {availableBillboardsCount}
        </span>
      </Button>

      {/* Tools Dropdown - Secondary Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm font-semibold gap-1.5 shadow-sm transition-all"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="hidden xs:inline">أدوات</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">أدوات إضافية</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportRePhotographyToExcel} className="cursor-pointer gap-2">
            <Camera className="h-4 w-4 text-orange-600" />
            <span>إعادة تصوير</span>
          </DropdownMenuItem>
          {onAdvancedPrintClick && (
            <DropdownMenuItem onClick={onAdvancedPrintClick} className="cursor-pointer gap-2">
              <Settings2 className="h-4 w-4 text-indigo-600" />
              <span>طباعة متقدمة</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/admin/smart-distribution')} className="cursor-pointer gap-2">
            <Shuffle className="h-4 w-4 text-emerald-600" />
            <span>توزيع ذكي</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/admin/shared-billboards')} className="cursor-pointer gap-2">
            <Share2 className="h-4 w-4 text-pink-600" />
            <span>اللوحات المشتركة</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Billboard Dropdown - Primary Action */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm"
            className="h-8 sm:h-9 px-2.5 sm:px-3.5 text-xs sm:text-sm font-bold gap-1.5 bg-gradient-to-r from-primary to-amber-600 text-primary-foreground shadow-md hover:shadow-gold transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة لوحة</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="text-xs text-muted-foreground">خيارات الإضافة</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => {
              initializeAddForm();
              setAddOpen(true);
            }} 
            className="cursor-pointer gap-2 font-medium"
          >
            <Plus className="h-4 w-4 text-primary" />
            <span>إضافة لوحة واحدة</span>
          </DropdownMenuItem>
          {setBulkAddOpen && (
            <DropdownMenuItem 
              onClick={() => setBulkAddOpen(true)} 
              className="cursor-pointer gap-2 font-medium"
            >
              <Zap className="h-4 w-4 text-amber-500" />
              <span>إضافة لوحات متعددة</span>
            </DropdownMenuItem>
          )}
          {setExcelImportOpen && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setExcelImportOpen(true)} 
                className="cursor-pointer gap-2 font-medium"
              >
                <Upload className="h-4 w-4 text-green-600" />
                <span>استيراد من Excel</span>
              </DropdownMenuItem>
            </>
          )}
          {setExcelImageImportOpen && (
            <DropdownMenuItem 
              onClick={() => setExcelImageImportOpen(true)} 
              className="cursor-pointer gap-2 font-medium"
            >
              <Upload className="h-4 w-4 text-purple-600" />
              <span>استيراد صور من Excel</span>
            </DropdownMenuItem>
          )}
          {setBatchPhotoImportOpen && (
            <DropdownMenuItem 
              onClick={() => setBatchPhotoImportOpen(true)} 
              className="cursor-pointer gap-2 font-bold text-amber-600 dark:text-amber-400"
            >
              <Camera className="h-4 w-4 text-amber-500" />
              <span>إضافة لوحات من صور ميدانية</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog for selecting contracts - المتاح + عقود */}
      {exportAvailableWithContracts && (
        <ExportWithContractsDialog
          open={contractsDialogOpen}
          onOpenChange={setContractsDialogOpen}
          onExport={exportAvailableWithContracts}
          title="تصدير المتاح مع عقود محددة"
          description="اختر العقود التي تريد إضافة لوحاتها إلى ملف اللوحات المتاحة (بدون تاريخ انتهاء)"
        />
      )}

      {/* Dialog for selecting contracts - المتاح والقادمة + عقود */}
      {exportAvailableAndUpcomingWithContracts && (
        <ExportWithContractsDialog
          open={upcomingContractsDialogOpen}
          onOpenChange={setUpcomingContractsDialogOpen}
          onExport={(contractIds, hideEndDateIds) =>
            exportAvailableAndUpcomingWithContracts(contractIds, hideEndDateIds, monthsAhead)
          }
          title={`تصدير المتاح والقادمة مع عقود محددة (${monthsAhead} ${monthsAhead === 1 ? 'شهر' : monthsAhead === 2 ? 'شهرين' : monthsAhead <= 10 ? 'أشهر' : 'شهراً'})`}
          description="اختر العقود التي تريد إضافة لوحاتها إلى ملف اللوحات المتاحة والقادمة (بدون تاريخ انتهاء)"
        />
      )}

      {/* Dialog for municipality export */}
      <ExportMunicipalityDialog
        open={municipalityDialogOpen}
        onOpenChange={setMunicipalityDialogOpen}
        onExport={exportMunicipalityToExcel}
        municipalities={municipalities}
      />

      {/* Preview Dialog for Uploading Available + Upcoming Billboards & Active Contracts */}
      {uploadAvailableAndUpcomingToSite && (
        <UploadAvailablePreviewDialog
          open={uploadPreviewOpen}
          onOpenChange={setUploadPreviewOpen}
          monthsAhead={monthsAhead}
          billboards={billboards}
          isContractExpired={isContractExpired}
          onConfirmUpload={async (m) => {
            await uploadAvailableAndUpcomingToSite(m);
          }}
        />
      )}
    </div>
  );
};