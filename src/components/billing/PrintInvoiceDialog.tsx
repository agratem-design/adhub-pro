import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';

interface PrintItem {
  size: string;
  quantity: number;
  faces: number; // عدد الأوجه لكل لوحة
  totalFaces: number; // إجمالي الأوجه
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
}

interface ContractRow {
  Contract_Number: number;
  'Ad Type': string;
  'Customer Name': string;
  'Total': number;
}

interface PrintInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  customerName: string;
  contracts: ContractRow[];
  selectedContracts: string[];
  onSelectContracts: (contracts: string[]) => void;
  printItems: PrintItem[];
  onUpdatePrintItem: (index: number, field: keyof PrintItem, value: number) => void;
  onRemoveItem: (index: number) => void;
  includeAccountBalance: boolean;
  onIncludeAccountBalance: (include: boolean) => void;
  accountPayments: number;
  onPrintInvoice: () => void;
  onSaveInvoice: () => void;
}

export function PrintInvoiceDialog({
  open,
  onClose,
  customerName,
  contracts,
  selectedContracts,
  onSelectContracts,
  printItems,
  onUpdatePrintItem,
  onRemoveItem,
  includeAccountBalance,
  onIncludeAccountBalance,
  accountPayments,
  onPrintInvoice,
  onSaveInvoice
}: PrintInvoiceDialogProps) {
  const handleContractToggle = (contractNumber: string) => {
    if (selectedContracts.includes(contractNumber)) {
      onSelectContracts(selectedContracts.filter(c => c !== contractNumber));
    } else {
      onSelectContracts([...selectedContracts, contractNumber]);
    }
  };

  const printTotal = printItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalFacesCount = printItems.reduce((sum, item) => sum + item.totalFaces, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="text-lg font-bold text-primary text-right">
            فاتورة طباعة - {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Contract Selection */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">اختيار العقود:</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {contracts.map((contract) => (
                <label
                  key={contract.Contract_Number}
                  className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedContracts.includes(String(contract.Contract_Number))}
                    onCheckedChange={() => handleContractToggle(String(contract.Contract_Number))}
                    className="border-border"
                  />
                  <span className="text-card-foreground">
                    عقد رقم {contract.Contract_Number} - {contract['Ad Type']}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Print Items */}
          {printItems.length > 0 && (
            <div className="expenses-preview-item">
              <h3 className="expenses-preview-label">
                تفاصيل الطباعة - إجمالي الأوجه: {totalFacesCount}
              </h3>
              <div className="space-y-3">
                {printItems.map((item, index) => (
                  <div key={index} className="bg-muted/30 p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-card-foreground text-lg">
                        {item.size} - {item.quantity} لوحة × {item.totalFaces} وجه
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="expenses-form-label block mb-2">عدد اللوحات</label>
                        <div className="bg-muted px-4 py-3 rounded text-card-foreground font-medium">
                          {item.quantity}
                        </div>
                      </div>
                      <div>
                        <label className="expenses-form-label block mb-2">إجمالي الأوجه</label>
                        <Input
                          type="number"
                          value={item.totalFaces}
                          onChange={(e) => onUpdatePrintItem(index, 'totalFaces', Number(e.target.value) || 0)}
                          className="bg-input border-border text-card-foreground font-medium"
                        />
                      </div>
                      <div>
                        <label className="expenses-form-label block mb-2">سعر المتر</label>
                        <Input
                          type="number"
                          value={item.pricePerMeter}
                          onChange={(e) => onUpdatePrintItem(index, 'pricePerMeter', Number(e.target.value) || 0)}
                          className="bg-input border-border text-card-foreground font-medium"
                        />
                      </div>
                      <div>
                        <label className="expenses-form-label block mb-2">الإجمالي</label>
                        <div className="expenses-amount-calculated px-4 py-3 rounded font-bold">
                          {item.totalPrice.toLocaleString('ar-LY')} د.ل
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground bg-muted/20 p-2 rounded">
                      المساحة: {item.area.toFixed(2)} م² × {item.totalFaces} وجه = {item.totalArea.toFixed(2)} م²
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="expenses-preview-item">
            <h3 className="expenses-preview-label">ملخص فاتورة الطباعة:</h3>
            <div className="space-y-3 text-card-foreground">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="font-medium">إجمالي عدد الأوجه:</span>
                <span className="font-bold stat-blue">{totalFacesCount} وجه</span>
              </div>
              {printTotal > 0 && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="font-medium">إجمالي الطباعة:</span>
                  <span className="font-bold">{printTotal.toLocaleString('ar-LY')} د.ل</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xl pt-2">
                <span>الإجمالي النهائي:</span>
                <span className="text-primary">{printTotal.toLocaleString('ar-LY')} د.ل</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="expenses-actions justify-end pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              إلغاء
            </Button>
            <Button
              onClick={onSaveInvoice}
              className="stat-green bg-green-600 hover:bg-green-700 text-white font-semibold"
              disabled={printTotal <= 0}
            >
              حفظ في الحساب
            </Button>
            <Button
              onClick={onPrintInvoice}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              disabled={selectedContracts.length === 0 || printTotal <= 0}
            >
              طباعة فاتورة الطباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}