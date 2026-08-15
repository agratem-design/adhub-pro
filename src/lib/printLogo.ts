// ✅ تحميل الشعار وتحويله إلى Base64 لضمان ظهوره في الطباعة

// الشعار كـ Base64 PNG (سيتم تحميله من المجلد العام)
let cachedLogoDataUri: string | null = null;

// دالة لتحميل الشعار وتحويله إلى PNG Base64 (لضمان التوافق مع الطباعة)
export async function loadPrintLogo(): Promise<string> {
  if (cachedLogoDataUri) {
    return cachedLogoDataUri;
  }

  try {
    // تحميل الشعار من المجلد العام
    const response = await fetch('/logofaresgold.svg');
    const svgText = await response.text();
    
    // تحويل SVG إلى PNG باستخدام Canvas
    const pngDataUri = await svgToPng(svgText, 337, 133);
    cachedLogoDataUri = pngDataUri;
    
    return cachedLogoDataUri;
  } catch (error) {
    console.error('Error loading print logo:', error);
    // fallback إلى شعار بسيط
    return getSimpleLogo();
  }
}

// تحويل SVG إلى PNG
async function svgToPng(svgText: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // استخدام أبعاد أكبر للجودة
    canvas.width = width * 2;
    canvas.height = height * 2;
    
    img.onload = () => {
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, width, height);
      const pngDataUri = canvas.toDataURL('image/png');
      resolve(pngDataUri);
    };
    
    img.onerror = () => {
      // في حالة فشل تحميل الـ SVG، نستخدم الشعار البسيط
      resolve(getSimpleLogo());
    };
    
    // تحويل SVG إلى data URI
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    img.src = URL.createObjectURL(svgBlob);
  });
}

// شعار بسيط كـ fallback
function getSimpleLogo(): string {
  const simpleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 337 133" width="337" height="133">
    <defs>
      <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#d6ac40;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#fef492;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect fill="url(#grad1)" width="133" height="133" rx="20"/>
    <circle cx="66.5" cy="66.5" r="40" fill="#fff"/>
    <text x="235" y="75" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#141414" text-anchor="middle">الفارس</text>
    <text x="235" y="105" font-family="Arial, sans-serif" font-size="14" fill="#666" text-anchor="middle">ALFARES ALDAHAB</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(simpleSvg)))}`;
}

// دالة للحصول على الشعار بشكل متزامن (تستخدم الـ cache أو الـ fallback)
export function getPrintLogoSync(): string {
  if (cachedLogoDataUri) {
    return cachedLogoDataUri;
  }
  return getSimpleLogo();
}

// تحميل الشعار مسبقاً عند تحميل التطبيق
loadPrintLogo().catch(console.error);

// للتوافق مع الكود القديم
export const PRINT_LOGO_DATA_URI = getSimpleLogo();
export const PRINT_LOGO_SVG = '';
