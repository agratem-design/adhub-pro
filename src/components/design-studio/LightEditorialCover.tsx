import type { ReactNode } from 'react';
import { fitCoverTitle } from './coverLayout';

type Props = {
  width: number;
  height: number;
  photo: string;
  crop: { x: number; y: number };
  title: string;
  kicker: string;
  tagline: string;
  accent: string;
  titleSize: number;
  kickerSize: number;
  taglineSize: number;
  showKicker: boolean;
  showTagline: boolean;
  showPhoto: boolean;
  intensity: number;
  header: ReactNode;
  footer: ReactNode;
};

/** Editable implementation of the luxury Light Editorial reference cover (الصورة البيضاء). */
export function LightEditorialCover(p: Props) {
  const W = p.width,
    H = p.height,
    unit = Math.min(W, H) / 1200;
  const margin = W * 0.042;
  const photoTop = H * 0.285;
  const photoHeight = H * 0.635;
  const photoWidth = W - 2 * margin;

  const title = p.title || 'اسم الحملة';
  const lines = Math.max(1, Math.ceil(Array.from(title).length / 26));
  const titleSize = Math.min(
    fitCoverTitle(p.titleSize * unit, title, W * 0.88),
    (H * 0.1) / (lines * 1.15)
  );

  const lens = Math.min(W, H) * 0.21;
  const lensLeft = W * 0.68;
  const lensTop = H * 0.76;

  const imageStyle = {
    width: photoWidth,
    height: photoHeight,
    maxWidth: 'none',
    objectFit: 'cover' as const,
    objectPosition: `${p.crop.x}% ${p.crop.y}%`,
  };

  const effect = Math.max(0, Math.min(1, p.intensity));
  const accentColor = p.accent || '#d6ac40';

  return (
    <div
      dir="rtl"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#f4f0e8',
        color: '#1d1d1f',
        fontFamily: "'Tajawal', 'Cairo', sans-serif",
        isolation: 'isolate',
      }}
    >
      {/* ──── Header: Brand Identity (Top Right) ──── */}
      <div
        style={{
          position: 'absolute',
          top: H * 0.035,
          left: margin,
          right: margin,
          height: H * 0.07,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {p.header ? (
          p.header
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span
              style={{
                fontSize: Math.max(20, 26 * unit),
                fontWeight: 900,
                color: '#1d1d1f',
                letterSpacing: '0.01em',
              }}
            >
              الفارس الذهبي
            </span>
            <span
              style={{
                fontSize: Math.max(11, 14 * unit),
                fontWeight: 600,
                color: '#65615a',
                letterSpacing: '0.04em',
              }}
            >
              للدعاية والإعلان
            </span>
          </div>
        )}
      </div>

      {/* ──── Main Editorial Headline Section ──── */}
      <div
        style={{
          position: 'absolute',
          top: H * 0.115,
          height: H * 0.155,
          left: W * 0.06,
          right: W * 0.06,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: H * 0.01,
          textAlign: 'center',
          zIndex: 8,
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 900,
            lineHeight: 1.15,
            color: '#141416',
            overflowWrap: 'anywhere',
            maxWidth: '100%',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>

        {p.showKicker && p.kicker && (
          <div
            style={{
              fontSize: Math.min(p.kickerSize * unit, H * 0.024),
              fontWeight: 600,
              lineHeight: 1.3,
              color: '#555149',
              letterSpacing: '0.12em',
            }}
          >
            {p.kicker}
          </div>
        )}
      </div>

      {/* ──── Hero Architectural Store Photo ──── */}
      {p.showPhoto && (
        <div
          style={{
            position: 'absolute',
            left: margin,
            top: photoTop,
            width: photoWidth,
            height: photoHeight,
            overflow: 'hidden',
            background: '#ded9cf',
            borderRadius: `${6 * unit}px`,
            boxShadow: `0 ${10 * unit}px ${30 * unit}px rgba(0,0,0,0.08)`,
          }}
        >
          {p.photo && (
            <img
              src={p.photo}
              crossOrigin="anonymous"
              alt=""
              style={{ ...imageStyle, display: 'block' }}
            />
          )}
        </div>
      )}

      {/* ──── Glass & Lens Accents ──── */}
      {effect > 0 && p.showPhoto && (
        <div style={{ opacity: effect, pointerEvents: 'none' }}>
          {/* Faceted Glass Shards SVG */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 6,
            }}
            aria-hidden="true"
          >
            <polygon
              points={`${-0.03 * W},${0.065 * H} ${0.28 * W},${0.41 * H} ${-0.03 * W},${0.52 * H}`}
              fill="rgba(255, 255, 255, 0.22)"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth={2 * unit}
            />
            <polyline
              points={`${-0.03 * W},${0.07 * H} ${0.275 * W},${0.41 * H} ${-0.03 * W},${0.515 * H}`}
              fill="none"
              stroke="rgba(100, 110, 120, 0.15)"
              strokeWidth={unit}
            />
            <polygon
              points={`${1.03 * W},${0.42 * H} ${0.85 * W},${0.62 * H} ${1.03 * W},${0.72 * H}`}
              fill="rgba(255, 255, 255, 0.18)"
              stroke="rgba(255, 255, 255, 0.88)"
              strokeWidth={2 * unit}
            />
          </svg>

          {/* Glowing Circular Lens Ring Overlay */}
          <div
            style={{
              position: 'absolute',
              left: lensLeft,
              top: lensTop,
              width: lens,
              height: lens,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `${unit * 2}px solid rgba(255,255,255,0.92)`,
              boxShadow: `0 ${6 * unit}px ${20 * unit}px rgba(0,0,0,0.15), inset 0 0 ${8 * unit}px rgba(255,255,255,0.6)`,
              zIndex: 7,
            }}
          >
            {p.photo && (
              <img
                src={p.photo}
                crossOrigin="anonymous"
                alt=""
                style={{
                  ...imageStyle,
                  position: 'absolute',
                  left: margin - lensLeft,
                  top: photoTop - lensTop,
                  transform: 'scale(1.04)',
                  transformOrigin: `${lensLeft - margin + lens / 2}px ${lensTop - photoTop + lens / 2}px`,
                }}
              />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.3) 100%)',
              }}
            />
          </div>
        </div>
      )}

      {/* ──── Bottom Footer Section ──── */}
      <div
        style={{
          position: 'absolute',
          top: H * 0.948,
          left: margin,
          right: margin,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: W * 0.05,
          zIndex: 10,
        }}
      >
        {p.showTagline && p.tagline ? (
          <div
            style={{
              fontSize: Math.min(p.taglineSize * unit, H * 0.022),
              fontWeight: 700,
              lineHeight: 1.4,
              color: '#1d1d1f',
              letterSpacing: '0.02em',
              maxWidth: '75%',
              overflowWrap: 'anywhere',
            }}
          >
            {p.tagline}
          </div>
        ) : (
          <span />
        )}

        <div
          style={{
            width: W * 0.22,
            height: Math.max(2, 2.2 * unit),
            background: accentColor,
            borderRadius: 99,
            flexShrink: 0,
          }}
        />
      </div>

      {p.footer && (
        <div
          style={{
            position: 'absolute',
            bottom: H * 0.008,
            left: margin,
            right: margin,
            fontSize: 11 * unit,
            color: '#625c52',
            zIndex: 10,
          }}
        >
          {p.footer}
        </div>
      )}
    </div>
  );
}
