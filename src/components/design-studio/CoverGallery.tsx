export const coverLayouts = [
  { id: 'template1', name: 'تموّج ذهبي', description: 'شرائح وإضاءة عميقة', layout: 'wave' },
  { id: 'template2', name: 'كريستال', description: 'تكوين زجاجي متبلور', layout: 'crystal' },
  { id: 'template3', name: 'النجمة الذهبية', description: 'شظايا مذهبة وكرة زجاجية (أسود فاخر)', layout: 'hero' },
  { id: 'template4', name: 'بطاقات', description: 'صور متداخلة وتأثيرات عمق', layout: 'cards' },
  { id: 'template5', name: 'البوابة الذهبية', description: 'إطار ذهبي ثلاثي الأبعاد', layout: 'portal' },
  { id: 'template6', name: 'الأعمدة الزجاجية', description: 'خمسة أعمدة بعمق ثلاثي الأبعاد', layout: 'gallery' },
  { id: 'template7', name: 'الموزاييك السينمائي', description: 'قطع موزاييك وبطاقة زجاجية', layout: 'split' },
  { id: 'template8', name: 'الغلاف التحريري', description: 'صورة كاملة وعدسة نقية (أبيض فاخر)', layout: 'report' },
] as const;

export type CoverTemplateId = typeof coverLayouts[number]['id'];

// A small layout diagram, deliberately independent of remote images.
export function CoverThumbnail({ id }: { id: CoverTemplateId }) {
  if (id === 'template8') {
    return (
      <div aria-hidden="true" className="relative h-20 overflow-hidden rounded-md bg-[#eeeae2] px-3 py-2 border border-black/10">
        <div className="ml-auto h-0.5 w-6 bg-[#302d28]" />
        <div className="mx-auto mb-2 mt-2 h-1 w-12 bg-[#302d28]" />
        <div className="relative h-10 bg-[#84959b] rounded-sm overflow-hidden">
          <div className="absolute bottom-0 left-3 h-7 w-8 bg-[#364a50]" />
          <div className="absolute bottom-0 right-2 h-9 w-6 bg-[#c0b4a0]" />
          <div className="absolute bottom-1 right-3 h-4 w-4 rounded-full border border-white/80 bg-white/20 shadow-sm" />
        </div>
      </div>
    );
  }

  if (id === 'template3') {
    return (
      <div aria-hidden="true" className="relative h-20 overflow-hidden rounded-md bg-[#07080a] p-2 border border-[#d6ac40]/30">
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-10 bg-[#d6ac40] rounded-full" />
        <div className="relative h-full w-full flex items-center justify-center">
          <div className="absolute inset-1 grid grid-cols-3 gap-0.5 opacity-60">
            <span className="border border-[#d6ac40]/50 bg-[#d6ac40]/15" style={{ clipPath: 'polygon(0 0, 100% 20%, 70% 100%, 0 80%)' }} />
            <span className="border border-[#d6ac40]/50 bg-[#d6ac40]/15" style={{ clipPath: 'polygon(20% 0, 100% 0, 90% 100%, 0 100%)' }} />
            <span className="border border-[#d6ac40]/50 bg-[#d6ac40]/15" style={{ clipPath: 'polygon(0 15%, 100% 0, 100% 85%, 20% 100%)' }} />
          </div>
          <div className="relative z-10 h-8 w-8 rounded-full border-2 border-[#d6ac40] bg-[#12141a]/95 flex flex-col items-center justify-center shadow-[0_0_10px_rgba(214,172,64,0.4)]">
            <span className="h-0.5 w-4 bg-white rounded-full" />
            <span className="h-0.5 w-2.5 bg-[#d6ac40] rounded-full mt-0.5" />
          </div>
        </div>
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-[#d6ac40]/70 rounded-full" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="relative h-20 overflow-hidden rounded-md bg-[#10121a] p-2 border border-border/30">
      <div className="grid h-full gap-1" style={{ gridTemplateColumns: `repeat(${id === 'template6' ? 5 : 4}, 1fr)` }}>
        {Array.from({ length: id === 'template6' ? 5 : 8 }, (_, i) => (
          <span
            key={i}
            className="border border-[#d6ac40]/40 bg-[#d6ac40]/20"
            style={{
              transform: id === 'template6' ? `skewY(${i % 2 ? 8 : -8}deg)` : `rotate(${i % 2 ? 8 : -8}deg)`,
            }}
          />
        ))}
      </div>
      <div className={`absolute left-1/2 top-1/2 flex h-10 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 border border-[#d6ac40]/60 bg-[#10121a]/90 ${id === 'template7' ? 'rounded-md' : 'rounded-full'}`}>
        <span className="h-1 w-8 bg-white/80" />
        <span className="h-1 w-5 bg-[#d6ac40]" />
      </div>
    </div>
  );
}
