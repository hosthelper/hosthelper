const KAKAO_SEND_ENDPOINT =
  process.env.KAKAO_SEND_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/kakao/send';

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

function parseReserved(text, roomName) {
  const lines = unfoldICal(text);
  const out = [];
  let event = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      event = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (event?.uid && event?.checkoutDate && String(event.summary || '').trim().toLowerCase() === 'reserved') {
        out.push({ roomName, uid: event.uid, checkoutDate: event.checkoutDate });
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

function currentKstMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).split('-');
  return { year: parts[0], month: parts[1] };
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

export async function sendCurrentMonthCleaningSummary() {
  const feeds = getFeeds();
  const { year, month } = currentKstMonth();
  const prefix = `${year}-${month}-`;
  const bookings = [];
  const failures = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed.icalUrl, {
        cache: 'no-store',
        headers: { 'user-agent': 'helper-office-render-worker/seocho-month-summary' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const text = await response.text();
      for (const booking of parseReserved(text, feed.id)) {
        if (booking.checkoutDate.startsWith(prefix)) bookings.push(booking);
      }
    } catch (error) {
      failures.push({ room: feed.id, error: String(error.message || error) });
    }
  }

  if (failures.length > 0) {
    const error = new Error(`MONTH_SUMMARY_INCOMPLETE:${failures.map((f) => f.room).join(',')}`);
    error.failures = failures;
    throw error;
  }

  bookings.sort((a, b) => a.checkoutDate.localeCompare(b.checkoutDate) || a.roomName.localeCompare(b.roomName));

  const grouped = new Map();
  for (const booking of bookings) {
    const day = Number(booking.checkoutDate.slice(8, 10));
    const key = `${Number(month)}/${day}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(booking.roomName);
  }

  const lines = [`${year}년 ${Number(month)}월 서초 지젤 청소일정`, ''];
  if (grouped.size === 0) lines.push('등록된 청소 일정 없음');
  else {
    for (const [date, rooms] of grouped.entries()) lines.push(`${date}  ${rooms.join(' · ')}`);
  }

  const text = lines.join('\n');
  const kakao = await sendKakao(text);
  return { ok: true, year, month: Number(month), bookings, text, kakao };
}
