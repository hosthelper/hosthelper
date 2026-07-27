# 릴스 자동 게시 — 1회 토큰 세팅 가이드 (비개발자용)

이 세팅을 한 번만 끝내면, 매일 만들어지는 릴스가 **인스타 릴스 + 유튜브 쇼츠에 자동 업로드**됩니다.
넣을 곳: GitHub 저장소 → Settings → Secrets and variables → Actions → **New repository secret**
(각 항목의 Name은 아래 대문자 그대로, Value에 발급받은 값 붙여넣기)

주의: 인스타·유튜브 계정은 "창업정보 모임"으로 올릴 계정을 기준으로 발급하세요.
자동 업로드는 처음엔 **비공개(private)** 로 올라갑니다 — 확인 후 직접 공개 전환(안전장치).

---

## A. 인스타그램 릴스 (Secrets 2개: META_ACCESS_TOKEN, IG_USER_ID)

전제: 인스타 계정이 **프로페셔널(비즈니스/크리에이터)** 이고 **페이스북 페이지에 연결**돼 있어야 합니다.
(인스타 앱 → 설정 → 계정 유형 → 프로페셔널 전환 / 페이스북 페이지 연결)

1. developers.facebook.com → 로그인 → **My Apps → Create App** → 유형 "Business".
2. 앱 대시보드에서 **Instagram** 제품 추가(또는 "Instagram Graph API").
3. 상단 **Tools → Graph API Explorer** 이동.
4. 권한(Permissions)에 다음 추가: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.
5. **Generate Access Token** → 인스타 연결된 페이스북 페이지 선택 → 토큰 복사.
   - 이 단기 토큰을 장기 토큰으로 바꾸기: 브라우저에 아래 주소를 치고(값 3개 교체) 나오는 `access_token`을 복사
     `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=앱ID&client_secret=앱시크릿&fb_exchange_token=위단기토큰`
   - → 이 값이 **META_ACCESS_TOKEN**.
6. **IG_USER_ID** 찾기: Graph API Explorer에서 `me/accounts` 조회 → 페이지 id 확인 →
   `그페이지id?fields=instagram_business_account` 조회 → 나오는 숫자 id가 **IG_USER_ID**.

넣기: Secret 2개 등록 — `META_ACCESS_TOKEN`, `IG_USER_ID`.
(장기 토큰도 약 60일마다 갱신이 필요할 수 있습니다 — 만료되면 5번만 다시.)

---

## B. 유튜브 쇼츠 (Secrets 3개: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN)

1. console.cloud.google.com → 프로젝트 생성 → **YouTube Data API v3** 사용 설정.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → 유형 "Desktop app".
   → 나오는 **Client ID = YT_CLIENT_ID**, **Client secret = YT_CLIENT_SECRET**.
3. OAuth 동의화면(consent screen)에서 본인 구글계정을 **테스트 사용자**로 추가.
4. **Refresh token** 발급(가장 쉬운 길): developers.google.com/oauthplayground 접속
   - 우측 상단 톱니 → "Use your own OAuth credentials" 체크 → 위 Client ID/Secret 입력.
   - 좌측에서 `https://www.googleapis.com/auth/youtube.upload` 선택 → Authorize → 계정 로그인·동의.
   - "Exchange authorization code for tokens" → 나오는 **Refresh token = YT_REFRESH_TOKEN**.

넣기: Secret 3개 등록 — `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.

---

## C. (선택) 결과 알림 — Secrets 2개
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 를 넣으면 게시 결과가 텔레그램으로 옵니다.

---

## 세팅 확인
- Secret 등록 후, GitHub → Actions → "창업정보 릴스 자동 게시" → **Run workflow**로 1회 테스트.
- 인스타·유튜브에 비공개로 올라오면 성공. 확인 후 공개 전환.
- 이후에는 매일 릴스가 합성될 때마다 자동으로 게시됩니다.

토큰을 넣기 전까지는 워크플로가 해당 채널을 조용히 건너뛰므로, 기존 "텔레그램 완성본 → 수동 업로드"도 그대로 병행됩니다.
