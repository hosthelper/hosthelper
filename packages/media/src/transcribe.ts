import { spawn } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// STT(음성 인식) 미구성/비활성 — 호출 측이 "지원 준비 중" 안내로 처리.
export class SttUnavailableError extends Error {}
// 다운로드/전사 단계 실패.
export class TranscriptionError extends Error {}

export interface TranscriptionResult {
  transcript: string;
  language?: string;
  title?: string;
  durationSec?: number;
  sourceUrl: string;
}

export interface SttConfig {
  enabled: boolean;
  ytdlpBin: string;
  ffmpegBin: string;
  whisperBin: string;
  whisperModel: string;
  maxDurationSec: number;
  timeoutMs: number;
}

export function loadSttConfig(env: NodeJS.ProcessEnv = process.env): SttConfig {
  return {
    enabled: env.HOSTHELPER_STT_ENABLED === '1',
    ytdlpBin: env.HOSTHELPER_YTDLP_BIN ?? 'yt-dlp',
    ffmpegBin: env.HOSTHELPER_FFMPEG_BIN ?? 'ffmpeg',
    whisperBin: env.HOSTHELPER_WHISPER_BIN ?? 'whisper',
    whisperModel: env.HOSTHELPER_WHISPER_MODEL ?? 'base',
    maxDurationSec: Number(env.HOSTHELPER_STT_MAX_SEC ?? '900'),
    timeoutMs: Number(env.HOSTHELPER_STT_TIMEOUT_MS ?? '300000'),
  };
}

// ---- 순수 함수 (단위 테스트 대상) ----

// yt-dlp 메타데이터(JSON)만 받아오는 인자.
export function buildYtdlpInfoArgs(url: string): string[] {
  return ['--dump-single-json', '--no-warnings', '--no-playlist', url];
}

// yt-dlp 오디오 추출 인자 (mp3, ffmpeg 필요).
export function buildYtdlpAudioArgs(
  url: string,
  outTemplate: string,
  ffmpegBin: string,
): string[] {
  return [
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '5',
    '--no-playlist',
    '--no-warnings',
    '--ffmpeg-location',
    ffmpegBin,
    '-o',
    outTemplate,
    url,
  ];
}

// whisper CLI 인자 (JSON 출력).
export function buildWhisperArgs(
  audioPath: string,
  outDir: string,
  model: string,
): string[] {
  return [
    audioPath,
    '--model',
    model,
    '--output_format',
    'json',
    '--output_dir',
    outDir,
    '--task',
    'transcribe',
    '--verbose',
    'False',
  ];
}

// yt-dlp info JSON → 제목/길이.
export function parseYtdlpInfo(json: unknown): { title?: string; durationSec?: number } {
  if (typeof json !== 'object' || json === null) return {};
  const o = json as Record<string, unknown>;
  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    durationSec: typeof o.duration === 'number' ? o.duration : undefined,
  };
}

// whisper JSON → 전사 텍스트/언어.
export function parseWhisperJson(json: unknown): { text: string; language?: string } {
  if (typeof json !== 'object' || json === null) {
    throw new TranscriptionError('whisper 출력을 해석하지 못했습니다');
  }
  const o = json as Record<string, unknown>;
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  const language = typeof o.language === 'string' ? o.language : undefined;
  if (!text) throw new TranscriptionError('전사 결과가 비어 있습니다');
  return { text, language };
}

// ---- 실행부 (바이너리 필요 — 단위 테스트 제외) ----

function run(
  bin: string,
  args: string[],
  opts: { capture?: boolean; timeoutMs: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new TranscriptionError(`${bin} 시간 초과`));
    }, opts.timeoutMs);

    child.stdout.on('data', (d) => {
      if (opts.capture) stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      // ENOENT 등 — 바이너리 미설치.
      reject(new SttUnavailableError(`${bin} 실행 실패: ${e.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new TranscriptionError(`${bin} 비정상 종료(${code}): ${stderr.slice(0, 500)}`));
    });
  });
}

async function findAudioFile(dir: string): Promise<string | null> {
  const entries = await readdir(dir);
  const audio = entries.find((f) => f.endsWith('.mp3'));
  return audio ? join(dir, audio) : null;
}

async function findJsonFile(dir: string): Promise<string | null> {
  const entries = await readdir(dir);
  const j = entries.find((f) => f.endsWith('.json'));
  return j ? join(dir, j) : null;
}

/**
 * 영상 URL → 오디오 다운로드 → whisper 전사.
 * yt-dlp / ffmpeg / whisper 바이너리가 설치된 서버에서만 동작합니다.
 * 미구성 시 SttUnavailableError 를 던집니다 (호출 측이 안내로 처리).
 */
export async function transcribeFromUrl(
  url: string,
  config: SttConfig = loadSttConfig(),
): Promise<TranscriptionResult> {
  if (!config.enabled) {
    throw new SttUnavailableError('음성 인식(STT) 기능이 비활성화되어 있습니다');
  }

  const workDir = await mkdtemp(join(tmpdir(), 'hh-stt-'));
  try {
    // 1) 메타데이터 — 제목/길이, 너무 긴 영상 사전 차단.
    let info: { title?: string; durationSec?: number } = {};
    try {
      const raw = await run(config.ytdlpBin, buildYtdlpInfoArgs(url), {
        capture: true,
        timeoutMs: Math.min(config.timeoutMs, 60_000),
      });
      info = parseYtdlpInfo(JSON.parse(raw));
    } catch (e) {
      if (e instanceof SttUnavailableError) throw e;
      // 메타 실패는 치명적이지 않음 — 전사로 진행.
    }
    if (info.durationSec && info.durationSec > config.maxDurationSec) {
      throw new TranscriptionError(
        `영상이 너무 깁니다 (${Math.round(info.durationSec)}초 > 한도 ${config.maxDurationSec}초)`,
      );
    }

    // 2) 오디오 추출.
    await run(
      config.ytdlpBin,
      buildYtdlpAudioArgs(url, join(workDir, 'audio.%(ext)s'), config.ffmpegBin),
      { timeoutMs: config.timeoutMs },
    );
    const audioPath = await findAudioFile(workDir);
    if (!audioPath) throw new TranscriptionError('오디오를 추출하지 못했습니다');

    // 3) whisper 전사.
    await run(config.whisperBin, buildWhisperArgs(audioPath, workDir, config.whisperModel), {
      timeoutMs: config.timeoutMs,
    });
    const jsonPath = await findJsonFile(workDir);
    if (!jsonPath) throw new TranscriptionError('전사 결과 파일을 찾지 못했습니다');
    const parsed = parseWhisperJson(JSON.parse(await readFile(jsonPath, 'utf8')));

    return {
      transcript: parsed.text,
      language: parsed.language,
      title: info.title,
      durationSec: info.durationSec,
      sourceUrl: url,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
