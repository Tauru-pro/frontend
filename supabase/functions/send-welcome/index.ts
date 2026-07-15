// Sends the buyer welcome email. Invoked by the frontend right after a user
// verifies their email (a session exists). Reads the recipient from the
// verified JWT, so a caller can only trigger their own welcome.
import { buyerWelcome, nameFromClaims, sendEmail } from '../_shared/send-email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: corsHeaders });

  let claims: Record<string, unknown>;
  try {
    claims = decodeJwtClaims(token);
  } catch {
    return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401, headers: corsHeaders });
  }

  const email = claims['email'] as string | undefined;
  if (!email) return new Response(JSON.stringify({ error: 'NO_EMAIL' }), { status: 400, headers: corsHeaders });

  try {
    const { subject, html } = buyerWelcome(nameFromClaims(claims));
    await sendEmail(email, subject, html);
  } catch (err) {
    // Best-effort: report but do not surface as a hard failure to the user.
    console.error('send-welcome failed:', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'SEND_FAILED' }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
