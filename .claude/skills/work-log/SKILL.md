---
name: work-log
description: 에이전시 작업을 실시간 보드에 기록한다. 작업 시작·완료·막힘 시 apps/workspace/work-log.json 갱신. "지금 뭐 하는 중인지 보이게", 작업 기록, 진행 상황 공유 상황에서 호출. 모든 직원이 실작업 시 따르는 규칙.
---
# 📡 작업 로그 — 실시간 보드에 나를 드러내기

> GitHub 커밋은 **끝난 일**만 안다. "지금 누가 무슨 작업 중"은 직원이 **직접 기록**해야 보인다.
> 기록 대상: `apps/workspace/work-log.json` → 라이브 보드(`apps/workspace/live.html`)가 30초마다 읽음.

## 언제 기록하나

| 시점 | status | 하는 일 |
|---|---|---|
| 작업 **시작** | `running` | 항목 추가 + `startedAt`·`heartbeat` 기록 |
| 긴 작업 **진행 중** | `running` | `heartbeat` 갱신 (30분 넘게 안 갱신되면 보드가 "응답 없음"으로 표시) |
| **완료** | `done` | `endedAt` + `output`(PR 번호·문서 경로·결과 요약) |
| 대표 **결정 대기** | `waiting` | `endedAt` + `output`(PR 번호). 사람이 눌러야 진행되는 상태 |
| **막힘** | `blocked` | `note`에 막힌 이유. 3일 이상이면 `role-pjm` 에스컬레이션 |

## 항목 형식

```json
{
  "id": "wl-0010",
  "agent": "role-md",            // 직원 호출명 (명부의 이름 그대로)
  "agency": "house",             // changup | life | house | academy | next | hq
  "task": "개업 패키지 가격 티어 설계",
  "status": "running",
  "startedAt": "2026-08-11T12:00:00Z",
  "heartbeat": "2026-08-11T12:20:00Z",
  "endedAt": null,
  "output": null,
  "note": null
}
```

## 규칙
1. **최신이 위로** — 배열 맨 앞에 추가.
2. **`updatedAt`** 을 항상 갱신.
3. **시간은 UTC ISO8601** (보드가 한국시간으로 환산해 표시).
4. **50건 초과 시** 오래된 `done` 항목부터 정리.
5. **개인정보·비밀 금지** — 고객명·연락처·키는 기록하지 않는다 (`privacy-guard`).
6. 커밋해야 보드에 보인다. 작업 커밋에 로그를 **함께 담는다**(별도 커밋 불필요).

## 왜 중요한가
`role-pjm`의 임무 「**대표 없이도 돌아가는가**」 점검이 이 로그 위에서 돌아간다.
`running`인데 heartbeat가 멈춘 항목 = **사람이 안 눌러서 멈춘 흐름**의 신호.

## 관련
`docs/AGENCY_MODEL.md` · `docs/ZERO_TO_ONE.md` · 보드 `apps/workspace/live.html`
