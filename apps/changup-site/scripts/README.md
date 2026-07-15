# 창업정보 모임 — 자동 콘텐츠 생성기

5시간마다 GitHub Action(`.github/workflows/changup-content.yml`)이 `generate-post.mjs`를 실행해
**원본 창업 정보 기사**(뉴스기사 평균 분량, 최소 500자)를 생성하고 초안 PR로 올립니다.

- **① AI 원본 + ③ 공공 보도자료 재가공**: Claude가 공공기관(소진공·중기부·공정위 등) 자료를
  근거로 원본 글을 작성합니다. 언론·매거진 글을 복제하지 않습니다(저작권 안전).
- **모델**: `claude-opus-4-7` 기본 (`CHANGUP_AI_MODEL` 변수로 오버라이드). adaptive thinking,
  temperature 미사용 — CLAUDE.md §3 규약 준수.
- **분리 매각 가치**: `@hosthelper/ai` 게이트웨이에 의존하지 않는 독립 스크립트. 호스트헬퍼와
  결합 없이 창업정보 모임만 떼어낼 수 있습니다 (CLAUDE.md §6).

## 로컬 실행

```bash
cd apps/changup-site/scripts
npm install --no-save @anthropic-ai/sdk zod
ANTHROPIC_API_KEY=... node generate-post.mjs
```

## 필요 설정

1. 저장소 Secret `ANTHROPIC_API_KEY` 등록.
2. Actions 권한: "Allow GitHub Actions to create and approve pull requests" 체크.
3. 예약 실행은 기본 브랜치(main) 병합 후부터 동작.
