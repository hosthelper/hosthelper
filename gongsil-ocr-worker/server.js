import express from 'express';
import { createWorker } from 'tesseract.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.PORT || 10000);
const WORKER_SECRET = process.env.WORKER_SECRET || '';
const ALLOWED_IMAGE_HOST = process.env.ALLOWED_IMAGE_HOST || '';
const MAX_BYTES = Number(process.env.MAX_BYTES || 12582912);

let workerPromise;
let serial = Promise.resolve();

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(['kor', 'eng'], 1, {
      logger: (m) => {
        if (m?.status && Number.isFinite(m?.progress)) {
          console.log(`[ocr] ${m.status} ${Math.round(m.progress * 100)}%`);
        }
      },
    });
  }
  return workerPromise;
}

function runSerial(task) {
  const run = serial.then(task, task);
  serial = run.catch(() => undefined);
  return run;
}

function compact(text = '') {
  return String(text).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

function normalizeToken(text = '') {
  return String(text).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
}

function scoreExpectedAddress(rawText, expectedAddress) {
  if (!expectedAddress) return { value: null, confidence: 0 };
  const rawNorm = normalizeToken(rawText);
  const parts = compact(expectedAddress)
    .split(/\s+/)
    .map(normalizeToken)
    .filter((x) => x.length >= 2);
  if (!parts.length) return { value: null, confidence: 0 };
  const matched = parts.filter((p) => rawNorm.includes(p));
  const ratio = matched.length / parts.length;
  return {
    value: ratio >= 0.5 ? compact(expectedAddress) : null,
    confidence: Math.min(0.96, Math.max(0, ratio)),
  };
}

function extractLabelValue(lines, labels) {
  for (const line of lines) {
    for (const label of labels) {
      const re = new RegExp(`${label}\\s*[:：]?\\s*([가-힣A-Za-z]{2,30})`, 'i');
      const m = line.match(re);
      if (m?.[1]) return compact(m[1]);
    }
  }
  return null;
}

function extractConsent(lines) {
  const strong = lines.find((line) => /(전대|재임대|sublet)/i.test(line) && /(동의|허용|승낙|가능|consent|allow)/i.test(line));
  if (strong) return compact(strong);
  return lines.find((line) => /(전대|재임대|sublet)/i.test(line)) || null;
}

function extractDate(text) {
  const m = text.match(/(20\d{2}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[일]?/);
  if (!m) return null;
  const yyyy = m[1].length === 2 ? `20${m[1]}` : m[1];
  return `${yyyy}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

function signatureSignal(lines) {
  const idx = lines.findIndex((line) => /(서명|날인|도장|인\)|\(인|signature)/i.test(line));
  if (idx < 0) return { present: false, confidence: 0 };
  const local = [lines[idx], lines[idx + 1] || ''].join(' ');
  const hasNameLike = /[가-힣]{2,4}/.test(local.replace(/서명|날인|도장|인/g, ''));
  return { present: hasNameLike, confidence: hasNameLike ? 0.74 : 0.45 };
}

function buildFields(rawText, ocrConfidence, expectedAddress) {
  const text = compact(rawText);
  const lines = text.split('\n').map(compact).filter(Boolean);
  const address = scoreExpectedAddress(text, expectedAddress);
  const landlord = extractLabelValue(lines, ['임대인', '소유자', '갑']);
  const tenant = extractLabelValue(lines, ['임차인', '사용자', '을']);
  const consent = extractConsent(lines);
  const documentDate = extractDate(text);
  const signature = signatureSignal(lines);
  const base = Math.max(0, Math.min(1, Number(ocrConfidence || 0) / 100));

  return {
    address: address.value,
    landlord,
    tenant,
    consent_text: consent,
    document_date: documentDate,
    signature_present: signature.present,
    confidence: {
      address: Number(Math.min(address.confidence, Math.max(0.72, base)).toFixed(3)),
      landlord: landlord ? Number(Math.max(0.72, base * 0.92).toFixed(3)) : 0,
      tenant: tenant ? Number(Math.max(0.72, base * 0.92).toFixed(3)) : 0,
      consent: consent ? Number(Math.max(0.72, base * 0.90).toFixed(3)) : 0,
      date: documentDate ? Number(Math.max(0.72, base * 0.90).toFixed(3)) : 0,
      signature: Number(signature.confidence.toFixed(3)),
    },
  };
}

function assertAuthorized(req) {
  if (!WORKER_SECRET) throw new Error('worker_secret_not_configured');
  const presented = req.get('x-worker-secret') || '';
  if (presented !== WORKER_SECRET) {
    const err = new Error('unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

function assertImageUrl(input) {
  const u = new URL(input);
  if (u.protocol !== 'https:') throw new Error('https_image_url_required');
  if (ALLOWED_IMAGE_HOST && u.hostname !== ALLOWED_IMAGE_HOST) throw new Error('image_host_not_allowed');
  return u;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'gongsil-ocr-worker', engine: 'tesseract.js', languages: ['kor', 'eng'] });
});

app.post('/v1/sublet-ocr', async (req, res) => {
  try {
    assertAuthorized(req);
    const imageUrl = String(req.body?.image_url || '');
    const expectedAddress = req.body?.expected_address ? String(req.body.expected_address) : null;
    if (!imageUrl) return res.status(400).json({ error: 'image_url_required' });
    const u = assertImageUrl(imageUrl);

    const imageResp = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!imageResp.ok) return res.status(502).json({ error: 'image_fetch_failed', status: imageResp.status });
    const contentType = (imageResp.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return res.status(415).json({ error: 'image_only_for_now', content_type: contentType || null });
    }
    const len = Number(imageResp.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return res.status(413).json({ error: 'image_too_large' });
    const image = Buffer.from(await imageResp.arrayBuffer());
    if (image.byteLength > MAX_BYTES) return res.status(413).json({ error: 'image_too_large' });

    const result = await runSerial(async () => {
      const worker = await getWorker();
      return worker.recognize(image);
    });

    const rawText = String(result?.data?.text || '');
    const ocrConfidence = Number(result?.data?.confidence || 0);
    const fields = buildFields(rawText, ocrConfidence, expectedAddress);

    res.json({
      ok: true,
      provider: 'tesseract-js-kor-eng-v1',
      fields,
      raw_text: rawText,
      ocr_confidence: ocrConfidence,
      meta: { content_type: contentType, bytes: image.byteLength },
    });
  } catch (err) {
    const status = Number(err?.statusCode || 500);
    console.error('[ocr-error]', err?.message || err);
    res.status(status).json({ error: err?.message || 'ocr_failed' });
  }
});

app.listen(PORT, () => console.log(`gongsil-ocr-worker listening on ${PORT}`));
