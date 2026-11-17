# 호스트헬퍼 24시간 Slack 이벤트 수신 운영

2026-11-18 신규 인프라 배포

## 배포 확인

- Supabase 프로젝트: helpecrm / buzcnfnimzlsjvbeefjb
- Edge Function: hosthelper-slack-events (v1, 배포 상태 ACTIVE)
- 서버 요청 URL: https://buzcnfnimzlsjvbeefjb.supabase.co/functions/v1/hosthelper-slack-events
- 데이터베이스: public.hosthelper_ai_slack_events (RLS 활성화, anon/authenticated 차단, service_role만 조회·저장)
- Slack 채널: #hosthelper-ai-ops (비공개 채널 ID C0CKGEYUABA)
- 연결된 소유자: hosthelper01
- 서버 코드: supabase/functions/hosthelper-slack-events/index.ts

## 필수 연결 작업 — 서버는 배포되었지만 이 설정 전까지 실제 수집이 시작되지 않음

1. https://api.slack.com/apps 에서 별도의 Slack 앱(예: HostHelper Ops)을 만든다. ChatGPT의 Slack 연결과는 별도 앱이다.
2. Slack 앱 Basic Information > App Credentials > Signing Secret 값을 복사해 Supabase 프로젝트 Edge Function Secrets에 이름 HH_SLACK_SIGNING_SECRET로 **직접 등록**한다. 채팅/깃허브/Slack 메시지에 절대 공유하지 않는다.
   - https://supabase.com/dashboard/project/buzcnfnimzlsjvbeefjb/settings/functions
   - UI 항목명이 바뀌면 Edge Functions > Secrets 또는 Settings > Edge Function Secrets에서 등록.
3. Slack 앱 OAuth & Permissions > Bot Token Scopes에 groups:history 를 추가한다.
4. Slack 앱 Event Subscriptions > Enable Events 켜고 Request URL에 위 서버 요청 URL을 등록. URL 인증이 통과해야 한다.
5. Subscribe to bot events 에 message.groups 선택. Save Changes. 필요한 경우 Reinstall to Workspace.
6. Slack에서 #hosthelper-ai-ops 비공개 채널에 만든 Slack 앱의 봇을 초대한다 (채널에서 /invite @봇이름).
7. 호스트헬퍼 소유자 계정으로 테스트: '201호 청소완료' 및 애프터 사진 전송.
8. Supabase SQL Editor에서 아래 조회 결과에 해당 event_id 한 건이 생성되었는지 확인:
   SELECT room, cleaning_reported_completed, review_status, received_at FROM public.hosthelper_ai_slack_events ORDER BY received_at DESC LIMIT 5;
9. 실제 자동 운영 전 청소 팀원 Slack ID를 HH_SLACK_ALLOWED_USERS에 콤마 구분으로 추가해야 팀원 보고가 수락된다.
10. 봇의 outbound 알림, Claude/피클 실행 및 게스트 메시지 자동 발송은 **별도 구현/검증이 필요**하다. 이 엔드포인트는 보고를 검수 대기열에 기록할 뿐이다.

## 테스트 기준

- GET 요청: 서버 상태 표기, ready=false면 Signing Secret 미설정 또는 DB 서비스 키 미존재.
- 서명 없는 POST: 인증 미설정이면 503, 설정 후 401.
- Slack URL verification: 서명이 유효해야만 challenge 응답.
- 유효한 메시지: 허용 채널/사용자만 200; 예약/문자 전문은 저장하지 않음.
- 동일 Slack 이벤트 재시도: event_id 기준 중복 저장하지 않음.
- 사진 업로드가 있다고 해서 자동으로 청소완료·얼리체크인 확정/비밀번호 전달/결제가 실행되지는 않음.
- 서버리스 서비스: PC를 끄더라도 배포된 API는 요청을 받을 수 있으나, 100% 가동률은 플랫폼 SLA/장애 여부에 따름.

## 개인정보 및 보안

메시지 원문/게스트 개인 정보/비밀번호/카드 정보를 서버 원장에 저장하지 않는다. 수집 대상 데이터는 Slack event id, 채널/사용자 ID, 객실번호, 첨부사진의 Slack 파일 ID, 청소 완료 주장 여부, 특이사항 감지 여부, 검수 상태뿐이다. 서비스 역할 키 또는 Signing Secret을 공개 클라이언트에 노출하지 않는다.

## 기존 자산

구글 정산장부, 기존 1시간 예약/정산 자동화, 장애 감시, 호스트헬퍼 AppDeploy 운영 앱은 변경하지 않았다. 신규 수신 서버는 기존 앱과 아직 실시간 DB 양방향 연동되지 않았다.
