# ADR-0002: Matching Algorithm (V1 → V3)

- **Status**: Accepted (V1), Planned (V2/V3)
- **Date**: 2026-05-22

## Context

청소 Job이 생성되면 후보 청소사를 점수화해 오퍼한다. 초기엔 데이터가 없으므로 룰베이스로 시작하고, 데이터 축적 후 학습 모델로 진화한다.

## Decision

### V1 — Rule-based (Closed Beta까지)

```
score = w1·(1/distance_km)
      + w2·rating
      + w3·log(1 + completed_jobs)
      + w4·rebooking_rate
      − w5·recent_decline_rate
```

**초안 가중치** (Admin tunable):
- w1 = 0.35  (거리)
- w2 = 0.25  (평점)
- w3 = 0.15  (완료 횟수, log 스케일)
- w4 = 0.15  (재예약율)
- w5 = 0.10  (최근 거절율)

**필터 (가중치 적용 전)**:
- 청소사 가용성 슬롯 매치
- 청소사 거리 ≤ 10km
- 정지/제재 상태 아님
- 호스트 블랙리스트 미포함
- 청소사 인증 완료(KYC)

**오퍼 라운드**:
1. Top 5 후보에게 동시 푸시 (15분 TTL)
2. 첫 수락자 확정
3. 미수락 시 다음 5명 라운드 (최대 3 라운드)
4. 3 라운드 후에도 매칭 실패 → 운영팀 수동 개입

### V2 — Personalized (Public Launch +3개월)

- 호스트별 선호 청소사 학습 (Implicit ALS or simple counts)
- 시간대 적합도 (청소사가 과거 수락한 시간대)
- 노쇼 확률 (최근 N건 노쇼/연체 기록)

### V3 — ML (Series A 전)

- LightGBM Binary Classifier: P(수락 | 후보, Job, 컨텍스트)
- Multi-objective: 수락확률 × E[게스트 청결도 점수]
- Feature store: 청소사 7/30/90일 윈도우 통계
- Online A/B: V2 vs V3, 매칭 시간·수락률·게스트 평점 비교

## Implementation Notes

- 매칭 서비스는 **순수 함수**로 구현 → 테스트 용이
- 점수·가중치는 DB의 `matching_weights` 테이블에서 로드 (런타임 변경)
- 모든 매칭 결정 `match_decisions` 테이블에 로그 (V2/V3 학습 데이터)

## Risks

- 콜드 스타트: 신규 청소사 점수 낮음 → "신규 우대 부스트" 30일간 +0.1 적용
- Gaming: 거절 시 패널티 → 청소사가 가용성을 비워서 회피 → 가용성 신뢰도 점수 별도 추적
