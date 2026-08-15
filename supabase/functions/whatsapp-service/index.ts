import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCorsHeaders } from '../_shared/cors.ts';

const json = (data: unknown, corsHeaders: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function verifyAdminAccess(req: Request): Promise<{ success: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { success: false, error: 'Authorization header required' };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return { success: false, error: 'Invalid or expired token' };
  }
  const userId = claimsData.claims.sub as string | undefined;
  if (!userId) return { success: false, error: 'User ID not found in token' };

  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: roleData, error: roleError } = await supabaseAdmin
    .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (roleError) return { success: false, error: 'Failed to verify user role' };
  if (!roleData) return { success: false, error: 'Admin access required' };
  return { success: true, userId };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authResult = await verifyAdminAccess(req);
    if (!authResult.success) {
      return json({ success: false, error: authResult.error || 'Unauthorized' }, corsHeaders, 401);
    }

    let body: any = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch (_) { body = {}; }
    }

    const action = body?.action as string | undefined;

    // Get bridge URL and provider from database
    let bridgeBase: string | null = null;
    let provider: string = 'wppconnect';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data } = await supabase
          .from('messaging_settings')
          .select('whatsapp_bridge_url, whatsapp_provider, wppconnect_bridge_url')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        if (data) {
          provider = data.whatsapp_provider || 'wppconnect';
          if (provider === 'wppconnect' && data.wppconnect_bridge_url) {
            bridgeBase = data.wppconnect_bridge_url;
          } else if (data.whatsapp_bridge_url) {
            bridgeBase = data.whatsapp_bridge_url;
          }
        }
      }
    } catch (err) {
      console.log('Failed to fetch settings from database:', err);
    }

    if (!bridgeBase) {
      bridgeBase = Deno.env.get("WHATSAPP_BRIDGE_URL") ?? null;
    }

    if (!bridgeBase) {
      switch (action) {
        case "status":
          return json({ connected: false, bridgeConfigured: false, provider }, corsHeaders);
        case "start":
          return json({ requiresBridge: true, message: "لم يتم ضبط رابط الجسر." }, corsHeaders);
        case "disconnect":
          return json({ success: true, message: "تمت المحاولة (بدون جسر)" }, corsHeaders);
        default:
          return json({ success: false, message: "الخدمة قيد الإعداد. يرجى تهيئة رابط الجسر." }, corsHeaders);
      }
    }

    const base = bridgeBase.replace(/\/$/, "");
    console.log(`Using provider: ${provider}, bridge configured`);

    // ✅ Handle sendFile action — send PDF/media as file attachment
    if (action === 'sendFile') {
      const { phone, fileUrl, fileName, caption, base64, mimeType } = body;
      if (!phone) {
        return json({ success: false, error: 'رقم الهاتف مطلوب' }, corsHeaders, 400);
      }
      if (!fileUrl && !base64) {
        return json({ success: false, error: 'يجب توفير رابط الملف أو بيانات base64' }, corsHeaders, 400);
      }

      const sendFileBody: any = {
        phone,
        caption: caption || '',
        fileName: fileName || 'document.pdf',
      };

      // Prefer base64 if provided, otherwise use URL
      if (base64) {
        sendFileBody.base64 = base64;
        sendFileBody.mimeType = mimeType || 'application/pdf';
      } else {
        sendFileBody.url = fileUrl;
      }

      console.log(`Sending file to ${phone.slice(-4)}, fileName: ${fileName}, hasBase64: ${!!base64}, hasUrl: ${!!fileUrl}`);

      const targetUrl = `${base}/sendFile`;
      try {
        const resp = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
          body: JSON.stringify(sendFileBody),
        });

        const text = await resp.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!resp.ok) {
          console.error('Bridge sendFile error:', resp.status, text.substring(0, 200));
          return json({ success: false, error: 'فشل إرسال الملف', status: resp.status, data }, corsHeaders, resp.status);
        }

        return json(data, corsHeaders);
      } catch (fetchError) {
        console.error('Failed to send file via bridge:', (fetchError as Error).message);
        return json({ success: false, error: 'فشل الاتصال بخادم واتساب لإرسال الملف' }, corsHeaders, 503);
      }
    }

    // Standard routes
    const routes: Record<string, { method: string; path: string }> = {
      status: { method: "GET", path: "/status" },
      start: { method: "POST", path: "/start" },
      disconnect: { method: "POST", path: "/disconnect" },
      send: { method: "POST", path: "/send" },
    };

    const target = (action && routes[action]) || { method: "POST", path: "/proxy" };
    const targetUrl = `${base}${target.path}`;

    const sanitizedBody = body ? {
      action: body?.action,
      hasPhone: !!body?.phone,
      hasMessage: !!body?.message,
      phoneLastDigits: body?.phone ? `***${body.phone.slice(-4)}` : undefined,
      messageLength: body?.message?.length
    } : {};
    console.log(`Calling ${target.method} ${target.path}`, sanitizedBody);

    const init: RequestInit = {
      method: target.method,
      headers: { "Content-Type": "application/json", "bypass-tunnel-reminder": "true" },
    };
    if (target.method !== "GET") {
      const { action: _a, ...rest } = body || {};
      init.body = JSON.stringify(rest);
    }

    let bridgeResp: Response;
    try {
      bridgeResp = await fetch(targetUrl, init);
    } catch (fetchError) {
      console.error('Failed to connect to bridge');
      return new Response(
        JSON.stringify({ success: false, error: 'فشل الاتصال بخادم واتساب', provider }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = await bridgeResp.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!bridgeResp.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'خطأ من خادم واتساب', status: bridgeResp.status, data, provider }),
        { status: bridgeResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("whatsapp-service error:", (error as Error).name);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
