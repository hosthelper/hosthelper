// 영상 콘텐츠 추출기 — URL → (제목/작성자/설명/자막).
// LLM은 영상을 직접 보지 못하므로, 여기서 텍스트(자막·메타)를 뽑아 @hosthelper/ai 에 넘깁니다.
// 네트워크 의존부와 순수 파싱부를 분리해 파싱부는 단위 테스트로 100% 커버합니다.
import type { VideoPlatform } from '@hosthelper/shared';

export interface ExtractedVideo {
  platform: VideoPlatform;
  sourceUrl: string;
  videoId?: string;
  title?: string;
  author?: string;
  description?: string;
  transcript?: string;
  transcriptLanguage?: string;
  durationLabel?: string;
  // 자막·설명으로 텍스트를 못 얻음 → 음성 인식(STT)이 필요함을 표시.
  needsTranscription?: boolean;
}

export class VideoExtractionError extends Error {}

// 호스트명 → 플랫폼. 알려진 영상 플랫폼은 자막/HTML 스크랩이 막혀 STT 경로로 보냅니다.
const PLATFORM_HOSTS: Record<string, VideoPlatform> = {
  'instagram.com': 'instagram',
  'www.instagram.com': 'instagram',
  'tiktok.com': 'tiktok',
  'www.tiktok.com': 'tiktok',
  'vm.tiktok.com': 'tiktok',
  'facebook.com': 'facebook',
  'www.facebook.com': 'facebook',
  'fb.watch': 'facebook',
  'twitter.com': 'twitter',
  'www.twitter.com': 'twitter',
  'x.com': 'twitter',
  'vimeo.com': 'vimeo',
  'www.vimeo.com': 'vimeo',
};

export function classifyPlatform(url: string): VideoPlatform {
  if (isYouTubeUrl(url)) return 'youtube';
  try {
    return PLATFORM_HOSTS[new URL(url).hostname.toLowerCase()] ?? 'web';
  } catch {
    return 'web';
  }
}

const FETCH_TIMEOUT_MS = 12_000;
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ---- 순수 파싱부 (테스트 대상) ----

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

export function isYouTubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

// 다양한 유튜브 URL 형태에서 11자리 video id 추출.
export function parseYouTubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const idRe = /^[A-Za-z0-9_-]{11}$/;

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0] ?? '';
    return idRe.test(id) ? id : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const v = parsed.searchParams.get('v');
  if (v && idRe.test(v)) return v;

  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  const segs = parsed.pathname.split('/').filter(Boolean);
  const head = segs[0];
  const id = segs[1];
  if (head && id && ['shorts', 'embed', 'live', 'v'].includes(head)) {
    return idRe.test(id) ? id : null;
  }
  return null;
}

export function secondsToLabel(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// 유튜브 player response 의 자막 트랙 중 한국어 > 영어 > 첫 번째 순으로 선택.
export function pickCaptionTrack(
  tracks: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>,
): { baseUrl: string; languageCode: string } | null {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const withUrl = tracks.filter((t) => typeof t.baseUrl === 'string' && t.baseUrl);
  if (withUrl.length === 0) return null;
  const byLang = (code: string) =>
    withUrl.find((t) => (t.languageCode ?? '').toLowerCase().startsWith(code));
  const chosen = byLang('ko') ?? byLang('en') ?? withUrl[0];
  if (!chosen || !chosen.baseUrl) return null;
  return { baseUrl: chosen.baseUrl, languageCode: chosen.languageCode ?? '' };
}

// json3 자막 응답 → 평문 텍스트.
export function parseJson3Transcript(json: unknown): string {
  if (typeof json !== 'object' || json === null) return '';
  const events = (json as { events?: unknown }).events;
  if (!Array.isArray(events)) return '';
  const parts: string[] = [];
  for (const ev of events) {
    const segs = (ev as { segs?: unknown }).segs;
    if (!Array.isArray(segs)) continue;
    for (const seg of segs) {
      const utf8 = (seg as { utf8?: unknown }).utf8;
      if (typeof utf8 === 'string') parts.push(utf8);
    }
  }
  return parts.join('').replace(/\n{2,}/g, '\n').trim();
}

// HTML <head> 메타에서 og:title / og:description / title 추출.
export function parseHtmlMeta(html: string): {
  title?: string;
  description?: string;
  siteName?: string;
} {
  const meta = (prop: string): string | undefined => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
      'i',
    );
    const m = html.match(re);
    return m && m[1] !== undefined ? decodeHtmlEntities(m[1]).trim() : undefined;
  };
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const titleText = titleTag && titleTag[1] !== undefined ? decodeHtmlEntities(titleTag[1]).trim() : undefined;
  return {
    title: meta('og:title') ?? titleText,
    description: meta('og:description') ?? meta('description'),
    siteName: meta('og:site_name'),
  };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

// player response 에서 captionTracks 추출 (HTML 스크랩).
export function extractPlayerResponse(html: string): Record<string, unknown> | null {
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
  if (!m || m[1] === undefined) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---- 네트워크부 ----

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { 'user-agent': DESKTOP_UA, 'accept-language': 'ko,en;q=0.8', ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYouTube(url: string, videoId: string): Promise<ExtractedVideo> {
  const result: ExtractedVideo = { platform: 'youtube', sourceUrl: url, videoId };

  // 1) oEmbed — 제목/작성자 (가볍고 안정적).
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`,
      )}&format=json`,
    );
    if (res.ok) {
      const data = (await res.json()) as { title?: string; author_name?: string };
      result.title = data.title;
      result.author = data.author_name;
    }
  } catch {
    /* oEmbed 실패는 치명적이지 않음 */
  }

  // 2) watch 페이지 — 설명/길이/자막 트랙.
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/watch?v=${videoId}&hl=ko`,
    );
    if (res.ok) {
      const html = await res.text();
      const player = extractPlayerResponse(html);
      if (player) {
        const details = player.videoDetails as
          | { shortDescription?: string; lengthSeconds?: string; title?: string; author?: string }
          | undefined;
        if (details) {
          result.title ??= details.title;
          result.author ??= details.author;
          result.description = details.shortDescription;
          const len = Number(details.lengthSeconds);
          if (len) result.durationLabel = secondsToLabel(len);
        }
        const tracks =
          ((player.captions as Record<string, any>)?.playerCaptionsTracklistRenderer
            ?.captionTracks as Array<{ baseUrl?: string; languageCode?: string }>) ?? [];
        const track = pickCaptionTrack(tracks);
        if (track) {
          const capRes = await fetchWithTimeout(`${track.baseUrl}&fmt=json3`);
          if (capRes.ok) {
            const transcript = parseJson3Transcript(await capRes.json());
            if (transcript) {
              result.transcript = transcript;
              result.transcriptLanguage = track.languageCode || undefined;
            }
          }
        }
      }
    }
  } catch {
    /* watch 페이지 스크랩 실패 — 메타만으로 진행 */
  }

  // 자막/설명을 못 얻었으면 음성 인식(STT)으로 보완 가능하도록 표시.
  if (!result.transcript && !result.description) {
    result.needsTranscription = true;
  }
  return result;
}

async function fetchWeb(url: string): Promise<ExtractedVideo> {
  let html = '';
  try {
    const res = await fetchWithTimeout(url);
    if (res.ok) html = await res.text();
  } catch {
    /* 스크랩 실패 — STT 경로로 넘김 */
  }
  const meta = html ? parseHtmlMeta(html) : {};
  if (!meta.title && !meta.description) {
    // 텍스트를 못 얻음 → 영상 페이지일 수 있으니 STT 시도 대상으로.
    return { platform: 'web', sourceUrl: url, needsTranscription: true };
  }
  return {
    platform: 'web',
    sourceUrl: url,
    title: meta.title,
    author: meta.siteName,
    description: meta.description,
  };
}

export async function extractVideo(url: string): Promise<ExtractedVideo> {
  const platform = classifyPlatform(url);

  if (platform === 'youtube') {
    const videoId = parseYouTubeId(url);
    if (videoId) return fetchYouTube(url, videoId);
  }

  // 인스타그램·틱톡 등은 자막/HTML 스크랩이 막혀 있어 곧바로 STT 경로로.
  if (platform !== 'web') {
    return { platform, sourceUrl: url, needsTranscription: true };
  }

  return fetchWeb(url);
}
