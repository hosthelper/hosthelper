# Helper Content Autopilot V1 — 2026-09-12

## Goal
호스트헬퍼 72시간 고객 유입 캠페인에서 콘텐츠 기획 → Asset 생성 → QA → Instagram / Threads / YouTube / TikTok 게시 → Evidence → KPI 수집을 자동화한다.

## Live backend
Supabase project: `qjtgueuaoohopffatjsp`

### Content tables
- `content_items`
- `content_assets`
- `content_channel_plans`
- `content_generation_jobs`
- `content_autopilot_policies`

### Campaign
- `hosthelper-72h-20260912`
- Goal: `diagnosis_applied = 10`
- CTA keyword: `진단`
- Timer begins after first real SNS publish success.

### Seeded content
- `CNT-HOST-72H-01` 가격부터 내리지 마세요 — Reel — QA 95
- `CNT-HOST-72H-02` 숙소 운영하면서 이런 생각 해본 적 있으세요? — Carousel — QA 94
- `CNT-HOST-72H-03` 저라면 이 숙소는 가격을 내리지 않습니다 — Reel — QA 96
- `CNT-HOST-72H-04` 숙소 운영 5대 항목 무료진단 — Carousel — QA 97
- `CNT-HOST-72H-05` 숙소 운영자가 가장 외로운 순간 — Reel — QA 95
- `CNT-HOST-72H-06` 숙소 10곳 운영진단 실험 — Carousel — QA 96

가짜 Before/After 수치, 검증되지 않은 후기/성과, `광고 아닙니다` 같은 오인 문구는 금지한다.

## Autopilot policy
HostHelper policy:
- enabled: true
- min QA: 90
- allowed: Instagram, Threads, YouTube, TikTok
- max daily posts: 8
- Evidence required
- unverified results / fake social proof blocked

`content_autopilot_reconcile()` runs every 5 minutes. It only creates an approved `sns_posts` row when:
1. campaign is ready/active
2. content QA passed and score >= 90
3. required asset is ready
4. direct SNS OAuth account is connected

Idempotency key prevents duplicate posts.

## Publishing engine
`sns-publish` V6 supports:
- Instagram: image / carousel / Reel
- Threads: text / image / video / carousel
- YouTube: video
- TikTok: video direct post + status polling

All posts use business route health checks, UTM attribution and Evidence. Failed posts retry with backoff. TikTok stays `submitted` until API status becomes `PUBLISH_COMPLETE`.

## OAuth / token maintenance
`sns-oauth` V5 supports Instagram, Threads, YouTube and TikTok.
TikTok requires `TT_CLIENT_KEY` / `TT_CLIENT_SECRET` and scope `user.info.basic,video.publish`.
`sns-token-maintenance` V2 refreshes TikTok access tokens using its refresh token in addition to the other supported channels.

## Current blockers
Current direct SNS API account table is empty. OAuth app credentials still need to be registered and accounts connected once.

Current reconcile state after implementation:
- waiting_asset: 12 channel plans
- waiting_account: 5 Threads text plans
- waiting_qa: 0
- blocked: 0
- media generation jobs queued: 6

The copy, scripts, channel plans, QA and publish runtime exist, but actual generated media assets and direct account OAuth are not yet complete. Do not declare automatic publishing complete until an actual external post ID and Evidence are confirmed per target channel.

## Next production gates
1. Connect media generation worker / provider and write finished assets to `content_assets`.
2. Register SNS app secrets and OAuth once for Instagram / Threads / YouTube / TikTok.
3. Run channel preflight.
4. Publish one test post per channel and confirm external post ID.
5. Confirm UTM business link and campaign activation.
6. Continue 72h KPI loop.
