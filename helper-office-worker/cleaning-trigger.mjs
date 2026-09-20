const KAKAO_SEND_ENDPOINT =
  process.env.KAKAO_SEND_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/kakao/send';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const STATE_REPO = process.env.CLEANING_STATE_REPO || 'hosthelper/hosthelper';
const STATE_BRANCH = process.env.CLEANING_STATE_BRANCH || 'runtime/seocho-cleaning-state-v2';
const STATE_PATH = 'helper-office-worker/runtime/seocho-cleaning-state.json';

const ROOM_FEEDS = [
  { id: 'A605', source: 'airbnb', feedKey: 'airbnb:A605', envKey: 'SEOCHO_GISELLE_ICAL_A605' },
  { id: 'A601', source: 'airbnb', feedKey: 'airbnb:A601', envKey: 'SEOCHO_GISELLE_ICAL_A601' },
  { id: 'A705', source: 'airbnb', feedKey: 'airbnb:A705', envKey: 'SEOCHO_GISELLE_ICAL_A705' },
  { id: 'A311', source: 'airbnb', feedKey: 'airbnb:A311', envKey: 'SEOCHO_GISELLE_ICAL_A311' },
  { id: 'A506', source: 'airbnb', feedKey: 'airbnb:A506', envKey: 'SEOCHO_GISELLE_ICAL_A506' },
  { id: 'A805', source: 'airbnb', feedKey: 'airbnb:A805', envKey: 'SEOCHO_GISELLE_ICAL_A805' },
  { id: '401호 천호', source: 'airbnb', feedKey: 'airbnb:401호 천호', envKey: 'CHEONHO_401_ICAL' },
  { id: '청량리', source: 'airbnb', feedKey: 'airbnb:청량리', envKey: 'CHEONGLYANGNI_ICAL' },
  { id: '청량리', source: 'booking', feedKey: 'booking:청량리', envKey: 'CHEONGNYANGNI_BOOKING_ICAL' },
];

function getFeeds() {
  const feeds = ROOM_FEEDS.map(({ id, source, feedKey, envKey }) => ({
    id,
    source,
    feedKey,
    icalUrl: String(process.env[envKey] || '').trim(),
  }));
  const missing = feeds.filter((feed) => !feed.icalUrl).map((feed) => feed.feedKey);
  if (missing.length) throw new Error(`CLEANING_ICAL_MISSING:${missing.join(',')}`);
  return feeds;
}

function unfoldICal(text) {
  const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
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

function dateDiffDays(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}

function addDays(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function isAcceptedEvent(event, feed, today) {
  const summary = String(event.summary || '').trim().toLowerCase();
  if (!event.uid || !event.checkoutDate) return false;

  if (feed.source === 'airbnb') return summary === 'reserved';

  if (feed.source === 'booking') {
    if (!event.checkinDate) return false;
    if (summary !== 'closed - not available') return false;
    const nights = dateDiffDays(event.checkinDate, event.checkoutDate);
    if (nights === null || nights <= 0 || nights > 30) return false;
    if (event.checkoutDate > addDays(today, 180)) return false;
    return true;
  }

  return false;
}

function parseBookings(text, feed, today) {
  const lines = unfoldICal(text);
  const out = [];
  let event = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (event && isAcceptedEvent(event, feed, today)) {
        const key = feed.source === 'airbnb'
          ? `${feed.id}:${event.uid}`
          : `${feed.id}:booking:${event.uid}`;
        out.push({
          key,
          roomName: feed.id,
          source: feed.source,
          feedKey: feed.feedKey,
          uid: event.uid,
          checkinDate: event.checkinDate || null,
          checkoutDate: event.checkoutDate,
        });
      }
      event = null;
      continue;
    }
    if (!event) continue;

    if (line.startsWith('UID')) event.uid = valueOf(line);
    else if (line.startsWith('SUMMARY')) event.summary = valueOf(line);
    else if (line.startsWith('DTSTART')) event.checkinDate = normalizeDate(valueOf(line));
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

function propertyName(roomName) {
  if (roomName === '401호 천호') return '천호';
  if (roomName === '청량리') return '청량리';
  return '서초 지젤';
}

function feedKeyForBooking(booking) {
  if (booking?.feedKey) return booking.feedKey;
  if (booking?.source === 'booking') return `booking:${booking.roomName}`;
  return `airbnb:${booking.roomName}`;
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
      'user-agent': 'helper-office-render-worker/cleaning-state',
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
    const bookings = state.bookings && typeof state.bookings === 'object' ? state.bookings : {};
    const derivedKnownRooms = [...new Set(Object.values(bookings).map((booking) => booking.roomName).filter(Boolean))];
    const knownRooms = Array.isArray(state.knownRooms) ? state.knownRooms : derivedKnownRooms;
    const derivedKnownFeeds = knownRooms.map((room) => `airbnb:${room}`);
    return {
      version: Number(state.version || 4),
      initialized: state.initialized === true,
      updatedAt: state.updatedAt || null,
      bookings,
      knownRooms,
      knownFeeds: Array.isArray(state.knownFeeds) ? state.knownFeeds : derivedKnownFeeds,
      sha: String(file?.sha || ''),
    };
  } catch {
    return { version: 4, initialized: false, updatedAt: null, bookings: {}, knownRooms: [], knownFeeds: [], sha: String(file?.sha || '') };
  }
}

async function saveState(bookings, sha, knownRooms, knownFeeds) {
  if (!sha) throw new Error('CLEANING_STATE_SHA_MISSING');
  const state = {
    version: 4,
    initialized: true,
    updatedAt: new Date().toISOString(),
    knownRooms: [...new Set(knownRooms)].sort(),
    knownFeeds: [...new Set(knownFeeds)].sort(),
    bookings,
  };
  await githubState('PUT', {
    message: 'chore(runtime): update cleaning state',
    content: Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64'),
    sha,
    branch: STATE_BRANCH,
  });
  return state;
}

async function fetchCurrentBookings(feeds, previousBookings) {
  const today = kstToday();
  const current = {};
  const succeededFeeds = new Set();
  const failures = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.icalUrl, {
        cache: 'no-store',
        headers: { 'user-agent': 'helper-office-render-worker/cleaning-direct' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const text = await response.text();
      for (const booking of parseBookings(text, feed, today)) {
        if (booking.checkoutDate >= today) current[booking.key] = booking;
      }
      succeededFeeds.add(feed.feedKey);
    } catch (error) {
      failures.push({ feed: feed.feedKey, error: String(error.message || error) });
    }
  }

  for (const [key, booking] of Object.entries(previousBookings || {})) {
    if (!succeededFeeds.has(feedKeyForBooking(booking))) current[key] = booking;
  }

  return { today, current, succeededFeeds, failures };
}

// One known Booking.com calendar item (Cheongnyangni, checkout 2027-03-20)
// has been repeatedly re-issued with unstable identity and must not generate
// another "new" Kakao alert. Keep change/cancellation alerts intact.
export function shouldSuppressAlert(event) {
  return event?.type === 'new'
    && event?.booking?.roomName === '청량리'
    && event?.booking?.checkoutDate === '2027-03-20';
}

function buildAlert(type, booking) {
  const property = propertyName(booking.roomName);
  const title =
    type === 'new'
      ? `🧹 ${property} 신규 청소 일정`
      : type === 'changed'
        ? `🧹 ${property} 청소 일정 변경`
        : `🧹 ${property} 청소 일정 취소`;

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
      return { ok: false, initialized: false, reason: 'baseline_requires_all_feeds', failures: snapshot.failures };
    }
    await saveState(snapshot.current, previous.sha, feeds.map((feed) => feed.id), feeds.map((feed) => feed.feedKey));
    return { ok: true, initialized: true, baselineOnly: true, activeBookings: Object.keys(snapshot.current).length, events: [], failures: [] };
  }

  const knownRooms = new Set(previous.knownRooms || []);
  const knownFeeds = new Set(previous.knownFeeds || []);
  const newlyOnboardedFeeds = new Set();
  for (const feed of feeds) {
    if (!knownFeeds.has(feed.feedKey) && snapshot.succeededFeeds.has(feed.feedKey)) {
      newlyOnboardedFeeds.add(feed.feedKey);
      knownFeeds.add(feed.feedKey);
      knownRooms.add(feed.id);
    }
  }

  const events = [];
  for (const [key, current] of Object.entries(snapshot.current)) {
    const before = previous.bookings[key];
    if (!before) {
      if (!newlyOnboardedFeeds.has(current.feedKey)) events.push({ type: 'new', booking: current });
    } else if (before.checkoutDate !== current.checkoutDate) {
      events.push({ type: 'changed', booking: current });
    }
  }

  for (const [key, before] of Object.entries(previous.bookings)) {
    const beforeFeedKey = feedKeyForBooking(before);
    if (!snapshot.succeededFeeds.has(beforeFeedKey)) continue;
    if (before.checkoutDate <= snapshot.today) continue;
    if (!snapshot.current[key]) events.push({ type: 'cancelled', booking: before });
  }

  // Cross-channel iCal feeds can represent the same stay with different UIDs.
  // If one source disappears while another source reports the same room/checkout,
  // that is not a real cleaning change. Suppress the paired new+cancel alert.
  const scheduleTypes = new Map();
  for (const event of events) {
    const sig = `${event.booking.roomName}:${event.booking.checkoutDate}`;
    if (!scheduleTypes.has(sig)) scheduleTypes.set(sig, new Set());
    scheduleTypes.get(sig).add(event.type);
  }
  const effectiveEvents = events.filter((event) => {
    const sig = `${event.booking.roomName}:${event.booking.checkoutDate}`;
    const types = scheduleTypes.get(sig);
    return !(types?.has('new') && types?.has('cancelled'));
  });

  const sent = [];
  const dedupe = new Set();
  for (const event of effectiveEvents) {
    if (shouldSuppressAlert(event)) continue;
    const signature = `${event.type}:${event.booking.roomName}:${event.booking.checkoutDate}`;
    if (dedupe.has(signature)) continue;
    dedupe.add(signature);
    const result = await sendKakao(buildAlert(event.type, event.booking));
    sent.push({ type: event.type, roomName: event.booking.roomName, checkoutDate: event.booking.checkoutDate, source: event.booking.source || 'airbnb', result });
  }

  await saveState(snapshot.current, previous.sha, [...knownRooms], [...knownFeeds]);
  return {
    ok: true,
    initialized: true,
    newlyOnboardedFeeds: [...newlyOnboardedFeeds],
    activeBookings: Object.keys(snapshot.current).length,
    events: sent.map(({ type, roomName, checkoutDate, source }) => ({ type, roomName, checkoutDate, source })),
    failures: snapshot.failures,
  };
}
