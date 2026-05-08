# Toss Insurance — 영업 관리 MVP

영업 담당자(REP)와 지점장(MANAGER)을 위한 토스 스타일 CRM 대시보드.
Next.js 14 (App Router) + Tailwind + Supabase(Postgres + Auth + RLS) + Vercel.

**인증**: 이메일/비밀번호 (Google OAuth 등 외부 IdP 의존성 없음)

---

## 1. 사전 준비 (사용자가 직접 해야 하는 작업)

보안상 Claude/AI가 대신 할 수 없는 부분이므로 직접 진행하세요.

### 1-1. Supabase 프로젝트 생성

1. https://supabase.com 접속 → 로그인 → **New Project**
2. 비밀번호 설정 (DB password) — 안전한 곳에 저장
3. 리전: **Northeast Asia (Seoul)** 권장
4. 생성 완료까지 약 1~2분 대기

### 1-2. SQL 스키마 적용

1. Supabase 대시보드 → **SQL Editor** → **New query**
2. 본 저장소의 [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql) 내용을 전체 복사 → 붙여넣기 → **Run**
3. 에러 없이 `Success. No rows returned` 확인

### 1-3. 이메일 인증 끄기 (권장)

승인 플로우(PENDING → ACTIVE)가 이미 있으므로 별도 이메일 인증은 불필요합니다.

1. Supabase 대시보드 → **Authentication** → **Providers** → **Email** (또는 좌측 **Authentication > Sign In / Up** 화면)
2. **Confirm email** 토글을 **OFF** 로 변경 → Save

> 켜두고 싶다면 그대로 둬도 됩니다. 가입 후 이메일에 도착하는 인증 링크를 클릭해야 첫 로그인이 가능해집니다.

### 1-4. Site URL 등록 (배포 후 필수)

Supabase → **Authentication** → **URL Configuration**

- **Site URL**: 운영 도메인 (예: `https://toss-insurance.vercel.app`)
- **Redirect URLs**:
  ```
  http://localhost:3000/auth/callback
  https://toss-insurance.vercel.app/auth/callback
  ```

---

## 2. 로컬 실행

```bash
# 1) 환경 변수 파일 생성
cp .env.local.example .env.local

# 2) .env.local 편집
#   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000
#  → URL/anon key 는 Supabase 대시보드 > Settings > API 에서 복사

# 3) 서버 실행
npm run dev
```

`http://localhost:3000` 접속 → 회원가입(첫 사용자) → 로그인.

> **⚠️ 첫 가입자가 자동으로 MANAGER + ACTIVE 상태가 됩니다.**
> 이후 가입자는 PENDING + REP 로 들어와 첫 사용자(지점장)가 승인해야 합니다.

---

## 3. Vercel 배포 (외부 접근)

### 3-1. GitHub Push

```bash
cd toss-insurance-mvp
git init
git add .
git commit -m "init: toss insurance MVP"
gh repo create toss-insurance-mvp --private --source=. --push
# 또는 GitHub 웹에서 repo 만들고 push
```

### 3-2. Vercel 연동

1. https://vercel.com → **Add New Project**
2. GitHub repo 선택 → **Import**
3. **Environment Variables** 에 3개 등록:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://YOUR_VERCEL_DOMAIN.vercel.app` (도메인은 1차 deploy 후 확정됨 — 일단 빈 값으로 두고 deploy 후 다시 채워서 redeploy 해도 OK)
4. **Deploy**
5. 배포 완료 후 도메인 받으면:
   - `NEXT_PUBLIC_SITE_URL` 환경변수 갱신 → **Redeploy**
   - Supabase **Authentication > URL Configuration** 에 Vercel 도메인을 Site URL/Redirect URL 로 추가

---

## 4. 권한 모델 (DB 레벨에서 강제됨)

| 역할 | 자기 KPI 보기 | 팀원 KPI 보기 | 딜 자기 작성 | 딜 자기 수정 | 모든 딜 보기 | 모든 딜 수정 | 팀 KPI 수정 | 사용자 승인/회수 |
|---|---|---|---|---|---|---|---|---|
| REP | ✅ | ✅ (이름·실적만) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| MANAGER | ✅ | ✅ (전체) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 핵심 RLS / 트리거
- **deals**: REP 는 자기 deal 만 INSERT/UPDATE/DELETE 가능 (`member_id = auth.uid()`).
- **stage 가드**: REP 는 `계약완료` 로 직접 이동 불가 → DB 트리거가 차단. 클로징은 반드시 `클로징(승인대기)` → MANAGER 승인.
- **profiles**: MANAGER 만 `role`/`status` 수정 가능. 본인의 role/status 자가 변경은 트리거로 차단.
- **status='INACTIVE'**: 미들웨어가 `/pending` 으로 강제 리다이렉트 — 데이터는 보존(Soft Delete).
- **last_updated**: deal 변경 시 트리거가 자동 갱신 → 칸반 체류일 모니터링.

---

## 5. 폴더 구조

```
toss-insurance-mvp/
├─ app/
│  ├─ (app)/                    # 인증 필요 라우트 (layout 에서 가드)
│  │  ├─ dashboard/page.tsx     # KPI 역산 대시보드
│  │  ├─ pipeline/page.tsx      # 칸반 + 딜 CRUD
│  │  └─ manager/page.tsx       # MANAGER 전용 KPI/사용자 관리
│  ├─ auth/
│  │  ├─ callback/route.ts      # OAuth code → 세션 교환
│  │  └─ signout/route.ts
│  ├─ login/page.tsx            # Google 로그인 단일 진입
│  ├─ pending/page.tsx          # PENDING/INACTIVE 안내
│  └─ layout.tsx
├─ components/                  # *Client.tsx = 인터랙티브 UI
├─ lib/
│  ├─ supabase/                 # browser/server/middleware 클라이언트
│  ├─ actions.ts                # 서버 액션 (모든 mutation)
│  ├─ types.ts
│  └─ utils.ts                  # KPI 역산, 체류일 계산 등
├─ middleware.ts                # 세션 체크 + 상태별 라우트 가드
└─ supabase/migrations/         # SQL 스키마
```

---

## 6. 자주 묻는 트러블슈팅

**Q. 로그인 후 무한 리다이렉트가 발생함**
A. Supabase **Site URL** 과 **Redirect URLs** 에 `https://your-domain/auth/callback` 가 등록되어 있는지 확인.

**Q. 첫 사용자가 MANAGER 가 아닌 REP/PENDING 으로 들어왔음**
A. `handle_new_user()` 트리거는 `profiles` 테이블이 비어있을 때만 첫 사용자를 MANAGER로 부트스트랩합니다. 이미 다른 사용자가 있다면 SQL Editor 에서 본인 row 의 `role`/`status` 를 직접 수정하세요:
```sql
update profiles set role='MANAGER', status='ACTIVE' where email='YOUR_EMAIL';
```

**Q. 권한 회수했는데 그 사용자가 계속 접속됨**
A. 활성 세션 무효화는 미들웨어가 다음 요청에서 `/pending` 으로 보냅니다. 즉시 로그아웃까지 강제하려면 Supabase Auth > Users > 해당 유저 → 우측 메뉴에서 세션 강제 만료.

---

## 7. 알림(이메일/푸시) 셋업 가이드

이메일/카톡 알림은 별도 셋업이 필요합니다. 두 가지 방법:

### 옵션 A. Supabase pg_cron + Edge Function (권장)
1. Supabase 대시보드 → **Database > Extensions** → `pg_cron` 활성화
2. **Edge Functions** 에서 `daily-notifications` 함수 작성 (이메일 발송 SMTP 또는 Slack/Kakao webhook 호출)
3. SQL Editor 에서 cron 등록:
   ```sql
   select cron.schedule(
     'daily-contact-reminders',
     '0 0 * * *',  -- 매일 오전 9시 (UTC 0시 = KST 9시)
     $$ select net.http_post('https://YOUR_PROJECT.supabase.co/functions/v1/daily-notifications', '{}', '{}', '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb) $$
   );
   ```

### 옵션 B. 외부 cron 서비스 (간단)
- [cron-job.org](https://cron-job.org) 또는 GitHub Actions schedule 로 매일 한 번 우리 사이트의 알림 endpoint 호출
- Next.js 에서 `/api/notify` route handler 작성하고, 이 안에서 다음 컨택일이 D-1 인 딜들 조회 → 메일/슬랙 발송

### 발송 대상 추천
- 영업맨: 다음 컨택 예정일 = 오늘 인 딜 목록
- 매니저: 새로 들어온 클로징(승인대기) 딜 목록
- 매니저: 자격증 만료 D-30 인 팀원 명단
