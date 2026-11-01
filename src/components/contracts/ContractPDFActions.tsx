import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, Eye, Send, Upload } from 'lucide-react';

interface ContractPDFActionsProps {
  documentLabel?: string;
  isGenerating: boolean;
  sendingWhatsApp: boolean;
  hasPhone: boolean;
  printMode: 'auto' | 'manual';
  withStamp: boolean;
  withCustomerStamp: boolean;
  onWithCustomerStampChange: (value: boolean) => void;
  onWithStampChange: (value: boolean) => void;
  onPrintInvoice: () => void;
  onPreviewInvoice: () => void;
  onDownloadInvoice: () => void;
  onSendInvoiceWhatsApp: () => void;
  onPrintContract: () => void;
  onPreviewContract: () => void;
  onDownloadContract: () => void;
  onSendContractWhatsApp: () => void;
  onUnifiedPrint?: () => void;
  onUploadToDrive?: () => void;
}

export function ContractPDFActions({
  documentLabel = 'العقد',
  isGenerating,
  sendingWhatsApp,
  hasPhone,
  printMode,
  withStamp,
  withCustomerStamp,
  onWithCustomerStampChange,
  onWithStampChange,
  onPrintInvoice,
  onPreviewInvoice,
  onDownloadInvoice,
  onSendInvoiceWhatsApp,
  onPrintContract,
  onPreviewContract,
  onDownloadContract,
  onSendContractWhatsApp,
  onUnifiedPrint,
  onUploadToDrive,
}: ContractPDFActionsProps) {
  if (isGenerating) return null;

  return (
    <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm p-3">
      <div className="flex flex-col gap-2">
        {/* Invoice Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14">الفاتورة:</span>
          <div className="flex gap-2 flex-1 flex-wrap">
            <Button 
              onClick={onPrintInvoice}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-sm h-8"
              disabled={sendingWhatsApp}
            >
              <Printer className="h-3.5 w-3.5 ml-1.5" />
              طباعة
            </Button>
            <Button 
              onClick={onPreviewInvoice}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Eye className="h-3.5 w-3.5 ml-1.5" />
              معاينة
            </Button>
            <Button 
              onClick={onDownloadInvoice}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Download className="h-3.5 w-3.5 ml-1.5" />
              PDF
            </Button>
          </div>
        </div>
        
        {/* Contract Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14">{documentLabel}:</span>
          <div className="flex gap-2 flex-1 flex-wrap items-center">
            {onUnifiedPrint && (
              <Button 
                onClick={onUnifiedPrint}
                size="sm"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white shadow-sm h-8"
                disabled={sendingWhatsApp}
              >
                <Printer className="h-3.5 w-3.5 ml-1.5" />
                طباعة {documentLabel}
              </Button>
            )}
            <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              أختام العقد
              <select
                aria-label="أختام العقد"
                value={withStamp ? (withCustomerStamp ? 'both' : 'company') : (withCustomerStamp ? 'customer' : 'none')}
                disabled={sendingWhatsApp}
                onChange={e => {
                  onWithStampChange(e.target.value === 'both' || e.target.value === 'company');
                  onWithCustomerStampChange(e.target.value === 'both' || e.target.value === 'customer');
                }}
                className="min-h-9 max-w-full cursor-pointer rounded-md border border-input bg-background px-2 text-foreground transition-all duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="both">مع ختم الشركة وختم العميل</option>
                <option value="company">بدون ختم العميل (ختم الشركة فقط)</option>
                <option value="customer">ختم العميل فقط</option>
                <option value="none">بدون أي ختم</option>
              </select>
            </label>
            <Button 
              onClick={onPreviewContract}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Eye className="h-3.5 w-3.5 ml-1.5" />
              معاينة
            </Button>
            <Button 
              onClick={onDownloadContract}
              variant="outline"
              size="sm"
              className="h-8"
              disabled={sendingWhatsApp}
            >
              <Download className="h-3.5 w-3.5 ml-1.5" />
              PDF
            </Button>
            {onUploadToDrive && (
              <Button 
                onClick={onUploadToDrive}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={sendingWhatsApp}
              >
                <Upload className="h-3.5 w-3.5 ml-1.5" />
                رفع
              </Button>
            )}
            {hasPhone && (
              <Button 
                onClick={onSendContractWhatsApp}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={sendingWhatsApp}
              >
                <Send className="h-3.5 w-3.5 ml-1.5" />
                واتساب
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}