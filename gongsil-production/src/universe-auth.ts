import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_HELPER_UNIVERSE_AUTH_URL = 'https://pds-ai-company-zv30ms.v2.appdeploy.ai';
const HU_SERVICE_TOKEN_KEY = 'helper_universe_gongsil_session';

export type UniverseExchangeResult = {
  ok: boolean;
  token: string;
  expiresAt: string;
  kakaoIdToken: string;
  user: {
    memberId: string;
    name: string;
    email: string | null;
    services: string[];
    service: 'gongsil';
  };
};

function helperUniverseBaseUrl() {
  const envUrl = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_HELPER_UNIVERSE_AUTH_URL;
  return String(envUrl || DEFAULT_HELPER_UNIVERSE_AUTH_URL).replace(/\/$/, '');
}

export function buildGongsilUnifiedLoginUrl(returnTo: string) {
  const url = new URL(helperUniverseBaseUrl() + '/');
  url.searchParams.set('hu_sso_service', 'gongsil');
  url.searchParams.set('hu_return_to', returnTo);
  return url.toString();
}

export function startGongsilUnifiedLogin(returnTo = window.location.href) {
  const target = new URL(returnTo, window.location.origin);
  if (target.origin !== window.location.origin) throw new Error('invalid_return_origin');
  window.location.assign(buildGongsilUnifiedLoginUrl(target.toString()));
}

export async function exchangeGongsilSsoCode(code: string): Promise<UniverseExchangeResult> {
  if (!/^[a-f0-9]{32}$/i.test(code)) throw new Error('invalid_sso_code');
  const response = await fetch(helperUniverseBaseUrl() + '/api/universe/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || '헬퍼유니버스 통합로그인을 완료하지 못했습니다.');
  if (!data?.kakaoIdToken || !data?.user?.memberId || !data?.token) {
    throw new Error('통합로그인 응답에 필요한 회원정보가 없습니다.');
  }
  return data as UniverseExchangeResult;
}

function cleanSsoParams() {
  const url = new URL(window.location.href);
  ['hu_sso', 'hu_sso_code', 'hu_sso_service'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export async function completeGongsilUnifiedLogin(supabase: SupabaseClient) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('hu_sso_code');
  if (!code) return null;

  const exchange = await exchangeGongsilSsoCode(code);
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'kakao',
    token: exchange.kakaoIdToken,
  });
  if (error || !data.session) throw error || new Error('공실헬퍼 Supabase 세션을 만들지 못했습니다.');

  const displayName =
    exchange.user.name ||
    data.session.user.user_metadata?.nickname ||
    data.session.user.user_metadata?.name ||
    '카카오 회원';

  const { error: bootstrapError } = await supabase.rpc('gongsil_bootstrap_profile', {
    p_display_name: displayName,
  });
  if (bootstrapError) throw bootstrapError;

  const { error: linkError } = await supabase.rpc('gongsil_link_universe_member', {
    p_member_id: exchange.user.memberId,
  });
  if (linkError) throw linkError;

  window.localStorage.setItem(HU_SERVICE_TOKEN_KEY, exchange.token);
  cleanSsoParams();

  return {
    session: data.session,
    universeMemberId: exchange.user.memberId,
    serviceToken: exchange.token,
  };
}

export async function logoutGongsilUnifiedSession(supabase: SupabaseClient) {
  const serviceToken = window.localStorage.getItem(HU_SERVICE_TOKEN_KEY) || '';
  window.localStorage.removeItem(HU_SERVICE_TOKEN_KEY);

  if (serviceToken) {
    await fetch(helperUniverseBaseUrl() + '/api/universe/external/logout', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + serviceToken },
    }).catch(() => undefined);
  }

  await supabase.auth.signOut();
}
