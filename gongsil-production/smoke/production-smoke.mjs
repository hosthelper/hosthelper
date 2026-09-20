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
  await page.getByText('헬퍼유니버스 카카오 통합인증', { exact: false }).waitFor({ timeout: 10000 });
  console.log('PASS access pass login gate');
  await page.locator('#modalClose').click();

  await route('#register', '매물 등록');
  await page.getByText('카카오 인증 후 등록할 수 있습니다.', { exact: false }).waitFor();
  console.log('PASS register auth gate');

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
  await page.getByText('헬퍼유니버스 카카오 통합인증', { exact: false }).waitFor();
  await Promise.all([
    page.waitForURL(url => url.hostname.includes('v2.appdeploy.ai') || url.hostname.includes('kakao.com'), { timeout: 30000 }),
    page.getByRole('button', { name: '카카오로 계속하기' }).click()
  ]);
  console.log('PASS unified SSO start', page.url());

  const cfg = await page.request.get(base + '.netlify/functions/portone-config');
  if (!cfg.ok()) throw new Error('portone-config HTTP ' + cfg.status());
  const json = await cfg.json();
  if (!json.storeId || !json.channelKey) throw new Error('portone public config missing');
  console.log('PASS portone config');

  console.log('GONGSIL_PRODUCTION_SMOKE=PASS');
} finally {
  await browser.close();
}
