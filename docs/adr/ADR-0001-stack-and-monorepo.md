# ADR-0001: Tech Stack & Monorepo Structure

- **Status**: Accepted
- **Date**: 2026-05-22
- **Deciders**: Founding Team

## Context

hosthelper은 호스트(웹/모바일웹), 청소사(웹/모바일웹), 운영자(웹) 3개 클라이언트와 API, 비동기 워커를 갖는 양면 마켓플레이스다. 초기 팀은 풀스택 1~3명 규모를 가정하며, 빠른 반복 + 일관된 도메인 모델 공유가 우선순위다.

## Decision

### Stack
- **Frontend**: Next.js 14 (App Router) — 호스트·청소사 공용 PWA + 별도 Admin
- **Backend**: NestJS modular monolith (BullMQ 워커 분리)
- **DB**: PostgreSQL 15 (Prisma ORM)
- **Cache/Queue**: Redis (ioredis + BullMQ)
- **Storage**: AWS S3 (Presigned URL 업로드)
- **Realtime**: NestJS WebSocket Gateway + Redis adapter
- **PG**: 토스페이먼츠 (主) + 카카오페이 (보조)
- **알림**: NHN 알림톡 + Twilio SMS fallback

### Monorepo
- **pnpm + Turborepo**: 워크스페이스, 캐싱, 의존성 그래프 명확
- TypeScript strict mode 전역
- Prisma + zod schema를 `packages/shared` `packages/db`에서 공유

### Infra
- **AWS Seoul (ap-northeast-2)**: ECS Fargate (api/worker), ALB, RDS Postgres multi-AZ, ElastiCache, S3 + CloudFront, SES, Secrets Manager
- Terraform IaC, GitHub Actions CI/CD

## Alternatives Considered

| Option | 채택 이유/거부 이유 |
|---|---|
| Next.js + tRPC (BFF) | NestJS 대비 도메인 분리 약함, BullMQ 워커 분리 어려움 |
| Spring Boot + React | 국내 표준이나 풀TS 모노레포 대비 개발속도 느림 |
| React Native first | 청소사 앱은 매력적이나 호스트는 웹 충분 → PWA first |
| Bubble / 노코드 | PMF 검증엔 빠르지만 결제·정산·매칭 로직 복잡도 한계 |
| Supabase (Postgres + Auth) | 빠른 시작 가능하나 BullMQ 워커·복잡 트랜잭션·legal residency 우려 |

## Consequences

### + Pros
- 단일 TS 언어, DTO·schema 공유 → 버그 감소
- Prisma + Postgres `tstzrange exclude` 제약으로 더블부킹 DB레벨 차단
- ECS Fargate로 운영 부담 낮음, 한국 리전 latency

### − Cons
- pnpm workspace 캐시 디버깅 학습 곡선
- NestJS DI 보일러플레이트
- RN 미사용 → 청소사 푸시/오프라인은 PWA 한계 (Beta 후 재평가)

## Decision Drivers
1. 개발 속도 (소규모 팀)
2. 도메인 모델 공유 일관성
3. 한국 리전 latency + 규제 준수
4. PMF 검증 후 RN/ML로 확장 가능성
