# 공실헬퍼 특허 구현 맵

> 목적: 공실헬퍼의 특허 관련 기술 흐름을 실제 운영 코드·DB 구조와 연결해 추적하기 위한 내부 구현 문서입니다.
> 이 문서는 법률의견이나 특허 등록 가능성 판단이 아니라, 현재 시스템의 기술 구현 사실을 정리합니다.

## 전체 흐름

1. 이용자 인증
2. 매물·증빙 수집
3. OCR 및 자동 검증
4. 공공데이터 대조·검증등급
5. 공개 매물 Gate
6. 유료 상세정보 열람
7. 직접 거래 또는 지정중개사 연결

핵심 원칙은 **제출정보 → 원본증빙 → OCR → 정부DB 대조 → 서버 Gate → 운영자 검수 → 공개 → 유료 상세 → 연락처 연결** 순서입니다.

---

## 1단계 · 이용자 인증

### 목적
매도/매수/중개 요청 주체를 식별하고 공실헬퍼 서비스 사용자 권한을 연결합니다.

### 구현
- 카카오 로그인 기반 사용자 인증
- Supabase Auth 세션
- Helper ID/서비스 사용자 연결
- 매물등록·열람·매칭 RPC는 인증된 사용자만 실행

### 주요 코드
- `gongsil-production/site/app.js`
- `gongsil_bootstrap_profile`
- `hu_sync_gongsil_kakao`
- `hu_ensure_service_user`

---

## 2단계 · 매물·증빙 수집

### 목적
판매자가 매물 기본정보, 정확주소, 연락처, 공개사진, 검증서류를 제출합니다.

### 서버 불변조건
- 판매자 연락처 필수
- 공개사진 3장 이상 10장 이하
- 공개사진과 증빙원본은 별도 Storage bucket 사용
- 증빙문서는 소유자/운영자 범위로 제한
- 정확주소는 공개목록에서 바로 노출하지 않음

### 주요 코드/DB
- `gongsil-production/db/20260923_patent_stage2_photo_contact.sql`
- `public.gongsil_submit_property(jsonb)`
- `public.gongsil_add_property_document(...)`
- Storage:
  - `gongsil-property-images`
  - `gongsil-verification-docs`

---

## 3단계 · OCR 자동 검증

### 목적
증빙문서에서 주소 등 검증용 정보를 추출하고, 사용자가 입력한 상세주소와 대조합니다.

### 외국인관광 도시민박업
- 최신 사업자등록증을 서버 OCR 대상으로 사용
- OCR 주소와 매물 상세주소 일치 여부 저장
- 최신 OCR PASS 이력이 있어야 다음 Gate 통과 가능

### 전대형
- 최신 전대동의서를 OCR
- 주소, 임대인, 임차인, 전대허용 문구, 작성일, 서명·날인의 6개 항목 확인

### 주요 구성
- Cloud OCR Queue Worker
- `gongsil.verification_runs`
- `gongsil.verification_items`
- `public.gongsil_start_property_verification(...)`

---

## 4단계 · 공공데이터 대조 및 검증등급

### 목적
사용자가 입력한 주소/호실과 서울시 외국인관광 도시민박업 인허가 원천데이터를 비교합니다.

### 현재 판정
- `confirmed`: 정확 호실 일치 + 영업/정상
- `partial`: 같은 건물의 활성 인허가는 있으나 호실 불일치
- `inactive`: 같은 주소 기록은 있으나 활성 영업 아님
- `not_found`: 해당 주소 인허가 미확인
- `unavailable`: 원천 API 조회 실패

### 주소 판정
- 띄어쓰기 무시
- 도로명 기반
- 동·층·호수 별도 정규화
- 호수는 정확 일치 필수
- 동 정보가 양쪽에 있으면 동도 정확 일치
- 층 정보가 양쪽에 있으면 층도 정확 일치

### 원천 조회
- 서울 25개 자치구별 서비스
- API `list_total_count` 기반 페이지네이션
- 1회 1,000건 단위
- 안전상한 10,000건
- 조회 실패와 실제 미등록을 구분

### 감사 증거
응답에 다음을 포함:
- `checkedAt`
- `service`
- `matchLevel`
- `sourceMeta`
- SHA-256 `evidenceFingerprint`

### 주요 코드
- `gongsil-production/site/netlify/functions/lodging-check.mjs`
- `gongsil_private.process_auto_verification_jobs()`

---

## 5단계 · 공개 매물 Gate

### 목적
클라이언트 화면의 상태값만으로는 공개할 수 없게 하고, 서버가 검증이력을 재확인합니다.

### 중앙 Gate
`gongsil_private.patent_verification_gate(property_id)`

외국인관광 도시민박업 매물은 모두 필요:
- 공개사진 3~10장
- 필수 검증서류 4종
- 인허가 verification item confirmed
- OCR 주소 verification item confirmed
- 최근 30일 이내 정부DB PASS
- 정부DB 결과 `matchLevel=unit`
- 유효한 SHA-256 증거지문
- 최신 사업자등록증에 대한 최근 30일 이내 OCR PASS

전대형 매물은:
- 공개사진 3~10장
- 전대동의서
- OCR 6개 항목 confirmed
- 최신 전대동의서에 대한 최근 30일 이내 OCR PASS

### 제출 Gate
`public.gongsil_finalize_property(property_id)`
- 중앙 Gate 통과 전에는 `submitted` 불가

### 운영자 게시 Gate
`public.gongsil_admin_review_property(...)`
- 중앙 Gate 재확인
- 실제 업로드된 공개사진 Storage 경로만 허용
- 제출 후 생성되는 운영자 현장검수 체크리스트까지 완료해야 `published`

### 운영자 최종 체크
- 현장 사진·시설 상태
- 영업신고·인허가·소방
- 최근 매출·예약률 근거 또는 임대조건
- 양도자산·계약승계 조건 또는 신규오픈 비용근거

### 주요 SQL
- `gongsil-production/db/20260924_patent_stage3_5_verification_gate.sql`

---

## 6단계 · 유료 상세정보 열람

### 목적
공개 탐색에서는 기본정보만 표시하고, 권한을 얻은 사용자에게만 민감 상세정보를 제공합니다.

### 공개
- 지역
- 숙소 유형
- 공개사진
- 보증금/월세/권리금 등 공개범위
- 검증상태

### 열람권 이후
- 정확주소
- 운영기간
- 매출/예약률
- 운영비
- 권리금 진단 상세
- 양도조건 등

### 주요 SQL
- `gongsil-production/db/20260923_patent_stage6_7_access_contact.sql`
- `public.gongsil_get_property_detail(property_id)`

---

## 7단계 · 거래 연결

### 목적
상세정보 확인 이후 실제 거래 당사자 또는 지정 공인중개사와 연결합니다.

### 모드
- 직거래: 승인된 매수자에게 판매자/호스트 연락처 연결
- 중개사 연결: 해당 매물에 지정된 활성 공인중개사 연결

### Gate
- 카카오 인증 사용자
- 상세정보 열람권 보유
- published 상태의 매물
- 중개모드일 경우 지정중개사 1명 명확히 존재
- 연락처 권한 별도 entitlement 생성

### 주요 SQL
- `gongsil-production/db/20260923_patent_stage6_7_access_contact.sql`
- `public.gongsil_request_match(...)`
- `public.gongsil_get_match_contact(...)`

---

## 검증 이력과 개인정보 경계

### 내부에 보관
- 정확주소
- 제출 증빙 경로
- OCR 추출 메타데이터
- 정부DB 원천 응답
- 조회시각
- 원천 서비스명
- 검증 증거지문
- 운영자 검토 이력

### 공개하지 않는 정보
- 증빙 원본
- 정확주소(권한 획득 전)
- 판매자 연락처(매칭/연락처 권한 전)
- OCR 원문 전체

### 사용자 우회 방지
- 핵심 공개 Gate는 DB 서버 함수에서 실행
- private Gate는 anon/authenticated 직접 EXECUTE 불가
- 최종 제출은 소유자 확인
- 게시승인은 관리자 권한 재확인
- 검증이력은 소유자/관리자 SELECT 범위이며 사용자 직접 수정 경로를 제공하지 않음

---

## 현재 자동 QA 고정 항목

Production Smoke에서 최소 다음을 검증합니다.

- 호실 없는 주소 차단
- 띄어쓰기 없는 정확 B101호 조회 성공
- 정확 호실은 `confirmed + unit`
- SHA-256 증거지문 존재
- 잘못된 B102호는 exact confirmed 금지
- 서대문구 공식 서비스 정상 응답
- 카카오 인증 Gate
- 매물등록 Gate
- 열람권 Gate
- PortOne 공개 설정

---

## 운영 QA에서 확인한 실제 사례

검증 주소:
`서울특별시 동대문구 전농로37길 68-4, B101호`

자동대조 확인값:
- 사업장명: 지-안
- 인허가 상태: 영업/정상
- 허가일자: 2024-02-07
- 관리번호: CDFI2262212024000004
- 건축물 용도: 단독주택
- 정확 B101호 → confirmed
- B102호 → partial / building

이 사례는 테스트용 기준점이며, 공개 매물 등록을 의미하지 않습니다.
