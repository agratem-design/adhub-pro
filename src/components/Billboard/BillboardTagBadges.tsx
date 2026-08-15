import { Badge } from '@/components/ui/badge';

const TAG_COLORS: Record<string, string> = {
  'صحة': 'bg-red-100 text-red-800 border-red-200',
  'تعليم': 'bg-blue-100 text-blue-800 border-blue-200',
  'تجاري': 'bg-amber-100 text-amber-800 border-amber-200',
  'سكني': 'bg-green-100 text-green-800 border-green-200',
  'صناعي': 'bg-gray-100 text-gray-800 border-gray-200',
  'ترفيهي': 'bg-purple-100 text-purple-800 border-purple-200',
  'رياضي': 'bg-orange-100 text-orange-800 border-orange-200',
  'ديني': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'حكومي': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'طريق سريع': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'طريق رئيسي': 'bg-teal-100 text-teal-800 border-teal-200',
  'وسط المدينة': 'bg-pink-100 text-pink-800 border-pink-200',
};

interface BillboardTagBadgesProps {
  tags?: string[] | null;
  locationType?: string | null;
  maxTags?: number;
}

export default function BillboardTagBadges({ tags, locationType, maxTags = 4 }: BillboardTagBadgesProps) {
  const allTags: string[] = [];
  if (locationType) allTags.push(locationType);
  if (tags?.length) allTags.push(...tags);

  const unique = [...new Set(allTags)];
  if (unique.length === 0) return null;

  const shown = unique.slice(0, maxTags);
  const remaining = unique.length - shown.length;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={`text-[10px] px-1.5 py-0 leading-4 ${TAG_COLORS[tag] || 'bg-muted text-muted-foreground border-border'}`}
        >
          {tag}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4 bg-muted text-muted-foreground">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
