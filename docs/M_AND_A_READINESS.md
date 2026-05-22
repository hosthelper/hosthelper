# M&A Readiness Checklist

> 인수자 또는 잠재 인수자의 실사(Due Diligence) 대비 체크리스트. **녹색 = 준비됨, 노랑 = 진행 중, 적색 = 별도 정비 필요**.

## 1. 코드·IP

| 항목 | 상태 | 위치 |
|---|---|---|
| 단일 라이선스 (`UNLICENSED`) | 🟢 | `LICENSE` |
| 모든 패키지에 `private: true` 또는 `UNLICENSED` 명시 | 🟢 | `*/package.json` |
| 외부 라이선스 의존성 정리 (MIT/Apache 중심) | 🟢 | `pnpm-lock.yaml`, `THIRD_PARTY_LICENSES.md` |
| 코드 주석 내 개인 식별정보·키 노출 없음 | 🟢 | `.env.example`만 커밋 |
| 분리 매각 가능한 모듈 식별 | 🟢 | `docs/ARCHITECTURE.md` §3 |

## 2. 도메인·데이터

| 항목 | 상태 | 비고 |
|---|---|---|
| 도메인 모델 ERD 문서화 | 🟢 | `packages/db/prisma/schema.prisma` + `docs/ARCHITECTURE.md` |
| 마이그레이션 이력 보관 | 🟢 | `packages/db/prisma/migrations/` |
| 데이터 시드 재현 가능 | 🟢 | `packages/db/prisma/seed.ts` |
| 개인정보 항목 식별 | 🟡 | User.phone, User.email, BankAccount(암호화 예정) |
| 데이터 보존·파기 정책 | 🟡 | 운영 매뉴얼에 명시 필요 |
| GDPR/개인정보보호법 대응 | 🟡 | 양도·삭제 API 미구현 |

## 3. 사업·법무

| 항목 | 상태 | 책임 |
|---|---|---|
| 법인 등기부 등본 | 🔴 | M&A 시 별도 제출 |
| 사업자등록증 | 🔴 | M&A 시 별도 제출 |
| 통신판매업 신고증 | 🔴 | M&A 시 별도 제출 |
| 임직원·외주 인력 계약서 (NDA, IP 양도) | 🔴 | HR/법무팀 |
| 청소사 위탁 표준계약서 | 🟡 | 노무법인 자문 필요 |
| 호스트 이용약관·개인정보처리방침 | 🟡 | 초안 작성 필요 |
| 토스페이먼츠 가맹 계약 사본 | 🔴 | M&A 시 별도 제출 |
| 영업배상책임보험 가입증 | 🔴 | M&A 시 별도 제출 |

## 4. 운영·인프라

| 항목 | 상태 | 위치 |
|---|---|---|
| AWS 계정 OU 분리 (dev/staging/prod) | 🟡 | Terraform 모듈화 진행 중 |
| IaC (Terraform) | 🟡 | `infra/terraform/` 스켈레톤 |
| 백업·복구 절차 | 🔴 | RDS 자동 스냅샷 외 PITR 정책 미수립 |
| 모니터링·알람 | 🔴 | CloudWatch + Sentry 도입 예정 |
| Runbook | 🟡 | `docs/runbooks/local-dev.md` 부분 |
| Disaster Recovery 시나리오 | 🔴 | 미수립 |

## 5. 재무

| 항목 | 상태 |
|---|---|
| 단가표·수수료 정책 (정액 ₩10,000) | 🟢 (PRD §10) |
| 세금 정책 (3.3% 원천세, 부가세) | 🟢 (`pricing.service.ts`) |
| 손익 시뮬레이션 | 🟢 (PRD §10) |
| 매출 인식 정책 | 🟡 |
| 환불·취소 정책 | 🟡 |

## 6. 사용자·고객

| 항목 | 상태 |
|---|---|
| 누적 호스트 수 | 🔴 (런칭 전) |
| 누적 청소사 수 | 🔴 |
| 월간 GMV | 🔴 |
| Take rate (₩10,000 × Job 수) | 🔴 |
| 호스트 NPS | 🔴 |
| 분쟁률 | 🔴 |

> 실사 시 위 지표는 BI 대시보드 또는 Notion DB로 제공 예정.

## 7. 기술 자산 매각 단위 (참고)

| 단위 | 가치 추정 근거 |
|---|---|
| **`@hosthelper/ui`** | 한국어 최적화 미니멀 디자인 시스템 단독 → 다른 SaaS 회사 라이선스 |
| **매칭 알고리즘** (`apps/api/src/modules/matching/scoring.ts`) | 청소·배달·돌봄 등 양면 시장에 적용 가능. 별도 라이선싱 가능 |
| **가격 정책 엔진** (`apps/api/src/modules/pricing/`) | 한국 서비스업 정책 가격 적용 가능 |
| **STR 청소 도메인 모델** (`packages/db/prisma/schema.prisma`) | 동종 시장 진입자에게 IP 가치 |
| **마켓플레이스 전체** (`apps/*`) | 실제 운영 매출 + 사용자 베이스 결합 시 최고 가치 |

## 8. 매각 협상 시 즉시 제공 가능 자료

- 본 저장소 zip (LICENSE 포함)
- `docs/ARCHITECTURE.md` — 30분 안에 시스템 파악
- `docs/prd/PRD.md` — 제품 정의
- `docs/adr/` — 모든 주요 의사결정 기록
- `CHANGELOG.md` — 개발 이력
- pnpm-lock.yaml — 의존성 트리 잠금

## 9. 연락처

M&A·라이선싱·기술이전 문의: **hosthelper01@gmail.com**
