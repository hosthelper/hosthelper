import * as PortOne from '@portone/browser-sdk/v2';
import type { SupabaseClient } from '@supabase/supabase-js';

export const ACCESS_PASS_PLANS = {
  day_10: { code: 'day_10', label: '10일 열람권', price: 50000, days: 10 },
  day_30: { code: 'day_30', label: '30일 열람권', price: 100000, days: 30 },
  day_60: { code: 'day_60', label: '60일 열람권', price: 150000, days: 60 },
} as const;

export type AccessPassPlanCode = keyof typeof ACCESS_PASS_PLANS;

type PortOnePublicConfig = {
  storeId: string;
  channelKey: string;
};

async function getPortOnePublicConfig(): Promise<PortOnePublicConfig> {
  const response = await fetch('/.netlify/functions/portone-config', { cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.storeId || !data?.channelKey) {
    throw new Error(data?.error || 'PortOne 공개 설정을 불러오지 못했습니다.');
  }
  return data as PortOnePublicConfig;
}

function idempotencyKey(planCode: AccessPassPlanCode) {
  const existing = window.sessionStorage.getItem('gongsil.access-order.' + planCode);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem('gongsil.access-order.' + planCode, next);
  return next;
}

async function createAccessOrder(supabase: SupabaseClient, planCode: AccessPassPlanCode) {
  const { data, error } = await supabase.rpc('gongsil_create_access_order_idempotent', {
    p_plan_code: planCode,
    p_idempotency_key: idempotencyKey(planCode),
  });
  if (error) throw error;
  if (!data) throw new Error('열람권 주문을 만들지 못했습니다.');
  return String(data);
}

async function verifyAccessPassPayment(resourceId: string, paymentId: string) {
  const response = await fetch('/.netlify/functions/portone-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceType: 'access_order',
      resourceId,
      paymentId,
      action: 'verify_payment',
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.error || data?.detail || '서버 결제 검증에 실패했습니다.');
  }
  return data;
}

export async function purchaseAccessPass(
  supabase: SupabaseClient,
  planCode: AccessPassPlanCode,
  customer?: { id?: string; name?: string; email?: string },
) {
  const plan = ACCESS_PASS_PLANS[planCode];
  const [orderId, config] = await Promise.all([
    createAccessOrder(supabase, planCode),
    getPortOnePublicConfig(),
  ]);

  const paymentId = 'gongsil-' + orderId;
  const redirect = new URL(window.location.href);
  redirect.searchParams.set('payment_callback', '1');
  redirect.searchParams.set('access_order_id', orderId);

  const response = await PortOne.requestPayment({
    storeId: config.storeId,
    channelKey: config.channelKey,
    paymentId,
    orderName: '공실헬퍼 ' + plan.label,
    totalAmount: plan.price,
    currency: 'CURRENCY_KRW',
    payMethod: 'CARD',
    redirectUrl: redirect.toString(),
    customer: {
      customerId: customer?.id,
      fullName: customer?.name,
      email: customer?.email,
    },
  });

  if (!response) {
    return { redirected: true as const, orderId, paymentId };
  }
  if (response.code !== undefined) {
    throw new Error(response.message || '결제가 취소되었거나 실패했습니다.');
  }

  const verifiedPaymentId = response.paymentId || paymentId;
  await verifyAccessPassPayment(orderId, verifiedPaymentId);
  window.sessionStorage.removeItem('gongsil.access-order.' + planCode);

  const { data: status, error: statusError } = await supabase.rpc('gongsil_get_my_access_pass_status');
  if (statusError) throw statusError;

  return { redirected: false as const, orderId, paymentId: verifiedPaymentId, status };
}

export async function completeAccessPassRedirect(supabase: SupabaseClient) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('payment_callback') !== '1') return null;

  const orderId = url.searchParams.get('access_order_id') || '';
  const paymentId = url.searchParams.get('paymentId') || '';
  const code = url.searchParams.get('code');
  const message = url.searchParams.get('message');

  ['payment_callback', 'access_order_id', 'paymentId', 'code', 'message', 'pgCode', 'pgMessage'].forEach((key) => {
    url.searchParams.delete(key);
  });

  if (code) {
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    throw new Error(message || '결제가 취소되었거나 실패했습니다.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !paymentId) {
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    throw new Error('결제 완료 정보가 올바르지 않습니다.');
  }

  await verifyAccessPassPayment(orderId, paymentId);
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);

  const { data: status, error } = await supabase.rpc('gongsil_get_my_access_pass_status');
  if (error) throw error;
  return status;
}
