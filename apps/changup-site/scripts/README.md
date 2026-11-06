# 창업정보 모임 — 자동 콘텐츠 생성기

> **현재 상태: 은퇴.** 이 스크립트의 예약 실행은 제거됐습니다. `.github/workflows/changup-content.yml`은
> `workflow_dispatch` 수동 실행 전용이며 폐기 예정입니다. 기사 발행은 현재 사람/에이전트 데일리 루틴이
> 직접 작성해 수행합니다 — 마케팅팀은 `.claude/agents/hu-marketing.md`를 부르세요.

`generate-post.mjs`는 **원본 창업 정보 기사**(뉴스기사 평균 분량, 최소 500자)를 생성해
`app.html`의 `var ARTICLES=[` 최상단에 삽입하고 `index.html`로 복사합니다.

- **① AI 원본 + ③ 공공 보도자료 재가공**: 공공기관(소진공·중기부·공정위 등) 자료를 근거로 원본 글을
  작성합니다. 언론·매거진 글을 복제하지 않습니다(저작권 안전).
- **모델**: **GitHub Models**의 `openai/gpt-4o-mini` 기본 (`CHANGUP_AI_MODEL`로 오버라이드).
  엔드포인트 `https://models.github.ai/inference/chat/completions`, 인증은 `GITHUB_TOKEN`.
  이 스크립트는 Anthropic API를 쓰지 않으므로 CLAUDE.md §3의 모델 규약 적용 대상이 아닙니다.
- **입력 없음**: 시각 기반 결정론적 로테이션으로 13개 주제 중 하나를 고릅니다.
- **출력**: 파일을 새로 만들지 않습니다. `app.html`/`index.html`의 ARTICLES·SOURCES·`var TODAY`만 갱신합니다.
  `posts/`의 개별 페이지 구조는 은퇴했습니다.
- **분리 매각 가치**: `@hosthelper/ai` 게이트웨이에 의존하지 않는 독립 스크립트. 호스트헬퍼와
  결합 없이 창업정보 모임만 떼어낼 수 있습니다 (CLAUDE.md §6).

## 로컬 실행

```bash
cd apps/changup-site/scripts
npm install --no-save zod
GITHUB_TOKEN=... node generate-post.mjs
```

## 필요 설정

1. `GITHUB_TOKEN` — GitHub Models 추론 권한(`models: read`)이 있어야 합니다. 워크플로에서는 자동 주입됩니다.
2. Actions 권한: "Allow GitHub Actions to create and approve pull requests" 체크.
3. 수동 실행 전용이므로 예약 스케줄은 없습니다.
