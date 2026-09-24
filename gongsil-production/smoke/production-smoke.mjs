import { chromium } from 'playwright';

const base = 'https://gongsil-helper.netlify.app/';
// retry-direct-kakao-20260923
// post-deploy-account-return-20260924
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

async function route(hash, text) {
  await page.goto(base + hash, { waitUntil: 'networkidle', timeout: 60000 });
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 20000 });
  console.log('PASS', hash, text);
}

try {
  const index = await page.request.get(base);
  if (!index.ok()) throw new Error('index HTTP ' + index.status());
  const indexHtml = await index.text();
  const appMatch = indexHtml.match(/<script[^>]+src=["']\.\/app\.js\?v=([^"']+)["']/i);
  if (!appMatch?.[1]) throw new Error('versioned app.js asset missing');
  const appRes = await page.request.get(base + 'app.js?v=' + encodeURIComponent(appMatch[1]));
  if (!appRes.ok()) throw new Error('app.js HTTP ' + appRes.status());
  const appJs = await appRes.text();
  if (!appJs.includes("supabase.auth.signInWithOAuth") || !appJs.includes("provider:'kakao'")) throw new Error('direct Supabase Kakao OAuth flow missing from live app.js');
  if (appJs.includes("/api/universe/auth/start-redirect")) throw new Error('legacy PDS start-redirect must not be used by live Gongsil app');
  console.log('PASS live versioned app asset', appMatch[1]);

  await route('#valuation', '무료 AI 권리금 시세진단');
  await page.locator('input[name="revenue"]').fill('550만원');
  await page.locator('input[name="rent"]').fill('180만원');
  await page.locator('input[name="fixed"]').fill('120만원');
  await page.locator('input[name="months"]').fill('24개월');
  await page.locator('input[name="occupancy"]').fill('72');
  await page.locator('input[name="accessibility"]').fill('82');
  await page.locator('input[name="tourism"]').fill('78');
  await page.getByText('관광지 인접도', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'AI 적정 권리금 계산' }).click();
  await page.locator('#valuationPreview').getByText('권리금 기준값', { exact: false }).waitFor({ timeout: 30000 });
  console.log('PASS valuation quote');

  await route('#listings', '특허 제5단계');
  await page.locator('#areaFilter').waitFor();
  await page.locator('#depositMax').waitFor();
  await page.locator('#premiumMax').waitFor();
  console.log('PASS patent search filters');

  await route('#passes', '프리미엄 열람권');
  await page.getByText('10일 열람권', { exact: false }).waitFor();
  await page.getByText('30일 열람권', { exact: false }).waitFor();
  await page.getByText('60일 열람권', { exact: false }).waitFor();
  const firstBuy = page.locator('[data-buy-plan]').first();
  await firstBuy.click();
  await page.getByText('카카오 로그인 후 바로 공실헬퍼 내 계정으로 돌아옵니다.', { exact: false }).waitFor({ timeout: 10000 });
  console.log('PASS access pass login gate');
  await page.locator('#modalClose').click();

  await route('#register', '매물 등록');
  await page.getByText('카카오 인증 후 등록할 수 있습니다.', { exact: false }).waitFor();
  console.log('PASS register auth gate');

  await route('#account', '카카오 인증이 필요합니다.');
  console.log('PASS account login gate');

  await route('#broker', '공인중개사 파트너');
  console.log('PASS broker patent claim login gate');

  await route('#verify', '관공서 자동대조');
  const verifyAddress = page.locator('input[name="address"]');

  await verifyAddress.fill('서울특별시 동대문구 전농로37길 68-4');
  await page.getByRole('button', { name: '자동대조 실행' }).click();
  await page.locator('#verifyResult').getByText('주소 보완 필요', { exact: false }).waitFor({ timeout: 10000 });
  console.log('PASS unit-required gate');

  await verifyAddress.fill('서울특별시동대문구전농로37길68-4B101호');
  await page.getByRole('button', { name: '자동대조 실행' }).click();
  await page.locator('#verifyResult').getByText(/활성 영업 확인|영업\/정상/, { exact: false }).first().waitFor({ timeout: 30000 });
  await page.locator('#verifyResult').getByText('지-안', { exact: false }).first().waitFor({ timeout: 30000 });
  console.log('PASS exact unit permit check without spaces');

  await page.goto(base + '#home', { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('#authBtn').click();
  await page.getByText('카카오 로그인 후 바로 공실헬퍼 내 계정으로 돌아옵니다.', { exact: false }).waitFor();
  let supabaseAuthorizeUrl = '';
  page.on('request', req => {
    if (req.url().includes('buzcnfnimzlsjvbeefjb.supabase.co/auth/v1/authorize')) supabaseAuthorizeUrl = req.url();
  });
  await page.getByRole('button', { name: '카카오로 계속하기' }).click();
  await page.waitForURL(url => url.hostname === 'kauth.kakao.com' || url.hostname === 'accounts.kakao.com', { timeout: 30000 });
  const storage = await page.context().storageState();
  const gongsilOrigin = storage.origins.find(o => o.origin === 'https://gongsil-helper.netlify.app');
  const pendingEntry = gongsilOrigin?.localStorage?.find(x => x.name === 'gongsil.pending');
  if (!pendingEntry) throw new Error('Gongsil account return target was not persisted before Kakao navigation');
  const pending = JSON.parse(pendingEntry.value);
  if (pending?.type !== 'route' || pending?.hash !== '#account') throw new Error('Kakao login must return to Gongsil #account');
  if (!supabaseAuthorizeUrl) throw new Error('Supabase Kakao authorize endpoint was not requested');
  const supabaseUrl = new URL(supabaseAuthorizeUrl);
  if (supabaseUrl.searchParams.get('provider') !== 'kakao') throw new Error('Supabase OAuth provider must be kakao');
  const redirectTo = supabaseUrl.searchParams.get('redirect_to') || '';
  if (redirectTo !== 'https://gongsil-helper.netlify.app/') throw new Error('Supabase redirect_to must target Gongsil root before session recovery');
  if (page.url().includes('v2.appdeploy.ai')) throw new Error('PDS must not appear in Gongsil login navigation');
  const kakaoUrl = new URL(page.url());
  if (kakaoUrl.hostname === 'accounts.kakao.com') {
    const rawContinue = kakaoUrl.searchParams.get('continue') || '';
    const cont = decodeURIComponent(rawContinue);
    if (!cont.includes('kauth.kakao.com/oauth/authorize')) throw new Error('Kakao login continue URL mismatch');
    const decodedTwice = decodeURIComponent(cont);
    if (!decodedTwice.includes('buzcnfnimzlsjvbeefjb.supabase.co/auth/v1/callback')) throw new Error('Kakao callback must use Supabase Auth');
    if (!decodedTwice.includes('gongsil-helper.netlify.app')) throw new Error('Kakao flow must return to Gongsil');
  }
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/KOE205|KOE006/.test(bodyText)) throw new Error('Kakao configuration error visible');
  console.log('PASS direct Supabase Kakao login handoff', page.url());

  const cfg = await page.request.get(base + '.netlify/functions/portone-config');
  if (!cfg.ok()) throw new Error('portone-config HTTP ' + cfg.status());
  const json = await cfg.json();
  if (!json.storeId || !json.channelKey) throw new Error('portone public config missing');
  console.log('PASS portone config');

  console.log('GONGSIL_PRODUCTION_SMOKE=PASS');
} finally {
  await browser.close();
}
