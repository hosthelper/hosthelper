const CLEANING_ALERT_ENDPOINT =
  process.env.CLEANING_ALERT_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/cron/cleaning-alerts';

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

export async function triggerSeochoCleaning(options = {}) {
  const feeds = getFeeds();
  const sendMonthSummary =
    options.sendMonthSummary === true || process.env.SEND_MONTH_SUMMARY_ONCE === 'true';

  const response = await fetch(CLEANING_ALERT_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'helper-office-render-worker/seocho-cleaning',
    },
    body: JSON.stringify({ feeds, sendMonthSummary }),
    signal: AbortSignal.timeout(50_000),
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1000) }; }
  if (!response.ok) {
    const error = new Error(`CLEANING_DOWNSTREAM_${response.status}`);
    error.status = response.status;
    error.downstream = body;
    throw error;
  }

  return body;
}
