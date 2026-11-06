import { useEffect, useState } from 'react';
import { getBillboardsSortMaps } from '@/lib/billboardSorter';

let loaded = false;

/**
 * ترتيب اللوحات الموحد (المقاس ← المستوى ← البلدية) يعتمد على جداول الترتيب التي تُحمَّل بشكل غير متزامن.
 * أضف القيمة المُعادة إلى اعتماديات useMemo حتى يُعاد الترتيب بعد اكتمال التحميل.
 */
export function useBillboardSortRanks(): number {
  const [version, setVersion] = useState(loaded ? 1 : 0);
  useEffect(() => {
    if (loaded) return;
    let alive = true;
    getBillboardsSortMaps().then(() => { loaded = true; if (alive) setVersion(v => v + 1); }, () => {});
    return () => { alive = false; };
  }, []);
  return version;
}
