# @hosthelper/changup — 창업이지

점포 양도(창업 매물) 중개용 앱. 예비창업자 설문(`/s`, SNS 공유용) → 리드 축적 → 조건 필터+점수 매칭으로 매물 추천 → 내부 운영(`/ops/*`)에서 연락·미팅 파이프라인 관리.

**분리 매각 가치**: 독립 브랜드·독립 사업(점포 중개). hosthelper 모델과 FK 0개 — Prisma 테이블 2개(`StoreListing`, `BuyerLead`) + API 모듈(`apps/api/src/modules/changup`) + 이 앱으로 완결되어 통째 분리 가능.

## 실행

```bash
pnpm --filter @hosthelper/api dev       # API :4000 (Postgres 필요)
pnpm --filter @hosthelper/changup dev   # 웹 :3002
```

- 공개 설문: http://localhost:3002/s
- 리드 파이프라인: http://localhost:3002/ops/leads
- 매물 관리: http://localhost:3002/ops/listings

`NEXT_PUBLIC_API_BASE_URL`로 API 주소 지정 (기본 `http://localhost:4000`). 정적 배포는 `STATIC_EXPORT=1 pnpm build` (빌드 시점에 API 주소 주입 필요).

새 설문이 접수되면 API가 `CHANGUP_NOTIFY_WEBHOOK_URL`(슬랙/디스코드/카카오워크/Make 등 웹훅 URL)로 리드 요약을 보냅니다 — 비워두면 알림 없음.

## 설계 결정

docs/adr/ADR-0003-changup-store-match.md 참조. 매칭 점수는 `apps/api/src/modules/changup/scoring.ts` 순수 함수 (Jest 100% 커버).

⚠️ `/ops` 화면과 변경 API는 아직 무인증(MVP). 설문 링크를 공개 배포하기 전에 최소 `x-ops-key` 가드를 붙일 것.
