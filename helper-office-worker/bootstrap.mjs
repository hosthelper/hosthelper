import { deployHelperOfficeProduction } from './production-deploy-v2.mjs';
import { inspectVercelProtection } from './vercel-inspect.mjs';
import { disableVercelSsoProtection } from './vercel-protection.mjs';
import { triggerSeochoCleaning } from './cleaning-trigger.mjs';

await import('./server.mjs');

void inspectVercelProtection()
  .then((result) => {
    console.log('HELPER_OFFICE_VERCEL_PROTECTION', JSON.stringify(result));
  })
  .catch((error) => {
    console.error('HELPER_OFFICE_VERCEL_PROTECTION_FAILED', String(error?.message || error));
  });

if (process.env.RUN_VERCEL_PROTECTION_FIX_ON_START === 'true') {
  void disableVercelSsoProtection()
    .then((result) => {
      console.log('HELPER_OFFICE_VERCEL_PROTECTION_FIX_OK', JSON.stringify(result));
    })
    .catch((error) => {
      console.error('HELPER_OFFICE_VERCEL_PROTECTION_FIX_FAILED', String(error?.message || error));
    });
}

if (process.env.RUN_PRODUCTION_DEPLOY_ON_START === 'true') {
  void deployHelperOfficeProduction()
    .then((result) => {
      console.log('HELPER_OFFICE_PRODUCTION_DEPLOY_OK', JSON.stringify(result));
    })
    .catch((error) => {
      console.error('HELPER_OFFICE_PRODUCTION_DEPLOY_FAILED', String(error?.message || error));
    });
}

if (process.env.RUN_CLEANING_SYNC_ON_START === 'true') {
  void triggerSeochoCleaning()
    .then((result) => {
      console.log('CLEANING_SYNC_ON_START_OK', JSON.stringify(result));
    })
    .catch((error) => {
      console.error('CLEANING_SYNC_ON_START_FAILED', String(error?.message || error));
    });
}

const ONE_TIME_NOTICE_TEXT = `<서초 지젤>\n\n9/14: A605 -\n9/15: A805 -\n9/16: A506 -\n\n9/25: A705 -\n\n<401 천호>\n9/15:\n9/18:\n9/27:\n\n<청량리>\n9월 청소 일정 없음`;

async function sendOneTimeNotice() {
  const endpoint = process.env.KAKAO_SEND_ENDPOINT || 'https://auction-community-pearl.vercel.app/api/kakao/send';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vercel-cron/1.0',
    },
    body: JSON.stringify({ text: ONE_TIME_NOTICE_TEXT }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw: raw.slice(0, 500) }; }
  if (!response.ok || body?.ok === false) throw new Error(`ONE_TIME_NOTICE_SEND_${response.status}`);
  return body;
}

if (process.env.RUN_ONE_TIME_NOTICE_ON_START === 'true') {
  void sendOneTimeNotice()
    .then((result) => {
      console.log('ONE_TIME_NOTICE_SEND_OK', JSON.stringify(result));
    })
    .catch((error) => {
      console.error('ONE_TIME_NOTICE_SEND_FAILED', String(error?.message || error));
    });
}
