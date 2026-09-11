const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_NqiuOriBTEEiMG4NnPZyFaqJN9eD';
const ORG_ID = process.env.VERCEL_ORG_ID || 'team_bTTQ4keENdDaBRIcpINqZFVU';

export async function setProductionPublicPreviewProtected() {
  if (!VERCEL_TOKEN || VERCEL_TOKEN.length < 20) throw new Error('VERCEL_TOKEN_NOT_CONFIGURED');
  const response = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(PROJECT_ID)}?teamId=${encodeURIComponent(ORG_ID)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${VERCEL_TOKEN}`,
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'helper-office-render-worker/protection-fix',
    },
    body: JSON.stringify({ ssoProtection: { deploymentType: 'preview' } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`VERCEL_PROTECTION_${response.status}:${body?.error?.message || body?.message || 'UPDATE_FAILED'}`);
  }
  return {
    ok: true,
    project_id: body.id || PROJECT_ID,
    ssoProtection: body.ssoProtection || null,
  };
}
