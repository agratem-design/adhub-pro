import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Wrench, DollarSign } from 'lucide-react';

interface InstallationCostSummaryProps {
  installationCost: number;
  installationDetails: Array<{
    billboardId: string;
    billboardName: string;
    size: string;
    installationPrice: number;
    faces?: number;
    adjustedPrice?: number;
  }>;
  operatingFee: number;
  operatingFeeRate: number;
  setOperatingFeeRate: (rate: number) => void;
  rentalCostOnly: number;
  totalAfterDiscount: number;
}

export const InstallationCostSummary: React.FC<InstallationCostSummaryProps> = ({
  installationCost,
  installationDetails,
  operatingFee,
  operatingFeeRate,
  setOperatingFeeRate,
  rentalCostOnly,
  totalAfterDiscount
}) => {
  if (installationCost === 0 && operatingFee === 0) return null;

  return (
    <>
      {/* Installation Cost Summary */}
      {installationCost > 0 && (
        <Card className="card-elegant border-orange">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 installation-cost">
              <Wrench className="h-5 w-5" />
              تفاصيل تكلفة التركيب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {installationDetails.map((detail, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-orange-light rounded">
                    <div>
                      <div className="font-medium text-sm">{detail.billboardName}</div>
                      <div className="text-xs text-primary">
                        مقاس: {detail.size}
                        {detail.faces && (
                          <span className="ml-2">• عدد الأوجه: {detail.faces}</span>
                        )}
                      </div>
                      {detail.adjustedPrice && detail.adjustedPrice !== detail.installationPrice && (
                        <div className="text-xs installation-cost">
                          السعر الأصلي: {(detail.installationPrice * 2).toLocaleString('ar-LY')} د.ل (مقسوم ÷ 2 للوجه الواحد)
                        </div>
                      )}
                    </div>
                    <div className="font-semibold installation-cost">
                      {detail.installationPrice.toLocaleString('ar-LY')} د.ل
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>إجمالي تكلفة التركيب:</span>
                  <span className="installation-cost">{installationCost.toLocaleString('ar-LY')} د.ل</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operating Fee Summary */}
      {operatingFee > 0 && (
        <Card className="card-elegant border-blue">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 operating-fee">
              <DollarSign className="h-5 w-5" />
              رسوم التشغيل ({operatingFeeRate}%) 
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span>{installationCost > 0 ? 'صافي تكلفة الإيجار:' : 'الإجمالي بعد الخصم:'}</span>
                <span className="price-text">{(installationCost > 0 ? rentalCostOnly : totalAfterDiscount).toLocaleString('ar-LY')} د.ل</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>نسبة التشغيل:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={operatingFeeRate}
                    onChange={(e) => setOperatingFeeRate(Number(e.target.value) || 3)}
                    className="w-16 h-6 text-xs"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span className="operating-fee">%</span>
                </div>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center font-bold">
                  <span>إجمالي رسوم التشغيل:</span>
                  <span className="operating-fee">{operatingFee.toLocaleString('ar-LY')} د.ل</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};