import { deployHelperOfficeProduction } from './production-deploy-v2.mjs';
import { inspectVercelProtection } from './vercel-inspect.mjs';
import { disableVercelSsoProtection } from './vercel-protection.mjs';
import { triggerSeochoCleaning } from './cleaning-trigger.mjs';

await import('./server.mjs');

void inspectVercelProtection()
  .then((result) => console.log('HELPER_OFFICE_VERCEL_PROTECTION', JSON.stringify(result)))
  .catch((error) => console.error('HELPER_OFFICE_VERCEL_PROTECTION_FAILED', String(error?.message || error)));

if (process.env.RUN_VERCEL_PROTECTION_FIX_ON_START === 'true') {
  void disableVercelSsoProtection()
    .then((result) => console.log('HELPER_OFFICE_VERCEL_PROTECTION_FIX_OK', JSON.stringify(result)))
    .catch((error) => console.error('HELPER_OFFICE_VERCEL_PROTECTION_FIX_FAILED', String(error?.message || error)));
}

if (process.env.RUN_PRODUCTION_DEPLOY_ON_START === 'true') {
  void deployHelperOfficeProduction()
    .then((result) => console.log('HELPER_OFFICE_PRODUCTION_DEPLOY_OK', JSON.stringify(result)))
    .catch((error) => console.error('HELPER_OFFICE_PRODUCTION_DEPLOY_FAILED', String(error?.message || error)));
}

if (process.env.RUN_CLEANING_SYNC_ON_START === 'true') {
  void triggerSeochoCleaning()
    .then((result) => console.log('CLEANING_SYNC_ON_START_OK', JSON.stringify(result)))
    .catch((error) => console.error('CLEANING_SYNC_ON_START_FAILED', String(error?.message || error)));
}

function unfoldIcal(text) {
  const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = [];
  for (const line of rows) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  return lines;
}

function val(line) {
  const i = line.indexOf(':');
  return i >= 0 ? line.slice(i + 1).trim() : '';
}

function classifySummary(summary) {
  const s = String(summary || '').trim().toLowerCase();
  if (!s) return 'empty';
  if (s === 'closed - not available') return 'closed_not_available';
  if (s === 'reserved') return 'reserved';
  if (s.includes('block')) return 'blocked_like';
  if (s.includes('reservation') || s.includes('booking')) return 'reservation_like';
  return 'other';
}

async function inspectBookingIcal() {
  const url = String(process.env.CHEONGNYANGNI_BOOKING_ICAL || '').trim();
  if (!url) throw new Error('CHEONGNYANGNI_BOOKING_ICAL_MISSING');
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`BOOKING_ICAL_HTTP_${response.status}`);
  const text = await response.text();
  const events = [];
  let event = null;
  for (const line of unfoldIcal(text)) {
    if (line === 'BEGIN:VEVENT') { event = {}; continue; }
    if (line === 'END:VEVENT') {
      if (event) events.push({
        start: event.start || null,
        end: event.end || null,
        summaryClass: classifySummary(event.summary),
        hasDescription: Boolean(event.description),
        status: event.status || null,
        uidHost: String(event.uid || '').split('@')[1] || null,
      });
      event = null;
      continue;
    }
    if (!event) continue;
    if (line.startsWith('DTSTART')) event.start = val(line);
    else if (line.startsWith('DTEND')) event.end = val(line);
    else if (line.startsWith('SUMMARY')) event.summary = val(line);
    else if (line.startsWith('DESCRIPTION')) event.description = val(line);
    else if (line.startsWith('STATUS')) event.status = val(line);
    else if (line.startsWith('UID')) event.uid = val(line);
  }
  return { count: events.length, events: events.slice(0, 50) };
}

if (process.env.RUN_BOOKING_ICAL_DIAG_ON_START === 'true') {
  void inspectBookingIcal()
    .then((result) => console.log('BOOKING_ICAL_DIAG_OK', JSON.stringify(result)))
    .catch((error) => console.error('BOOKING_ICAL_DIAG_FAILED', String(error?.message || error)));
}

const ONE_TIME_CLEANING_NOTICE = `<서초 지젤>\n\n9/14: A605 -\n9/15: A805 -\n9/16: A506 -\n\n9/25: A705 -\n\n<401 천호>\n9/15:\n9/18:\n9/27:\n\n<청량리>\n9/28:`;

async function sendOneTimeCleaningNotice() {
  const endpoint = process.env.KAKAO_SEND_ENDPOINT || 'https://auction-community-pearl.vercel.app/api/kakao/send';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vercel-cron/1.0',
    },
    body: JSON.stringify({ text: ONE_TIME_CLEANING_NOTICE }),
    signal: AbortSignal.timeout(30000),
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw: raw.slice(0, 500) }; }
  if (!response.ok || body?.ok === false) throw new Error(`ONE_TIME_CLEANING_NOTICE_${response.status}`);
  return body;
}

if (process.env.RUN_ONE_TIME_NOTICE_ON_START === 'true') {
  void sendOneTimeCleaningNotice()
    .then((result) => console.log('ONE_TIME_NOTICE_SEND_OK', JSON.stringify(result)))
    .catch((error) => console.error('ONE_TIME_NOTICE_SEND_FAILED', String(error?.message || error)));
}
