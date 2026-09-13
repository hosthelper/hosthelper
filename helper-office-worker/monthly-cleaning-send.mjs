const KAKAO_SEND_ENDPOINT =
  process.env.KAKAO_SEND_ENDPOINT ||
  'https://auction-community-pearl.vercel.app/api/kakao/send';

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
  const text = `<서초 지젤>\n\n9/14: A605 -\n9/15: A805 -\n9/16: A506 -\n\n9/25: A705 -\n\n<401 천호>\n9/15:\n9/18:\n9/27:\n\n<청량리>\n9/28:`;
  const kakao = await sendKakao(text);
  return { ok: true, text, kakao };
}
