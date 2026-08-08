# 💻 제품·개발 워크플로 (DEV WORKFLOW)

> hosthelper는 실제 소프트웨어 제품(`apps/*`, `packages/*`)입니다. 이 문서는 기능 하나가
> **아이디어 → 배포**까지 거치는 **체인**과, 단계마다 담당하는 AI 직원을 정의합니다.
> (개리 탄의 gstack "체인 워크플로" 아이디어를 우리 `CLAUDE.md` 규칙에 맞춰 이식.)
>
> 핵심: 각 단계는 **앞 단계의 산출물을 물려받습니다.** 즉흥 프롬프트가 아니라 손에서 손으로.

## 파이프라인

```
① 기획          ② 설계            ③ 구현           ④ 리뷰          ⑤ QA           ⑥ 릴리스        ⑦ 문서
dev-product-spec → dev-eng-planner → dev-code-builder → dev-code-reviewer → dev-qa → dev-release → dev-docs
   PRD              엔지니어링 계획      코드+테스트        리뷰 코멘트        검증결과      릴리스노트       문서갱신
```

## 단계별 담당·산출물·게이트

| 단계 | 직원 | 입력 → 산출물 | 통과 게이트 |
| --- | --- | --- | --- |
| ① 기획 | `dev-product-spec` | 아이디어 → PRD(문제·유저스토리·수용기준·범위) | 수용기준이 검증 가능한가 |
| ② 설계 | `dev-eng-planner` | PRD → 기술계획(영향범위·Prisma·zod·테스트계획·ADR) | 마이그레이션·API 계약·LLM 경로 정의됨 |
| ③ 구현 | `dev-code-builder` | 계획 → 코드+마이그레이션+단위테스트 | 규칙 위반 0 (아래 게이트) |
| ④ 리뷰 | `dev-code-reviewer` | diff → 리뷰 코멘트 | 금지사항·버그·복잡성 클리어 |
| ⑤ QA | `dev-qa` | 테스트계획 → 검증결과 | 수용기준 충족, 엣지 커버 |
| ⑥ 릴리스 | `dev-release` | → 릴리스노트·배포/롤백 체크 | 롤백 플랜 존재 |
| ⑦ 문서 | `dev-docs` | → README·ADR·CHANGELOG 갱신 | 문서-코드 동기화 |

## 규칙 게이트 (CLAUDE.md — 전 단계 공통)

구현·리뷰 단계에서 **반드시** 막는 것:

- LLM 기능은 `@hosthelper/ai` 게이트웨이 통과 (직접 `@anthropic-ai/sdk` 호출 금지).
- 시스템 프롬프트에 `Date.now()`·`HOSTNAME`·세션ID·비밀(키·사업자번호) 금지 (prompt caching 파괴/보안).
- `temperature`/`top_p`/`top_k` 금지 (Opus 4.7 400).
- **다른 LLM 프로바이더 추가 금지** — Anthropic 전용.
- 외부 입력 zod 검증(`ZodPipe`), TypeScript strict.
- 토큰 회계(`LLMCall`)·예산 가드(`TokenBudget`)·결정 영속화(`Decision`).
- Prisma 변경 시 마이그레이션 커밋, 의존성은 MIT/Apache-2.0.

## 한 사이클 예시 (대화)

1. `dev-product-spec` — "청소사 자동 재배정 기능 PRD 써줘"
2. `dev-eng-planner` — "이 PRD로 엔지니어링 계획·테스트 계획 짜줘"
3. `dev-code-builder` — "계획대로 구현해줘"
4. `dev-code-reviewer` — "이 변경 리뷰해줘"
5. `dev-qa` — "수용기준대로 테스트·엣지케이스 검증해줘"
6. `dev-release` — "릴리스 노트랑 배포·롤백 체크리스트 준비해줘"
7. `dev-docs` — "바뀐 내용 README·CHANGELOG·ADR에 반영해줘"

> 작은 변경은 단계를 합쳐도 됩니다(②③④를 한 번에). 큰 기능일수록 체인을 지키세요.

## 조율

여러 단계를 한 번에 돌리고 싶으면 **`team-orchestrator`(총괄실장)** 에게
"이 기능 개발 체인 돌려줘"라고 하면 단계별로 배정·취합합니다.
대규모 병렬이 필요하면 워크플로/다중 에이전트로 확장.

## 관계

- 사업 운영 직원(1~29)과 별개인 **제품 제작 라인**입니다. 명부: `docs/AI_TEAM.md`.
- 배포 실무: `docs/DEPLOY.md`, 아키텍처: `docs/ARCHITECTURE.md`, 결정: `docs/adr`.
