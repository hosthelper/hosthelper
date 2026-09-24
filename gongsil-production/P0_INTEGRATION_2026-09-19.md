# 공실헬퍼 P0 통합 작업

## 완료
- 최신 브랜드 기준 문구 GitHub 반영
- Render ML Worker 인증 토큰 구조 반영
- Netlify valuation proxy에 X-Gongsil-Worker-Token 전달 코드 반영
- helpecrm Supabase에 Helper Universe member link 컬럼/RPC 적용
- 기존 열람권 플랜 확인: day_10 / day_30 / day_60 활성
- Helper Universe SSO 브라우저 모듈 작성
- PortOne V2 열람권 주문/결제/서버검증/모바일 redirect 처리 모듈 작성

## 현재 Production 차단점
1. PDS 인증 허브의 공실헬퍼 허용 Origin이 예전 chatgpt.site 주소로 고정되어 있음.
   - 목표 Origin: https://gongsil-helper.netlify.app
2. Netlify Production에 서버 전용 Secret이 없음.
   - SUPABASE_SERVICE_ROLE_KEY
   - PORTONE_API_SECRET
3. 현재 Netlify deploy는 CLI 수동 배포이며 Git 저장소와 연결되어 있지 않아 정확한 live index source 자동 patch가 불가능함.
4. AppDeploy 공실헬퍼/PDS 새 배포는 일일 배포 크레딧 reset 전까지 일시 차단.

## PDS 변경
UNIVERSE_SERVICE_ORIGINS.gongsil 값을 canonical Production인
https://gongsil-helper.netlify.app
으로 변경한다.

## 로그인 E2E
공실헬퍼 → PDS → Kakao OIDC → PDS callback → hu_sso_code → PDS exchange
→ Kakao ID Token → Supabase signInWithIdToken(kakao)
→ gongsil_bootstrap_profile
→ gongsil_link_universe_member

## 결제 E2E
로그인 → gongsil_create_access_order_idempotent
→ PortOne.requestPayment
→ /.netlify/functions/portone-verify
→ PortOne 서버 조회
→ DB 주문 금액/상태 대조
→ gongsil_ingest_portone_verified_event
→ access entitlement 활성화

## 보안 원칙
- Service Role / PortOne API Secret / Worker Token은 브라우저에 노출 금지
- 결제 금액은 브라우저 값이 아니라 DB 주문 금액을 기준으로 서버에서 재검증
- Helper ID 연결은 로그인한 본인의 gongsil.profiles 행만 수정
- SSO code는 1회용이며 PDS가 Origin을 검증


## 2026-09-19 추가 완료
- helpecrm gongsil.profiles에 외부 Helper Universe member mapping 컬럼 적용
- public.gongsil_link_universe_member(text) 적용: SECURITY INVOKER, authenticated only
- 기존 hu_sync_gongsil_kakao + hu_ensure_service_user('gongsil')를 SSO 완료 흐름에 연결
- gongsil_create_access_order_idempotent: anon 실행권 제거
- gongsil_has_active_access_pass: anon 실행권 제거
- gongsil_get_portone_verification_contract: service_role only
- gongsil_ingest_portone_verified_event: service_role only
- Production /.netlify/functions/portone-config 실응답 확인
- PortOne V2 PC Promise + 모바일 redirect callback 모두 처리하도록 클라이언트 모듈 준비
- 기존 visit_deposit 결제/환불 Function 회귀 없이 보존

## 배포 직전 필수
- PDS UNIVERSE_SERVICE_ORIGINS.gongsil을 https://gongsil-helper.netlify.app 로 변경
- Netlify에 새로 발급한 PORTONE_API_SECRET 등록
- Netlify 결제 검증은 SUPABASE_SERVICE_ROLE_KEY 대신 GONGSIL_PORTONE_SETTLE_TOKEN + SUPABASE_PUBLISHABLE_KEY 사용
- 외부 공유 이력이 있는 과거 Secret은 재사용하지 않음


## 2026-09-19 SSO 실제 QA
- PDS Gongsil 허용 Origin을 canonical Production + staging 2개로 명시 제한
  - https://gongsil-helper.netlify.app
  - https://new-gsg1y1.v2.appdeploy.ai
- SSO exchange에서 one-time code에 기록된 returnTo Origin과 실제 요청 Origin 재검증
- staging의 기존 direct Supabase Kakao OAuth를 Helper Universe SSO 방식으로 교체
- 실제 브라우저 QA:
  - 공실헬퍼 staging 로그인 모달
  - Helper Universe/PDS SSO
  - Kakao OAuth
  - accounts.kakao.com 공식 로그인 화면 도달
  - Origin/CORS/returnTo 오류 없음
- 실제 Kakao 계정 입력·로그인 완료는 테스트 계정 자격증명 없이 수행하지 않음

## 결제 보안 업데이트
- 별도 GONGSIL_PORTONE_SETTLE_TOKEN을 회전
- DB에는 SHA-256 hash만 저장
- Netlify에는 Secret으로만 저장
- DB token validation = true 확인
- 준비한 portone-verify Function은 SUPABASE_SERVICE_ROLE_KEY 의존 제거
- publishable key + token-scoped verification/settlement RPC 사용
- 기존 visit_deposit 결제/환불 경로 유지

## 현재 외부 블로커
1. Netlify Production은 CLI 수동배포본이며 연결된 도구에 source upload API가 없어 프런트/Function 코드 파일을 직접 교체할 수 없음.
2. 연결된 Remote Desktop은 offline, Opera Browser Connector는 disconnected.
3. 실제 PortOne 서버 검증에는 과거 공유된 키를 재사용하지 않고 새 PORTONE_API_SECRET 발급·등록 필요.


## 2026-09-23 특허 핵심 흐름 Production 보완

특허 청구항의 1~7단계 기준으로 Production 연결부를 재점검하고 다음을 보완했다.

- 제1단계: 최신 미러 Kakao OAuth를 helpecrm Supabase 기준으로 정상화하고 실제 Kakao 로그인 확인.
- 제2단계: 담당자명/연락처를 UI와 서버 모두 필수화. 공개사진 3~10장 규칙을 DB 검증/게시 전환에서도 강제.
- 제3단계: 기존 OCR + 관공서 자동대조 + 최종 제출 게이트 유지.
- 제4단계: 등록 매물 권리금 산정을 구형 규칙 직접호출에서 `gongsil_request_premium_assessment`로 변경해 활성 XGBoost 모델을 우선 사용.
- 제5단계: 비로그인 사용자의 공개 기본정보 열람 권한 유지. 위치/보증금/권리금 필터와 열람권 게이트 Production Smoke 통과.
- 제6단계: 열람권 권한 보유 시 정확한 주소와 매도인이 입력한 운영정보, 최신 권리금 평가를 상세 응답에 포함.
- 제7단계: 직거래/지정중개사 매칭 생성 시 연락처 열람권한 자동 발급. 구매자/매도인/중개사 알림 트리거의 smallint 타입 오류 수정.
- 청구항 3: 공인중개사 신청/승인/지정매물/의뢰매물 등록 진입점 유지.
- 청구항 2: 건수형(1/5/10건) 및 기간형(1일/1주/1개월/분기/반기/1년) 플랜 스키마와 사용 로직은 구현되어 있다. 현재 판매정책은 가격이 확정된 10/30/60일 플랜만 활성화한다.

검증:
- DB rollback QA: 상세주소 공개 → 직거래 매칭 → contact_access → 매도인 연락처 조회 → 양측 알림 = PASS.
- Production Playwright Smoke: AI 권리금, 검색필터, 열람권, 매물등록 게이트, 중개사 Claim 3, 관공서 검증, Kakao OAuth, PortOne config = PASS.
- 실제 QA 데이터는 rollback 처리하여 Production 데이터에 남기지 않음.
