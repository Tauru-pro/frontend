// Creates a SELLER or SUPER_ADMIN account. Only callable by a verified
// SUPER_ADMIN. Uses the service_role key, which only ever lives here as a
// project secret — never in the Angular frontend.
//
// Deploy with: supabase functions deploy admin-create-user
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (set via `supabase secrets set`, see ../../README.md)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ROLES = new Set(['SELLER', 'SUPER_ADMIN']);

// supabase.functions.invoke() from a browser sends a CORS preflight
// (OPTIONS) before the real POST, since it carries an Authorization header.
// Edge Functions don't add CORS headers automatically — without these, the
// browser blocks the request before it ever reaches this code.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Edge Functions verify the JWT signature/expiry before this code runs
  // (default verify_jwt behavior), so decoding the payload here is safe —
  // the role claim itself was set server-side by custom_access_token_hook.
  const claims = decodeJwtClaims(token);
  if (claims['user_role'] !== 'SUPER_ADMIN') {
    return new Response(JSON.stringify({ error: 'FORBIDDEN' }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const body = (await req.json().catch(() => null)) as
    | { email?: string; fullName?: string; role?: string }
    | null;

  if (!body?.email || !body.role || !ALLOWED_ROLES.has(body.role)) {
    return new Response(JSON.stringify({ error: 'INVALID_BODY' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Without redirectTo, the invite email's link sends the user to the
  // project's default site_url (the public home page) with no chance to
  // set a password. origin is the real frontend origin here since this is
  // a genuine cross-origin fetch from the browser (supabase.functions.invoke).
  const origin = req.headers.get('origin');
  const redirectTo = origin ? `${origin}/auth/set-password` : undefined;

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    body.email,
    { data: { full_name: body.fullName, role: body.role }, redirectTo }
  );

  if (inviteError) {
    const alreadyExists = inviteError.message?.toLowerCase().includes('already registered');
    return new Response(
      JSON.stringify({ error: alreadyExists ? 'EMAIL_EXISTS' : inviteError.message }),
      { status: alreadyExists ? 409 : 400, headers: corsHeaders }
    );
  }

  // The handle_new_user trigger always inserts CUSTOMER first; promote to
  // the requested privileged role using the service_role client, which
  // bypasses RLS (no client-side path can reach this update).
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ role: body.role })
    .eq('id', invited.user.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ id: invited.user.id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
