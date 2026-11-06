# HostHelper PMS Core V1

## 목적

호스트헬퍼의 PMS Core는 숙박 운영의 중앙 원장(Source of Truth)이다.
기존 `Booking` 모델은 청소 턴오버 예약이므로 유지하며, 게스트 숙박 예약과 재고는 별도 PMS 도메인으로 확장한다.

## 개발 순서

1. PMS Core
2. Booking Engine
3. CMS / Channel Manager
4. RMS 추천형
5. RMS 자동화

다음 단계들은 PMS가 확정한 숙소·객실·예약·재고 데이터를 읽고 쓰며, 별도의 예약 원장을 만들지 않는다.

## PMS Core 엔티티

- Property: 기존 숙소 엔티티 유지
- PMS Property Config: 숙소별 시간대·통화·체크인/아웃 정책
- Room Type: 판매 단위 객실유형
- Room Unit: 실제 객실 호수/Unit
- Guest: 투숙객 기본정보
- Reservation: 게스트 숙박 예약
- Reservation Night: 숙박일별 객실 점유
- Inventory Day: 객실유형별 일자 재고
- Reservation Event: 상태변경 감사기록

## 예약 상태

`HOLD → PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`

예외 상태:

- `CANCELLED`
- `NO_SHOW`

허용되지 않은 상태 점프는 API/DB에서 차단한다.

## 핵심 불변조건

1. 체크아웃 날짜는 체크인 날짜보다 이후여야 한다.
2. 같은 실제 객실(Room Unit)은 같은 숙박일에 두 예약이 동시에 점유할 수 없다.
3. 객실유형별 `held + sold <= total`을 보장한다.
4. 취소된 예약의 홀드/판매 재고는 멱등적으로 복구된다.
5. 외부 채널 예약은 `(channel, externalReservationId)` 기준 중복 생성되지 않는다.
6. 객실 재고 변경은 예약 생성/확정/취소와 같은 트랜잭션 경계에서 처리한다.
7. Booking Engine/CMS/RMS는 PMS Inventory를 우회해 별도 재고를 만들지 않는다.
8. 기존 청소 Booking/Job 흐름은 PMS 도입으로 깨지지 않아야 한다.

## Shared Contract V1

`packages/shared/src/schemas/pms.ts`가 다음 공통 계약을 제공한다.

- 객실유형 생성 검증
- 실제 객실 생성 검증
- 투숙객 입력 검증
- 숙박 예약 생성 검증
- 일자 재고 검증
- 예약 상태 enum / 전환 규칙

Frontend, API, Worker는 동일 계약을 사용한다.

## 다음 WorkItem

### W2 — Prisma / DB

PMS 전용 모델과 migration을 추가한다. 기존 `Booking`은 변경하지 않는다.

### W3 — Inventory Lock

예약 생성 시 날짜 범위 전체의 재고를 잠그고 중복 예약을 차단하는 트랜잭션 서비스를 구현한다.

### W4 — PMS API

- Room Type CRUD
- Room Unit CRUD
- Reservation Create / Read / Transition
- Availability Query
- Cancellation / Inventory Restore

### W5 — Host Workspace

- PMS 대시보드
- 예약 캘린더
- 객실 상태
- 체크인/아웃
- 예약 상세

## Production Gate

PMS Core 완료는 화면 존재가 아니라 다음 조건을 모두 만족한 상태다.

- shared contract PASS
- Prisma schema/migration PASS
- double booking 방지 PASS
- 예약 상태머신 PASS
- 취소 후 inventory restore PASS
- 기존 cleaning regression PASS
- Auth/RBAC PASS
- E2E PASS
- QA evidence 확보
- 총괄검수 PASS
- Production 검증 PASS
