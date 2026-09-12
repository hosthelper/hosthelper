import assert from 'node:assert/strict';
import test from 'node:test';
process.env.GITHUB_TOKEN = 'test-only-placeholder';
process.env.VERCEL_TOKEN = 'test-only-placeholder-value';
process.env.ALLOW_PRODUCTION_DEPLOY = 'true';
const { validateProductionBundle, deployHelperOfficeProduction } = await import('./production-deploy.mjs');
const names = ['index.html','app.js','styles.css','enhancements.js','runtime-status-v3.js','session-recovery-v1.js','p0-hardening-v1.js','decision-rights-v1.js','customer360-v1.js','operations-v1.js'];
function files() {
  return names.map(file => ({ file, data: file === 'index.html'
    ? '<html><body><script src="./app.js"></script><script src="./enhancements.js"></script><script src="./runtime-status-v3.js"></script></body></html>'
    : file === 'styles.css' ? 'body{color:black}'
    : '// runtime-status-v3-20260912 session-recovery-v1-20260912 p0-hardening-v1-20260912-guardian ho_get_guardian_board decision-rights-v1-20260912 ho_get_decision_rights_board customer360-v1-20260912 ho_get_customer_360_board\n(()=>{})();' }));
}
test('bundle gate rejects syntax errors and missing modules before deployment', () => {
  const valid = files();
  assert.equal(Object.keys(validateProductionBundle(valid)).length, names.length);
  assert.throws(() => validateProductionBundle(valid.filter(f => f.file !== 'operations-v1.js')), /BUNDLE_FILE_MISSING/);
  const broken = files(); broken.find(f => f.file === 'customer360-v1.js').data = '(() => { } inject(); })();';
  assert.throws(() => validateProductionBundle(broken), SyntaxError);
});
test('deployment pins one commit, validates scripts, and compares published file hashes', async () => {
  const originalFetch = globalThis.fetch;
  const sourceSha = 'a'.repeat(40); let deployed = null, postCount = 0, sourceReads = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname === 'api.github.com' && url.pathname.includes('/commits/')) return Response.json({ sha: sourceSha });
    if (url.hostname === 'api.github.com') {
      assert.equal(url.searchParams.get('ref'), sourceSha); sourceReads++;
      const file = files().find(f => url.pathname.endsWith('/' + f.file)); assert.ok(file);
      return Response.json({ content: Buffer.from(file.data).toString('base64') });
    }
    if (url.hostname === 'api.vercel.com' && init.method === 'POST') {
      postCount++; const body = JSON.parse(init.body); deployed = body.files;
      assert.equal(body.meta.helperOfficeSourceCommit, sourceSha);
      return Response.json({ id: 'dpl_test' });
    }
    if (url.hostname === 'api.vercel.com') return Response.json({ readyState: 'READY', url: 'example.vercel.app' });
    const file = deployed.find(f => '/' + f.file === url.pathname || (f.file === 'index.html' && url.pathname === '/'));
    assert.ok(file); return new Response(file.data);
  };
  try {
    const result = await deployHelperOfficeProduction();
    assert.equal(result.source_commit, sourceSha);
    assert.equal(result.production_verification.syntax_verified, true);
    assert.equal(Object.keys(result.production_verification.content_hashes).length, names.length);
    assert.equal(sourceReads, names.length); assert.equal(postCount, 1);
  } finally { globalThis.fetch = originalFetch; }
});
