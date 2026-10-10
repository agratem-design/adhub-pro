export interface BrowserRecipient { id: string; name: string; phone?: string; message: string }
export interface BrowserBatch { id: string; state: string; items: {id: string; name: string; status: string; error?: string}[] }
export interface BrowserReply { ok: boolean; connected?: boolean; error?: string; batch?: BrowserBatch | null }

export function whatsappBrowserRequest(action: 'STATUS'|'PREPARE'|'PAUSE'|'CANCEL'|'REVIEW', payload?: BrowserRecipient[]): Promise<BrowserReply> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const cleanup = () => { window.removeEventListener('message', listener); window.clearTimeout(timeout); };
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.source !== 'alfares-extension' || event.data.requestId !== requestId) return;
      cleanup();
      if (!event.data.ok) reject(new Error(event.data.error || 'تعذر الاتصال بالإضافة.'));
      else resolve(event.data);
    };
    const timeout = window.setTimeout(() => {cleanup();reject(new Error('الإضافة غير مرتبطة. افتح أيقونتها واضغط «ربط صفحة النظام المفتوحة».'));}, 5000);
    window.addEventListener('message', listener);
    window.postMessage({source:'alfares-app',requestId,action,payload},window.location.origin);
  });
}
