# changup-site — 창업정보 모임 공개 사이트

예비창업자 대상 정적 사이트. 설문(`/s/`) + 매일 창업정보 콘텐츠(`/posts/`) + 홈 피드(`/`).
접수는 Supabase Edge Function(`changup-leads`)으로 POST — hosthelper 서비스와 무관.

**분리 매각 가치**: 순수 정적 HTML(빌드 0, 의존성 0). 이 디렉토리 하나로 창업 사업 웹이 완결 — 통째 이전 가능.

## 배포 (Netlify)

새 사이트 생성 시: Import from Git → 이 저장소 → Branch `main` → Base directory `apps/changup-site` (netlify.toml 자동 적용). 이후 main에 푸시하면 자동 배포.

## 매일 콘텐츠 추가 절차

1. `posts/YYYY-MM-DD-slug.html` 생성 (기존 글 복사 후 내용 교체)
2. `index.html`의 "오늘의 창업정보" 목록 맨 위에 카드 1개 추가
3. main에 커밋 → 자동 배포
