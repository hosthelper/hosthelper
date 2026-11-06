# 공실헬퍼 특허 구현 맵

> 기준: 라이브러리의 `09월16일-특허-거래서비스플랫폼.pdf` 청구항 1~4와 현재 Production 구현을 대조한 내부 기술 문서입니다.
> 법률의견·등록가능성 판단이 아니라, 출원서의 기술구성을 실제 코드/DB와 추적하기 위한 문서입니다.

## 청구항 1 · 제1~7단계 Core Flow

### 제1단계 · 소셜 회원가입·로그인

**출원 흐름**
- 미가입 사용자는 소셜 계정으로 회원가입·로그인
- 가입 사용자는 소셜 계정으로 인증

**Production 구현**
- 카카오 OAuth / Supabase Auth
- 로그인 세션 생성 후 공실헬퍼 계정 화면 복귀
- `gongsil_bootstrap_profile`
- `hu_sync_gongsil_kakao`
- `hu_ensure_service_user`
- 매물등록·열람·매칭 핵심 RPC는 인증 사용자 기준

---

### 제2단계 · 매도인 상세매물·증빙 등록

**출원 흐름**
- 지역·주소
- 보증금·월세·권리금
- 월매출·가동률·월고정비·관리비·운영연수
- 담당자·특징
- 매물사진 3~10장
- 외국인관광 도시민박업 사업자등록증
- 임대차계약서
- 임대인 동의서
- 전입세대 열람원

**Production 구현**
- `public.gongsil_submit_property(jsonb)`
- `public.gongsil_add_property_document(...)`
- `gongsil.property_takeover_data`
- `gongsil.property_private`
- `gongsil.property_documents`
- 공개사진 3~10장 서버 검증
- 실제 Storage 경로와 DB 문서 메타데이터 결합
- 정확주소·연락처·원본증빙은 공개목록에서 분리

**주요 SQL**
- `gongsil-production/db/20260923_patent_stage2_photo_contact.sql`

---

### 제3단계 · OCR + 관공서 DB 대조 + 검증/미검증 판정

**출원 흐름**
증빙 이미지 → OCR 텍스트 추출 → 관공서 DB 비교·대조 → 합법성 검증 → 검증 매물 / 미검증 매물 분류

**Production 구현**
1. 사업자등록증/전대동의서 등 private Storage 업로드
2. Cloud OCR Queue Worker
3. OCR 주소와 등록 상세주소 비교
4. 서울시 외국인관광 도시민박업 인허가 원천데이터 조회
5. 도로명·동·층·호수 정규화
6. 정확 호실 + 영업/정상일 때만 `confirmed`
7. 불일치·부분일치·비활성·조회불가 상태를 분리
8. 검증 이력과 원천응답을 DB에 저장

**현재 인허가 판정**
- `confirmed`: 정확 호실 일치 + 영업/정상
- `partial`: 같은 건물의 활성 인허가는 있으나 호실 불일치
- `inactive`: 주소 기록은 있으나 활성 영업 아님
- `not_found`: 해당 주소 인허가 미확인
- `unavailable`: 원천 API 장애/조회 실패

**원천 추적**
- 서울 25개 자치구별 Open API 서비스
- `list_total_count` 기반 1,000건 단위 페이지네이션
- 조회시각 `checkedAt`
- 원천 서비스명
- 조회 건수/페이지/실패 자치구
- SHA-256 `evidenceFingerprint`

**서버 Gate**
`gongsil_private.patent_verification_gate(property_id)`

외도민 매물은 다음이 모두 필요:
- 사진 3~10장
- 필수 증빙 4종
- 인허가 item confirmed
- OCR 주소 item confirmed
- 최근 30일 정부DB PASS
- `matchLevel=unit`
- 64자리 SHA-256 검증지문
- 최신 사업자등록증의 최근 30일 OCR PASS

**주요 코드**
- `gongsil-production/site/netlify/functions/lodging-check.mjs`
- `gongsil_private.process_auto_verification_jobs()`
- `gongsil-production/db/20260924_patent_stage3_5_verification_gate.sql`

---

### 제4단계 · AI 권리금 산정

**출원 흐름**
등록매물의 금액·수익정보와 리뷰·예약현황·접근성·관광지 인접성 등을 AI/ML로 수치화하여 권리금을 산출

**Production 입력 특징**
- operating_months
- deposit_amount
- monthly_rent
- avg_monthly_revenue
- avg_daily_rate
- fixed_cost
- management_fee
- occupancy_rate
- asset_reuse_pct
- facility_investment
- review_score
- reservation_forward_rate
- accessibility_score
- tourism_proximity_score
- area
- accommodation_type

**Production ML**
- 활성 모델: `premium-xgb-20260918015612`
- 엔진: `xgboost_residual_v1`
- Queue: `gongsil.valuation_inference_jobs`
- Worker: `gongsil-ml-http`
- 요청: `public.gongsil_request_premium_assessment(property_id)`
- 완료: `public.gongsil_complete_ml_inference_job(...)`
- 결과: `gongsil.premium_assessments`

**제4단계 공개 Gate**
`gongsil_private.patent_premium_gate(property_id)`

숙소인수 매물의 제5단계 공개 전:
- 실제 ML 모델 평가가 있어야 함
- `components.engine = ml_worker`
- 권리금 min ≤ recommended ≤ max
- confidence > 0
- 평가의 `input_snapshot`이 현재 매물 ML 특징과 완전히 일치해야 함
- 매출/가동률 등 입력값이 바뀌면 기존 평가는 자동으로 Gate 실패

**운영 E2E 확인**
임시 QA 매물로 실제 XGBoost 추론 → `premium_assessments` 저장 → Stage 4 Gate PASS를 확인함.
QA 데이터는 테스트 후 삭제.

---

### 제5단계 · 기본 매물검색 + 선택형 열람권

**출원 흐름**
매수자에게 위치·금액·사진 등 기본 매물정보를 검색 가능하게 보여주고, 상세정보 열람권을 선택적으로 구매 가능하게 제공

**Production 구현**
- 검색/필터 공개 UI
- 공개 대상은 운영자 승인 완료 `published` 매물
- 공개 전 제3단계 검증 Gate 재확인
- 숙소인수 매물은 제4단계 ML 권리금 Gate 재확인
- 실제 업로드된 3~10장 공개사진 경로만 승인
- 운영자 최종 체크리스트 완료 후 공개

**운영자 최종검수**
- 현장 사진·시설 상태
- 영업신고·인허가·소방
- 최근 매출·예약률 근거
- 양도자산·계약승계 조건

**열람권 데이터 모델**
`gongsil.access_pass_plans`
- 건수형: 1건 / 5건 / 10건
- 기간형: 1일 / 7일 / 30일 / 90일 / 180일 / 365일
- 현재 실제 판매상품은 별도 활성 플랜으로 운영 가능

**건수형/기간형 권한 처리**
- `public.gongsil_create_access_order_idempotent(...)`
- `public.gongsil_unlock_property(...)`
- 건수형은 `access_pass_usage`로 사용 건수 차감
- 기간형은 `valid_until`로 유효기간 검사

---

### 제6단계 · 구매자 상세정보 제공

**출원 흐름**
열람권 구매가 확인되면 매도인 등록정보와 제4단계에서 산출된 권리금을 포함한 상세정보 제공

**Production 구현**
`public.gongsil_get_property_detail(property_id)`

권한 보유 사용자에게만:
- 정확주소
- 운영기간
- 월매출
- 평균객단가
- 고정비/관리비
- 가동률
- 리뷰
- 예약선행률
- 접근성
- 관광지 인접성
- 시설투자
- 포함자산
- 양도사유
- AI 권리금 최소/최대/추천
- 모델버전·신뢰도·산정시각

권한이 없는 공개검색에서는 위 민감 상세정보와 AI 권리금 상세가 잠김.

---

### 제7단계 · 직거래 / 지정중개사 매칭

**출원 흐름**
상세정보 확인 후 매칭 요청을 받으면:
- 직거래: 매도인·매수인 연락처 상호 통지
- 중개거래: 매매 당사자와 사전 지정 공인중개사 연락처 통지

**Production 구현**
- `public.gongsil_request_match(...)`
- `public.gongsil_get_match_contact(...)`
- 카카오 인증 사용자
- 상세 열람 entitlement
- published 매물
- 지정중개 모드일 경우 활성 지정중개사 확인
- 연락처 공개 권한 별도 생성

**주요 SQL**
- `gongsil-production/db/20260923_patent_stage6_7_access_contact.sql`

---

## 청구항 2 · 열람권 형태

출원 구성:
- 검색 매물 1~10건당 건수형
- 하루·일주일·한 달·분기·반기·1년 기간형

현재 DB 모델:
- `count_1`
- `count_5`
- `count_10`
- `day_1`
- `week_1`
- `month_1`
- `quarter_1`
- `half_1`
- `year_1`

실제 판매정책은 `active`와 가격 설정으로 별도 운영 가능.

---

## 청구항 3 · 매도인에 공인중개사 포함

공인중개사 파트너/배정 매물 구조가 존재하며, 지정중개사 모드에서 중개인 연락처를 제7단계에 연결.

관련 UI/RPC:
- `#broker`
- `gongsil_submit_broker_application_v2`
- `gongsil_broker_assigned_properties_v1`

---

## 청구항 4 · 시스템 청구항

위 제1~7단계 서버 흐름을 웹/모바일 브라우저에서 동일하게 사용할 수 있도록 클라이언트, API, DB, Worker로 구성.

---

## 기술적 추가 안전장치

출원서의 단계 구현 외에 Production에서 추가한 보호장치:

- 정확 호실이 아니면 외도민 검증 PASS 금지
- 띄어쓰기 없는 주소도 정규화
- 정부DB 장애와 실제 미등록 구분
- API 페이지네이션
- SHA-256 검증 증거지문
- 검증 데이터 최근 30일 freshness
- 최신 OCR 문서 기준
- ML 입력 스냅샷과 현재 매물값 불일치 시 Stage 4 Gate 실패
- 실제 Storage에 등록된 사진만 공개 승인
- submitted 이후 운영자 수동 체크리스트
- private Gate를 anon/authenticated가 직접 실행하지 못하도록 차단
- 공개 전 서버에서 제3·4단계 Gate 재검증

---

## Production 자동 QA

현재 Smoke QA에서:
- 호실 없는 주소 차단
- 띄어쓰기 없는 B101호 정확 조회
- exact unit = confirmed
- SHA-256 evidence fingerprint
- B102호 오입력 exact-confirmed 차단
- 서대문구 공식 Open API 정상
- 특허 제5단계 검색 화면
- 열람권 로그인 Gate
- 매물등록 로그인 Gate
- 공인중개사 로그인 Gate
- 카카오 로그인 handoff
- PortOne 설정

서버 DB QA에서:
- 상태값만 confirmed인 매물 차단
- 정부검증만 PASS인 매물 차단
- 정부검증 + OCR + fingerprint + 사진/서류가 모두 맞을 때 submitted
- XGBoost 실제 추론 완료
- 매물 입력 변경 시 과거 ML 평가 무효화
- 제3단계 검증 + 제4단계 ML 완료 + 운영자 검수 후에만 published
- 테스트 데이터 즉시 삭제

---

## 기준 테스트 주소

`서울특별시 동대문구 전농로37길 68-4, B101호`

테스트 시 확인한 공공데이터:
- 사업장명: 지-안
- 인허가 상태: 영업/정상
- 허가일자: 2024-02-07
- 관리번호: CDFI2262212024000004
- 건축물 용도: 단독주택
- B101호 → confirmed / unit
- B102호 → partial / building

이 주소는 검증기술 QA 기준점이며 공실헬퍼 판매매물로 등록됐다는 의미가 아닙니다.
