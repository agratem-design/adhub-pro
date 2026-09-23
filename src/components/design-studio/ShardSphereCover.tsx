import { useId, type ReactNode } from 'react';

type Props = {
  width: number;
  height: number;
  photos: { url: string }[];
  crops: { x: number; y: number }[];
  title: string;
  kicker: string;
  tagline: string;
  accent: string;
  titleSize: number;
  kickerSize: number;
  taglineSize: number;
  zoom: number;
  intensity: number;
  mixImages: boolean;
  showCollage: boolean;
  colorStrength: number;
  glow: string;
  glowOpacity: number;
  glowBlur: number;
  glowSpread: number;
  showKicker: boolean;
  showTagline: boolean;
  swap: boolean;
  header: ReactNode;
  footer: ReactNode;
};

// Shards forming a dynamic shattered starburst contour
// Leaving top ~11% open for the golden brand header and bottom ~10% open for the golden divider
const shardPolys = [
  '0.5,11 43,16 50,51.5 0.5,32',
  '0.5,32 50,51.5 0.5,64',
  '0.5,64 50,51.5 24,84 0.5,84',
  '24,84 50,51.5 49,89.5 27,89.5',
  '49,89.5 50,51.5 68,89.5 53,90',
  '68,89.5 50,51.5 99.5,82 99.5,89.5',
  '99.5,82 50,51.5 99.5,35',
  '99.5,35 50,51.5 48,16 99.5,11',
];

export function ShardSphereCover(p: Props) {
  const id = useId().replace(/:/g, '');
  const minDim = Math.min(p.width, p.height);
  const sphereSize = minDim * 0.52;
  const imgUrl = p.photos[0]?.url || '';
  const scale = p.width / 1200;
  const accentColor = p.accent || '#d6ac40';

  return (
    <div
      style={{
        width: p.width,
        height: p.height,
        backgroundColor: '#07080a',
        position: 'relative',
        overflow: 'hidden',
        direction: 'rtl',
        fontFamily: "'Tajawal', 'Cairo', sans-serif",
      }}
    >
      {/* Background subtle radial ambient glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(214,172,64,0.06) 0%, rgba(7,8,10,0.85) 65%, #07080a 100%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Continuous Hero Image Split Across Polygons */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {shardPolys.map((poly, idx) => {
          const percentPoly = poly
            .split(' ')
            .map((pair) =>
              pair
                .split(',')
                .map((n) => n + '%')
                .join(' ')
            )
            .join(', ');

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                inset: 0,
                clipPath: `polygon(${percentPoly})`,
              }}
            >
              {imgUrl && (
                <img
                  src={imgUrl}
                  crossOrigin="anonymous"
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: '50% 50%',
                    display: 'block',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Shard Borders Overlay (Metallic Beveled Gold) */}
      <svg
        width={p.width}
        height={p.height}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
      >
        <defs>
          <linearGradient id={`gold-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fae596" />
            <stop offset="35%" stopColor={accentColor} />
            <stop offset="70%" stopColor="#f3d37a" />
            <stop offset="100%" stopColor="#96701b" />
          </linearGradient>
          <filter id={`shard-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g filter={`url(#shard-glow-${id})`}>
          {shardPolys.map((poly, idx) => {
            const points = poly
              .split(' ')
              .map((pair) => {
                const [x, y] = pair.split(',').map(Number);
                return `${(x * p.width) / 100},${(y * p.height) / 100}`;
              })
              .join(' ');
            return (
              <polygon
                key={idx}
                points={points}
                fill="none"
                stroke={`url(#gold-grad-${id})`}
                strokeWidth={Math.max(2, 2.8 * scale)}
                strokeLinejoin="round"
              />
            );
          })}
        </g>
      </svg>

      {/* Subtle outer vignette shadow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 140px rgba(0,0,0,0.85)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* ──── Top Header ──── */}
      <div
        style={{
          position: 'absolute',
          top: Math.max(16, p.height * 0.032),
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        {p.header ? (
          p.header
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                color: accentColor,
                fontSize: Math.max(26, 36 * scale),
                fontWeight: 900,
                letterSpacing: '0.02em',
                textShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 30px ${accentColor}44`,
              }}
            >
              الفارس الذهبي
            </span>
            <span
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: Math.max(13, 17 * scale),
                fontWeight: 500,
                letterSpacing: '0.05em',
              }}
            >
              للدعاية والإعلان
            </span>
          </div>
        )}
      </div>

      {/* ──── Floating 3D Smoked Glass Central Sphere ──── */}
      <div
        style={{
          position: 'absolute',
          top: '51.5%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: sphereSize,
          height: sphereSize,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 28%, rgba(42, 46, 60, 0.95) 0%, rgba(14, 16, 22, 0.98) 70%, rgba(6, 7, 9, 1) 100%)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: `${32 * scale}px`,
          zIndex: 6,
          boxShadow: `0 25px 60px rgba(0,0,0,0.95), 0 0 45px ${accentColor}33, inset 0 0 35px rgba(0,0,0,0.85)`,
          border: `${Math.max(2, 2.5 * scale)}px solid ${accentColor}`,
        }}
      >
        {/* Specular curved reflection crescent at top of the sphere */}
        <div
          style={{
            position: 'absolute',
            top: `${6 * scale}px`,
            left: '18%',
            right: '18%',
            height: '32%',
            borderRadius: '50%',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Inner subtle specular hairline ring */}
        <svg
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: '50%' }}
          width="100%"
          height="100%"
        >
          <circle
            cx="50%"
            cy="50%"
            r="calc(50% - 6px)"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
        </svg>

        {/* Kicker */}
        {p.showKicker && p.kicker && (
          <div
            style={{
              color: accentColor,
              fontSize: Math.max(16, (p.kickerSize || 22) * scale),
              marginBottom: `${14 * scale}px`,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textShadow: `0 2px 10px ${accentColor}66`,
            }}
          >
            {p.kicker}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            color: '#ffffff',
            fontSize: Math.max(30, (p.titleSize || 54) * scale),
            fontWeight: 900,
            lineHeight: 1.16,
            textShadow: '0 6px 24px rgba(0,0,0,0.95)',
            maxWidth: '92%',
            overflowWrap: 'break-word',
          }}
        >
          {p.title || 'اسم الحملة'}
        </div>

        {/* Thin divider line */}
        <div
          style={{
            width: '45%',
            height: Math.max(1, 1.5 * scale),
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            margin: `${16 * scale}px 0`,
          }}
        />

        {/* Tagline (Clean, elegant text — no yellow pill!) */}
        {p.showTagline && p.tagline && (
          <div
            style={{
              color: 'rgba(255,255,255,0.95)',
              fontSize: Math.max(14, (p.taglineSize || 20) * scale),
              fontWeight: 600,
              lineHeight: 1.3,
              letterSpacing: '0.02em',
              textShadow: '0 2px 12px rgba(0,0,0,0.8)',
            }}
          >
            {p.tagline}
          </div>
        )}
      </div>

      {/* ──── Bottom Golden Separator and Footer ──── */}
      <div
        style={{
          position: 'absolute',
          bottom: Math.max(24, p.height * 0.038),
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${10 * scale}px`,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: Math.min(240, p.width * 0.22),
            height: Math.max(2, 2.5 * scale),
            background: `linear-gradient(90deg, transparent, ${accentColor} 30%, ${accentColor} 70%, transparent)`,
            borderRadius: 99,
          }}
        />
        {p.footer}
      </div>
    </div>
  );
}
