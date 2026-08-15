import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DollarSign } from 'lucide-react';
import { toast } from 'sonner';

// Currency options
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$' },
  { code: 'EUR', name: 'يورو', symbol: '€' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ' },
  { code: 'TND', name: 'دينار تونسي', symbol: 'د.ت' },
  { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م' },
];

export default function CurrencySettings() {
  const [defaultCurrency, setDefaultCurrency] = useState('LYD');
  const [displayCurrency, setDisplayCurrency] = useState('LYD');
  const [exchangeRates, setExchangeRates] = useState<{ [key: string]: number }>({
    LYD: 1,
    USD: 4.8,
    EUR: 5.2,
    GBP: 6.1,
    SAR: 1.28,
    AED: 1.31,
    TND: 1.52,
    EGP: 0.098,
  });

  const handleSave = () => {
    // Save settings to localStorage or database
    localStorage.setItem('defaultCurrency', defaultCurrency);
    localStorage.setItem('displayCurrency', displayCurrency);
    localStorage.setItem('exchangeRates', JSON.stringify(exchangeRates));
    toast.success('تم حفظ إعدادات العملة بنجاح');
  };

  const handleExchangeRateChange = (currency: string, rate: number) => {
    setExchangeRates(prev => ({ ...prev, [currency]: rate }));
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">إعدادات العملة</h1>
        <p className="text-muted-foreground mt-2">إدارة العملات وأسعار الصرف</p>
      </div>

      <div className="space-y-6">
        {/* Default Currency Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              العملة الافتراضية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">العملة الافتراضية للنظام</label>
              <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العملة" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">العملة المعروضة في الواجهة</label>
              <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر العملة" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Exchange Rates Card */}
        <Card>
          <CardHeader>
            <CardTitle>أسعار الصرف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                حدد سعر صرف كل عملة مقابل الدينار الليبي (1 د.ل = ؟)
              </p>
              {CURRENCIES.filter(c => c.code !== 'LYD').map((currency) => (
                <div key={currency.code} className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      {currency.symbol} - {currency.name}
                    </label>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      value={exchangeRates[currency.code]}
                      onChange={(e) => handleExchangeRateChange(currency.code, Number(e.target.value) || 0)}
                      placeholder="السعر"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground w-20">
                    {currency.symbol}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            حفظ الإعدادات
          </Button>
        </div>
      </div>
    </div>
  );
}
