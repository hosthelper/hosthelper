import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const GATEWAY_URL = process.env.HELPER_OFFICE_CODE_GATEWAY || 'https://buzcnfnimzlsjvbeefjb.supabase.co/functions/v1/helper-office-code-gateway';
const ALLOWED_GITHUB_OWNER = process.env.ALLOWED_GITHUB_OWNER || 'hosthelper';
const PRODUCTION_SNAPSHOT_BASE = 'https://helper-office-4vmzn0t90-lifehelper.vercel.app';
const activeJobs = new Set();

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 128 * 1024) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function gateway(jobToken, action, payload = {}) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, job_token: jobToken, ...payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(`GATEWAY_${response.status}:${body.error || 'unknown_error'}`);
  return body;
}

async function github(repo, path, init = {}) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const response = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'helper-office-render-worker',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const error = new Error(`GITHUB_${response.status}:${body?.message || String(text).slice(0, 180)}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function fetchProductionSnapshot() {
  const names = ['index.html', 'app.js', 'styles.css'];
  const files = [];
  for (const name of names) {
    const response = await fetch(`${PRODUCTION_SNAPSHOT_BASE}/${name}`, {
      headers: { 'user-agent': 'helper-office-render-worker/source-snapshot' },
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`SNAPSHOT_${name}_${response.status}`);
    const content = await response.text();
    if (!content || content.length < 20) throw new Error(`SNAPSHOT_${name}_EMPTY`);
    files.push({ name, content, bytes: Buffer.byteLength(content, 'utf8') });
  }
  return { base: PRODUCTION_SNAPSHOT_BASE, files };
}

function encodePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

function pathAllowed(path, allowedPaths) {
  const clean = String(path || '').replace(/^\/+/, '');
  const forbidden = ['.env', '.github/workflows/', 'render.yaml', 'vercel.json', 'netlify.toml'];
  if (forbidden.some((item) => clean === item || clean.startsWith(item))) return false;
  return allowedPaths.some((prefix) => clean.startsWith(String(prefix || '').replace(/^\/+/, '')));
}

async function ensureBranch(repo, baseBranch, workingBranch) {
  const baseRef = await github(repo, `git/ref/heads/${encodeURIComponent(baseBranch)}`);
  try {
    await github(repo, `git/ref/heads/${encodeURIComponent(workingBranch)}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await github(repo, 'git/refs', {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${workingBranch}`, sha: baseRef.object.sha }),
    });
  }
}

async function listCandidateFiles(repo, branch, allowedPaths) {
  const ref = await github(repo, `git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await github(repo, `git/commits/${ref.object.sha}`);
  const tree = await github(repo, `git/trees/${commit.tree.sha}?recursive=1`);
  return (tree.tree || [])
    .filter((item) => item.type === 'blob' && Number(item.size || 0) <= 180000 && pathAllowed(item.path, allowedPaths))
    .slice(0, 180)
    .map((item) => ({ path: item.path, size: item.size }));
}

async function readFiles(repo, branch, paths) {
  const files = [];
  for (const path of paths) {
    const item = await github(repo, `contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`);
    if (item?.type !== 'file' || !item.content || !item.sha) continue;
    files.push({ path, sha: item.sha, content: Buffer.from(String(item.content).replace(/\s/g, ''), 'base64').toString('utf8') });
  }
  return files;
}

async function writeEdits(repo, branch, sourceFiles, edit) {
  const sourceByPath = new Map(sourceFiles.map((file) => [file.path, file]));
  const changed = [];
  let lastCommitSha = '';
  const proposals = Array.isArray(edit?.files) ? edit.files.slice(0, 3) : [];
  for (const proposal of proposals) {
    const path = String(proposal?.path || '');
    const source = sourceByPath.get(path);
    const content = String(proposal?.content || '');
    if (!source || !content || content === source.content) continue;
    const result = await github(repo, `contents/${encodePath(path)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `feat(helper-office): ${String(edit.summary || 'AI worker change').slice(0, 72)}`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        sha: source.sha,
        branch,
      }),
    });
    lastCommitSha = String(result?.commit?.sha || lastCommitSha);
    changed.push(path);
  }
  if (!changed.length || !lastCommitSha) throw new Error('AI_PRODUCED_NO_SAFE_CHANGE');
  return { changed, lastCommitSha };
}

async function ensureDraftPr(repo, baseBranch, workingBranch, workItemId, title) {
  const owner = repo.split('/')[0];
  const existing = await github(repo, `pulls?state=open&head=${encodeURIComponent(`${owner}:${workingBranch}`)}&base=${encodeURIComponent(baseBranch)}`);
  if (Array.isArray(existing) && existing[0]?.html_url) return existing[0];
  return github(repo, 'pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: `Helper Office: ${String(title || 'AI code task').slice(0, 80)}`,
      head: workingBranch,
      base: baseBranch,
      draft: true,
      body: ['Automated by Helper Office truthful Render executor.', '', `WorkItem: ${workItemId}`, '', 'Safety: existing bound files only; direct main writes and automatic Production deployment are disabled.'].join('\n'),
    }),
  });
}

async function executeJob(jobToken) {
  if (activeJobs.has(jobToken)) throw new Error('JOB_ALREADY_RUNNING_ON_THIS_INSTANCE');
  activeJobs.add(jobToken);
  let started = false;
  try {
    const auth = await gateway(jobToken, 'authorize');
    const context = auth.context || {};
    if (context.write_mode !== 'pr_only' || context.production_deploy_allowed !== false) throw new Error('UNSAFE_JOB_POLICY');
    if (!String(context.repository || '').startsWith(`${ALLOWED_GITHUB_OWNER}/`)) throw new Error('REPOSITORY_OWNER_NOT_ALLOWED');
    const allowedPaths = Array.isArray(context.allowed_paths) ? context.allowed_paths : [];
    if (!allowedPaths.length) throw new Error('NO_ALLOWED_PATHS');

    const start = await gateway(jobToken, 'start');
    if (start.reused) throw new Error('JOB_ALREADY_RUNNING');
    started = true;

    await gateway(jobToken, 'heartbeat', { step: 'GitHub branch preparation' });
    const branch = context.working_branch || `helper-office/wi-${String(context.work_item_id).slice(0, 8)}`;
    await ensureBranch(context.repository, context.base_branch || 'main', branch);

    const candidates = await listCandidateFiles(context.repository, branch, allowedPaths);
    if (!candidates.length) throw new Error('NO_ALLOWED_EXISTING_FILES');
    await gateway(jobToken, 'heartbeat', { step: 'AI file selection' });
    const selection = await gateway(jobToken, 'select_files', { candidates });
    const readPaths = (selection.read_paths || []).filter((path) => pathAllowed(path, allowedPaths)).slice(0, 4);
    if (!readPaths.length) throw new Error('AI_SELECTED_NO_SAFE_FILES');

    const sourceFiles = await readFiles(context.repository, branch, readPaths);
    if (!sourceFiles.length) throw new Error('NO_READABLE_SOURCE_FILES');
    await gateway(jobToken, 'heartbeat', { step: 'AI edit generation' });
    const generated = await gateway(jobToken, 'generate_edit', { files: sourceFiles.map(({ path, content }) => ({ path, content })) });
    const edit = generated.edit || {};

    await gateway(jobToken, 'heartbeat', { step: 'GitHub commit creation' });
    const { changed, lastCommitSha } = await writeEdits(context.repository, branch, sourceFiles, edit);
    const pr = await ensureDraftPr(context.repository, context.base_branch || 'main', branch, context.work_item_id, context.task);

    return await gateway(jobToken, 'complete', {
      commit_sha: lastCommitSha,
      pr_url: pr.html_url,
      branch,
      files: changed,
      summary: edit.summary || 'Render Worker code change',
      completed: edit.completed || 'GitHub code change and Draft PR created',
      remaining: edit.remaining || 'CI and Production verification',
      next_action: edit.next_action || 'Review CI, then continue Helper Office review flow',
    });
  } catch (error) {
    if (started) {
      try { await gateway(jobToken, 'fail', { error: String(error.message || error) }); } catch {}
    }
    throw error;
  } finally {
    activeJobs.delete(jobToken);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'helper-office-render-worker',
      github_write_configured: GITHUB_TOKEN.length > 20,
      production_deploy: false,
      mode: 'event-driven',
    });
  }
  if (req.method === 'GET' && url.pathname === '/snapshot-production') {
    try {
      const snapshot = await fetchProductionSnapshot();
      return json(res, 200, { ok: true, snapshot });
    } catch (error) {
      return json(res, 502, { ok: false, error: String(error.message || error) });
    }
  }
  if (req.method === 'POST' && url.pathname === '/execute') {
    try {
      const body = await readJson(req);
      const jobToken = String(body.job_token || '');
      if (jobToken.length < 48) return json(res, 400, { ok: false, error: 'job_token_required' });
      const result = await executeJob(jobToken);
      return json(res, 200, { ok: true, result });
    } catch (error) {
      return json(res, 500, { ok: false, error: String(error.message || error) });
    }
  }
  return json(res, 404, { ok: false, error: 'not_found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Helper Office Render Worker listening on ${PORT}`);
});
