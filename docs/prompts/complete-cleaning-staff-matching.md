# 개발 프롬프트 — 청소 매니저 매칭 루프 완성

> 이 문서는 AI 코딩 에이전트(예: Claude Code) 또는 개발자에게 **그대로 입력**할 수 있는 실행 지향 작업 지시서입니다.
> 대상 저장소: `hosthelper` 모노레포. 작업 브랜치: `claude/cleaning-staff-matching-Q1EP8`.
> 저장소 컨벤션은 루트 `CLAUDE.md`를 **반드시** 따릅니다.

---

## 0. 목표 한 줄

**결제 확정 → 후보 산출 → 오퍼 라운드 발송 → 청소부 수락/거절 → 잡 `MATCHED`** 로 이어지는 청소 매니저 매칭의 **끊긴 엔드투엔드 루프를 완성**한다. 매칭 점수 알고리즘과 데이터 모델은 이미 존재하므로 **재작성하지 말고 이어 붙인다**.

---

## 1. 현재 상태 — 이미 완성된 자산 (재작성 금지)

다음은 **이미 구현·테스트되어 있으니 그대로 재사용**한다:

- **점수 알고리즘**: `apps/api/src/modules/matching/scoring.ts` — `scoreCandidate()`, `rankCandidates()`. 거리/평점/완료건수/재예약률/거절패널티/신규부스트 가중 합산. 단위 테스트 `scoring.spec.ts` 존재. 설계 근거 `docs/adr/ADR-0002-matching-algorithm.md`.
- **후보 산출 + 영속화**: `apps/api/src/modules/matching/matching.service.ts`의 `MatchingService.findCandidates(jobId)` — KYC 승인·가용시간 겹침 청소부를 점수화해 `MatchCandidate` 테이블에 upsert. HTTP 진입점 `matching.controller.ts`의 `POST /matching/jobs/:jobId/candidates`.
- **DB 스키마** (`packages/db/prisma/schema.prisma`):
  - `MatchCandidate` — 잡별 후보 점수 + 분해(distanceKm/ratingScore/…), `@@unique([jobId, cleanerId])`.
  - `OfferRound` — `roundIdx`, `cleanerId`, `status`(`PENDING|ACCEPTED|DECLINED|EXPIRED`), `expiresAt`, `respondedAt`.
  - `MatchingWeights`(id=`default`) — 가중치 + `topN`, `offerTtlMinutes`, `maxRounds`.
  - `CleaningJob.status` — `REQUESTED → MATCHED → IN_PROGRESS → SUBMITTED → APPROVED → SETTLED | DISPUTED | CANCELLED`, `cleanerId`(매칭 전 null).
- **워커 골격**: `apps/worker/src/main.ts` — BullMQ `matching-offer` 큐를 `runMatchingOffer({jobId, roundIdx})`로 소비. 프로세서 `apps/worker/src/jobs/matching-offer.processor.ts`는 이미 라운드별 `OfferRound` 생성까지 수행.
- **공유 스키마**: `packages/shared/src/schemas/matching.ts` — `MatchScoreBreakdownSchema`, `MatchingWeightsSchema`.

---

## 2. 빠진 고리 — 채워야 할 7가지

탐색으로 확인한 정확한 미구현 지점:

1. **트리거 부재**: `apps/api/src/modules/payment/payment.service.ts`의 `confirm()`이 booking을 `CONFIRMED`로 전이(약 62행)하지만 매칭을 **시작하지 않는다**. `findCandidates`는 지금 수동 HTTP로만 호출됨.
2. **API → 워커 큐 프로듀서 부재**: 워커는 `matching-offer` 큐를 **소비**만 한다. API 쪽에 이 큐로 **발행**하는 BullMQ `Queue` 프로듀서가 없다.
3. **라운드 진행 부재**: `matching-offer.processor.ts`가 `expiresAt`과 함께 라운드 N 오퍼를 만들지만, TTL 만료 시 라운드 N+1을 enqueue하지 않는다(51행 부근 TODO).
4. **알림 stub**: `matching-offer.processor.ts`의 청소부 푸시/알림톡(약 51행), 운영팀 소진 알림(약 19행)이 TODO 주석뿐.
5. **수락/거절 API 부재**: `offers` 모듈이 없다. `OfferRound.status` 전이, `CleaningJob.cleanerId` 배정 + `MATCHED`, 동일 잡 잔여 오퍼 정리, 청소부 통계 갱신이 미구현.
6. **공유 스키마 부재**: `packages/shared`에 오퍼 수락/거절/목록 zod 스키마 없음.
7. **웹 미연결**: `apps/web/app/cleaner/page.tsx`가 하드코딩 오퍼 + 미연결 수락/거절 버튼 사용.

---

## 3. 작업 목록 (순서대로 실행)

> 각 작업은 독립 커밋 권장. Prisma 스키마를 건드리면 `pnpm db:migrate --name <설명>` 후 마이그레이션 디렉토리를 커밋한다.

### T1 — API 큐 프로듀서
- `apps/api`에 `matching-offer` 큐로 발행하는 BullMQ 프로듀서를 추가한다 (예: `apps/api/src/modules/queue/queue.module.ts` + `MatchingQueue` 프로바이더).
- 큐 이름 상수는 워커와 **반드시 일치**시킨다: `apps/worker/src/main.ts`의 `MATCHING_QUEUE = 'matching-offer'`. 가능하면 큐 이름 상수를 `packages/shared`로 빼서 양쪽이 공유하도록 한다(중복 문자열 제거).
- Redis 연결은 워커와 동일하게 `process.env.REDIS_URL ?? 'redis://localhost:6379'` 사용, `maxRetriesPerRequest: null`.
- API 종료 시 큐 연결을 정리(graceful shutdown)한다.

### T2 — 결제 확정 → 매칭 트리거
- `PaymentService.confirm()`의 트랜잭션이 booking을 `CONFIRMED`로 만든 **직후**, 해당 booking의 `CleaningJob`에 대해:
  1. `MatchingService.findCandidates(jobId)` 실행(후보 영속화), 그다음
  2. T1 프로듀서로 `runMatchingOffer({ jobId, roundIdx: 1 })` enqueue.
- 결합도를 낮추기 위해 결제 모듈이 매칭/큐를 직접 import하기보다, 얇은 오케스트레이션 서비스(예: `MatchingTriggerService`) 또는 NestJS 이벤트(`EventEmitter2`)를 통해 호출하는 방식을 우선 검토한다. (`CLAUDE.md §2` 결합도 최소화 / M&A 친화)
- 후보가 0명이면 즉시 운영팀 알림 훅(T4)을 호출하고 잡을 미배정 상태로 둔다.

### T3 — 라운드 진행 (TTL 만료 → 다음 라운드)
- `matching-offer.processor.ts`에서 라운드 N 오퍼를 만든 뒤, **라운드 N+1을 `expiresAt` 시점에 실행**되도록 BullMQ 지연(`delay`) 잡을 enqueue한다. (프로세서가 큐에 다시 넣을 수 있도록 프로듀서/큐 핸들을 워커에서도 사용 가능하게 구성)
- 다음 라운드 실행 시: 이미 `ACCEPTED`된 잡이면 즉시 종료(현재 `job.status !== 'REQUESTED'` 가드 유지). 만료된 이전 라운드의 `PENDING` 오퍼는 `EXPIRED`로 전이.
- `roundIdx > maxRounds`면 운영팀 소진 알림(T4) 호출 후 종료.
- 중복 방지: 이미 오퍼받은 `cleanerId`는 제외하는 기존 로직(`notIn: offeredCleanerIds`) 유지.

### T4 — 알림 심(seam)
- **외부(Kakao 알림톡/푸시)를 직접 연동하지 말 것.** 대신 `NotificationService` 인터페이스를 정의하고 **콘솔/no-op 어댑터**를 기본 구현으로 둔다(테스트 가능성 유지, 외부 의존성·라이선스 이슈 회피).
- 두 지점을 이 인터페이스 호출로 교체: ① 청소부에게 오퍼 발송, ② 운영팀에 라운드 소진 알림.
- 실연동(알림톡/FCM)은 별도 작업으로 남기고, 어댑터 교체만으로 가능하도록 경계를 만든다.

### T5 — 오퍼 수락/거절 API
- 신규 모듈 `apps/api/src/modules/offers/` 생성: `offers.module.ts`, `offers.controller.ts`, `offers.service.ts`.
- 엔드포인트:
  - `POST /offers/:offerId/accept`
  - `POST /offers/:offerId/decline`
- **수락 처리(단일 트랜잭션, 경쟁 조건 주의)**:
  - 대상 `OfferRound`가 `PENDING`이고 `expiresAt` 이전인지 확인(아니면 409/410류 에러).
  - 해당 `CleaningJob`이 아직 `REQUESTED`인지 확인(이미 다른 청소부가 채갔으면 충돌 응답).
  - `OfferRound.status = ACCEPTED`, `respondedAt = now`.
  - `CleaningJob.cleanerId = 해당 cleaner`, `status = MATCHED`.
  - 동일 잡의 다른 `PENDING` 오퍼들을 `EXPIRED`(또는 별도 취소 상태)로 정리.
  - 운영상 중요한 배정이므로 필요 시 `Decision` 기록(`CLAUDE.md §3-6`). **과설계 금지** — 단순 배정에 LLM 호출은 불필요.
- **거절 처리**:
  - `OfferRound.status = DECLINED`, `respondedAt = now`.
  - 청소부 `declineRate` 등 통계 갱신 정책이 있으면 반영(없으면 범위 밖, 추측 구현 금지).
  - 현재 라운드의 모든 오퍼가 응답 종료되면 다음 라운드를 즉시 enqueue(T3와 일관).
- 입력은 zod로 검증(`ZodPipe`). 인증 주체(어떤 cleaner인지)는 기존 인증 패턴을 따른다 — 현재 인증이 stub이면 그 한계를 코드 주석/PR 설명에 명시하되 별도 인증 구현으로 범위를 넓히지 말 것.

### T6 — 공유 스키마
- `packages/shared/src/schemas/`에 오퍼 관련 zod 스키마 추가: 수락/거절 응답, 청소부 오퍼 목록 응답(잡·숙소·시간·예상 정산액·만료까지 남은 시간).
- `packages/shared/src/index.ts`에서 재노출.
- 의존성 추가가 필요하면 워크스페이스 명시: `pnpm --filter @hosthelper/shared add <dep>`.

### T7 — 청소부 오퍼 목록 API + 웹 연결
- API: 로그인한 청소부의 `PENDING`(미만료) 오퍼 목록 조회 엔드포인트 추가(예: `GET /offers/mine`). 응답은 T6 스키마 사용.
- 웹: `apps/web/app/cleaner/page.tsx`의 하드코딩 `offers` 배열을 제거하고 위 API로 대체. 수락/거절 버튼을 `POST /offers/:offerId/accept|decline`에 연결, 응답 후 목록 갱신.
- `@hosthelper/ui` 기존 컴포넌트(`Card`, `ListItem`, `Button` 등)를 재사용. 새 디자인 시스템 도입 금지.

---

## 4. 컨벤션 가드레일 (CLAUDE.md 발췌 — 반드시 준수)

- **TypeScript strict**. 외부 경계 입력은 zod 검증.
- **Prisma 변경** 시 `pnpm db:migrate --name <설명>` 후 마이그레이션 커밋.
- **의존성 추가**는 워크스페이스 명시(`pnpm --filter @hosthelper/<pkg> add <dep>`), MIT/Apache-2.0 호환만.
- **순수 함수**(점수·정산 등)는 단위 테스트 100%. 라운드 전이/수락 충돌 같은 핵심 분기는 결정론적 테스트 추가.
- **LLM 미사용 영역**: 매칭 배정·라운드 진행은 결정론적 로직. LLM 호출 추가 금지.
- **결합도 최소화**: 패키지/모듈 분리 매각 가능하도록(`CLAUDE.md §2, §6`). 결제 모듈이 매칭 내부에 강결합되지 않게 한다.
- **한국어 우선**: 운영/UI 텍스트 한국어, 코드 식별자 영어.

---

## 5. 검증 (작업 완료 전 반드시 실행)

```bash
# 1. 타입/린트/빌드
pnpm install
pnpm -r build        # 또는 영향받은 패키지: --filter @hosthelper/api 등

# 2. 단위 테스트 (점수 + 신규 라운드/수락 분기)
pnpm -r test         # scoring.spec.ts 통과 + 신규 테스트 통과

# 3. 마이그레이션 (스키마 변경 시)
pnpm db:migrate --name <설명>
```

**엔드투엔드 스모크(로컬, `docs/runbooks/local-dev.md` 참고)**:
1. Redis + API + 워커 기동.
2. 호스트로 booking 생성 → `/payments/intent` → `/payments/confirm`(개발 stub) 호출.
3. booking이 `CONFIRMED`가 되고, `MatchCandidate`가 채워지며, 라운드 1 `OfferRound`(PENDING)가 생성되는지 DB로 확인.
4. `GET /offers/mine`(상위 후보 청소부)로 오퍼가 보이는지 확인.
5. `POST /offers/:offerId/accept` → `CleaningJob.status = MATCHED`, `cleanerId` 배정, 잔여 오퍼 `EXPIRED` 확인.
6. 거절 경로: 모든 오퍼 거절/만료 시 라운드 2가 enqueue되고, `maxRounds` 초과 시 운영팀 알림 훅(콘솔)이 호출되는지 확인.

---

## 6. 수용 기준 체크리스트

- [ ] 결제 확정이 후보 산출 + 라운드 1 오퍼를 자동 트리거한다.
- [ ] API에서 `matching-offer` 큐로 발행하는 프로듀서가 워커 큐명과 일치한다.
- [ ] TTL 만료 시 다음 라운드가 자동 진행되고 `maxRounds`에서 운영팀 알림으로 종료된다.
- [ ] `POST /offers/:id/accept|decline`이 동작하며, 수락 시 잡이 `MATCHED`로 전이되고 잔여 오퍼가 정리된다(경쟁 조건 안전).
- [ ] 청소부 웹 대시보드가 실제 오퍼를 표시하고 수락/거절이 API에 연결된다.
- [ ] 알림은 인터페이스 + stub 어댑터로 분리되어 있고 외부 의존성을 추가하지 않는다.
- [ ] 단위/통합 테스트 통과, 스키마 변경 시 마이그레이션 커밋 포함.
- [ ] CLAUDE.md 규칙(zod, 워크스페이스 의존성, 결합도, 한국어) 준수.

---

## 7. 범위 밖 (이번 작업에서 하지 말 것)

- 실제 Kakao 알림톡/FCM 연동 (심만 제공).
- 인증/JWT 가드 전면 구현 (기존 패턴 한계는 명시만).
- 결제 웹훅·정산(payout) 실행·리뷰·체크리스트 업로드 등 매칭 루프 외 기능.
- 점수 알고리즘 변경 (ADR-0002 변경이 필요하면 별도 ADR로 제안).
