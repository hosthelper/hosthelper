import { chromium } from 'playwright';

const base = 'https://gongsil-helper.netlify.app/';
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
  if (!indexHtml.includes('user-v12-20260922')) throw new Error('latest asset version missing');
  console.log('PASS asset version v12');

  await route('#valuation', '무료 권리금 시세진단');
  await page.locator('input[name="revenue"]').fill('550만원');
  await page.locator('input[name="rent"]').fill('180만원');
  await page.locator('input[name="fixed"]').fill('120만원');
  await page.locator('input[name="months"]').fill('24개월');
  await page.locator('input[name="occupancy"]').fill('72');
  await page.getByRole('button', { name: '예상 권리금 계산' }).click();
  await page.locator('#valuationPreview').getByText('권리금 기준값', { exact: false }).waitFor({ timeout: 30000 });
  console.log('PASS valuation quote');

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
  if (!supabaseAuthorizeUrl) throw new Error('Supabase Kakao authorize endpoint was not requested');
  const supabaseUrl = new URL(supabaseAuthorizeUrl);
  if (supabaseUrl.searchParams.get('provider') !== 'kakao') throw new Error('Supabase OAuth provider must be kakao');
  const redirectTo = supabaseUrl.searchParams.get('redirect_to') || '';
  if (redirectTo !== 'https://gongsil-helper.netlify.app/#account') throw new Error('Supabase redirect_to must target Gongsil account');
  if (page.url().includes('v2.appdeploy.ai')) throw new Error('PDS must not appear in Gongsil login navigation');
  const kakaoUrl = new URL(page.url());
  if (kakaoUrl.hostname === 'accounts.kakao.com') {
    const cont = decodeURIComponent(kakaoUrl.searchParams.get('continue') || '');
    const authorizeUrl = new URL(cont);
    if (authorizeUrl.hostname !== 'kauth.kakao.com' || authorizeUrl.pathname !== '/oauth/authorize') throw new Error('Kakao login continue URL mismatch');
    if (authorizeUrl.searchParams.get('redirect_uri') !== 'https://buzcnfnimzlsjvbeefjb.supabase.co/auth/v1/callback') throw new Error('Kakao callback must use Supabase Auth');
    if (authorizeUrl.searchParams.get('redirect_to') !== 'https://gongsil-helper.netlify.app/#account') throw new Error('Kakao redirect_to must return to Gongsil account');
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
