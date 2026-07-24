# 🏪 창업이지 — 매물중개 퍼널 실행 플레이북

> 당근/SNS 유입 → 랜딩 니즈 파악 → 매물 TOP3 추천 → 오프미팅 브리핑 → 클로징까지,
> 각 단계에 **어느 AI 직원을 부르는지** 정리한 운영 매뉴얼.
> (창업이지 = 점포 양도 중개. hosthelper 마켓과 분리된 사업 라인.)

## 퍼널 한눈에

```
① 유입        ② 니즈 파악        ③ 추천            ④ 미팅            ⑤ 브리핑          ⑥ 클로징
당근·SNS  →   랜딩 설문(/s)  →   매물 TOP3    →   오프미팅 세팅  →  매물3 브리핑  →   팔로업·계약
              Supabase           추천 사유          일정 확정          비교표·Q&A         진행관리
```

## 단계별 담당 직원

| 단계 | 하는 일 | 담당 직원(호출명) | 산출물 |
| --- | --- | --- | --- |
| ① 유입 | 당근·인스타·스레드·블로그로 링크 유도 | `ad-copy`, `shortform-planner`, `blog-seo`, `host-outreach` | SNS 콘텐츠(→ 회원모집 키트) |
| ② 니즈 파악 | 설문/문의 리드 요약·자격 분류 | **`changup-lead-intake`** (나상담) | 상담 카드 |
| (소싱) | 양도 매물 수집·검수·등록 | **`changup-listing-sourcer`** (소매물) | 매물 카드 |
| ③ 추천 | 리드↔매물 매칭 TOP3 + 사유 | **`changup-deal-matcher`** (매삼추) | TOP3 추천 |
| (분석) | 매물 상권·입지 분석 | **`changup-location-analyst`** (상권분석가) | 상권 리포트 |
| ④ 미팅 | 연락·일정 조율·리마인드 | **`changup-meeting-coordinator`** (일정관리) | 미팅 메시지 세트 |
| ⑤ 브리핑 | 매물 3개 브리핑 시트·비교표·Q&A | **`changup-deal-brief`** (브리핑) | 브리핑 팩 |
| ⑥ 클로징 | 미팅 후 후속·계약 단계 관리 | **`changup-deal-closer`** (클로징) | 팔로업·파이프라인 상태 |
| (전 단계) | 계약·약관 문구 초안 | `legal-draft` (유법무) *(변호사 검토)* | 계약 유의사항 |
| (주간) | 퍼널 지표 리포트 | `weekly-report` (주보고) | 전환율 리포트 |

## 실제 시스템 연결점 (이미 구축됨)

- **랜딩·설문**: `apps/changup-site` (`/s`) → Supabase `BuyerLead` 저장. **이 정적 사이트가 실서비스 리드 경로.**
- **리드 필드**: 운영방식·업종·지역·예산·연락처·동의 (`packages/shared` `BuyerLeadSurveySchema`).
- **매칭**: `apps/api/src/modules/changup/scoring.ts` (룰베이스 점수, ADR-0003).
- **운영 파이프라인**: `apps/changup` `/ops/leads·listings·calendar`.
- ⚠️ 현재 리드는 Supabase에 저장되고 `/ops` 대시보드(Postgres)와 저장소가 갈라져 있음 → 리드 확인은 Supabase에서.

## 한 사이클 돌리는 법 (예시 대화)

1. `changup-lead-intake` — "이 리드 정리해줘: (설문 내용)" → 상담 카드
2. `changup-deal-matcher` — "이 리드에 맞는 매물 TOP3 골라줘: (매물 목록)" → TOP3
3. `changup-location-analyst` — "1순위 매물 상권 분석해줘"
4. `changup-meeting-coordinator` — "이 고객한테 미팅 제안 메시지 만들어줘 (시간 옵션 3개)"
5. `changup-deal-brief` — "이 매물 3개로 미팅 브리핑 자료 만들어줘"
6. 미팅 진행 → `changup-deal-closer` — "미팅 끝났어, 팔로업 메시지랑 다음 단계 정리해줘"

## 지표 (주간 점검)

리드 수 · 상담 전환 · 미팅 예약 · 미팅 노쇼 · 브리핑 후 진행 · 계약 성사.
→ `weekly-report`에게 숫자만 넘기면 전환율 리포트로 정리.

## ⚠️ 공통 안전장치

- 개인정보(연락처)는 상담 목적 외 사용·노출 금지.
- 미검증 매출·수익은 "매물주 제시 기준"으로만 표기.
- 금액·계약·법률 커뮤니케이션은 **담당자(및 필요 시 전문가) 확인 후** 발송.
