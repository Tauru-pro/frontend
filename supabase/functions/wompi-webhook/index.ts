// Public Wompi webhook endpoint (no buyer JWT — Wompi calls this directly).
// Every step here exists to survive the resilience matrix in
// checkout-orders-wompi's proposal: checksum tampering, duplicate delivery,
// out-of-order events, amount/reference manipulation (design.md Decisions
// 6-8). Uses the service_role client since there is no buyer session — this
// is the one function in this change that legitimately needs it.
//
// Every early return is logged (console.log/warn) and the whole handler is
// wrapped in try/catch — a webhook that fails silently is undebuggable, so
// this function never fails silently, even on a payload shape we didn't
// anticipate.
//
// Deploy with: supabase functions deploy wompi-webhook --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyEventChecksum, type WompiEventPayload } from '../_shared/wompi-signature.ts';
import { applyApprovedPayment, applyDeclinedOrErrorPayment } from '../_shared/order-transitions.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

interface WompiTransactionData {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';
  amount_in_cents: number;
  reference: string;
  currency: string;
  status_message?: string | null;
  payment_method_type?: string | null;
}

/** Maps whatever label Wompi/the operator use (test, TEST, uat, sandbox, prod, live...) onto one of SANDBOX/PRODUCTION, so an unexpected exact spelling never causes a false mismatch. */
function normalizeEnv(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (!v) return '';
  if (['TEST', 'SANDBOX', 'UAT', 'STAGING'].includes(v)) return 'SANDBOX';
  if (['PRODUCTION', 'PROD', 'LIVE'].includes(v)) return 'PRODUCTION';
  return v;
}

/** payload.timestamp should be a unix-seconds number, but never trust that blindly — a bad value here must not crash the function. */
function occurredAtIso(rawTimestamp: unknown): string {
  const seconds = typeof rawTimestamp === 'number' ? rawTimestamp : Number(rawTimestamp);
  if (!Number.isFinite(seconds)) {
    console.warn('wompi-webhook: payload.timestamp is missing or not numeric, raw value:', rawTimestamp);
    return new Date().toISOString();
  }
  return new Date(seconds * 1000).toISOString();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      console.log(`wompi-webhook: rejected method ${req.method}`);
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    }

    const rawBody = await req.text();
    console.log('wompi-webhook: received body (first 2000 chars):', rawBody.slice(0, 2000));

    let payload: WompiEventPayload | null = null;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.warn('wompi-webhook: body is not valid JSON:', e instanceof Error ? e.message : e);
      return json({ error: 'INVALID_BODY' }, 400);
    }

    if (!payload || typeof payload !== 'object' || !payload.data || !payload.signature) {
      console.warn(
        'wompi-webhook: payload missing data/signature. Top-level keys:',
        payload ? Object.keys(payload) : null,
      );
      return json({ error: 'INVALID_BODY' }, 400);
    }

    const transaction = payload.data['transaction'] as WompiTransactionData | undefined;
    if (!transaction?.id || !transaction.reference || !transaction.status) {
      console.warn('wompi-webhook: payload.data.transaction missing id/reference/status:', payload.data);
      return json({ error: 'INVALID_BODY' }, 400);
    }

    console.log(
      `wompi-webhook: event=${payload.event} transaction=${transaction.id} reference=${transaction.reference} status=${transaction.status}`,
    );

    // The real separation between sandbox and production is the events URL
    // itself — Wompi's docs say to register a different URL per environment
    // precisely so sandbox/production data never mixes. This project only
    // has one URL registered right now, so there's exactly one environment
    // it can legitimately receive events from. We still log the label Wompi
    // sends (its exact string — "test", "TEST", "SANDBOX", etc. — isn't
    // documented and varies), but a mismatch is logged, never rejected: a
    // wrong guess about that string must never block a real, checksum-valid
    // payment event.
    const configuredEnv = normalizeEnv(Deno.env.get('WOMPI_ENVIRONMENT') ?? 'SANDBOX');
    const eventEnv = normalizeEnv(payload.environment ?? '');
    if (eventEnv && eventEnv !== configuredEnv) {
      console.warn(
        `wompi-webhook: environment label mismatch (informational only) — event="${payload.environment}" (normalized ${eventEnv}) configured=${configuredEnv}`,
      );
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const eventsSecret = Deno.env.get('WOMPI_EVENTS_SECRET');
    if (!eventsSecret) console.error('wompi-webhook: WOMPI_EVENTS_SECRET is not configured');
    const checksumValid = eventsSecret ? await verifyEventChecksum(payload, eventsSecret) : false;
    console.log(`wompi-webhook: checksum valid = ${checksumValid}`);

    if (!checksumValid) {
      const { error } = await admin.from('webhook_events').insert({
        provider: 'WOMPI',
        event_type: payload.event,
        event_id: (payload as { id?: string }).id ?? null,
        transaction_id: transaction.id,
        occurred_at: occurredAtIso(payload.timestamp),
        payload,
        checksum: payload.signature?.checksum ?? null,
        environment: eventEnv || null,
        processing_status: 'CHECKSUM_INVALID',
      });
      if (error) console.error('wompi-webhook: failed to log CHECKSUM_INVALID event:', error.message);
      return json({ error: 'INVALID_CHECKSUM' }, 401);
    }

    // Dedupe: insert first, and if this exact event was already recorded,
    // unique-violation means "already processed" — respond 200 and stop
    // (design.md Decision 7 / proposal §11 — duplicate delivery, one effect).
    const { data: inserted, error: insertError } = await admin
      .from('webhook_events')
      .insert({
        provider: 'WOMPI',
        event_type: payload.event,
        event_id: (payload as { id?: string }).id ?? null,
        transaction_id: transaction.id,
        occurred_at: occurredAtIso(payload.timestamp),
        payload,
        checksum: payload.signature.checksum,
        environment: eventEnv || null,
        processing_status: 'RECEIVED',
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        console.log('wompi-webhook: duplicate event, already processed');
        return json({ ok: true, duplicate: true }, 200);
      }
      console.error('wompi-webhook: failed to log event:', insertError.message);
      return json({ error: 'INTERNAL_ERROR' }, 500);
    }

    const webhookEventId = inserted!.id as string;

    const markProcessed = (status: string, error_message: string | null = null) =>
      admin
        .from('webhook_events')
        .update({ processed_at: new Date().toISOString(), processing_status: status, error_message })
        .eq('id', webhookEventId);

    // Look up by reference (the current attempt's reference), never by
    // user_id/order_id alone (proposal §26 / design.md Decision 8).
    const { data: attempt, error: attemptError } = await admin
      .from('payment_attempts')
      .select('id, payment_id, amount, payments!inner(id, order_id, orders!inner(id, total))')
      .eq('reference', transaction.reference)
      .maybeSingle();

    if (attemptError) console.error('wompi-webhook: payment_attempts lookup failed:', attemptError.message);

    if (!attempt) {
      console.warn(`wompi-webhook: no payment_attempts row for reference ${transaction.reference}`);
      await markProcessed('REVIEW_REQUIRED', 'No payment_attempts row for this reference');
      return json({ ok: true }, 200);
    }

    const payment = (attempt as unknown as { payments: { id: string; order_id: string; orders: { total: number } } })
      .payments;
    const orderTotal = payment.orders.total;
    const expectedCents = orderTotal * 100;

    if (transaction.amount_in_cents !== expectedCents) {
      console.warn(`wompi-webhook: amount mismatch — wompi=${transaction.amount_in_cents} expected=${expectedCents}`);
      await markProcessed(
        'REVIEW_REQUIRED',
        `Amount mismatch: wompi=${transaction.amount_in_cents} expected=${expectedCents}`,
      );
      return json({ ok: true }, 200);
    }
    if (transaction.currency !== 'COP') {
      console.warn(`wompi-webhook: unexpected currency ${transaction.currency}`);
      await markProcessed('REVIEW_REQUIRED', `Unexpected currency: ${transaction.currency}`);
      return json({ ok: true }, 200);
    }

    let applied = false;
    if (transaction.status === 'APPROVED') {
      applied = await applyApprovedPayment(admin, {
        paymentId: payment.id,
        orderId: payment.order_id,
        providerTransactionId: transaction.id,
        rawResponse: payload,
      });
    } else if (transaction.status === 'DECLINED' || transaction.status === 'ERROR' || transaction.status === 'VOIDED') {
      applied = await applyDeclinedOrErrorPayment(admin, {
        paymentId: payment.id,
        orderId: payment.order_id,
        status: transaction.status,
        providerTransactionId: transaction.id,
        failureReason: transaction.status_message ?? null,
        rawResponse: payload,
      });
    }
    // PENDING: no-op, payment stays CREATED/PENDING until a terminal status arrives.

    console.log(`wompi-webhook: applied=${applied} for payment=${payment.id} order=${payment.order_id}`);
    await markProcessed('PROCESSED', applied ? null : 'No-op: payment already in a terminal state');
    return json({ ok: true }, 200);
  } catch (e) {
    console.error('wompi-webhook: unhandled error:', e instanceof Error ? (e.stack ?? e.message) : e);
    return json({ error: 'INTERNAL_ERROR' }, 500);
  }
});
