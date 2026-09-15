const KAKAO_SEND_ENDPOINT =
  process.env.KAKAO_SEND_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/kakao/send';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const STATE_REPO = process.env.CLEANING_STATE_REPO || 'hosthelper/hosthelper';
const STATE_BRANCH = process.env.CLEANING_STATE_BRANCH || 'runtime/seocho-cleaning-state-v2';
const STATE_PATH = 'helper-office-worker/runtime/seocho-cleaning-state.json';

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function propertyName(roomName) {
  if (roomName === '401호 천호') return '401 천호';
  if (roomName === '청량리') return '청량리';
  return '서초 지젤';
}

async function loadState() {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const url = new URL(`https://api.github.com/repos/${STATE_REPO}/contents/${STATE_PATH}`);
  url.searchParams.set('ref', STATE_BRANCH);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'helper-office-render-worker/month-summary',
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`STATE_READ_${response.status}`);
  const file = await response.json();
  const decoded = Buffer.from(String(file?.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
  const state = JSON.parse(decoded || '{}');
  return state.bookings && typeof state.bookings === 'object' ? Object.values(state.bookings) : [];
}

async function sendKakao(text) {
  const response = await fetch(KAKAO_SEND_ENDPOINT, {
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
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw: raw.slice(0, 1000) }; }
  if (!response.ok || body?.ok === false) {
    const error = new Error(`KAKAO_SEND_${response.status}`);
    error.downstream = body;
    throw error;
  }
  return body;
}

export async function sendCurrentMonthCleaningSummary() {
  const today = kstToday();
  const [year, month] = today.split('-');
  const prefix = `${year}-${month}-`;
  const stateBookings = await loadState();

  const seen = new Set();
  const bookings = stateBookings
    .filter((b) => String(b.checkoutDate || '').startsWith(prefix) && b.checkoutDate >= today)
    .filter((b) => {
      const signature = `${b.roomName}:${b.checkoutDate}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .sort((a, b) => a.checkoutDate.localeCompare(b.checkoutDate) || a.roomName.localeCompare(b.roomName));

  const lines = [];
  for (const property of ['서초 지젤', '401 천호', '청량리']) {
    lines.push(`<${property}>`, '');
    const rows = bookings.filter((b) => propertyName(b.roomName) === property);
    if (!rows.length) {
      lines.push('청소 일정 없음', '');
      continue;
    }
    for (const row of rows) {
      const day = Number(row.checkoutDate.slice(8, 10));
      if (property === '서초 지젤') lines.push(`${Number(month)}/${day}: ${row.roomName} -`);
      else lines.push(`${Number(month)}/${day}:`);
    }
    lines.push('');
  }

  const text = lines.join('\n').trimEnd();
  const kakao = await sendKakao(text);
  return { ok: true, year, month: Number(month), count: bookings.length, bookings, text, kakao };
}
