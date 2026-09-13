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

async function sendOneTimeNotice() {
  const text = String(process.env.ONE_TIME_NOTICE_TEXT || '').trim();
  if (!text) throw new Error('ONE_TIME_NOTICE_TEXT_EMPTY');
  const endpoint = process.env.KAKAO_SEND_ENDPOINT || 'https://auction-community-pearl.vercel.app/api/kakao/send';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vercel-cron/1.0',
    },
    body: JSON.stringify({ text }),
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
