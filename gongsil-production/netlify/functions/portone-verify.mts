import type { Context } from '@netlify/functions';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
function requiredEnv(name: string) {
  const value = Netlify.env.get(name);
  if (!value) throw new Error('missing_env:' + name);
  return value;
}
async function supabaseRpc(name: string, body: Record<string, unknown>) {
  const base = requiredEnv('SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(base + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: serviceKey, authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) throw new Error('supabase_rpc_' + name + '_' + res.status + ':' + (typeof parsed === 'string' ? parsed : JSON.stringify(parsed)));
  return parsed as Record<string, unknown> | null;
}
async function getPortOnePayment(paymentId: string) {
  const secret = requiredEnv('PORTONE_API_SECRET');
  const res = await fetch('https://api.portone.io/payments/' + encodeURIComponent(paymentId), {
    headers: { authorization: 'PortOne ' + secret },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) throw new Error('portone_get_' + res.status + ':' + (typeof parsed === 'string' ? parsed : JSON.stringify(parsed)));
  return parsed as Record<string, unknown>;
}
function paymentStatus(payment: Record<string, unknown>) {
  return String(payment?.status ?? '').toUpperCase();
}
function totalAmount(payment: Record<string, unknown>) {
  const amount = payment?.amount as Record<string, unknown> | undefined;
  const value = amount?.total ?? amount?.totalAmount ?? payment?.totalAmount;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
function eventKeyFallback(resourceType: string, resourceId: string, paymentId: string) {
  return 'server:' + resourceType + ':' + resourceId + ':' + paymentId + ':payment_paid';
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    requiredEnv('PORTONE_API_SECRET');
    requiredEnv('SUPABASE_URL');
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

    const resourceType = String(body.resourceType ?? '');
    const resourceId = String(body.resourceId ?? '');
    const paymentId = String(body.paymentId ?? '');

    if (resourceType !== 'access_order') return json({ error: 'invalid_resource_type' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(resourceId)) return json({ error: 'invalid_resource_id' }, 400);
    if (!paymentId) return json({ error: 'payment_id_required' }, 400);

    const contract = await supabaseRpc('gongsil_get_portone_verification_contract', {
      p_resource_type: resourceType,
      p_resource_id: resourceId,
    });
    const expectedAmount = Number(contract?.expected_amount_krw);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return json({ error: 'invalid_server_contract' }, 409);

    const payment = await getPortOnePayment(paymentId);
    const status = paymentStatus(payment);
    const amount = totalAmount(payment);
    const currency = String(payment?.currency ?? 'KRW').toUpperCase();

    if (!['PAID', 'PARTIAL_CANCELLED'].includes(status)) return json({ error: 'payment_not_paid', providerStatus: status }, 409);
    if (!['KRW', 'CURRENCY_KRW'].includes(currency)) return json({ error: 'currency_mismatch', currency }, 409);
    if (!Number.isFinite(amount) || Math.round(amount) !== Math.round(expectedAmount)) {
      return json({ error: 'amount_mismatch', expectedAmount, providerAmount: amount }, 409);
    }
    if (contract?.payable !== true && contract?.status !== 'paid') {
      return json({ error: 'resource_not_payable', status: contract?.status }, 409);
    }

    const eventKey = String(body.eventKey ?? eventKeyFallback(resourceType, resourceId, paymentId));
    const result = await supabaseRpc('gongsil_ingest_portone_verified_event', {
      p_event_key: eventKey,
      p_resource_type: resourceType,
      p_event_type: 'payment_paid',
      p_resource_id: resourceId,
      p_payment_id: paymentId,
      p_amount_krw: amount,
      p_provider_status: 'paid',
      p_payload: { provider: payment },
    });

    return json({ ok: true, result });
  } catch (error) {
    console.error('portone-verify error', error);
    return json({ error: 'server_verification_failed' }, 500);
  }
};
