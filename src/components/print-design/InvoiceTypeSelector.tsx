import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  InvoiceTemplateType, 
  InvoiceTemplateInfo, 
  INVOICE_TEMPLATES,
  TEMPLATE_CATEGORIES
} from '@/types/invoice-templates';
import * as LucideIcons from 'lucide-react';

interface Props {
  selectedType: InvoiceTemplateType;
  onSelectType: (type: InvoiceTemplateType) => void;
}

const getIcon = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-4 w-4" /> : null;
};

export function InvoiceTypeSelector({ selectedType, onSelectType }: Props) {
  // Group templates by category
  const groupedTemplates = INVOICE_TEMPLATES.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, InvoiceTemplateInfo[]>);

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-4">
        {Object.entries(TEMPLATE_CATEGORIES).map(([categoryKey, category]) => {
          const templates = groupedTemplates[categoryKey] || [];
          if (templates.length === 0) return null;

          return (
            <div key={categoryKey}>
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                {getIcon(category.icon)}
                <span>{category.name}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {templates.length}
                </Badge>
              </div>
              <div className="space-y-1 mt-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => onSelectType(template.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg text-right transition-all",
                      "hover:bg-accent/50",
                      selectedType === template.id 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-md",
                      selectedType === template.id 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}>
                      {getIcon(template.icon)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{template.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function getTemplateInfo(type: InvoiceTemplateType): InvoiceTemplateInfo | undefined {
  return INVOICE_TEMPLATES.find(t => t.id === type);
}