# ADR-0003: 창업이지 점포 매물 매칭 (조건 필터 + 점수)

- **Status**: Accepted
- **Date**: 2026-07-14

## Context

창업이지(별도 사업)는 SNS로 예비창업자를 모집해 설문으로 희망 조건(운영방식 직영/풀오토/위탁/본사, 업종·지역·보증금·월세·권리금)을 사전 확보하고, 조건에 맞는 양도 매물이 있으면 연락해 미팅을 잡는다. hosthelper 저장소의 매칭 패턴을 재사용하되, 분리 매각 가능해야 한다 (CLAUDE.md §6).

## Decision

### 매칭 = 하드 필터 + 가중 점수 (조회 시 계산)

```
필터: 매물 가격이 리드의 예산 상한(보증금/월세/권리금, null=무제한) 초과 시 제외
score = 0.35·industry + 0.30·region + 0.15·operation + 0.20·budget   (각 0..1)
```

- 업종/지역/운영방식: 희망 목록 포함=1, 미지정=0.5(중립), 불일치=0. 지역은 부분 일치 허용("마포" ⊂ "마포구"). 업종·지역은 **소프트** 처리(필터 아님) — 매물이 적은 초기에 빈 결과를 피하기 위함.
- budget: 상한 지정 차원만 `1 − price/max` 여유율 평균.
- 구현: `apps/api/src/modules/changup/scoring.ts` 순수 함수, Jest 100% 커버.

### 매치 결과 비영속 (compute-on-read)

hosthelper의 `MatchCandidate`는 오퍼 라운드 상태머신의 입력이라 영속이 필요했다. 창업이지는 사람이 전화로 후속 처리하고 리드·매물이 수십 건 규모이므로 `GET /leads/:id/matches`에서 즉시 계산한다. 가중치도 상수(`DEFAULT_CHANGUP_WEIGHTS`, `@hosthelper/shared`) — 튜닝 필요성이 생기면 DB 테이블로 승격.

### 분리 매각 경계

`StoreListing`/`BuyerLead` 테이블은 hosthelper 모델과 FK 0개. API는 `modules/changup` 단일 모듈, 웹은 `apps/changup` 독립 앱(브랜드 분리, `@hosthelper/ui` 미사용).

### 공개 설문 무인증 + 허니팟

`POST /changup/leads`는 공개(SNS 링크). 스팸 완화는 숨김 `website` 필드 허니팟 — 값이 있으면 성공 응답만 주고 저장 생략.

## Deferred (의도적 유예)

- **인증**: 저장소 전체가 아직 무인증이라 `/ops`·변경 API도 동일. 설문 링크 공개 배포 전 `x-ops-key` 헤더 가드(env `CHANGUP_OPS_KEY`) 추가.
- Rate limiting (survey POST).
- 가중치 DB 테이블 + admin 튜닝 화면.
- 금액 Int(원) 상한 ~21.4억 — 초대형 매물 취급 시 BigInt 전환.
- AI 기능(매물 소개문 생성, 적합도 설명) — 필요 시 `packages/ai` 패턴(`Decision`/`LLMCall` 기록)으로 추가.
