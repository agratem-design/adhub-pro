// Hook مشترك لحساب الأسعار من قاعدة البيانات (موحد لإنشاء/تعديل العقد)
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import { toast } from '@/components/ui/sonner';

export function useContractPricing() {
  const [pricingData, setPricingData] = useState<any[]>([]);
  const [sizeNames, setSizeNames] = useState(() => new Map<number, string>());
  const [loading, setLoading] = useState(true);

  // تحميل بيانات التسعير وأسماء المقاسات — قابل لإعادة الاستدعاء (Realtime/focus)
  const loadPricing = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const [pricingRes, sizesRes] = await Promise.all([
        supabase.from('pricing').select('*').order('size', { ascending: true }),
        supabase.from('sizes').select('id, name'),
      ]);

      if (!pricingRes.error && Array.isArray(pricingRes.data)) {
        setPricingData(pricingRes.data);
      } else if (pricingRes.error) {
        console.error('❌ Failed to load pricing data:', pricingRes.error);
      }

      if (!sizesRes.error && Array.isArray(sizesRes.data)) {
        const sizeMap = new Map<number, string>(sizesRes.data.map((s: any) => [s.id as number, s.name as string]));
        setSizeNames(sizeMap);
      } else if (sizesRes.error) {
        console.error('❌ Failed to load size names:', sizesRes.error);
      }
    } catch (e) {
      console.warn('Failed to load pricing/size data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPricing();

    // Realtime: أي تعديل على جدول الأسعار/المقاسات يُحدّث القائمة فوراً
    const channel = supabase
      .channel('contract-pricing-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pricing' }, () => {
        loadPricing({ silent: true }).then(() => {
          try { toast.info('تم تحديث قائمة الأسعار'); } catch {}
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sizes' }, () => {
        loadPricing({ silent: true });
      })
      .subscribe();

    const onFocus = () => loadPricing({ silent: true });
    const onVisibility = () => { if (document.visibilityState === 'visible') loadPricing({ silent: true }); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      try { supabase.removeChannel(channel); } catch {}
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadPricing]);

  // أدوات مساعدة
  const normalizeSizeName = (val: any) => String(val || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, 'x')
    .replace(/\*/g, 'x');

  const monthColumnMap: { [key: number]: string } = {
    1: 'one_month',
    2: '2_months',
    3: '3_months',
    6: '6_months',
    12: 'full_year',
  };

  const pickPrice = (row: any, months: number): number | null => {
    const column = monthColumnMap[months];
    if (!row || !column) return null;
    const v = row[column];
    if (v === null || v === undefined) return null;
    return Number(v) || 0;
  };

  // ✅ موحد: البحث عن السعر باستخدام size_id (رقمي) أو اسم المقاس (نصي مثل 8x3)
  const getPriceFromDatabase = (
    sizeRef: number | string | null,
    level: any,
    customer: string,
    months: number
  ): number | null => {
    const normLevel = String(level || '').trim();
    const normCustomer = String(customer || '').trim();

    // تحضير المعرف أو الاسم
    let sizeId: number | null = null;
    let sizeName: string | null = null;

    if (typeof sizeRef === 'number') {
      sizeId = sizeRef;
    } else if (typeof sizeRef === 'string') {
      const s = sizeRef.trim();
      const maybeNum = Number(s);
      if (!Number.isNaN(maybeNum)) sizeId = maybeNum;
      else sizeName = normalizeSizeName(s);
    }

    console.log('\n🔍 ===== PRICE LOOKUP START =====');
    console.log(
 ` Parameters: size_ref=${String(sizeRef)} (norm id=${String(sizeId)} name=${String(
        sizeName
      )}), level="${normLevel}", customer="${normCustomer}", months=${months}`
    );

    // 1) البحث بواسطة size_id
    if (sizeId) {
      const rowById = pricingData.find((p) => {
        const pSizeId = p.size_id !== null && p.size_id !== undefined ? Number(p.size_id) : null;
        return (
          pSizeId === sizeId && 
          String(p.billboard_level || '').trim().toUpperCase() === normLevel.toUpperCase() && 
          String(p.customer_category || '').trim().toUpperCase() === normCustomer.toUpperCase()
        );
      });
      if (rowById) {
        const price = pickPrice(rowById, months);
        if (price !== null) {
          console.log('✅ Found by size_id:', { size_id: rowById.size_id, size: rowById.size });
          console.log(`✅ SUCCESS: Price = ${price} (from column "${monthColumnMap[months]}")`);
          console.log('===== PRICE LOOKUP END =====\n');
          return price;
        }
      }
    }

    // 2) البحث بواسطة اسم المقاس (مثل 8x3)
    if (sizeName) {
      const rowByName = pricingData.find(
        (p) => normalizeSizeName(p.size) === sizeName && 
               String(p.billboard_level || '').trim().toUpperCase() === normLevel.toUpperCase() && 
               String(p.customer_category || '').trim().toUpperCase() === normCustomer.toUpperCase()
      );
      if (rowByName) {
        const price = pickPrice(rowByName, months);
        if (price !== null) {
          console.log('✅ Found by size name:', { size: rowByName.size, size_id: rowByName.size_id });
          console.log(`✅ SUCCESS: Price = ${price} (from column "${monthColumnMap[months]}")`);
          console.log('===== PRICE LOOKUP END =====\n');
          return price;
        }
      }

      // 2.b) محاولة ربط الاسم بالمعرف عبر جدول sizes
      let resolvedId: number | null = null;
      for (const [id, name] of sizeNames.entries()) {
        if (normalizeSizeName(name) === sizeName) {
          resolvedId = Number(id);
          break;
        }
      }
      if (resolvedId) {
        const rowByResolvedId = pricingData.find((p) => {
          const pSizeId = p.size_id !== null && p.size_id !== undefined ? Number(p.size_id) : null;
          return (
            pSizeId === resolvedId && 
            String(p.billboard_level || '').trim().toUpperCase() === normLevel.toUpperCase() && 
            String(p.customer_category || '').trim().toUpperCase() === normCustomer.toUpperCase()
          );
        });
        if (rowByResolvedId) {
          const price = pickPrice(rowByResolvedId, months);
          if (price !== null) {
            console.log('✅ Found by resolved size_id from name:', {
              size: rowByResolvedId.size,
              size_id: rowByResolvedId.size_id,
            });
            console.log(`✅ SUCCESS: Price = ${price} (from column "${monthColumnMap[months]}")`);
            console.log('===== PRICE LOOKUP END =====\n');
            return price;
          }
        }
      }
    }

    if (normCustomer !== 'عادي') {
      console.log(`⚠️ No price found for category "${normCustomer}". Falling back to default category "عادي"...`);
      return getPriceFromDatabase(sizeRef, level, 'عادي', months);
    }

    console.error('❌ No matching row found!');
    console.log('  Looking for:', { size_id: sizeId ?? sizeRef, level: normLevel, customer: normCustomer });
    console.error('\n❌ FINAL: No price found');
    console.log('===== PRICE LOOKUP END =====\n');
    return null;
  };

  // ✅ موحد: سعر اليوم باستخدام size_id أو اسم المقاس
  const getDailyPriceFromDatabase = (
    sizeRef: number | string | null,
    level: any,
    customer: string
  ): number | null => {
    const normLevel = String(level || '').trim();
    const normCustomer = String(customer || '').trim();

    let sizeId: number | null = null;
    let sizeName: string | null = null;

    if (typeof sizeRef === 'number') {
      sizeId = sizeRef;
    } else if (typeof sizeRef === 'string') {
      const s = sizeRef.trim();
      const maybeNum = Number(s);
      if (!Number.isNaN(maybeNum)) sizeId = maybeNum;
      else sizeName = normalizeSizeName(s);
    }

    console.log(`🔍 Looking for daily price: size_ref=${String(sizeRef)} (id=${String(sizeId)} name=${String(sizeName)}), level=${normLevel}, customer=${normCustomer}`);

    const pickDaily = (row: any): number | null => {
      const v = row?.one_day;
      if (v === null || v === undefined) return null;
      return Number(v) || 0;
    };

    if (sizeId) {
      const rowById = pricingData.find((p) => {
        const pSizeId = p.size_id !== null && p.size_id !== undefined ? Number(p.size_id) : null;
        return (
          pSizeId === sizeId && 
          String(p.billboard_level || '').trim().toUpperCase() === normLevel.toUpperCase() && 
          String(p.customer_category || '').trim().toUpperCase() === normCustomer.toUpperCase()
        );
      });
      const daily = pickDaily(rowById);
      if (daily !== null) return daily;
    }

    if (sizeName) {
      const rowByName = pricingData.find(
        (p) => normalizeSizeName(p.size) === sizeName && 
               String(p.billboard_level || '').trim().toUpperCase() === normLevel.toUpperCase() && 
               String(p.customer_category || '').trim().toUpperCase() === normCustomer.toUpperCase()
      );
      const daily = pickDaily(rowByName);
      if (daily !== null) return daily;

      let resolvedId: number | null = null;
      for (const [id, name] of sizeNames.entries()) {
        if (normalizeSizeName(name) === sizeName) {
          resolvedId = Number(id);
          break;
        }
      }
      if (resolvedId) {
        const rowByResolvedId = pricingData.find((p) => {
          const pSizeId = p.size_id !== null && p.size_id !== undefined ? Number(p.size_id) : null;
          return (
            pSizeId === resolvedId && 
            String(p.billboard_level || '').trim().toUpperCase() === normLevel.toUpperCase() && 
            String(p.customer_category || '').trim().toUpperCase() === normCustomer.toUpperCase()
          );
        });
        const daily2 = pickDaily(rowByResolvedId);
        if (daily2 !== null) return daily2;
      }
    }

    if (normCustomer !== 'عادي') {
      console.warn(`⚠️ No daily price found for category "${normCustomer}". Falling back to default category "عادي"...`);
      return getDailyPriceFromDatabase(sizeRef, level, 'عادي');
    }

    console.warn(`❌ No daily price found for size_ref=${String(sizeRef)}`);
    return null;
  };

  // ✅ موحد: حساب سعر اللوحة (أشهر/أيام) باستخدام الداتا +Fallback للبيانات الثابتة
  const calculateBillboardPrice = (
    billboard: any,
    pricingMode: 'months' | 'days',
    durationMonths: number,
    durationDays: number,
    pricingCategory: string,
    convertPrice: (price: number) => number = (p) => p
  ): number => {
    const rawSizeId = billboard.size_id || billboard.Size_ID || null;
    const sizeId = rawSizeId !== null ? Number(rawSizeId) : null;
    const size = (billboard.size || billboard.Size || '') as string;
    const level = (billboard.level || billboard.Level) as any;

    console.log('🔍 Calculating price for billboard:', {
      rawSizeId,
      sizeId,
      sizeIdType: typeof sizeId,
      size,
      level,
    });

    if (pricingMode === 'months') {
      const months = Math.max(0, Number(durationMonths || 0));
      let price = getPriceFromDatabase(sizeId ?? size, level, pricingCategory, months);
      if (price === null) {
        price = getPriceFor(size, level, pricingCategory as CustomerType, months);
      }
      return price !== null ? convertPrice(price) : 0;
    } else {
      const days = Math.max(0, Number(durationDays || 0));
      let daily = getDailyPriceFromDatabase(sizeId ?? size, level, pricingCategory);
      if (daily === null) {
        daily = getDailyPriceFor(size, level, pricingCategory as CustomerType);
      }
      if (daily === null) {
        let monthlyPrice = getPriceFromDatabase(sizeId ?? size, level, pricingCategory, 1);
        if (monthlyPrice === null) {
          monthlyPrice = getPriceFor(size, level, pricingCategory as CustomerType, 1) || 0;
        }
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      return convertPrice((daily || 0) * days);
    }
  };

  return {
    pricingData,
    sizeNames,
    loading,
    getPriceFromDatabase,
    getDailyPriceFromDatabase,
    calculateBillboardPrice,
    refetch: loadPricing,
  };
}
