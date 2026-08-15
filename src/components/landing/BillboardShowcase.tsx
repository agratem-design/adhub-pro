import React, { useState, useMemo } from 'react';
import { Billboard } from '@/types';
import { isBillboardAvailable } from '@/utils/contractUtils';
import { isContractExpired } from '@/utils/contractUtils';
import { motion } from 'framer-motion';
import { MapPin, Maximize2, Layers, Search, Filter, ChevronDown, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BillboardShowcaseProps {
  billboards: Billboard[];
}

const BillboardShowcase: React.FC<BillboardShowcaseProps> = ({ billboards }) => {
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [municipalityFilter, setMunicipalityFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  // Filter: available + upcoming (expired contracts), exclude hidden & friend company
  const availableBillboards = useMemo(() => {
    return billboards.filter((b: any) => {
      // Exclude hidden from available
      if (b.is_visible_in_available === false) return false;
      // Exclude friend company billboards
      if (b.friend_company_id) return false;
      if (b.is_partnership === true) return false;

      return isBillboardAvailable(b);
    });
  }, [billboards]);

  const uniqueCities = useMemo(() => [...new Set(availableBillboards.map(b => b.City).filter(Boolean))].sort(), [availableBillboards]);
  const uniqueSizes = useMemo(() => [...new Set(availableBillboards.map(b => b.Size).filter(Boolean))].sort(), [availableBillboards]);
  const uniqueMunicipalities = useMemo(() => [...new Set(availableBillboards.map((b: any) => b.Municipality).filter(Boolean))].sort(), [availableBillboards]);

  const filtered = useMemo(() => {
    return availableBillboards.filter((b: any) => {
      const matchesSearch = !search ||
        (b.Billboard_Name || '').includes(search) ||
        (b.City || '').includes(search) ||
        (b.District || '').includes(search) ||
        (b.Nearest_Landmark || '').includes(search) ||
        String(b.ID).includes(search);

      const matchesCity = cityFilter === 'all' || b.City === cityFilter;
      const matchesSize = sizeFilter === 'all' || b.Size === sizeFilter;
      const matchesMunicipality = municipalityFilter === 'all' || (b.Municipality || '') === municipalityFilter;

      return matchesSearch && matchesCity && matchesSize && matchesMunicipality;
    });
  }, [availableBillboards, search, cityFilter, sizeFilter, municipalityFilter]);

  const displayed = showAll ? filtered : filtered.slice(0, 12);

  const getImageUrl = (b: any) => {
    const imageName = b.image_name || b.Image_Name;
    const imageUrl = b.Image_URL || b.image;
    return imageName ? `/image/${imageName}` : (imageUrl || '');
  };

  if (availableBillboards.length === 0) return null;

  return (
    <section className="py-24 relative" id="available-billboards">
      <div className="absolute inset-0 art-deco-pattern opacity-30" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/8 border border-primary/15 rounded-full mb-4">
            <Eye className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary tracking-wide">{availableBillboards.length} لوحة متاحة</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3">
            اللوحات <span className="text-primary">المتاحة</span> للحجز
          </h2>
          <div className="h-[2px] w-20 bg-gradient-to-l from-transparent via-primary to-transparent mx-auto mb-4" />
          <p className="text-muted-foreground max-w-lg mx-auto">
            تصفح اللوحات الإعلانية المتاحة واختر الموقع الأنسب لحملتك
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap items-center gap-3 mb-8 p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم اللوحة أو الموقع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 bg-background/80 border-border/50 rounded-xl"
            />
          </div>

          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[140px] rounded-xl bg-background/80 border-border/50">
              <SelectValue placeholder="المدينة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المدن</SelectItem>
              {uniqueCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-[140px] rounded-xl bg-background/80 border-border/50">
              <SelectValue placeholder="المقاس" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المقاسات</SelectItem>
              {uniqueSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {uniqueMunicipalities.length > 1 && (
            <Select value={municipalityFilter} onValueChange={setMunicipalityFilter}>
              <SelectTrigger className="w-[140px] rounded-xl bg-background/80 border-border/50">
                <SelectValue placeholder="البلدية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل البلديات</SelectItem>
                {uniqueMunicipalities.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Badge variant="outline" className="px-3 py-2 text-xs font-semibold border-primary/20 text-primary">
            {filtered.length} نتيجة
          </Badge>
        </motion.div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد لوحات تطابق البحث</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {displayed.map((billboard: any, i) => {
                const img = getImageUrl(billboard);
                const isExpired = billboard.Contract_Number && isContractExpired(billboard.Rent_End_Date);

                return (
                  <motion.div
                    key={billboard.ID}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}
                    className="group relative rounded-2xl overflow-hidden bg-card border border-border hover:border-primary/25 transition-all duration-500 hover:shadow-luxury"
                  >
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden bg-muted">
                      {img ? (
                        <img
                          src={img}
                          alt={billboard.Billboard_Name || `لوحة ${billboard.ID}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Layers className="h-10 w-10 text-muted-foreground/20" />
                        </div>
                      )}

                      {/* Status badge */}
                      <div className="absolute top-3 right-3">
                        <Badge className={`text-[10px] font-bold rounded-full px-2.5 py-0.5 shadow-sm ${
                          isExpired
                            ? 'bg-amber-500/90 text-white border-0'
                            : 'bg-emerald-500/90 text-white border-0'
                        }`}>
                          {isExpired ? 'قادمة' : 'متاحة'}
                        </Badge>
                      </div>

                      {/* ID badge */}
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="text-[10px] font-mono rounded-full px-2 py-0.5 bg-background/80 backdrop-blur-sm border-0">
                          #{billboard.ID}
                        </Badge>
                      </div>

                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2.5">
                      <h3 className="font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {billboard.Billboard_Name || `لوحة ${billboard.ID}`}
                      </h3>

                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 text-primary/60 shrink-0" />
                        <span className="text-xs line-clamp-1">
                          {[billboard.City, billboard.District].filter(Boolean).join(' - ') || 'غير محدد'}
                        </span>
                      </div>

                      {billboard.Nearest_Landmark && (
                        <p className="text-[11px] text-muted-foreground/70 line-clamp-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-500 shrink-0" /> {billboard.Nearest_Landmark}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <Maximize2 className="h-3 w-3 text-primary/50" />
                          <span className="text-xs font-medium text-foreground/80">{billboard.Size || '-'}</span>
                        </div>
                        {billboard.Faces_Count && (
                          <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                            {billboard.Faces_Count} وجه
                          </span>
                        )}
                        {billboard.Level && (
                          <span className="text-[10px] font-medium text-primary/70">
                            {billboard.Level}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Show more */}
            {filtered.length > 12 && !showAll && (
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center mt-10"
              >
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowAll(true)}
                  className="rounded-full px-8 gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                >
                  <ChevronDown className="h-4 w-4" />
                  عرض الكل ({filtered.length} لوحة)
                </Button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default BillboardShowcase;
