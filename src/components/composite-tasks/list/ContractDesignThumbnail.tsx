import { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';
import { cn } from '@/lib/utils';

export function ContractDesignThumbnail({ contractId, url, className }: { contractId: number; url?: string; className?: string }) {
  const [fallback, setFallback] = useState<string>();
  useEffect(() => {
    setFallback(undefined);
    if (url || !contractId) return;
    let cancelled = false;
    fetchContractDesignUrls(contractId).then(urls => { if (!cancelled) setFallback(urls?.[0]); });
    return () => { cancelled = true; };
  }, [contractId, url]);
  const image = url || fallback;
  return <span className={cn('flex h-24 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background', className)}>
    {image ? <img src={image} alt={`تصميم عقد ${contractId}`} className="h-full w-full object-contain" loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/placeholder.svg'; }} /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
  </span>;
}
