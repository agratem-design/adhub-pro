import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

type ReqBody = {
  username?: string
  emailOrUsername?: string
  password?: string
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody
    const emailOrUsername = (body.emailOrUsername ?? body.username ?? '').trim()
    const password = (body.password ?? '').toString()

    if (!emailOrUsername || !password) {
      return json({ error: 'Invalid login credentials' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Missing Supabase function environment variables' }, 500)
    }

    // Lookup email by username using service role (no client-side RLS issues)
    let email = emailOrUsername
    if (!emailOrUsername.includes('@')) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey)
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .ilike('username', emailOrUsername)
        .maybeSingle()

      email = (data?.email ?? '').trim()
      // Avoid username enumeration: always return generic error
      if (!email) return json({ error: 'Invalid login credentials' }, 400)
    }

    // Authenticate via GoTrue token endpoint
    const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!resp.ok) {
      return json({ error: 'Invalid login credentials' }, 400)
    }

    const token = await resp.json()

    return json(
      {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        user: token.user,
      },
      200,
    )
  } catch (e) {
    return json({ error: (e as Error).message || 'Internal server error' }, 500)
  }
})
