# @hosthelper/media

> hosthelper 미디어 처리. 영상 URL → 오디오 다운로드(yt-dlp) → 음성 인식(whisper) 전사.

**M&A 친화**: 외부 npm 의존성 0 (Node 빌트인만 사용). hosthelper 도메인과 완전 독립 — 어떤 "영상 링크 → 자막" 제품에도 그대로 이식 가능합니다.

## 왜 필요한가

LLM(Claude)은 오디오를 직접 전사하지 못하고, 유튜브 외 플랫폼(인스타그램·틱톡 등)은
공개 자막을 제공하지 않습니다. 이 패키지는 영상에서 **오디오를 뽑아 텍스트로 전사**해,
자막이 없는 영상도 분석할 수 있게 합니다.

## 런타임 의존성 (바이너리)

이 패키지는 npm 의존성은 없지만, 실행 서버에 다음 바이너리가 필요합니다:

- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) — 영상/오디오 다운로드
- [`ffmpeg`](https://ffmpeg.org/) — 오디오 변환(mp3)
- [`whisper`](https://github.com/openai/whisper) (오픈소스, 로컬 실행) — 음성 인식

> Anthropic 전용 정책 유지: whisper는 LLM이 아니라 **로컬 음성 인식 모델**이라
> 외부 LLM 프로바이더를 추가하지 않습니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `HOSTHELPER_STT_ENABLED` | `0` | `1`이면 활성화. 미설정 시 호출은 `SttUnavailableError` |
| `HOSTHELPER_YTDLP_BIN` | `yt-dlp` | yt-dlp 실행 경로 |
| `HOSTHELPER_FFMPEG_BIN` | `ffmpeg` | ffmpeg 실행 경로 |
| `HOSTHELPER_WHISPER_BIN` | `whisper` | whisper 실행 경로 |
| `HOSTHELPER_WHISPER_MODEL` | `base` | whisper 모델 (tiny/base/small/medium/large) |
| `HOSTHELPER_STT_MAX_SEC` | `900` | 이보다 긴 영상은 거부 |
| `HOSTHELPER_STT_TIMEOUT_MS` | `300000` | 단계별 타임아웃 |

## 사용

```ts
import { transcribeFromUrl, loadSttConfig } from '@hosthelper/media';

const result = await transcribeFromUrl('https://www.instagram.com/reel/...');
// { transcript, language, title, durationSec, sourceUrl }
```

## 한계

- 서버리스(Vercel/Netlify)에서는 동작하지 않습니다 — 바이너리·디스크·실행시간 필요.
  반드시 API/worker를 도커 등 **상시 서버**로 띄워야 합니다.
- 인스타그램 등 로그인 차단이 강한 플랫폼은 yt-dlp에 쿠키 설정이 필요할 수 있습니다.
