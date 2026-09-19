# 오픈소스 도입 검토 기록

> 조사일 **2026-08-07**. **결론: 이번에는 아무것도 도입하지 않습니다.**
> 같은 조사를 반복하지 않기 위해 남깁니다. 라이선스는 조사 시점의 GitHub 메타데이터 기준입니다.

## 검토 기준

`CLAUDE.md` §6 — **새 의존성은 MIT/Apache-2.0 호환만**. `docs/THIRD_PARTY_LICENSES.md`에 등재합니다.
이 규칙은 분리 매각(M&A) 대비이며, 검색 단계에서 `license:mit` 한정자로 미리 걸러 후보를 좁혔습니다.

## 후보와 판정

| 저장소 | 라이선스 | ★ | 무엇에 쓸 수 있나 | 판정 |
|---|---|---|---|---|
| [`umami-software/umami`](https://github.com/umami-software/umami) | MIT | 38,089 | 쿠키리스 웹 애널리틱스 | **보류** — 규칙 부합 |
| [`medusajs/medusa`](https://github.com/medusajs/medusa) | MIT | 35,630 | 헤드리스 커머스 (하우스헬퍼 쇼핑몰) | **보류** — 규칙 부합 |
| [`6tail/lunar-javascript`](https://github.com/6tail/lunar-javascript) | MIT | 1,627 | 음력·간지·오행·십신 (사주 엔진) | **보류** — 규칙 부합 |
| [`gitroomhq/postiz-app`](https://github.com/gitroomhq/postiz-app) | **AGPL-3.0** | 34,366 | 4채널 발행 스케줄러 | **탈락** |
| [`plausible/analytics`](https://github.com/plausible/analytics) | **AGPL-3.0** | 28,397 | 웹 애널리틱스 | **탈락** |

## 왜 AGPL을 뺐나

AGPL-3.0은 **네트워크로 서비스만 제공해도 소스 공개 의무**가 발생합니다. `docs/M_AND_A_READINESS.md`를 두고 패키지 단위 분리 매각을 준비하는 구조에서는 실사 단계에서 바로 문제가 됩니다. `CLAUDE.md` §6이 MIT/Apache만 허용하는 이유입니다.

**AGPL 정책 판단은 아직 미결입니다.** 지금 결정할 필요가 없어 미뤘습니다. 다시 꺼내야 할 시점은 **4채널 발행 도구를 재검토할 때**입니다 — 그때는 별도 인스턴스 운영 시 전염 범위가 어디까지인지 법률 검토가 선행돼야 합니다.

## 구조적 결론 — 발행 도구는 대안이 없다

4채널 발행 영역에는 **MIT/Apache 대안이 사실상 없습니다.** Postiz는 AGPL, Mixpost는 상용 소스공개형입니다.

따라서 이 영역은 외부 도구 도입이 아니라 **기존 워크플로 수정**으로 가는 것이 맞습니다. 실제로 2026-08 대표실이 지목한 병목(`publish-reel` 미발화)은 새 도구가 아니라 트리거 방식 수정으로 해결했습니다 — [`runs/2026-08-ceo.md`](runs/2026-08-ceo.md), `docs/AI_COMPANY_OS.md` §5.

## 보류 3건을 다시 볼 시점

| 후보 | 언제 다시 보나 | 지금 도입하지 않는 이유 |
|---|---|---|
| Umami | 채널별 성과 비교가 실제로 필요해질 때 | **유입 태깅 0건은 이 도구로 안 풀립니다.** 게시 링크에 utm을 붙이지 않는 실행 문제입니다. Umami는 지금 전혀 없는 *사이트 트래픽 가시성*을 새로 주는 것이지 태깅을 대신하지 않습니다. 셀프호스팅에는 Postgres와 상시 실행 환경이 필요합니다 |
| Medusa | 하우스헬퍼 쇼핑몰을 실제로 만들 때 | 하우스헬퍼는 아직 브랜드 정의만 있는 단계입니다. 지금 넣으면 쓰지 않는 인프라가 됩니다 |
| lunar-javascript | 사주·운세 기능에 착수할 때 | 클라이언트 결정론적 계산이라 API 비용이 0이고 스택 부담이 작습니다. 착수 시점에 바로 넣으면 됩니다 |

## 도입할 때 할 일

1. `pnpm --filter @hosthelper/<pkg> add <dep>` — 워크스페이스를 명시합니다 (`CLAUDE.md` §4).
2. `docs/THIRD_PARTY_LICENSES.md`의 직접 의존성 표에 **패키지·버전·라이선스·용도**를 추가합니다.
3. 새 패키지를 만들었다면 `packages/<name>/README.md`에 분리 매각 가치를 한 줄 적고 `docs/ARCHITECTURE.md` §3 표를 갱신합니다 (`CLAUDE.md` §6).
