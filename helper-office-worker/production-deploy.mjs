import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.HELPER_OFFICE_PRODUCTION_SNAPSHOT || 'https://helper-office-4vmzn0t90-lifehelper.vercel.app';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_NqiuOriBTEEiMG4NnPZyFaqJN9eD';
const ORG_ID = process.env.VERCEL_ORG_ID || 'team_bTTQ4keENdDaBRIcpINqZFVU';
const SCOPE = process.env.VERCEL_SCOPE || 'lifehelper';
const RELEASE_REPO = 'hosthelper/lifehelper';
const RELEASE_REF = process.env.HELPER_OFFICE_RELEASE_REF || 'helper-office/control-plane-v1';

async function text(url, headers = {}) {
  const response = await fetch(url, { headers: { 'user-agent': 'helper-office-production-deployer', ...headers }, redirect: 'follow' });
  if (!response.ok) throw new Error(`FETCH_${response.status}:${url}`);
  return response.text();
}

async function githubFile(path) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const url = `https://api.github.com/repos/${RELEASE_REPO}/contents/${path}?ref=${encodeURIComponent(RELEASE_REF)}`;
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'helper-office-production-deployer',
    },
  });
  if (!response.ok) throw new Error(`GITHUB_${response.status}:${path}`);
  const body = await response.json();
  return Buffer.from(String(body.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
}

function injectScripts(index) {
  let html = index;
  const tags = [];
  if (!/enhancements\.js/i.test(html)) tags.push('<script src="/enhancements.js"></script>');
  if (!/runtime-status-v3\.js/i.test(html)) tags.push('<script src="/runtime-status-v3.js"></script>');
  if (!tags.length) return html;
  const block = `\n    ${tags.join('\n    ')}\n`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : `${html}${block}`;
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += String(d); process.stdout.write(d); });
    child.stderr.on('data', d => { stderr += String(d); process.stderr.write(d); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`VERCEL_CLI_EXIT_${code}:${stderr.slice(-800)}`)));
  });
}

export async function deployHelperOfficeProduction() {
  if (process.env.ALLOW_PRODUCTION_DEPLOY !== 'true') throw new Error('PRODUCTION_DEPLOY_NOT_APPROVED');
  if (!VERCEL_TOKEN || VERCEL_TOKEN.length < 20) throw new Error('VERCEL_TOKEN_NOT_CONFIGURED');

  const dir = await mkdtemp(join(tmpdir(), 'helper-office-prod-'));
  try {
    const [index, app, styles, enhancements, runtimeStatus] = await Promise.all([
      text(`${BASE}/index.html`),
      text(`${BASE}/app.js`),
      text(`${BASE}/styles.css`),
      githubFile('helper-office-hq/enhancements.js'),
      githubFile('helper-office-hq/runtime-status-v3.js'),
    ]);

    await writeFile(join(dir, 'index.html'), injectScripts(index), 'utf8');
    await writeFile(join(dir, 'app.js'), app, 'utf8');
    await writeFile(join(dir, 'styles.css'), styles, 'utf8');
    await writeFile(join(dir, 'enhancements.js'), enhancements, 'utf8');
    await writeFile(join(dir, 'runtime-status-v3.js'), runtimeStatus, 'utf8');
    await mkdir(join(dir, '.vercel'), { recursive: true });
    await writeFile(join(dir, '.vercel', 'project.json'), JSON.stringify({ projectId: PROJECT_ID, orgId: ORG_ID }), 'utf8');

    const result = await run('npx', ['vercel', 'deploy', '--prod', '--yes', '--token', VERCEL_TOKEN, '--scope', SCOPE], dir);
    const urls = result.stdout.split(/\s+/).filter(x => /^https:\/\//.test(x));
    return { ok: true, project_id: PROJECT_ID, scope: SCOPE, release_ref: RELEASE_REF, deployment_url: urls.at(-1) || null };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
