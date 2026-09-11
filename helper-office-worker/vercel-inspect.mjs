const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_NqiuOriBTEEiMG4NnPZyFaqJN9eD';
const ORG_ID = process.env.VERCEL_ORG_ID || 'team_bTTQ4keENdDaBRIcpINqZFVU';

export async function inspectVercelProtection() {
  if (!VERCEL_TOKEN || VERCEL_TOKEN.length < 20) {
    return { ok: false, error: 'VERCEL_TOKEN_NOT_CONFIGURED' };
  }
  const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(PROJECT_ID)}?teamId=${encodeURIComponent(ORG_ID)}`, {
    headers: {
      authorization: `Bearer ${VERCEL_TOKEN}`,
      accept: 'application/json',
      'user-agent': 'helper-office-render-worker/protection-inspect',
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, status: response.status, error: body?.error?.message || body?.message || 'PROJECT_READ_FAILED' };
  }
  return {
    ok: true,
    project_id: body.id || PROJECT_ID,
    name: body.name || null,
    ssoProtection: body.ssoProtection || null,
    passwordProtection: body.passwordProtection ? { deploymentType: body.passwordProtection.deploymentType || null, configured: true } : null,
    trustedIps: body.trustedIps ? { deploymentType: body.trustedIps.deploymentType || null, protectionMode: body.trustedIps.protectionMode || null, configured: true } : null,
    protectionBypassConfigured: !!body.protectionBypass,
  };
}
