# hosthelper

> **시간을 효율적으로 아껴드립니다.**

수익형 주택~하이엔드 수익형 주택(에어비앤비/STR) 운영자를 위한 청소 운영관리 매칭 플랫폼. 체크아웃→체크인 사이의 턴오버를 책임지는 SaaS. 매칭, 예약, 간편결제, 사진검수 체크리스트, 양방향 평판, 자동 정산까지 한 곳에서 운영합니다.

**수수료**: 건당 ₩10,000 정액 (호스트도 청소사도 한눈에). 광고는 사용 흐름을 가리지 않는 자리에만.

## Documentation

- **종합 기획안**: `/root/.claude/plans/reflective-waddling-cloud.md`
- **PRD**: [`docs/prd/PRD.md`](docs/prd/PRD.md)
- **아키텍처 결정**: [`docs/adr/`](docs/adr/)

## Tech Stack

| 영역 | 선택 |
|---|---|
| Frontend | Next.js 14 (App Router, PWA) |
| Backend | NestJS (modular monolith) |
| DB | PostgreSQL 15 + Prisma |
| Cache/Queue | Redis + BullMQ |
| Storage | AWS S3 (사진/문서) |
| Realtime | NestJS WebSocket + Redis adapter |
| Infra | AWS Seoul (ECS Fargate, RDS, ElastiCache, CloudFront) |
| IaC | Terraform |
| Monorepo | pnpm + Turborepo |

## Repo Layout

```
hosthelper/
├── apps/
│   ├── web/       # Next.js (호스트/청소사 공용 PWA)
│   ├── admin/     # Next.js (운영자 콘솔)
│   ├── api/       # NestJS API
│   └── worker/    # NestJS standalone (BullMQ 컨슈머)
├── packages/
│   ├── db/        # Prisma schema & migrations
│   ├── shared/    # zod 스키마, DTO, 타입
│   ├── ui/        # 디자인 시스템 (shadcn/ui)
│   ├── config/    # eslint, tsconfig, tailwind preset
│   └── sdk/       # 자동 생성 API 클라이언트
├── infra/terraform/
├── docs/{prd,adr,runbooks}/
└── .github/workflows/
```

## Quick Start

```bash
pnpm install
pnpm db:generate
pnpm dev          # web + api 동시 실행
```

세부 환경설정은 `apps/*/README.md` 참조.

## Roadmap

| Phase | 기간 | 핵심 산출물 |
|---|---|---|
| 0. Discovery | W1-2 | PRD, 법무, PG 셋업 |
| 1. Architecture | W3-4 | ADR 8건, 도메인 모델 |
| 2. MVP | W5-16 | 매칭·예약·결제·체크리스트·리뷰·정산 |
| 3. Closed Beta | W17-22 | 강남/마포 호스트 15-20명 파일럿 |
| 4. Public Launch | W23-30 | 수수료 모델 + 마케팅 |
| 5. Growth | W31+ | 수익 다각화, 부산/제주 확장 |
