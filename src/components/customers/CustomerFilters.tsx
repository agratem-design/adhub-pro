import { SearchInputWithHistory } from '@/components/ui/SearchInputWithHistory';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, SortAsc, SortDesc } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CustomerFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
}

export function CustomerFilters({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  sortOrder,
  onSortOrderToggle,
  filterStatus,
  onFilterStatusChange
}: CustomerFiltersProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_190px_48px_190px]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/80" />
          <SearchInputWithHistory
            historyKey="customers"
            placeholder="البحث بالاسم أو الشركة أو رقم الهاتف..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 rounded-xl border-border/70 bg-card/70 pr-10 transition-all duration-200 focus-visible:border-primary/60"
          />
        </div>

        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="h-11 w-full cursor-pointer rounded-xl border-border/70 bg-card/70 transition-all duration-200 hover:border-primary/40">
            <SelectValue placeholder="الترتيب حسب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">الاسم</SelectItem>
            <SelectItem value="totalRent">إجمالي العقود</SelectItem>
            <SelectItem value="totalPaid">إجمالي المدفوع</SelectItem>
            <SelectItem value="remaining">المتبقي</SelectItem>
            <SelectItem value="contractsCount">عدد العقود</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onSortOrderToggle}
          className="h-11 w-full cursor-pointer rounded-xl border-border/70 bg-card/70 transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-95 motion-reduce:transform-none motion-reduce:transition-none md:w-12"
          aria-label={sortOrder === 'asc' ? 'ترتيب تصاعدي' : 'ترتيب تنازلي'}
          title={sortOrder === 'asc' ? 'ترتيب تصاعدي' : 'ترتيب تنازلي'}
        >
          {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
        </Button>

        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="h-11 w-full cursor-pointer rounded-xl border-border/70 bg-card/70 transition-all duration-200 hover:border-primary/40">
            <SelectValue placeholder="حالة الدفع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="has_balance">له رصيد متبقي</SelectItem>
            <SelectItem value="fully_paid">مدفوع بالكامل</SelectItem>
            <SelectItem value="has_contracts">له عقود</SelectItem>
            <SelectItem value="no_contracts">بدون عقود</SelectItem>
            <SelectItem value="suppliers">موردين فقط</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
