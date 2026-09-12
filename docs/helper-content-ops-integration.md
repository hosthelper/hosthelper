# Helper Office 콘텐츠 운영실 V1

이 모듈은 Helper Content Autopilot의 실데이터를 Helper Office에서 관제하기 위한 운영 화면입니다.

## 연결 데이터
- Content items / QA
- Asset generation jobs
- SNS OAuth 상태
- Channel plans / publish blockers
- 72시간 캠페인 KPI
- 실제 게시 Evidence / External Post ID

## 상태 API
`https://qjtgueuaoohopffatjsp.supabase.co/functions/v1/content-ops-status`

## SNS OAuth
`https://qjtgueuaoohopffatjsp.supabase.co/functions/v1/sns-oauth`

## 완료 기준
화면의 상태 텍스트만으로 완료 처리하지 않고 External Post ID와 Evidence가 실제로 확인되어야 게시 완료로 본다.
