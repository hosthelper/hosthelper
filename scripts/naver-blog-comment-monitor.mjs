const BLOG_ID = process.env.NAVER_BLOG_ID || 'kimtaewook86';
const KAKAO_SEND_ENDPOINT = process.env.KAKAO_SEND_ENDPOINT || 'https://auction-community-pearl.vercel.app/api/kakao/send';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const STATE_REPO = process.env.NAVER_COMMENT_STATE_REPO || 'hosthelper/hosthelper';
const STATE_BRANCH = process.env.NAVER_COMMENT_STATE_BRANCH || 'runtime/seocho-cleaning-state-v2';
const STATE_PATH = process.env.NAVER_COMMENT_STATE_PATH || 'helper-office-worker/runtime/naver-blog-comment-state.json';
const MAX_POSTS = Number(process.env.NAVER_COMMENT_MAX_POSTS || 30);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36';

function decodeHtml(value = '') {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`NAVER_HTTP_${response.status}:${url}`);
  return response.text();
}

function extractLogNos(html) {
  const ids = [];
  const seen = new Set();
  const patterns = [
    /[?&]logNo=(\d{8,})/g,
    new RegExp(`/` + BLOG_ID.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `/(\\d{8,})`, 'g'),
    /["']logNo["']\s*:\s*["']?(\d{8,})/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const id = match[1];
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

async function discoverPosts() {
  const pages = [
    `https://m.blog.naver.com/${BLOG_ID}`,
    `https://m.blog.naver.com/PostList.naver?blogId=${BLOG_ID}&categoryNo=0&currentPage=1&countPerPage=${MAX_POSTS}`,
  ];
  const ids = [];
  const seen = new Set();
  for (const url of pages) {
    try {
      const html = await fetchText(url);
      for (const id of extractLogNos(html)) {
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    } catch (error) {
      console.error('discover warning', String(error.message || error));
    }
    if (ids.length >= MAX_POSTS) break;
  }
  if (!ids.length) throw new Error('NAVER_POST_DISCOVERY_EMPTY');
  return ids.slice(0, MAX_POSTS);
}

function parsePost(html, logNo) {
  const countPatterns = [
    /\bcommentCount=["'](\d+)["']/i,
    /\\?"commentCount\\?"\s*:\s*(\d+)/i,
    /\bcommentCount\s*:\s*(\d+)/i,
  ];
  let commentCount = null;
  for (const pattern of countPatterns) {
    const match = html.match(pattern);
    if (match) {
      commentCount = Number(match[1]);
      break;
    }
  }
  if (!Number.isFinite(commentCount)) throw new Error(`COMMENT_COUNT_NOT_FOUND:${logNo}`);

  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
    || html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = decodeHtml(titleMatch?.[1] || `네이버 블로그 글 ${logNo}`).replace(/\s*:\s*네이버 블로그\s*$/i, '');
  return {
    logNo: String(logNo),
    title,
    commentCount,
    url: `https://blog.naver.com/${BLOG_ID}/${logNo}`,
    checkedAt: new Date().toISOString(),
  };
}

async function fetchPost(logNo) {
  const html = await fetchText(`https://m.blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}`);
  return parsePost(html, logNo);
}

async function github(path, init = {}) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const response = await fetch(`https://api.github.com/repos/${STATE_REPO}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'hosthelper-naver-comment-monitor',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1000) }; }
  if (!response.ok) {
    const error = new Error(`GITHUB_${response.status}:${body?.message || 'unknown'}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function loadState() {
  try {
    const file = await github(`contents/${STATE_PATH}?ref=${encodeURIComponent(STATE_BRANCH)}`);
    const decoded = Buffer.from(String(file.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
    const state = JSON.parse(decoded || '{}');
    return { initialized: state.initialized === true, posts: state.posts || {}, sha: file.sha || '' };
  } catch (error) {
    if (error.status === 404) return { initialized: false, posts: {}, sha: '' };
    throw error;
  }
}

async function saveState(posts, sha = '') {
  const state = { version: 1, initialized: true, blogId: BLOG_ID, updatedAt: new Date().toISOString(), posts };
  const payload = {
    message: 'chore(runtime): update Naver blog comment state',
    content: Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64'),
    branch: STATE_BRANCH,
  };
  if (sha) payload.sha = sha;
  await github(`contents/${STATE_PATH}`, { method: 'PUT', body: JSON.stringify(payload) });
}

async function sendKakao(text) {
  const response = await fetch(KAKAO_SEND_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'hosthelper-naver-comment-monitor/1.0' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw: raw.slice(0, 500) }; }
  if (!response.ok || body?.ok === false) throw new Error(`KAKAO_SEND_${response.status}:${JSON.stringify(body)}`);
  return body;
}

function buildMessage(events) {
  const lines = ['💬 네이버 블로그 새 댓글'];
  for (const event of events) {
    lines.push('', `글: ${event.title}`, `새 댓글: +${event.delta}개 (총 ${event.commentCount}개)`, `확인: ${event.url}`);
  }
  return lines.join('\n').slice(0, 1900);
}

async function main() {
  const previous = await loadState();
  const ids = await discoverPosts();
  const currentPosts = { ...previous.posts };
  const events = [];
  const failures = [];

  for (const logNo of ids) {
    try {
      const post = await fetchPost(logNo);
      const before = previous.posts[logNo];
      if (previous.initialized) {
        if (before && post.commentCount > Number(before.commentCount || 0)) {
          events.push({ ...post, delta: post.commentCount - Number(before.commentCount || 0) });
        } else if (!before && post.commentCount > 0) {
          events.push({ ...post, delta: post.commentCount });
        }
      }
      currentPosts[logNo] = post;
    } catch (error) {
      failures.push({ logNo, error: String(error.message || error) });
    }
  }

  const keep = {};
  for (const logNo of ids) if (currentPosts[logNo]) keep[logNo] = currentPosts[logNo];
  if (!previous.initialized) {
    await saveState(keep, previous.sha);
    console.log(JSON.stringify({ ok: true, baselineOnly: true, posts: Object.keys(keep).length, events: [], failures }));
    return;
  }

  if (events.length) await sendKakao(buildMessage(events));
  await saveState(keep, previous.sha);
  console.log(JSON.stringify({ ok: true, baselineOnly: false, posts: Object.keys(keep).length, events: events.map(({ logNo, title, delta, commentCount, url }) => ({ logNo, title, delta, commentCount, url })), failures }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
