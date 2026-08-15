/**
 * إعدادات إضافية للفواتير: التحويلات البنكية + صورة الختم
 * تُخزن في system_settings بمفتاحي 'invoice_bank_accounts' و 'invoice_stamp_image'
 */

import { supabase } from '@/integrations/supabase/client';

export interface BankAccount {
  bankName: string;
  accountNumber: string;
}

export interface InvoiceExtras {
  bankAccounts: BankAccount[];
  stampImageUrl: string;
}

let cache: InvoiceExtras | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

export async function fetchInvoiceExtras(): Promise<InvoiceExtras> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const defaults: InvoiceExtras = { bankAccounts: [], stampImageUrl: '' };

  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['invoice_bank_accounts', 'invoice_stamp_image']);

    if (!data) return defaults;

    for (const row of data) {
      if (row.setting_key === 'invoice_bank_accounts' && row.setting_value) {
        try { defaults.bankAccounts = JSON.parse(row.setting_value); } catch {}
      }
      if (row.setting_key === 'invoice_stamp_image' && row.setting_value) {
        defaults.stampImageUrl = row.setting_value;
      }
    }

    cache = defaults;
    cacheTime = Date.now();
    return defaults;
  } catch {
    return defaults;
  }
}

export async function saveInvoiceExtras(extras: Partial<InvoiceExtras>): Promise<void> {
  if (extras.bankAccounts !== undefined) {
    await upsertSetting('invoice_bank_accounts', JSON.stringify(extras.bankAccounts), 'json', 'معلومات التحويلات البنكية');
  }
  if (extras.stampImageUrl !== undefined) {
    await upsertSetting('invoice_stamp_image', extras.stampImageUrl, 'text', 'صورة ختم الشركة');
  }
  cache = null;
  cacheTime = 0;
}

async function upsertSetting(key: string, value: string, type: string, desc: string) {
  const { data } = await supabase
    .from('system_settings')
    .select('id')
    .eq('setting_key', key)
    .maybeSingle();

  if (data) {
    await supabase
      .from('system_settings')
      .update({ setting_value: value, updated_at: new Date().toISOString() })
      .eq('setting_key', key);
  } else {
    await supabase
      .from('system_settings')
      .insert({ setting_key: key, setting_value: value, setting_type: type, description: desc });
  }
}

/**
 * Generate bank + stamp HTML section for invoices
 */
export function generateBankAndStampHTML(extras: InvoiceExtras, primaryColor: string = '#D4AF37'): string {
  const hasBanks = extras.bankAccounts.length > 0;
  const hasStamp = !!extras.stampImageUrl;
  if (!hasBanks && !hasStamp) return '';

  const bankHtml = hasBanks ? `
    <div style="flex:1;">
      <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:${primaryColor};">
        معلومات التحويلات البنكية
      </div>
      ${extras.bankAccounts.map(b => `
        <div style="margin-bottom:6px;font-size:11px;line-height:1.6;">
          <div style="font-weight:600;">${b.bankName}</div>
          <div style="font-family:Manrope,monospace;letter-spacing:0.5px;direction:ltr;text-align:right;">${b.accountNumber}</div>
        </div>
      `).join('')}
    </div>
  ` : '<div style="flex:1;"></div>';

  const stampHtml = hasStamp ? `
    <div style="text-align:center;flex-shrink:0;">
      <img src="${extras.stampImageUrl}" alt="ختم الشركة" style="max-width:140px;max-height:140px;object-fit:contain;" />
    </div>
  ` : '';

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:30px;margin-top:20px;padding-top:15px;border-top:1px dashed #ccc;">
      ${bankHtml}
      ${stampHtml}
    </div>
  `;
}
