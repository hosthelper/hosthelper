# Local Dev Runbook

## 사전 요구사항

- Node.js 20 LTS (`nvm use`)
- pnpm 9+
- Docker (Postgres + Redis 컨테이너용)

## 부트스트랩

```bash
# 1. 인프라(DB + Redis) 기동
docker compose up -d

# 2. 의존성 설치
pnpm install

# 3. 환경변수
cp .env.example .env
# DATABASE_URL/REDIS_URL은 docker-compose 기본값과 일치

# 4. Prisma 마이그레이션 + 시드
pnpm db:generate
pnpm db:migrate --name init
pnpm --filter @hosthelper/db seed

# 5. 개발 서버
pnpm dev
# - web:    http://localhost:3000
# - admin:  http://localhost:3001
# - api:    http://localhost:4000  (swagger: /docs)
# - worker: stdout 로그
```

## 개발 워크플로우

- 변경 사항은 `claude/cleaning-staff-matching-platform-vnkOq` 브랜치에 작업
- 매칭 알고리즘 변경 시 `apps/api/src/modules/matching/scoring.spec.ts` 함께 갱신
- Prisma 스키마 변경 시 `pnpm db:migrate --name <변경요약>`

## 트러블슈팅

- **Prisma generate 실패**: `pnpm db:generate` 재실행, 또는 Node 버전 확인
- **포트 충돌 (3000/4000/5432/6379)**: `docker compose down` 후 `lsof -i :<port>` 확인
- **pnpm workspace 미인식**: 루트에서 `pnpm install` 재실행

## 다음 단계 (Sprint 1 시작 전 체크리스트)

- [ ] PRD v1.0 사인오프 (호스트/청소사/법무)
- [ ] 토스페이먼츠 가맹점 등록 완료
- [ ] AWS Seoul 계정 OU 분리 + IAM 역할 정리
- [ ] NHN/Toss SMS OTP API 키 발급
- [ ] 디자인 시스템 무드보드 → Figma 컴포넌트 라이브러리 초안
