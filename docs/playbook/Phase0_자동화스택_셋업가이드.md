# Phase 0 자동화 스택 셋업 가이드 — 헬퍼유니버스

> 목표: 첫 고객 0명 단계에서 **월 5~10만원으로 통합 회원관리 + 사업체별 홍보 자동화**를 48시간 안에 가동.
> 적정 단계: Phase 0 (지금~월 booking 30건). 그 이후는 monday(Phase 1) → Salesforce(Phase 3).

## 0. 셋업 의존성 순서

```
1. 카카오톡 비즈채널 개설      ← 입구 (최우선)
2. Google Sheets 통합 DB
3. Google Form 회원 신청 폼
4. 토스페이먼츠 가맹 신청        ← 병렬, 심사 7~10일
5. Zapier 5개 zap
6. Claude API 키 + Zapier 연결
7. GA4 + Meta Pixel
8. 운영 SOP 1장
```

## 1. Google Sheets 통합 DB 스키마

스프레드시트명: `헬퍼유니버스_통합DB`. 메인 시트 컬럼:

| 컬럼 | 타입 | 예시 |
|---|---|---|
| member_id | 자동 ROW()-1 | 1,2,3 |
| created_at | NOW() | 2026-06-17 09:12 |
| channel | 텍스트 | kakao/form/instagram/blog |
| name | 텍스트 | 김OO |
| kakao_id | 텍스트 | @member123 |
| phone | 텍스트 | 010-xxxx |
| business_unit | 텍스트 | RCC/공실/하우스/아카데미 |
| product | 텍스트 | 시간제/데이/7일/열람권 |
| inquiry_text | 텍스트 | 문의 원문 |
| intent | Claude 채움 | booking/info/complaint |
| lead_score | Claude 채움 | 1~10 |
| stage | 텍스트 | 문의→상담→선결제→입주→퇴거→후기 |
| party_size | 숫자 | 1~8 |
| target_capacity | 텍스트 | 1인형/4인형/8인형 |
| planned_in / planned_out | 날짜 | — |
| payment_link | URL | toss 링크 |
| payment_status | 텍스트 | 미발송/발송/완료/환불 |
| assigned_to | 텍스트 | 담당자 |
| notes | 텍스트 | 메모 |

추가 시트: `_content_queue`(콘텐츠 검수 대기), `_metrics`(일별·사업체별 집계).

## 2. 카카오톡 비즈채널 (1시간)

1. center-pf.kakao.com 접속 → 로그인(hosthelper01@gmail.com)
2. 새 채널: 이름 `호스트헬퍼리커버리` / ID `@호스트헬퍼리커버리`
3. 카테고리: 숙박·생활 서비스 (의료 아님)
4. 프로필·소개 입력 (금지어 0건)
5. 채널 공개 + 검색 노출 ON
6. 설정 → 알림톡 API 키 발급 (Zapier용)

> 알림톡은 비즈메시지 사업자 등록(729-33-00827) 후 1~3일 심사.

## 3. Google Form 신청 폼

필드: 이름 / 연락처 / 카톡ID / 관심 사업체(RCC·공실·하우스·아카데미) / 관심 상품(시간제·데이·7일) / 입주 희망일 / 인원(1·2~4·5~8) / 문의 / 개인정보 동의(필수).
응답 저장 → 통합 DB 시트로 연결.

폼 상단 고지:
```
본 신청서는 비의료 체류 컨시어지 안내용입니다.
의료·치료·회복 효과 보장 안내가 아닙니다.
건강·의료 관련 사항은 담당 의료진과 상담하시기 바랍니다.
```

## 4. 토스페이먼츠 가맹 (병렬, 7~10일)

tosspayments.com 사업자 가입 → 서류(사업자등록증·통장·신분증) → 결제수단 카드+가상계좌+카카오페이 → 결제 링크 발급 권한 활성화.
Phase 0은 수동 링크 생성 + Zapier 자동 발송으로 충분.

## 5. Zapier 5개 zap

- **Zap 1** 폼 응답 → Claude 분류(intent/lead_score) → Sheets 업데이트 → 카톡 인사
- **Zap 2** stage="선결제대기" → 토스 결제 링크 생성 → Sheets → 카톡 발송
- **Zap 3** 매일 09:00 → 입주 D-3/D-1 리마인더
- **Zap 4** 매일 11:00 → 퇴거 다음날 후기 요청
- **Zap 5** 매주 월 08:00 → 사업체 4개 × 콘텐츠 3장 생성 → `_content_queue`

## 6. Claude API 호출 5종 (모델 claude-opus-4-7)

### A. 의도 분류 + 리드 스코어
```
너는 헬퍼유니버스 RCC의 1차 분류기다. 입력은 회원 문의 텍스트다.
JSON으로만 답하라:
{"intent":"booking|info|complaint","business_unit":"RCC|공실|하우스|아카데미",
 "product":"시간제|데이|7일|열람권|도매|교육|unknown","lead_score":1~10,"reason":"한 문장"}
의료/회복/치료 표현이 입력에 있어도 답변에 그대로 쓰지 마라.
```

### B. 사업체별 맞춤 응답 초안
```
너는 헬퍼유니버스 {business_unit} 담당 컨시어지다.
금지: 회복/치료/케어/수술 후/원장 추천/1박/체크인/호텔식/1인당 추가요금
권장: 비의료 체류/프리미엄 컨시어지/입주·퇴거/단기임대/정원
회원 문의에 200자 이내 한국어 답변. 끝에 "담당 의료진과 상담하시기 바랍니다." 포함.
```

### C. 리드 스코어링
```
너는 헬퍼유니버스 영업 매니저다. 회원 데이터로 1~10 점수+근거 JSON.
8점 이상 24시간 내 클로징, 4점 미만 양육 시퀀스.
```

### D. 사업체별 콘텐츠 일괄 생성
```
너는 헬퍼유니버스 {business_unit} 콘텐츠 작가다. 잽:라이트훅 4:1.
한국 인스타 캡션 3장(각 100~200자 + 해시태그 3~5). 금지어 가드 통과(B와 동일).
```

### E. 금지어 가드 스캔
```
너는 헬퍼유니버스 의료법·표시광고법 가드다. 입력 텍스트 스캔.
{"passed":true|false,"violations":[{"term":"...","location_snippet":"...","suggestion":"..."}]}
금지어: 회복,치료,케어,수술 후,붓기,통증,원장 추천,환자 유치,1박,체크인,
체크아웃,호텔식,1인당 추가요금,회복 보장
```

## 7. GA4 + Meta Pixel

GA4 측정ID(G-XXXX) + Meta Pixel ID 발급 → lifehelper.co.kr `<head>`에 삽입.
전환 이벤트: form_submit, kakao_channel_click, payment_link_click, purchase_complete.

## 8. 운영 SOP (일일)

```
매일 09:00  신규 문의 확인(booking & score≥7 우선) / 미답 문의 사람 답변
매일 14:00  입주 리마인더 발송 확인 / 결제 미완 후속
매일 17:00  _metrics에 문의수·전환율·매출 1줄 기록
매주 월     콘텐츠 12장 검수 → 가드 통과만 발행 / 8전문가 1군 적용 점검
매주 금     score<4 양육 카톡 1회 / 후기 미회신 후속
```

## 리스크 가드

1. 카톡 알림톡은 사업자 인증 필요(1~3일). 그 전엔 1:1 채팅만.
2. Zapier Free=월 100 task. 늘면 Starter($29).
3. Claude API 키 하드코딩 금지 — Zapier 인증/환경변수.
4. 금지어 가드는 사람이 발행 전 30초 재확인.
5. DB가 곧 자산 — 권한 관리, 주 1회 백업.

## 단계 전환 기준 (도구 업그레이드 시점)

| Phase | 조건 | 스택 |
|---|---|---|
| 0 (지금) | ~월 30건 | Claude API + Sheets + Zapier + 카톡 |
| 1 (6~18개월) | 30~300건, 2~3 사업체 | monday Sales CRM + Claude + 토스 |
| 2 (18~36개월) | 300~1000건, 5+ 사업체 | HubSpot/Salesforce Starter + monday + Claude |
| 3 (월매출 10억+) | 멀티 사업체 통합 | Salesforce Enterprise + hosthelper 모노레포 + Claude Agents |
