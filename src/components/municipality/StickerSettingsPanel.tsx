import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Save, RotateCcw, Ruler, Image, Hash, QrCode, Phone, MapPin, Crown, Building2 } from 'lucide-react';
import type { StickerSettings } from './MunicipalityStickerSettings';

interface Props {
  settings: StickerSettings;
  onUpdate: (key: keyof StickerSettings, value: any) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

function SliderField({ label, value, onChange, min, max, step = 1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono font-bold text-foreground tabular-nums">{value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2 items-center">
        <div className="relative">
          <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
        </div>
        <Input value={value} onChange={e => onChange(e.target.value)} className="h-8 text-xs font-mono flex-1" dir="ltr" />
      </div>
    </div>
  );
}

export default function StickerSettingsPanel({ settings, onUpdate, onSave, onReset, saving }: Props) {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          إعدادات الملصقات
        </h3>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onReset} className="h-7 px-2 text-xs">
            <RotateCcw className="h-3 w-3 ml-1" />
            إعادة
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="h-7 px-3 text-xs gap-1">
            <Save className="h-3 w-3" />
            {saving ? '...' : 'حفظ'}
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3">
          <Accordion type="multiple" defaultValue={['dimensions', 'number']} className="space-y-1">

            {/* الأبعاد والخلفية */}
            <AccordionItem value="dimensions" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Ruler className="h-3.5 w-3.5 text-blue-500" />
                  الأبعاد والخلفية
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <div className="grid grid-cols-2 gap-3">
                  <SliderField label="العرض" value={settings.stickerWidth} onChange={v => onUpdate('stickerWidth', v)} min={5} max={40} unit="cm" />
                  <SliderField label="الارتفاع" value={settings.stickerHeight} onChange={v => onUpdate('stickerHeight', v)} min={5} max={40} unit="cm" />
                </div>
                <ColorField label="لون الخلفية" value={settings.backgroundColor} onChange={v => onUpdate('backgroundColor', v)} />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">صورة الخلفية</Label>
                  <Input value={settings.backgroundUrl} onChange={e => onUpdate('backgroundUrl', e.target.value)} placeholder="رابط (اختياري)" className="h-8 text-xs" dir="ltr" />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* رقم اللوحة */}
            <AccordionItem value="number" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-emerald-500" />
                  رقم اللوحة
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <SliderField label="حجم الخط" value={settings.numberFontSize} onChange={v => onUpdate('numberFontSize', v)} min={20} max={1500} unit="px" />
                <SliderField label="الموقع من الأعلى" value={settings.numberTopPercent} onChange={v => onUpdate('numberTopPercent', v)} min={0} max={95} unit="%" />
                <ColorField label="اللون" value={settings.numberColor} onChange={v => onUpdate('numberColor', v)} />
              </AccordionContent>
            </AccordionItem>

            {/* صورة اللوحة */}
            <AccordionItem value="image" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Image className="h-3.5 w-3.5 text-purple-500" />
                  صورة اللوحة
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار</Label>
                  <Switch checked={settings.showBillboardImage} onCheckedChange={v => onUpdate('showBillboardImage', v)} />
                </div>
                {settings.showBillboardImage && (
                  <>
                    <SliderField label="من الأعلى" value={settings.imageTopPercent} onChange={v => onUpdate('imageTopPercent', v)} min={0} max={90} unit="%" />
                    <SliderField label="العرض" value={settings.imageWidthPercent} onChange={v => onUpdate('imageWidthPercent', v)} min={20} max={100} unit="%" />
                    <SliderField label="الارتفاع" value={settings.imageHeightPercent} onChange={v => onUpdate('imageHeightPercent', v)} min={5} max={60} unit="%" />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* الشعارات */}
            <AccordionItem value="logos" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-orange-500" />
                  الشعارات
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-3">
                {/* Company logo */}
                <div className="space-y-2 p-2 rounded-md bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">شعار الشركة</Label>
                    <Switch checked={settings.showCompanyLogo} onCheckedChange={v => onUpdate('showCompanyLogo', v)} />
                  </div>
                  {settings.showCompanyLogo && (
                    <>
                      <Input value={settings.companyLogoUrl} onChange={e => onUpdate('companyLogoUrl', e.target.value)} placeholder="رابط الشعار" className="h-7 text-xs" dir="ltr" />
                      <SliderField label="العرض" value={settings.companyLogoWidth} onChange={v => onUpdate('companyLogoWidth', v)} min={20} max={400} unit="px" />
                      <SliderField label="من الأعلى (Y)" value={settings.companyLogoTopPercent ?? 4} onChange={v => onUpdate('companyLogoTopPercent', v)} min={0} max={90} unit="%" />
                      <SliderField label="من اليسار (X)" value={settings.companyLogoLeftPercent ?? 5} onChange={v => onUpdate('companyLogoLeftPercent', v)} min={0} max={95} unit="%" />
                    </>
                  )}
                </div>

                {/* Municipality logo */}
                <div className="space-y-2 p-2 rounded-md bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">شعار البلدية</Label>
                    <Switch checked={settings.showMunicipalityLogo} onCheckedChange={v => onUpdate('showMunicipalityLogo', v)} />
                  </div>
                  {settings.showMunicipalityLogo && (
                    <>
                      <Input value={settings.municipalityLogoUrl} onChange={e => onUpdate('municipalityLogoUrl', e.target.value)} placeholder="يُجلب تلقائياً أو ضع رابط" className="h-7 text-xs" dir="ltr" />
                      <SliderField label="العرض" value={settings.municipalityLogoWidth} onChange={v => onUpdate('municipalityLogoWidth', v)} min={20} max={400} unit="px" />
                      <SliderField label="من الأعلى (Y)" value={settings.municipalityLogoTopPercent ?? 4} onChange={v => onUpdate('municipalityLogoTopPercent', v)} min={0} max={90} unit="%" />
                      <SliderField label="من اليسار (X)" value={settings.municipalityLogoLeftPercent ?? 85} onChange={v => onUpdate('municipalityLogoLeftPercent', v)} min={0} max={95} unit="%" />
                    </>
                  )}
                </div>

                {/* Municipality name */}
                <div className="space-y-2 p-2 rounded-md bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">اسم البلدية</Label>
                    <Switch checked={settings.showMunicipalityName} onCheckedChange={v => onUpdate('showMunicipalityName', v)} />
                  </div>
                  {settings.showMunicipalityName && (
                    <>
                      <SliderField label="حجم الخط" value={settings.municipalityNameFontSize} onChange={v => onUpdate('municipalityNameFontSize', v)} min={8} max={60} unit="px" />
                      <SliderField label="من الأعلى (Y)" value={settings.municipalityNameTopPercent ?? 6} onChange={v => onUpdate('municipalityNameTopPercent', v)} min={0} max={90} unit="%" />
                      <SliderField label="من اليسار (X)" value={settings.municipalityNameLeftPercent ?? 50} onChange={v => onUpdate('municipalityNameLeftPercent', v)} min={0} max={100} unit="%" />
                      <ColorField label="اللون" value={settings.municipalityNameColor ?? '#333333'} onChange={v => onUpdate('municipalityNameColor', v)} />
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* QR Code */}
            <AccordionItem value="qr" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <QrCode className="h-3.5 w-3.5 text-cyan-500" />
                  رمز QR
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار</Label>
                  <Switch checked={settings.showQrCode} onCheckedChange={v => onUpdate('showQrCode', v)} />
                </div>
                {settings.showQrCode && (
                  <>
                    <SliderField label="الحجم" value={settings.qrSizePx} onChange={v => onUpdate('qrSizePx', v)} min={40} max={300} unit="px" />
                    <SliderField label="الحشوة (إطار)" value={settings.qrPadding ?? 10} onChange={v => onUpdate('qrPadding', v)} min={0} max={30} unit="px" />
                    <SliderField label="شفافية الخلفية" value={settings.qrBgOpacity ?? 85} onChange={v => onUpdate('qrBgOpacity', v)} min={0} max={100} unit="%" />
                    <SliderField label="من الأعلى (Y)" value={settings.qrTopPercent ?? 85} onChange={v => onUpdate('qrTopPercent', v)} min={0} max={100} unit="%" />
                    <SliderField label="من اليسار (X)" value={settings.qrLeftPercent ?? 85} onChange={v => onUpdate('qrLeftPercent', v)} min={0} max={100} unit="%" />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* معلومات التواصل */}
            <AccordionItem value="contact" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-green-500" />
                  التواصل
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار</Label>
                  <Switch checked={settings.showContactInfo} onCheckedChange={v => onUpdate('showContactInfo', v)} />
                </div>
                {settings.showContactInfo && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">الهاتف</Label>
                      <Input value={settings.contactPhone} onChange={e => onUpdate('contactPhone', e.target.value)} className="h-8 text-xs" dir="ltr" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">فيسبوك</Label>
                      <Input value={settings.contactFacebook} onChange={e => onUpdate('contactFacebook', e.target.value)} className="h-8 text-xs" dir="ltr" />
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* النقطة الدالة */}
            <AccordionItem value="landmark" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  أقرب نقطة دالة
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار</Label>
                  <Switch checked={settings.showLandmark} onCheckedChange={v => onUpdate('showLandmark', v)} />
                </div>
                {settings.showLandmark && (
                  <>
                    <SliderField label="حجم الخط" value={settings.landmarkFontSize ?? 10} onChange={v => onUpdate('landmarkFontSize', v)} min={6} max={200} unit="px" />
                    <ColorField label="لون الخط" value={settings.landmarkColor ?? '#666666'} onChange={v => onUpdate('landmarkColor', v)} />
                    <SliderField label="من الأسفل (Y)" value={settings.landmarkBottomPercent ?? 2} onChange={v => onUpdate('landmarkBottomPercent', v)} min={0} max={50} unit="%" />
                    <SliderField label="من اليسار (X)" value={settings.landmarkLeftPercent ?? 50} onChange={v => onUpdate('landmarkLeftPercent', v)} min={0} max={100} unit="%" />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* مقاس اللوحة */}
            <AccordionItem value="sizelabel" className="border rounded-lg px-3 bg-card/50">
              <AccordionTrigger className="py-2 text-xs font-bold hover:no-underline">
                <span className="flex items-center gap-2">
                  <Ruler className="h-3.5 w-3.5 text-indigo-500" />
                  مقاس اللوحة
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">إظهار المقاس</Label>
                  <Switch checked={settings.showSizeLabel ?? true} onCheckedChange={v => onUpdate('showSizeLabel', v)} />
                </div>
                {(settings.showSizeLabel ?? true) && (
                  <>
                    <SliderField label="حجم الخط" value={settings.sizeLabelFontSize ?? 14} onChange={v => onUpdate('sizeLabelFontSize', v)} min={6} max={100} unit="px" />
                    <ColorField label="اللون" value={settings.sizeLabelColor ?? '#555555'} onChange={v => onUpdate('sizeLabelColor', v)} />
                    <SliderField label="من الأعلى (Y)" value={settings.sizeLabelTopPercent ?? 25} onChange={v => onUpdate('sizeLabelTopPercent', v)} min={0} max={95} unit="%" />
                    <SliderField label="من اليسار (X)" value={settings.sizeLabelLeftPercent ?? 50} onChange={v => onUpdate('sizeLabelLeftPercent', v)} min={0} max={100} unit="%" />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </div>
  );
}
