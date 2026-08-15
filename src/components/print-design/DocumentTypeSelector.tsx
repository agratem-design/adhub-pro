/**
 * Document Type Selector Component
 * مكون اختيار نوع المستند مع تصنيفات
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  DocumentType, 
  DOCUMENT_TYPES, 
  DOCUMENT_TYPE_INFO, 
  DOCUMENT_CATEGORIES,
  getDocumentsByCategory 
} from '@/types/document-types';
import { 
  FileText, 
  Receipt, 
  Package, 
  Users, 
  ShoppingCart, 
  CreditCard, 
  Printer, 
  Wrench, 
  Tag, 
  ClipboardList, 
  AlertTriangle, 
  Building2, 
  Scissors, 
  Layers, 
  UserCheck, 
  Ruler, 
  Wallet,
  FileSpreadsheet
} from 'lucide-react';

interface DocumentTypeSelectorProps {
  selectedType: DocumentType;
  onSelectType: (type: DocumentType) => void;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  FileText,
  Receipt,
  Package,
  Users,
  ShoppingCart,
  CreditCard,
  Printer,
  Wrench,
  Tag,
  ClipboardList,
  AlertTriangle,
  Building2,
  Scissors,
  Layers,
  UserCheck,
  Ruler,
  Wallet,
  FileSpreadsheet,
};

const categoryOrder: (keyof typeof DOCUMENT_CATEGORIES)[] = ['contracts', 'payments', 'operations', 'reports'];

export function DocumentTypeSelector({ selectedType, onSelectType }: DocumentTypeSelectorProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-4">
        {categoryOrder.map((category) => {
          const categoryInfo = DOCUMENT_CATEGORIES[category];
          const documents = getDocumentsByCategory(category);
          const CategoryIcon = iconMap[categoryInfo.icon] || FileText;
          
          return (
            <div key={category}>
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground font-semibold">
                <CategoryIcon className="h-3 w-3" />
                {categoryInfo.nameAr}
              </div>
              <div className="space-y-1 mt-1">
                {documents.map((doc) => {
                  const DocIcon = iconMap[doc.icon] || FileText;
                  const isSelected = selectedType === doc.id;
                  
                  return (
                    <button
                      key={doc.id}
                      onClick={() => onSelectType(doc.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <DocIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{doc.nameAr}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export function getDocumentInfo(type: DocumentType) {
  return DOCUMENT_TYPE_INFO[type];
}
