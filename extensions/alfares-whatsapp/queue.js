export function normalizePhone(input) {
  let value = String(input || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[\s()+.-]/g, '');
  if (value.startsWith('00')) value = value.slice(2);
  if (/^0\d{9}$/.test(value)) value = '218' + value.slice(1);
  else if (/^9\d{8}$/.test(value)) value = '218' + value;
  return /^[1-9]\d{7,14}$/.test(value) ? value : '';
}

export function validateRecipients(input) {
  if (!Array.isArray(input) || !input.length || input.length > 200) throw new Error('اختر من شخص واحد إلى 200 شخص في الدفعة.');
  const phones = new Set();
  return input.map((item, index) => {
    const phone = normalizePhone(item.phone);
    if (!phone) throw new Error(`رقم غير صالح: ${item.name || index + 1}`);
    if (phones.has(phone)) throw new Error(`الرقم مكرر لأكثر من مستلم: ${phone}. اختر مستلمًا واحدًا لهذا الرقم.`);
    phones.add(phone);
    if (typeof item.message !== 'string' || !item.message.trim() || item.message.length > 4000) throw new Error('الرسالة مطلوبة، وبحد أقصى 4000 حرف.');
    return { id: String(index), name: String(item.name || phone).slice(0, 160), phone, message: item.message.trim(), status: 'pending' };
  });
}

export function publicBatch(batch) {
  if (!batch) return null;
  return { id: batch.id, state: batch.state, items: batch.items.map(({id,name,status,error}) => ({id,name,status,error})) };
}
