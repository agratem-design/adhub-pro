import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateSettings {
  id?: string;
  template_name: string;
  template_type: string;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  background_color: string;
  header_font: string;
  body_font: string;
  font_size_header: number;
  font_size_body: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  logo_url: string;
  logo_width: number;
  logo_height: number;
  show_logo: boolean;
  header_text: string;
  footer_text: string;
  show_header: boolean;
  show_footer: boolean;
  signature_url: string;
  signature_label: string;
  show_signature: boolean;
  page_orientation: string;
  page_size: string;
  is_default: boolean;
}

/**
 * Hook لجلب إعدادات القالب الافتراضي لنوع معين
 * @param templateType نوع القالب (contract, billboard_print, invoice, etc.)
 */
export function useTemplateSettings(templateType: string) {
  const [settings, setSettings] = useState<TemplateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // جلب القالب الافتراضي للنوع المحدد
        const { data, error } = await supabase
          .from('template_settings')
          .select('*')
          .eq('template_type', templateType)
          .eq('is_default', true)
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSettings(data);
        } else {
          // إذا لم يوجد قالب افتراضي، نستخدم أي قالب من نفس النوع
          const { data: fallbackData } = await supabase
            .from('template_settings')
            .select('*')
            .eq('template_type', templateType)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          setSettings(fallbackData || null);
        }
      } catch (err) {
        console.error('Error loading template settings:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [templateType]);

  return { settings, loading, error };
}

/**
 * دالة مساعدة لتطبيق إعدادات القالب على HTML
 * @param settings إعدادات القالب
 * @returns CSS styles للتطبيق
 */
export function getTemplateStyles(settings: TemplateSettings | null): string {
  if (!settings) return '';

  return `
    body {
      font-family: '${settings.body_font}', Arial, sans-serif;
      font-size: ${settings.font_size_body}px;
      color: ${settings.text_color};
      background: ${settings.background_color};
      padding: ${settings.margin_top}px ${settings.margin_right}px ${settings.margin_bottom}px ${settings.margin_left}px;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: '${settings.header_font}', Arial, sans-serif;
      font-size: ${settings.font_size_header}px;
      color: ${settings.primary_color};
    }
    .primary-color {
      color: ${settings.primary_color};
    }
    .secondary-color {
      color: ${settings.secondary_color};
    }
    .bg-primary {
      background-color: ${settings.primary_color};
    }
    .bg-secondary {
      background-color: ${settings.secondary_color};
    }
    .border-primary {
      border-color: ${settings.primary_color};
    }
    .border-secondary {
      border-color: ${settings.secondary_color};
    }
    @media print {
      body {
        background: white !important;
        color: black !important;
      }
    }
  `;
}

/**
 * دالة لإنشاء عنصر header من إعدادات القالب
 */
export function renderTemplateHeader(settings: TemplateSettings | null): string {
  if (!settings || !settings.show_header) return '';

  return `
    <div class="template-header" style="text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid ${settings.primary_color};">
      ${settings.show_logo && settings.logo_url ? `
        <img src="${settings.logo_url}" 
             alt="Logo" 
             style="width: ${settings.logo_width}px; height: ${settings.logo_height}px; margin-bottom: 10px;" />
      ` : ''}
      ${settings.header_text ? `
        <h1 style="font-family: '${settings.header_font}'; font-size: ${settings.font_size_header}px; color: ${settings.primary_color}; margin: 0;">
          ${settings.header_text}
        </h1>
      ` : ''}
    </div>
  `;
}

/**
 * دالة لإنشاء عنصر footer من إعدادات القالب
 */
export function renderTemplateFooter(settings: TemplateSettings | null): string {
  if (!settings || !settings.show_footer) return '';

  return `
    <div class="template-footer" style="text-align: center; margin-top: 40px; padding-top: 15px; border-top: 2px solid ${settings.primary_color};">
      ${settings.footer_text ? `
        <p style="font-size: ${settings.font_size_body - 2}px; color: ${settings.text_color}; margin: 0;">
          ${settings.footer_text}
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * دالة لإنشاء عنصر signature من إعدادات القالب
 */
export function renderTemplateSignature(settings: TemplateSettings | null): string {
  if (!settings || !settings.show_signature) return '';

  return `
    <div class="template-signature" style="margin-top: 40px; display: flex; justify-content: space-between;">
      <div style="text-align: center; width: 200px;">
        ${settings.signature_url ? `
          <img src="${settings.signature_url}" 
               alt="Signature" 
               style="width: 100px; height: auto; margin-bottom: 10px;" />
        ` : ''}
        <div style="border-top: 2px solid ${settings.primary_color}; padding-top: 10px; font-size: ${settings.font_size_body}px;">
          ${settings.signature_label}
        </div>
      </div>
    </div>
  `;
}
