(() => {
  if (window.__alfaresWhatsAppBridge) return;
  window.__alfaresWhatsAppBridge = true;
  const allowed = new Set(['STATUS', 'PREPARE', 'PAUSE', 'CANCEL', 'REVIEW']);
  window.addEventListener('message', async event => {
    const data = event.data;
    if (event.source !== window || event.origin !== location.origin || data?.source !== 'alfares-app' || !allowed.has(data.action) || typeof data.requestId !== 'string') return;
    let result;
    try { result = await chrome.runtime.sendMessage({ channel: 'alfares', action: data.action, payload: data.payload }); }
    catch { result = { ok: false, error: 'أعد ربط الصفحة من أيقونة الإضافة.' }; }
    window.postMessage({ source: 'alfares-extension', requestId: data.requestId, ...result }, location.origin);
  });
})();
