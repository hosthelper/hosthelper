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
