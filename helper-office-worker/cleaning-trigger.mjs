const KAKAO_SEND_ENDPOINT =
  process.env.KAKAO_SEND_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/kakao/send';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const STATE_REPO = process.env.CLEANING_STATE_REPO || 'hosthelper/hosthelper';
const STATE_BRANCH = process.env.CLEANING_STATE_BRANCH || 'runtime/seocho-cleaning-state-v2';
const STATE_PATH = 'helper-office-worker/runtime/seocho-cleaning-state.json';

const ROOMS = ['A605', 'A601', 'A705', 'A311', 'A506', 'A805'];

function getFeeds() {
  const feeds = ROOMS.map((id) => ({
    id,
    icalUrl: String(process.env[`SEOCHO_GISELLE_ICAL_${id}`] || '').trim(),
  }));
  const missing = feeds.filter((feed) => !feed.icalUrl).map((feed) => feed.id);
  if (missing.length) throw new Error(`CLEANING_ICAL_MISSING:${missing.join(',')}`);
  return feeds;
}

function unfoldICal(text) {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function valueOf(line) {
  const idx = line.indexOf(':');
  return idx >= 0 ? line.slice(idx + 1).trim() : '';
}

function normalizeDate(value) {
  const match = String(value).match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return String(value);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseReservedBookings(text, roomName) {
  const lines = unfoldICal(text);
  const out = [];
  let event = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (
        event &&
        event.uid &&
        event.checkoutDate &&
        String(event.summary || '').trim().toLowerCase() === 'reserved'
      ) {
        out.push({
          key: `${roomName}:${event.uid}`,
          roomName,
          uid: event.uid,
          checkoutDate: event.checkoutDate,
        });
      }
      event = null;
      continue;
    }
    if (!event) continue;

    if (line.startsWith('UID')) event.uid = valueOf(line);
    else if (line.startsWith('SUMMARY')) event.summary = valueOf(line);
    else if (line.startsWith('DTEND')) event.checkoutDate = normalizeDate(valueOf(line));
  }

  return out;
}

function kstToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatKoreanDate(date) {
  const [, month, day] = String(date).split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

async function githubState(method = 'GET', body) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const url = new URL(`https://api.github.com/repos/${STATE_REPO}/contents/${STATE_PATH}`);
  if (method === 'GET') url.searchParams.set('ref', STATE_BRANCH);

  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'helper-office-render-worker/seocho-cleaning-state',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text.slice(0, 1000) }; }
  if (!response.ok) throw new Error(`CLEANING_STATE_GITHUB_${response.status}`);
  return parsed;
}

async function loadState() {
  const file = await githubState('GET');
  try {
    const decoded = Buffer.from(String(file?.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
    const state = JSON.parse(decoded || '{}');
    return {
      version: Number(state.version || 2),
      initialized: state.initialized === true,
      updatedAt: state.updatedAt || null,
      bookings: state.bookings && typeof state.bookings === 'object' ? state.bookings : {},
      sha: String(file?.sha || ''),
    };
  } catch {
    return { version: 2, initialized: false, updatedAt: null, bookings: {}, sha: String(file?.sha || '') };
  }
}

async function saveState(bookings, sha) {
  if (!sha) throw new Error('CLEANING_STATE_SHA_MISSING');
  const state = {
    version: 2,
    initialized: true,
    updatedAt: new Date().toISOString(),
    bookings,
  };
  await githubState('PUT', {
    message: 'chore(runtime): update Seocho cleaning state',
    content: Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64'),
    sha,
    branch: STATE_BRANCH,
  });
  return state;
}

async function fetchCurrentBookings(feeds, previousBookings) {
  const today = kstToday();
  const current = {};
  const succeededRooms = new Set();
  const failures = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.icalUrl, {
        cache: 'no-store',
        headers: { 'user-agent': 'helper-office-render-worker/seocho-cleaning-direct' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const text = await response.text();
      for (const booking of parseReservedBookings(text, feed.id)) {
        if (booking.checkoutDate >= today) current[booking.key] = booking;
      }
      succeededRooms.add(feed.id);
    } catch (error) {
      failures.push({ room: feed.id, error: String(error.message || error) });
    }
  }

  // 조회 실패 객실은 이전 상태를 유지해 잘못된 취소 알림을 방지한다.
  for (const [key, booking] of Object.entries(previousBookings || {})) {
    if (!succeededRooms.has(booking.roomName)) current[key] = booking;
  }

  return { today, current, succeededRooms, failures };
}

function buildAlert(type, booking) {
  const title =
    type === 'new'
      ? '🧹 서초 지젤 신규 청소 일정'
      : type === 'changed'
        ? '🧹 서초 지젤 청소 일정 변경'
        : '🧹 서초 지젤 청소 일정 취소';

  return [
    title,
    `객실: ${booking.roomName}`,
    `청소일: ${formatKoreanDate(booking.checkoutDate)}`,
    '담당:',
  ].join('\n');
}

async function sendKakao(text) {
  const response = await fetch(KAKAO_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vercel-cron/1.0',
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(30_000),
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

export async function probeKakaoSend() {
  const response = await fetch(KAKAO_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vercel-cron/1.0',
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1000) }; }
  return { status: response.status, ok: response.ok, body };
}

export async function triggerSeochoCleaning() {
  const feeds = getFeeds();
  const previous = await loadState();
  const snapshot = await fetchCurrentBookings(feeds, previous.bookings);

  if (!previous.initialized) {
    if (snapshot.failures.length > 0) {
      return {
        ok: false,
        initialized: false,
        reason: 'baseline_requires_all_rooms',
        failures: snapshot.failures,
      };
    }
    await saveState(snapshot.current, previous.sha);
    return {
      ok: true,
      initialized: true,
      baselineOnly: true,
      activeBookings: Object.keys(snapshot.current).length,
      events: [],
      failures: [],
    };
  }

  const events = [];
  for (const [key, current] of Object.entries(snapshot.current)) {
    const before = previous.bookings[key];
    if (!before) {
      events.push({ type: 'new', booking: current });
    } else if (before.checkoutDate !== current.checkoutDate) {
      events.push({ type: 'changed', booking: current });
    }
  }

  for (const [key, before] of Object.entries(previous.bookings)) {
    if (!snapshot.succeededRooms.has(before.roomName)) continue;
    if (before.checkoutDate <= snapshot.today) continue;
    if (!snapshot.current[key]) events.push({ type: 'cancelled', booking: before });
  }

  // 해당 호실 한 건씩만 발송한다. 월별 전체표는 자동 발송하지 않는다.
  const sent = [];
  for (const event of events) {
    const result = await sendKakao(buildAlert(event.type, event.booking));
    sent.push({ type: event.type, roomName: event.booking.roomName, checkoutDate: event.booking.checkoutDate, result });
  }

  await saveState(snapshot.current, previous.sha);
  return {
    ok: true,
    initialized: true,
    activeBookings: Object.keys(snapshot.current).length,
    events: sent.map(({ type, roomName, checkoutDate }) => ({ type, roomName, checkoutDate })),
    failures: snapshot.failures,
  };
}
