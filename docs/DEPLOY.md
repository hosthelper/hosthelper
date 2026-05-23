# 공개 URL 배포 가이드

> 본 저장소를 영구 공개 URL로 띄우는 가장 빠른 경로입니다. 샌드박스에서는 외부 터널링이 차단되므로 아래 1개를 선택해 진행하세요.

## 옵션 A. Vercel (가장 빠름, 5분, 무료)

**대상**: `apps/web` (랜딩 + 라이브러리 카탈로그). API는 별도 배포 필요.

### 1단계 — Vercel 계정 연결
- https://vercel.com 가입 (GitHub 계정으로)
- "Add New Project" → `hosthelper/hosthelper` 선택
- 브랜치: `claude/cleaning-staff-matching-platform-vnkOq`

### 2단계 — 프로젝트 설정
| 항목 | 값 |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm --filter @hosthelper/shared build && pnpm --filter @hosthelper/ui build && pnpm --filter @hosthelper/web build` |
| Output Directory | `.next` |
| Install Command | `cd ../.. && pnpm install --frozen-lockfile` |
| Node.js Version | 20.x |

### 3단계 — 환경변수
```
NEXT_PUBLIC_API_BASE_URL = https://api.hosthelper.kr   (API 배포 전엔 임시 placeholder OK)
```

### 4단계 — Deploy 클릭
→ `https://hosthelper-xxx.vercel.app` 형태 URL 자동 발급

도메인 연결: Vercel 프로젝트 → Domains → `hosthelper.kr` 추가 → 네임서버 설정.

## 옵션 B. Railway (Web + API + DB + Redis 한 번에)

**대상**: 전체 스택 (web + api + worker + postgres + redis)

### 1단계
- https://railway.app 가입 (GitHub 계정으로)
- "New Project" → "Deploy from GitHub" → `hosthelper/hosthelper`

### 2단계 — 서비스 4개 생성

#### 서비스 1: Postgres
- "New" → "Database" → "PostgreSQL"
- 자동 생성. `DATABASE_URL` 환경변수 자동 노출.

#### 서비스 2: Redis
- "New" → "Database" → "Redis"
- `REDIS_URL` 자동 노출.

#### 서비스 3: API
| 항목 | 값 |
|---|---|
| Root Directory | `/` |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @hosthelper/shared build && pnpm --filter @hosthelper/db build && pnpm --filter @hosthelper/ai build && pnpm --filter @hosthelper/api build` |
| Start Command | `pnpm --filter @hosthelper/db exec prisma migrate deploy && node apps/api/dist/main.js` |
| Port | 4000 |

환경변수:
```
DATABASE_URL  (Railway 자동 주입)
REDIS_URL     (Railway 자동 주입)
JWT_SECRET    (16자 이상 랜덤)
TOSS_CLIENT_KEY
TOSS_SECRET_KEY
ANTHROPIC_API_KEY
HOSTHELPER_AI_DAILY_BUDGET_USD = 50
```

#### 서비스 4: Web
| 항목 | 값 |
|---|---|
| Root Directory | `/` |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @hosthelper/shared build && pnpm --filter @hosthelper/ui build && pnpm --filter @hosthelper/web build` |
| Start Command | `pnpm --filter @hosthelper/web exec next start -p $PORT` |
| Port | (Railway가 PORT 자동 주입) |

환경변수:
```
NEXT_PUBLIC_API_BASE_URL = (API 서비스의 Railway 공개 URL)
```

### 결과
- Web: `https://hosthelper-web-production.up.railway.app`
- API: `https://hosthelper-api-production.up.railway.app`
- DB/Redis: 내부 네트워크만

## 옵션 C. AWS Seoul (상용 배포)

`infra/terraform/main.tf` skeleton에 모듈을 채워야 합니다. RDS multi-AZ + ElastiCache + ECS Fargate + ALB + CloudFront. 약 1주 작업.

상용 배포 시 권장: 옵션 B로 베타 운영 → MVP 검증 후 옵션 C로 이전.

---

## 빠른 결정표

| 상황 | 추천 |
|---|---|
| "그냥 미리 보기 한번" | 옵션 A (Vercel) — 5분 |
| "베타 호스트 5명 실사용 시키기" | 옵션 B (Railway) — 30분, 토스 결제 가능 |
| "공식 런칭 + 한국 데이터 주권" | 옵션 C (AWS Seoul) — 1주 |

## 다음 단계

옵션을 정해주시면 단계별로 함께 진행해드립니다. 또는 Vercel/Railway 계정 토큰을 공유해주시면 제가 직접 배포 스크립트를 실행할 수 있습니다 (선택 사항).
