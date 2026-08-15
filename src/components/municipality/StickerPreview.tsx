import { useMemo } from 'react';
import type { StickerSettings, PreviewBillboard } from './MunicipalityStickerSettings';

interface Props {
  settings: StickerSettings;
  zoom: number;
  previewBillboard?: PreviewBillboard | null;
}

export default function StickerPreview({ settings, zoom, previewBillboard }: Props) {
  const CM_TO_PX = 37.8;
  const pxW = settings.stickerWidth * CM_TO_PX;
  const pxH = settings.stickerHeight * CM_TO_PX;

  const sampleNumber = previewBillboard ? String(previewBillboard.id).padStart(3, '0') : '001';
  const sampleMunicipality = previewBillboard?.municipality || 'بلدية طرابلس';
  const sampleLandmark = previewBillboard?.landmark || 'أقرب نقطة دالة';
  const sampleImage = previewBillboard?.imageUrl || '';
  const sampleSize = previewBillboard?.size || '3x4';

  // Force re-render key based on all settings
  const settingsKey = JSON.stringify(settings);

  const companyStyle = useMemo(() => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 5,
      width: settings.companyLogoWidth,
      height: 'auto',
      objectFit: 'contain' as const,
      top: `${settings.companyLogoTopPercent ?? 4}%`,
      left: `${settings.companyLogoLeftPercent ?? 5}%`,
    };
    return base;
  }, [settings.companyLogoWidth, settings.companyLogoTopPercent, settings.companyLogoLeftPercent]);

  const muniStyle = useMemo(() => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 5,
      width: settings.municipalityLogoWidth,
      height: 'auto',
      objectFit: 'contain' as const,
      top: `${settings.municipalityLogoTopPercent ?? 4}%`,
      left: `${settings.municipalityLogoLeftPercent ?? 85}%`,
    };
    return base;
  }, [settings.municipalityLogoWidth, settings.municipalityLogoTopPercent, settings.municipalityLogoLeftPercent]);

  return (
    <div
      key={settingsKey}
      className="relative overflow-hidden rounded-2xl shadow-xl border border-border/50"
      style={{
        width: pxW,
        height: pxH,
        transformOrigin: 'top left',
        transform: `scale(${zoom})`,
      }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundColor: settings.backgroundColor,
          ...(settings.backgroundUrl ? {
            backgroundImage: `url(${settings.backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {}),
        }}
      />

      {/* Company logo */}
      {settings.showCompanyLogo && settings.companyLogoUrl && (
        <img
          src={settings.companyLogoUrl}
          alt="شعار الشركة"
          style={companyStyle}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* Municipality logo */}
      {settings.showMunicipalityLogo && settings.municipalityLogoUrl && (
        <img
          src={settings.municipalityLogoUrl}
          alt="شعار البلدية"
          style={muniStyle}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* Municipality name */}
      {settings.showMunicipalityName && (
        <div
          className="absolute z-5 font-bold text-center whitespace-nowrap"
          style={{
            top: `${settings.municipalityNameTopPercent ?? 6}%`,
            left: `${settings.municipalityNameLeftPercent ?? 50}%`,
            transform: 'translateX(-50%)',
            fontSize: settings.municipalityNameFontSize,
            color: settings.municipalityNameColor ?? '#333',
            width: '60%',
            fontFamily: "'Doran', 'Noto Sans Arabic', sans-serif",
          }}
        >
          {sampleMunicipality}
        </div>
      )}

      {/* Billboard number */}
      <div
        className="absolute z-5 text-center"
        style={{
          top: `${settings.numberTopPercent}%`,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: settings.numberFontSize,
          fontWeight: 900,
          color: settings.numberColor,
          fontFamily: "'Manrope', 'Arial Black', sans-serif",
          lineHeight: 1,
          letterSpacing: -2,
        }}
      >
        {sampleNumber}
      </div>

      {/* Billboard image */}
      {settings.showBillboardImage && (
        <div
          className="absolute z-5 overflow-hidden rounded-lg"
          style={{
            top: `${settings.imageTopPercent}%`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: `${settings.imageWidthPercent}%`,
            height: `${settings.imageHeightPercent}%`,
            border: '2px solid rgba(0,0,0,0.1)',
          }}
        >
          {sampleImage ? (
            <img
              src={sampleImage}
              alt="صورة اللوحة"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #e8dfc5 0%, #d4c9a8 50%, #bfb48f 100%)' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.35)', fontFamily: "'Noto Sans Arabic', sans-serif" }}>
                صورة اللوحة
              </span>
            </div>
          )}
        </div>
      )}

      {/* QR Code */}
      {settings.showQrCode && (
        <div
          style={{
            position: 'absolute',
            zIndex: 5,
            width: settings.qrSizePx,
            height: settings.qrSizePx,
            background: `rgba(30,30,30,${(settings.qrBgOpacity ?? 85) / 100})`,
            borderRadius: 12,
            padding: settings.qrPadding ?? 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            top: `${settings.qrTopPercent ?? 85}%`,
            left: `${settings.qrLeftPercent ?? 85}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="rounded-md"
            style={{
              width: '100%',
              height: '100%',
              background: 'white',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gridTemplateRows: 'repeat(5, 1fr)',
              gap: 2,
              padding: 4,
            }}
          >
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: [0,1,2,4,5,6,10,12,14,18,20,22,23,24].includes(i) ? '#222' : 'white',
                  borderRadius: 1,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Contact info */}
      {settings.showContactInfo && (
        <div
          className="absolute z-5 flex flex-col gap-1"
          style={{
            bottom: '5%',
            left: settings.qrLeftPercent > 50 ? '5%' : undefined,
            right: settings.qrLeftPercent <= 50 ? '5%' : undefined,
          }}
        >
          {settings.contactFacebook && (
            <div className="flex items-center gap-1.5" style={{ direction: 'ltr' }}>
              <div className="w-6 h-6 rounded-full bg-[#1877f2] flex items-center justify-center text-white text-[10px] font-black shrink-0">f</div>
              <div>
                <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Facebook</div>
                <div style={{ fontSize: 8, fontWeight: 800 }}>{settings.contactFacebook}</div>
              </div>
            </div>
          )}
          {settings.contactPhone && (
            <div className="flex items-center gap-1.5" style={{ direction: 'ltr' }}>
 <div className="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center text-white text-[10px] font-black shrink-0"></div>
              <div>
                <div style={{ fontSize: 7, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>Contact</div>
                <div style={{ fontSize: 9, fontWeight: 800 }}>{settings.contactPhone}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {settings.showLandmark && (
        <div
          className="absolute z-5 text-center"
          style={{
            bottom: `${settings.landmarkBottomPercent ?? 2}%`,
            left: `${settings.landmarkLeftPercent ?? 50}%`,
            transform: 'translateX(-50%)',
            fontSize: settings.landmarkFontSize ?? 10,
            color: settings.landmarkColor ?? '#666',
            padding: '2px 10px',
            maxWidth: '90%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sampleLandmark} - {previewBillboard?.municipality || 'المنطقة'}
        </div>
      )}

      {/* Size label */}
      {(settings.showSizeLabel ?? true) && (
        <div
          className="absolute z-5 text-center font-bold"
          style={{
            top: `${settings.sizeLabelTopPercent ?? 25}%`,
            left: `${settings.sizeLabelLeftPercent ?? 50}%`,
            transform: 'translateX(-50%)',
            fontSize: settings.sizeLabelFontSize ?? 14,
            color: settings.sizeLabelColor ?? '#555',
            whiteSpace: 'nowrap',
          }}
        >
          {sampleSize}
        </div>
      )}
    </div>
  );
}
