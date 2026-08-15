import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Link, Unlink, Plus } from 'lucide-react';

interface ContractManagementDialogProps {
  contractDialogOpen: boolean;
  setContractDialogOpen: (open: boolean) => void;
  selectedBillboard: any;
  contractAction: 'add' | 'remove';
  contractSearchQuery: string;
  setContractSearchQuery: (query: string) => void;
  filteredContracts: any[];
  addBillboardToContract: (contractNumber: string, loadBillboards: () => Promise<void>) => Promise<void>;
  removeBillboardFromContract: (loadBillboards: () => Promise<void>) => Promise<void>;
  createNewContract: () => void;
  loadAvailableContracts: (searchTerm?: string) => Promise<void>;
  loadBillboards: () => Promise<void>;
}

export const ContractManagementDialog: React.FC<ContractManagementDialogProps> = ({
  contractDialogOpen,
  setContractDialogOpen,
  selectedBillboard,
  contractAction,
  contractSearchQuery,
  setContractSearchQuery,
  filteredContracts,
  addBillboardToContract,
  removeBillboardFromContract,
  createNewContract,
  loadAvailableContracts,
  loadBillboards
}) => {
  return (
    <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {contractAction === 'add' ? (
              <>
                <Link className="h-5 w-5" />
                إضافة اللوحة إلى عقد
              </>
            ) : (
              <>
                <Unlink className="h-5 w-5" />
                إزالة اللوحة من العقد
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {contractAction === 'add' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              اختر عقداً موجوداً لإضافة اللوحة إليه أو أنشئ عقداً جديداً
            </p>
            
            {/* Contract Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في العقود..."
                value={contractSearchQuery}
                onChange={(e) => {
                  setContractSearchQuery(e.target.value);
                  loadAvailableContracts(e.target.value);
                }}
                className="pr-10"
              />
            </div>
            
            {filteredContracts.length > 0 && (
              <div>
                <Label>العقود المتاحة ({filteredContracts.length})</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredContracts.map((contract) => (
                    <Button
                      key={contract.Contract_Number}
                      variant="outline"
                      className="w-full justify-start text-right"
                      onClick={() => addBillboardToContract(contract.Contract_Number, loadBillboards)}
                    >
                      <div className="text-right">
                        <div className="font-medium">عقد رقم: {contract.Contract_Number}</div>
                        <div className="text-sm text-muted-foreground">
                          {contract['Customer Name']} - {contract['Ad Type']}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            {filteredContracts.length === 0 && contractSearchQuery && (
              <div className="text-center text-muted-foreground py-4">
                لا توجد عقود تطابق البحث
              </div>
            )}
            
            <div className="border-t pt-4">
              <Button 
                onClick={createNewContract}
                className="w-full gap-2"
              >
                <Plus className="h-4 w-4" />
                إنشاء عقد جديد للوحة
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              هل تريد إزالة هذه اللوحة من العقد الحالي؟
            </p>
            {selectedBillboard && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <div><strong>رقم العقد:</strong> {selectedBillboard.Contract_Number}</div>
                  <div><strong>العميل:</strong> {selectedBillboard.Customer_Name}</div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setContractDialogOpen(false)} className="flex-1">
                إلغاء
              </Button>
              <Button variant="destructive" onClick={() => removeBillboardFromContract(loadBillboards)} className="flex-1">
                إزالة من العقد
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};