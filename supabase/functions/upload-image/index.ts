import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { base64, name, provider, folder } = await req.json();
    console.log(`Upload request: provider=${provider}, name=${name}, folder=${folder}, base64Length=${base64?.length || 0}, user=${user.id}`);

    if (!base64) {
      return new Response(JSON.stringify({ error: 'Missing base64 image data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cloudinary uses secrets directly, no need for system_settings key
    if (provider === 'cloudinary') {
      const cloudinarySecret = Deno.env.get('CLOUDINARY_API_SECRET');
      if (!cloudinarySecret) {
        return new Response(JSON.stringify({ error: 'CLOUDINARY_API_SECRET غير مُعد' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Read cloud_name and api_key from system_settings
      const { data: cloudSettings } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['cloudinary_cloud_name', 'cloudinary_api_key']);

      const cloudName = cloudSettings?.find(s => s.setting_key === 'cloudinary_cloud_name')?.setting_value || 'dclm0wcn2';
      const apiKey = cloudSettings?.find(s => s.setting_key === 'cloudinary_api_key')?.setting_value || '341787562248646';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const uploadFolder = folder || 'billboard-uploads';

      // Generate signature (params must be in alphabetical order)
      const publicId = name || `image_${timestamp}`;
      const signParams = `folder=${uploadFolder}&public_id=${publicId}&timestamp=${timestamp}`;
      const signStr = `${signParams}${cloudinarySecret}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(signStr);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Build multipart form
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', blob, `${publicId}.png`);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', uploadFolder);
      formData.append('public_id', publicId);

      console.log('Calling Cloudinary upload API...');
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Cloudinary response status:', response.status);

      if (!response.ok || !result.secure_url) {
        console.error('Cloudinary error:', JSON.stringify(result));
        return new Response(JSON.stringify({ error: 'فشل رفع الصورة إلى Cloudinary', details: result }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ url: result.secure_url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const settingKey = provider === 'freeimage' ? 'freeimage_api_key' : provider === 'postimg' ? 'postimg_api_key' : 'imgbb_api_key';
    const { data: setting, error: settingError } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();

    if (settingError || !setting?.setting_value) {
      console.error('API key not found for:', settingKey, settingError);
      return new Response(JSON.stringify({ error: `مفتاح API غير مُعد للخدمة: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = setting.setting_value;
    let imageUrl: string | undefined | undefined;

    if (provider === 'freeimage') {
      const formData = new FormData();
      formData.append('key', apiKey);
      formData.append('action', 'upload');
      formData.append('source', base64);
      formData.append('format', 'json');
      if (name) {
        formData.append('name', name);
        formData.append('title', name);
      }

      console.log('Calling Freeimage.host API...');
      const response = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Freeimage.host response status:', response.status, 'success:', !!result.image?.url);

      if (!response.ok || !result.image?.url) {
        console.error('Freeimage.host error:', JSON.stringify(result));
        return new Response(JSON.stringify({ error: 'فشل رفع الصورة إلى Freeimage.host', details: result }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      imageUrl = result.image.url;
      console.log('Freeimage.host upload success:', imageUrl);
    } else if (provider === 'postimg') {
      // PostImages.org upload using multipart/form-data with file field
      // Convert base64 to binary blob
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', blob, `${name || 'image'}.png`);
      formData.append('key', apiKey);
      formData.append('expire', '0');
      formData.append('numfiles', '1');
      formData.append('optsize', '0');
      formData.append('adult', '0');
      formData.append('o', '2b819584285c102318568238c7d4a4c7');
      formData.append('m', '59c2ad4b46b0c1e12d5703302bff0120');

      console.log('Calling PostImages API (multipart)...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      
      let response: Response;
      try {
        response = await fetch('https://postimg.cc/json', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        // Fallback: try the original endpoint
        console.log('postimg.cc/json failed, trying api.postimage.org...');
        response = await fetch('https://api.postimage.org/1/upload', {
          method: 'POST',
          body: formData,
        });
      }
      clearTimeout(timeout);

      const responseText = await response.text();
      console.log('PostImages response status:', response.status, 'body preview:', responseText.substring(0, 500));

      if (!response.ok) {
        console.error('PostImages error:', responseText);
        return new Response(JSON.stringify({ error: 'فشل رفع الصورة إلى PostImages', details: responseText }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Try JSON first (postimg.cc/json endpoint)
      try {
        const jsonResult = JSON.parse(responseText);
        if (jsonResult.url) {
          imageUrl = jsonResult.url;
          console.log('PostImages upload success (JSON):', imageUrl);
        } else if (jsonResult.direct_link) {
          imageUrl = jsonResult.direct_link;
          console.log('PostImages upload success (JSON direct):', imageUrl);
        }
      } catch { /* not JSON, try XML */ }

      if (!imageUrl) {
        // Response is XML: extract <page> or <hotlink> URL
        const hotlinkMatch = responseText.match(/<hotlink>(https?:\/\/[^<]+)<\/hotlink>/);
        const pageMatch = responseText.match(/<page>(https?:\/\/[^<]+)<\/page>/);
        const directMatch = responseText.match(/<direct_link>(https?:\/\/[^<]+)<\/direct_link>/);
        
        const extractedUrl = hotlinkMatch?.[1] || directMatch?.[1] || null;

        if (extractedUrl) {
          imageUrl = extractedUrl;
          console.log('PostImages upload success (XML):', imageUrl);
        } else if (pageMatch?.[1]) {
          console.log('PostImages page URL:', pageMatch[1], '- fetching direct link...');
          try {
            const pageResponse = await fetch(pageMatch[1], {
              headers: { 'User-Agent': 'PostmanRuntime/7.29.0' },
            });
            const pageHtml = await pageResponse.text();
            const dlMatch = pageHtml.match(/(https:\/\/i\.postimg\.cc\/[^\s"'<>]+)/);
            if (dlMatch?.[1]) {
              imageUrl = dlMatch[1].replace(/\?dl=1$/, '');
            } else {
              imageUrl = pageMatch[1];
            }
          } catch (pageErr) {
            console.error('Failed to fetch PostImages page:', pageErr);
            imageUrl = pageMatch[1];
          }
        }
      }

      if (!imageUrl) {
        console.error('PostImages: could not extract URL:', responseText.substring(0, 300));
        return new Response(JSON.stringify({ error: 'فشل استخراج رابط الصورة من PostImages', details: responseText.substring(0, 500) }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const formData = new FormData();
      formData.append('key', apiKey);
      formData.append('image', base64);
      if (name) formData.append('name', name);

      console.log('Calling imgbb API...');
      const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('imgbb response status:', response.status, 'success:', result.success);

      if (!response.ok || !result.success || !result.data?.url) {
        console.error('imgbb error:', JSON.stringify(result));
        return new Response(JSON.stringify({ error: 'فشل رفع الصورة إلى imgbb', details: result }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      imageUrl = result.data.url;
      console.log('imgbb upload success:', imageUrl);
    }

    return new Response(JSON.stringify({ url: imageUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upload proxy error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message || 'خطأ في الخادم' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
