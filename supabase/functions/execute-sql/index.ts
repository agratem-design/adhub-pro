// This endpoint is intentionally disabled.
//
// Reason: it previously accepted arbitrary SQL strings from any admin user and
// executed them with the service-role key, bypassing all RLS. This is a
// privilege-escalation risk: a compromised admin account would gain full,
// unrestricted database access (DROP TABLE, INSERT INTO auth.users, mass
// exfiltration, etc.).
//
// The UI in `DatabaseSetup.tsx` already falls back to a manual copy/paste flow
// into the Supabase SQL Editor, which is the supported path for ad-hoc admin
// SQL. Do NOT re-enable this endpoint without a strict allow-list of
// pre-approved statements, audit logging, and a secondary confirmation step.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error:
        "تم تعطيل هذه النقطة لأسباب أمنية. الرجاء تنفيذ أوامر SQL مباشرة من Supabase SQL Editor.",
      disabled: true,
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
