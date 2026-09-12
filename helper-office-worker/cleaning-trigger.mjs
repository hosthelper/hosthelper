const CLEANING_ALERT_ENDPOINT =
  process.env.CLEANING_ALERT_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/cron/cleaning-alerts';
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

function parseReserved(text, roomId) {
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
        String(event.summary || '').trim().toLowerCase() === 'reserved' &&
        event.endDate
      ) {
        out.push({ roomName: roomId, checkoutDate: event.endDate });
      }
      event = null;
      continue;
    }
    if (!event) continue;
    if (line.startsWith('SUMMARY')) event.summary = valueOf(line);
    else if (line.startsWith('DTEND')) event.endDate = normalizeDate(valueOf(line));
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

async function fetchDirectSchedule(feeds) {
  const today = kstToday();
  const monthPrefix = today.slice(0, 7);
  const rows = [];
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
      for (const row of parseReserved(text, feed.id)) {
        if (row.checkoutDate.startsWith(monthPrefix) && row.checkoutDate >= today) {
          rows.push(row);
        }
      }
    } catch (error) {
      failures.push({ room: feed.id, error: String(error.message || error) });
    }
  }

  rows.sort(
    (a, b) =>
      a.checkoutDate.localeCompare(b.checkoutDate) || a.roomName.localeCompare(b.roomName),
  );
  return { today, rows, failures };
}

function buildMonthSummary(today, rows) {
  const [year, month] = today.split('-');
  const grouped = new Map();
  for (const row of rows) {
    const rooms = grouped.get(row.checkoutDate) || [];
    if (!rooms.includes(row.roomName)) rooms.push(row.roomName);
    grouped.set(row.checkoutDate, rooms);
  }

  const lines = [`${year}년 ${Number(month)}월 서초 지젤 청소일정`, ''];
  if (grouped.size === 0) {
    lines.push('남은 청소 일정 없음');
  } else {
    for (const [date, rooms] of grouped.entries()) {
      const [, m, d] = date.split('-');
      lines.push(`${Number(m)}/${Number(d)} ${rooms.join(' · ')}`);
    }
  }
  return lines.join('\n');
}

async function sendMonthlySummaryToKakao(summaryText) {
  const response = await fetch(KAKAO_SEND_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vercel-cron/1.0',
    },
    body: JSON.stringify({ text: summaryText }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1000) }; }
  return { ok: response.ok, status: response.status, body };
}

export async function triggerSeochoCleaning(options = {}) {
  const feeds = getFeeds();
  const sendMonthSummary =
    options.sendMonthSummary === true || process.env.SEND_MONTH_SUMMARY_ONCE === 'true';
  const direct = await fetchDirectSchedule(feeds);
  const monthSummary = buildMonthSummary(direct.today, direct.rows);

  let monthlyKakao = null;
  if (sendMonthSummary) {
    monthlyKakao = await sendMonthlySummaryToKakao(monthSummary);
  }

  const response = await fetch(CLEANING_ALERT_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'helper-office-render-worker/seocho-cleaning',
    },
    body: JSON.stringify({ feeds, sendMonthSummary: false }),
    signal: AbortSignal.timeout(50_000),
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1000) }; }
  if (!response.ok) {
    const error = new Error(`CLEANING_DOWNSTREAM_${response.status}`);
    error.status = response.status;
    error.downstream = body;
    error.directSchedule = direct;
    error.monthlyKakao = monthlyKakao;
    throw error;
  }

  return {
    ...body,
    directSchedule: direct.rows,
    directFailures: direct.failures,
    monthSummary,
    monthlyKakao,
  };
}
