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
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* بحث */}
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <SearchInputWithHistory
            historyKey="customers"
            placeholder="البحث بالاسم أو الشركة أو رقم الهاتف..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pr-10"
          />
        </div>

        {/* الترتيب حسب */}
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
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

        {/* اتجاه الترتيب */}
        <Button
          variant="outline"
          size="icon"
          onClick={onSortOrderToggle}
          className="shrink-0"
        >
          {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
        </Button>

        {/* فلتر الحالة */}
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-full sm:w-[200px]">
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