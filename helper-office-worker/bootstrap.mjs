import { deployHelperOfficeProduction } from './production-deploy.mjs';

if (process.env.RUN_PRODUCTION_DEPLOY_ON_START === 'true') {
  try {
    const result = await deployHelperOfficeProduction();
    console.log('HELPER_OFFICE_PRODUCTION_DEPLOY_OK', JSON.stringify(result));
  } catch (error) {
    console.error('HELPER_OFFICE_PRODUCTION_DEPLOY_FAILED', String(error?.message || error));
  }
}

await import('./server.mjs');
