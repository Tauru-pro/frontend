// Promotes the calling CUSTOMER to SELLER after they complete the onboarding
// wizard. Only callable by a signed-in CUSTOMER. Uses the service_role key
// (never in the frontend bundle) to run submit_seller_onboarding() in a single
// transaction — the only path allowed through the protect_role_and_status
// trigger (current_user = 'service_role').
//
// Deploy with: supabase functions deploy seller-self-onboard
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { nameFromClaims, sellerWelcome, sendEmail } from '../_shared/send-email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? '';
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalized));
}

interface Body {
  company?: Record<string, unknown>;
  responses?: { question_id: string; answer: unknown }[];
  sellerTermsVersion?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'UNAUTHORIZED' }, 401);

  // The JWT signature/expiry is verified by the runtime (verify_jwt) before
  // this code runs, so decoding the claims here is safe.
  let claims: Record<string, unknown>;
  try {
    claims = decodeJwtClaims(token);
  } catch {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  const userId = claims['sub'] as string | undefined;
  if (!userId) return json({ error: 'UNAUTHORIZED' }, 401);

  // Only a current CUSTOMER may self-onboard as a seller.
  if (claims['user_role'] !== 'CUSTOMER') return json({ error: 'FORBIDDEN' }, 403);

  const body = (await req.json().catch(() => null)) as Body | null;
  const businessName = (body?.company?.['business_name'] as string | undefined)?.trim();
  if (!body || !businessName) return json({ error: 'INVALID_BODY' }, 400);
  if (!body.sellerTermsVersion) return json({ error: 'TERMS_NOT_ACCEPTED' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Server-side check that every required, active survey question is answered.
  const { data: required, error: qErr } = await admin
    .from('onboarding_survey_questions')
    .select('id')
    .eq('is_active', true)
    .eq('is_required', true);
  if (qErr) return json({ error: qErr.message }, 500);

  const answered = new Set((body.responses ?? []).map((r) => r.question_id));
  const missing = (required ?? []).filter((q) => !answered.has(q.id as string));
  if (missing.length > 0) return json({ error: 'SURVEY_INCOMPLETE' }, 400);

  const { error } = await admin.rpc('submit_seller_onboarding', {
    p_user_id: userId,
    p_company: body.company ?? {},
    p_responses: body.responses ?? [],
    p_seller_terms_version: body.sellerTermsVersion,
  });

  if (error) {
    if (error.message?.includes('USER_NOT_CUSTOMER')) return json({ error: 'USER_NOT_CUSTOMER' }, 409);
    return json({ error: error.message }, 500);
  }

  // Best-effort welcome email — never fail the onboarding on email issues.
  try {
    const email = claims['email'] as string | undefined;
    if (email) {
      const { subject, html } = sellerWelcome(nameFromClaims(claims));
      await sendEmail(email, subject, html);
    }
  } catch (e) {
    console.error('seller welcome email failed:', e instanceof Error ? e.message : e);
  }

  return json({ ok: true }, 200);
});
