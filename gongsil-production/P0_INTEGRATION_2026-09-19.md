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
- Netlify에 현재 helpecrm의 SUPABASE_SERVICE_ROLE_KEY 등록
- 외부 공유 이력이 있는 과거 Secret은 재사용하지 않음
