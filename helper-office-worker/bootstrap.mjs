import { deployHelperOfficeProduction } from './production-deploy-v2.mjs';
import { inspectVercelProtection } from './vercel-inspect.mjs';
import { disableVercelSsoProtection } from './vercel-protection.mjs';

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
