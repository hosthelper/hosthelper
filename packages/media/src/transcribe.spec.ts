import {
  loadSttConfig,
  buildYtdlpInfoArgs,
  buildYtdlpAudioArgs,
  buildWhisperArgs,
  parseYtdlpInfo,
  parseWhisperJson,
  transcribeFromUrl,
  SttUnavailableError,
  TranscriptionError,
} from './transcribe';

describe('loadSttConfig', () => {
  it('기본값 — 비활성', () => {
    const cfg = loadSttConfig({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.ytdlpBin).toBe('yt-dlp');
    expect(cfg.whisperBin).toBe('whisper');
    expect(cfg.whisperModel).toBe('base');
  });
  it('env로 활성화/오버라이드', () => {
    const cfg = loadSttConfig({
      HOSTHELPER_STT_ENABLED: '1',
      HOSTHELPER_WHISPER_MODEL: 'small',
      HOSTHELPER_STT_MAX_SEC: '120',
    } as NodeJS.ProcessEnv);
    expect(cfg.enabled).toBe(true);
    expect(cfg.whisperModel).toBe('small');
    expect(cfg.maxDurationSec).toBe(120);
  });
});

describe('buildYtdlpInfoArgs', () => {
  it('메타 JSON 덤프 인자', () => {
    expect(buildYtdlpInfoArgs('https://x.com/v')).toEqual([
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      'https://x.com/v',
    ]);
  });
});

describe('buildYtdlpAudioArgs', () => {
  it('mp3 추출 + ffmpeg 위치 + 출력 템플릿', () => {
    const args = buildYtdlpAudioArgs('https://u', '/tmp/a.%(ext)s', '/usr/bin/ffmpeg');
    expect(args).toContain('-x');
    expect(args).toContain('mp3');
    expect(args).toContain('/usr/bin/ffmpeg');
    expect(args[args.length - 1]).toBe('https://u');
  });
});

describe('buildWhisperArgs', () => {
  it('json 출력 + 모델 + 출력 디렉터리', () => {
    const args = buildWhisperArgs('/tmp/a.mp3', '/tmp/out', 'base');
    expect(args[0]).toBe('/tmp/a.mp3');
    expect(args).toEqual(expect.arrayContaining(['--model', 'base', '--output_format', 'json']));
  });
});

describe('parseYtdlpInfo', () => {
  it('title/duration 추출', () => {
    expect(parseYtdlpInfo({ title: '릴스', duration: 32.5 })).toEqual({
      title: '릴스',
      durationSec: 32.5,
    });
  });
  it('객체 아니면 빈 객체', () => {
    expect(parseYtdlpInfo(null)).toEqual({});
  });
});

describe('parseWhisperJson', () => {
  it('text/language 추출', () => {
    expect(parseWhisperJson({ text: ' 안녕하세요 ', language: 'ko' })).toEqual({
      text: '안녕하세요',
      language: 'ko',
    });
  });
  it('빈 텍스트면 에러', () => {
    expect(() => parseWhisperJson({ text: '   ' })).toThrow(TranscriptionError);
  });
  it('객체 아니면 에러', () => {
    expect(() => parseWhisperJson('nope')).toThrow(TranscriptionError);
  });
});

describe('transcribeFromUrl', () => {
  it('비활성 시 SttUnavailableError', async () => {
    await expect(
      transcribeFromUrl('https://instagram.com/reel/x', loadSttConfig({})),
    ).rejects.toBeInstanceOf(SttUnavailableError);
  });
});
