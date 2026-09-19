# changup-site — 창업정보 모임 공개 사이트

예비창업자 대상 정적 사이트. hosthelper(apps/web)와 완전 분리.

## 구조

```
index.html            홈 랜딩(그린) — 히어로·3단계·왜무료·매물잠금·컨설턴트·FAQ·정보 피드(최신 3편)·양도문의·푸터
s/index.html          30초 설문 — 운영방식·종류(대분류)→업종(소분류)·예산·연락처·개인정보동의
posts/
  index.html          창업 정보 목록(뉴스형) — 카테고리 필터(정책자금·권리금·운영방식·상권분석)
  YYYY-MM-DD-*.html    개별 기사(뉴스기사 분량, 리드+소제목+본문+핵심요약+출처)
404.html · robots.txt  기본 페이지
scripts/
  generate-post.mjs    자동 발행 생성기(Claude) — 5시간 주기 GitHub Action이 실행
  _tokens.css          기사 공통 그린 토큰(빌드 전용, 웹 루트 비노출)
netlify.toml          전용 사이트 배포 설정(빌드 없음, publish=".")
```

모든 페이지: `word-break:keep-all`, 라이트/다크 토큰, OG/트위터 메타, SVG 파비콘(그린 체크).

## 데이터 흐름 (중요)

- **공개 설문 → Supabase**: `s/index.html`가 Supabase Edge Function `changup-leads`로 POST →
  Supabase `BuyerLead` 테이블에 저장. **이 정적 사이트가 실서비스 리드 경로.**
- 필드 계약은 `packages/shared` `BuyerLeadSurveySchema`와 일치(industries·regions는 각 항목 30자·최대 10개 — 폼에서 컷).
- 참고: `apps/changup`(Next.js)의 `/ops`·`/s`는 **NestJS API(Postgres)** 를 쓰는 **별도 백엔드**로,
  위 Supabase 리드와 저장소가 다릅니다. `/ops` 대시보드는 Supabase 리드를 보지 못하므로,
  현재 리드 확인은 Supabase 대시보드(또는 execute_sql)로 합니다. (배포 편의상 갈라진 상태 — 추후 단일화 여지)

## 배포 (Netlify · 전용 사이트)

Import from Git → 이 저장소 → **Base directory `apps/changup-site`** → Publish `apps/changup-site` →
Build command 비움 → Branch(main 또는 작업 브랜치). netlify.toml 자동 적용.

## 콘텐츠 발행

라이브 기사는 **`app.html`의 `var ARTICLES=[...]`가 원본**입니다. `index.html`은 그 사본입니다.
`posts/`의 개별 기사 페이지 구조는 2026-07-16에 동결된 레거시이며 더 이상 쓰지 않습니다.

- **에이전트(현재 방식)**: `.claude/agents/hu-marketing.md`(마케팅팀)를 불러 주제와 근거를 받고,
  사람이 검토해 `app.html`의 ARTICLES에 추가합니다.
- **스크립트(수동 실행)**: `.github/workflows/changup-content.yml`을 `workflow_dispatch`로 실행.
  스케줄은 제거됐고 폐기 예정입니다. `scripts/README.md` 참고.
- 생성기는 마커가 아니라 `var ARTICLES=[` · `var SOURCES={` 앵커에 문자열을 삽입합니다.
  (`posts/index.html`의 `<!--FEED:START-->`는 레거시 아카이브에만 남아 있습니다.)

**분리 매각 가치**: 순수 정적 HTML(런타임 빌드 0) + 독립 생성기(@hosthelper/ai 미의존). 디렉토리 하나로 완결.
