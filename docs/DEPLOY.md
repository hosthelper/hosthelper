# 공개 URL 배포 가이드

> 본 저장소를 영구 공개 URL로 띄우는 가장 빠른 경로입니다. 샌드박스에서는 외부 터널링이 차단되므로 아래 1개를 선택해 진행하세요.

## ⚡ 옵션 A. Vercel (가장 빠름, 5분, 무료)

**대상**: `apps/web` (랜딩 + 로그인 + 호스트 + 청소사 + 라이브러리 카탈로그 9개 라우트).
**전제**: `apps/web/vercel.json`이 이미 커밋되어 있어 install/build를 자동 설정합니다.

### 단계

1. **Vercel 가입**: https://vercel.com/signup → GitHub 계정으로 로그인
2. **프로젝트 추가**: 대시보드 → **Add New… → Project**
3. **저장소 선택**: `hosthelper/hosthelper` → **Import**
4. **Configure Project** 화면에서:
   - **Project Name**: `hosthelper-web` (자동 채워짐)
   - **Framework Preset**: `Next.js` (자동 감지)
   - **Root Directory**: **`apps/web`** ← 이것만 수동으로 변경
   - Build/Install Command: ❌ 건드리지 마세요. `vercel.json`이 자동 설정합니다.
   - **Branch**: `claude/cleaning-staff-matching-platform-vnkOq` (Production Branch에서 선택 가능)
5. **Environment Variables** (선택):
   ```
   NEXT_PUBLIC_API_BASE_URL = (비워두거나 임시 placeholder)
   ```
   API 미배포 상태에서도 랜딩/라이브러리 페이지는 정상 동작합니다. 로그인·예약 폼은 API URL이 있어야 동작.
6. **Deploy** 클릭

### 결과
- 약 3~4분 후 `https://hosthelper-web-xxxx.vercel.app` 형태 URL 발급
- 매 푸시마다 자동 재배포
- 무료 플랜: 100GB/월 대역폭, 6000분/월 빌드, custom domain 1개 무료 연결

### 도메인 연결
- Vercel 프로젝트 → **Settings → Domains** → `hosthelper.kr` 추가
- 네임서버 또는 A/CNAME 레코드 안내대로 설정

### 정상 동작 페이지 (API 없이도)
- `/` 랜딩
- `/library` 컴포넌트 카탈로그
- `/host/new`, `/cleaner/new` 안내 페이지

### API 연결이 필요한 페이지
- `/login` (OTP), `/host/book` (견적/결제), `/cleaner` (실시간 일감)
- 옵션 B(Railway)로 API 함께 배포하면 풀 동작

---

## 옵션 B. Railway (Web + API + DB + Redis 한 번에)

**대상**: 전체 스택. 베타 호스트 실사용 가능.

### 1단계
- https://railway.app 가입 (GitHub)
- **New Project → Deploy from GitHub** → `hosthelper/hosthelper`

### 2단계 — 서비스 4개 생성

#### 서비스 1: Postgres
**New → Database → PostgreSQL** → 자동 생성, `DATABASE_URL` 자동 노출

#### 서비스 2: Redis
**New → Database → Redis** → `REDIS_URL` 자동 노출

#### 서비스 3: API
| 항목 | 값 |
|---|---|
| Root Directory | `/` |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @hosthelper/shared build && pnpm --filter @hosthelper/db build && pnpm --filter @hosthelper/ai build && pnpm --filter @hosthelper/api build` |
| Start Command | `pnpm --filter @hosthelper/db exec prisma migrate deploy && node apps/api/dist/main.js` |
| Port | 4000 |

환경변수:
```
JWT_SECRET           = (16자 이상 랜덤)
TOSS_CLIENT_KEY      = (토스페이먼츠 가맹 발급)
TOSS_SECRET_KEY      = (토스페이먼츠 가맹 발급)
ANTHROPIC_API_KEY    = (Claude API 키)
HOSTHELPER_AI_DAILY_BUDGET_USD = 50
```
DATABASE_URL / REDIS_URL은 Railway가 자동 주입.

#### 서비스 4: Web
| 항목 | 값 |
|---|---|
| Root Directory | `/` |
| Build Command | `pnpm install --frozen-lockfile && pnpm --filter @hosthelper/shared build && pnpm --filter @hosthelper/ui build && pnpm --filter @hosthelper/web build` |
| Start Command | `pnpm --filter @hosthelper/web exec next start -p $PORT` |

환경변수:
```
NEXT_PUBLIC_API_BASE_URL = (API 서비스의 Railway 공개 URL)
```

### 결과
- Web: `https://hosthelper-web-production.up.railway.app`
- API: `https://hosthelper-api-production.up.railway.app`

---

## 옵션 C. AWS Seoul (상용 배포)

`infra/terraform/main.tf` 모듈을 채워야 합니다 (VPC + RDS multi-AZ + ElastiCache + ECS Fargate + ALB + CloudFront). 약 1주 작업.

상용 배포 권장 경로: **옵션 B로 베타 운영 → MVP 검증 후 옵션 C로 이전**.

---

## 빠른 결정표

| 상황 | 추천 | 소요 |
|---|---|---|
| "그냥 미리 보기 한 번" | 옵션 A | 5분 |
| "베타 호스트 5명 실사용" | 옵션 B | 30분 |
| "공식 런칭" | 옵션 C | 1주 |

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| Vercel 빌드: `cannot find module @hosthelper/ui` | Root Directory가 `apps/web`인지 확인. `vercel.json` 커밋되어 있어야 함. |
| Vercel 빌드: `pnpm: command not found` | Vercel은 자동으로 pnpm 감지. `pnpm-lock.yaml`이 커밋되어 있는지 확인. |
| Vercel 배포 후 `/login` 페이지 에러 | `NEXT_PUBLIC_API_BASE_URL` 미설정 → 옵션 B로 API 함께 배포 필요. |
| Railway API 부팅 실패 | Postgres/Redis 서비스 먼저 ready 확인. `JWT_SECRET` 필수. |
