# Architecture

> M&A 실사(due diligence)용. 외부 평가자도 30분 안에 시스템 전체를 파악할 수 있도록 구성.

## 1. 한 줄 요약

> 한국 STR(에어비앤비/단기임대) 호스트와 청소 매니저를 자동 매칭·결제·정산하는 양면 마켓플레이스 SaaS.

## 2. High-level Diagram

```
                    ┌────────────────┐
              ┌─────│  apps/web      │  PWA · Next.js 14
              │     │ (호스트·청소사) │  → Vercel 또는 ECS
              │     └────────────────┘
              │     ┌────────────────┐
              │     │  apps/admin    │  운영자 콘솔 · Next.js
              │     └────────────────┘
              │              │
              ▼              ▼
       ┌────────────────────────────┐
       │   apps/api  (NestJS)        │  REST + WebSocket
       │   - auth (OTP/JWT)          │  Stateless · ECS Fargate
       │   - pricing  (₩10k 정액)    │
       │   - booking                 │
       │   - matching (V1 룰베이스)  │
       │   - payment  (토스페이먼츠) │
       └─────┬───────────────────┬───┘
             │                   │
   ┌─────────▼────────┐  ┌──────▼──────────┐
   │  PostgreSQL 15   │  │  Redis 7        │  ◀───┐
   │  (Prisma)        │  │  + BullMQ       │      │
   │  RDS multi-AZ    │  │  ElastiCache    │      │
   └──────────────────┘  └────────┬────────┘      │
                                   │              │
                          ┌────────▼──────────┐   │
                          │  apps/worker      │───┘
                          │  - payout T+2     │
                          │  - matching offer │
                          └───────────────────┘

   ┌──────────────────┐  ┌─────────────────┐
   │  AWS S3          │  │  토스페이먼츠   │
   │  (사진 업로드)   │  │  (PG · 에스크로)│
   └──────────────────┘  └─────────────────┘
```

## 3. 모듈 분리 (M&A 단위)

각 패키지는 의도적으로 약결합(loose coupling)으로 설계되어 단독 매각 또는 라이선싱이 가능합니다.

| Package | 분리 매각성 | 가치 제안 |
|---|---|---|
| `@hosthelper/ui` | **독립 ★★★★★** | 한국어 최적화 미니멀 디자인 시스템. 다른 SaaS로 이식 가능 |
| `@hosthelper/shared` | 독립 ★★★★ | zod 기반 도메인 스키마. 검증 로직 라이브러리화 가능 |
| `@hosthelper/db` | 결합 ★★★ | Prisma 도메인 모델. STR 청소 도메인 데이터 모델 IP |
| `apps/api` matching | 분리 ★★★★ | V1→V3 매칭 알고리즘 (`scoring.ts` 순수함수). 별도 ML 회사로 이전 가능 |
| `apps/api` pricing | 분리 ★★★★ | 한국 시장 가격 정책 엔진. 다른 서비스업에 적용 가능 |
| `apps/api` payment | 결합 ★★ | 토스페이먼츠 통합 + 에스크로. STR 도메인 결합 약함 → 이식 용이 |
| `apps/worker` payout | 결합 ★★ | T+2 정산, 한국 원천세 처리 로직 |
| `apps/api` changup + `apps/changup` | **독립 ★★★★★** | 창업이지 점포 양도 중개 리드↔매물 매칭. hosthelper 모델과 FK 0개 — 테이블 2개+API 모듈+앱 통째 분리 가능 |

## 4. 데이터 모델 요약

**6개 Bounded Context**, 23개 Entity. 자세한 ERD: `packages/db/prisma/schema.prisma`

1. **Identity** — User, HostProfile, CleanerProfile
2. **Catalog** — Property, Skill, ChecklistTemplate, ChecklistItem
3. **Scheduling** — Availability, Booking, CleaningJob (state machine)
4. **Matching** — MatchCandidate, OfferRound, MatchingWeights
5. **Quality** — ChecklistRun, Photo, Review
6. **Money** — PricingRule, Payment, Payout

### 핵심 불변량
- `Booking.quotedPrice = base + perPyeong + bedroom × multipliers` (snapshot)
- `Booking.platformFee = ₩10,000` (정액)
- `Payout.net = Payment.amount − ₩10,000 − (gross × 3.3%)`
- Postgres `tstzrange` + `EXCLUDE USING gist`로 청소사 시간 더블부킹 DB 레벨 방지

## 5. State Machine: CleaningJob

```
REQUESTED ──매칭──▶ MATCHED ──시작──▶ IN_PROGRESS ──완료제출──▶ SUBMITTED
                                                                  │
                                                            호스트 승인
                                                                  ▼
              CANCELLED ◀──사용자/운영──┐                       APPROVED
                                       │                         │
                                       │                    분쟁 윈도우 48h
                                       │                         │
              DISPUTED ◀──클레임────────┘                         ▼
                  │                                            SETTLED
                  └──해결──────────────────────────────────────▶
```

## 6. 외부 의존성 (M&A 시 이전 필요)

| 종류 | 서비스 | 비용 부담 | 이전 비용 |
|---|---|---|---|
| PG | 토스페이먼츠 | 결제액의 약 2.x% | 가맹점 명의 변경 (1~2주) |
| SMS/알림톡 | NHN Cloud 또는 Toss SMS | 건당 ~₩10 | API 키 재발급 |
| 인프라 | AWS Seoul | 월 사용량 | 계정 이전 또는 새 계정 |
| 도메인 | hosthelper.kr | 연 ~₩20k | 도메인 명의 변경 |
| 사업자 | 통신판매업, 법인 | - | 법인 양도 또는 신규 등록 |
| 보험 | 영업배상 + 청소사 상해 | 월 보험료 | 가입자 변경 |

## 7. 기술 부채 (실사 시 공개)

- ML 매칭 V3 미구현 (V1 룰베이스만 운영)
- React Native 청소사 앱 미개발 (PWA만 운영)
- 카카오 알림톡 NHN 어댑터 스텁만 존재 (실 호출 미구현)
- e2e Playwright 시나리오 미작성 (단위·통합 7개만)
- Airbnb iCal 연동 로드맵 단계

## 8. 코드 메트릭 (실사 참고)

- 언어: TypeScript 100%
- 패키지: 7 (apps 4, packages 3)
- Entity: 23
- Public API endpoint: 9
- Unit tests: 7
- 빌드 시간: ~31초 (clean)
- typecheck: ~7초

## 9. 보안 모델

- JWT(HS256, 7d expiry) 전용 인증 (OAuth 미사용)
- 비밀 정보: AWS Secrets Manager + `.env` (gitignore)
- DB 비밀번호: Postgres role 분리, hosthelper 사용자 CREATEDB 권한만
- S3: 비공개 버킷 + Presigned URL (서버 측 발급)
- PG webhook: 멱등키(orderId)로 재시도 안전성

## 10. 운영 메트릭 KPI

자세한 내용: `docs/prd/PRD.md` §6.

- North Star: 주간 완료 청소 Job 수
- Public Launch 타겟: GMV ₩100M/월, Take ₩10k × Job 수
- Series A 타겟: GMV ₩1B/월, MAU 호스트 1,000+
