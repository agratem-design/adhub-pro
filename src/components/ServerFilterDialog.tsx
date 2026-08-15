import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Download, Server } from 'lucide-react';

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

function getServerLabel(hostname: string): string {
  if (hostname.includes('googleusercontent.com') || hostname.includes('google.com')) return 'Google';
  if (hostname.includes('supabase')) return 'Supabase';
  if (hostname.includes('cloudinary')) return 'Cloudinary';
  if (hostname.includes('imgur')) return 'Imgur';
  if (hostname.includes('ibb.co')) return 'ImgBB';
  if (hostname.includes('iili.io')) return 'Iili';
  if (hostname.includes('postimg')) return 'PostImg';
  if (hostname.includes('facebook') || hostname.includes('fbcdn')) return 'Facebook';
  return hostname;
}

interface ServerInfo {
  hostname: string;
  label: string;
  count: number;
}

interface ServerFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrls: string[];
  onConfirm: (selectedServers: Set<string>) => void;
  title?: string;
}

export default function ServerFilterDialog({ open, onOpenChange, imageUrls, onConfirm, title = 'اختيار السيرفرات للتنزيل' }: ServerFilterDialogProps) {
  const servers = useMemo(() => {
    const map = new Map<string, ServerInfo>();
    for (const url of imageUrls) {
      const hostname = getHostname(url);
      if (hostname === 'unknown') continue;
      const existing = map.get(hostname);
      if (existing) {
        existing.count++;
      } else {
        map.set(hostname, { hostname, label: getServerLabel(hostname), count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [imageUrls]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(servers.map(s => s.hostname)));

  // Reset selection when servers change
  useMemo(() => {
    setSelected(new Set(servers.map(s => s.hostname)));
  }, [servers]);

  const totalSelected = useMemo(() => {
    return imageUrls.filter(url => selected.has(getHostname(url))).length;
  }, [imageUrls, selected]);

  const toggleServer = (hostname: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(hostname)) next.delete(hostname);
      else next.add(hostname);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(servers.map(s => s.hostname)));
  const deselectAll = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            اختر السيرفرات التي تريد تنزيل صورها. يمكنك اختيار سيرفر واحد أو أكثر.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">تحديد الكل</Button>
            <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs">إلغاء الكل</Button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {servers.map(server => (
              <label
                key={server.hostname}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selected.has(server.hostname)}
                  onCheckedChange={() => toggleServer(server.hostname)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{server.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{server.hostname}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">
                  {server.count} صورة
                </Badge>
              </label>
            ))}
          </div>

          {servers.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">لا توجد صور</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button
            onClick={() => { onConfirm(selected); onOpenChange(false); }}
            disabled={selected.size === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            تنزيل {totalSelected} صورة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Filter URLs by selected servers */
export function filterUrlsByServers(urls: string[], selectedServers: Set<string>): Set<string> {
  const allowed = new Set<string>();
  for (const url of urls) {
    if (selectedServers.has(getHostname(url))) {
      allowed.add(url);
    }
  }
  return allowed;
}
