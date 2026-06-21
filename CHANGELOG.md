# Changelog

## [Unreleased] — 상용화 준비

### 변경
- **수익 모델**: 정률 18% 수수료 → **건당 정액 ₩10,000**
- 광고 부가수익 모델 PRD에 명시 (Public Launch +3M)
- 브랜드 약속 "시간을 효율적으로 아껴드립니다" UI 적용

### 추가
- **영상 요약·분석**: 링크 입력 → 영상 내용 추출(유튜브 자막/메타·웹 OG) → 한국어 요약 + 중요 포인트
  - `packages/ai/src/video.ts` `analyzeVideo()` (프롬프트 캐싱·adaptive thinking·zod 검증)
  - `apps/api` `POST /ai/video/analyze`, `GET /ai/video` (LLMCall 토큰 회계 + `VideoAnalysis` 영속화)
  - `apps/web/app/video` 링크 입력 페이지
- `apps/web` 미니멀 UI: 랜딩, 로그인(OTP), 호스트 대시보드, 예약·견적, 청소사 일감 목록
- `apps/api` 검증 통과: typecheck/test/build 전체 그린
- `apps/api` 통합 테스트 완료: health, pricing/quote, auth OTP, matching/candidates
- `packages/shared`, `packages/db` 빌드 단계 추가 (`dist/`)
- `Dockerfile` 3종 (api, web, worker)
- CI 파이프라인 강화: install → typecheck → test → build → API smoke test

### 수정
- BullMQ v5 호환: `QueueScheduler` 제거 (Worker 내장)
- NestJS `ValidationPipe` 제거 (zod 기반 `ZodPipe` 라우트별 적용)
- Payment 서비스/컨트롤러 명시적 반환 타입 추가 (Prisma 내부 모듈 참조 회피)

### 검증된 시나리오 (로컬)
| 시나리오 | 결과 |
|---|---|
| 20평 2침실 평일 11시 견적 | ₩130,000 / 수수료 ₩10,000 / 청소사 ₩116,040 |
| 30평 3침실 주말 14시 견적 (1.2× 할증) | ₩204,000 / 수수료 ₩10,000 / 청소사 ₩187,598 |
| OTP 요청 → 검증 → JWT 발급 | 성공 |
| 잘못된 휴대폰 번호 → zod 검증 실패 | 한글 에러 메시지 반환 |
| 매칭 후보 검색 (강남 1km 권역) | 거리 2.76km, 점수 0.616 산정, MatchCandidate 영속화 |
| 멱등성 (재호출 시 upsert) | rows = 1 유지 |
