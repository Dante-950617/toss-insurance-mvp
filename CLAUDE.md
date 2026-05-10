# CLAUDE.md — 프로젝트 컨텍스트 (다음 세션용)

> 이 파일은 새 Claude 세션이 프로젝트를 5초 안에 파악하도록 돕는 메모입니다.

## 한 줄 요약
보험설계사용 토스 스타일 영업 관리 SaaS. Next.js 14 + Supabase + Vercel.
현재 운영 중: **https://toss-insurance-mvp.vercel.app**

## 더미 계정 (개발/테스트용)
- `rep1@dummy.com` / pw `demo1234` — 김지원 (시니어 REP)
- `rep2@dummy.com` / pw `demo1234` — 이현주 (미들 REP)
- `rep3@dummy.com` / pw `demo1234` — 박민수 (신입 REP)
- 매니저는 본인 계정 (toolark7@gmail.com)
- 더미 데이터 전체 시드: `supabase/seed/dummy_data.sql` (또는 part_a~d 분할 파일)
- 데이터 셋업 내역: 딜 12개 (다양한 단계/결과/카테고리), 활동 36개,
  태스크 6개, 인사 8개, 프로모션 3개 (Q2 활성 + 신입 캠페인 + 종료된 것)

## 로고
- `/public/logo.svg` (Toss 스타일 파란 sphere SVG)
- 실제 PNG 원하면 같은 경로에 `logo.svg` 교체 (NavBar 의 `<img src="/logo.svg" />`)

## 인프라

| 항목 | 정보 |
|---|---|
| 코드 | https://github.com/Dante-950617/toss-insurance-mvp |
| 배포 | Vercel — main 브랜치 푸시 시 자동 재배포 |
| DB/Auth | Supabase 프로젝트 `rnrzhtfxuhninmyvikiz` (Singapore region, Free tier) |
| 인증 방식 | 이메일/비밀번호 (Google OAuth 아님 — 의도적으로 단순화) |
| 이메일 인증 | OFF (관리자 승인 플로우로 대체) |

## 기술 스택
- Next.js 14 App Router (TypeScript, no src dir)
- Tailwind v3
- Supabase: `@supabase/ssr` + `@supabase/supabase-js`
- lucide-react 아이콘
- Pretendard 폰트 (CDN)

## 폴더 구조
```
app/
  (app)/                # 인증 필요 라우트
    layout.tsx          # 세션 가드 + NavBar + ToastProvider
    dashboard/page.tsx  # KPI 역산 + 자동 할 일 위젯
    pipeline/page.tsx   # 칸반 + 딜 CRUD + 활동 타임라인
    manager/page.tsx    # MANAGER 전용 KPI/사용자 관리
    calendar/page.tsx   # 컨택 예정일 캘린더
    leaderboard/page.tsx # 활동량/실적 리더보드
    analytics/page.tsx  # MANAGER: 드롭사유/활동분포
    scripts/page.tsx    # 영업 스크립트 라이브러리
  auth/{callback,signout}/route.ts
  login/page.tsx        # 이메일/비번 + 가입 폼
  pending/page.tsx      # PENDING/INACTIVE 안내
  layout.tsx, page.tsx, globals.css
components/             # *Client.tsx 가 인터랙티브 클라이언트 컴포넌트
lib/
  auth.ts              # getCurrentProfile (React cache)
  actions.ts           # 모든 Server Actions (CRUD)
  types.ts             # Profile, Deal, Task, ... 인터페이스
  utils.ts             # KPI 계산, CSV export, 날짜 유틸
  supabase/{client,server,middleware}.ts
middleware.ts          # 세션 + 상태별 라우트 가드
supabase/migrations/   # SQL 마이그레이션 (003 까지 적용됨)
```

## DB 스키마 핵심
- `profiles` — auth.users 1:1, role(MANAGER/REP) + status(PENDING/ACTIVE/INACTIVE) + KPI + 보험설계사 정보
- `team_settings` — 싱글톤 (id=1)
- `deals` — 영업 파이프라인 카드 + 고객 상세 정보 (생년월일/가족/직업 등)
- `deal_activities` — 활동 타임라인 (11개 타입)
- `tasks` — 개인 할 일
- `member_invitations` — MANAGER 가 미리 등록하는 팀원 초대
- `sales_scripts` — 영업 스크립트 라이브러리

### 핵심 트리거
- `handle_new_user`: 신규 가입 시 profiles 자동 생성. **첫 사용자는 MANAGER+ACTIVE 부트스트랩**, 초대된 이메일은 즉시 ACTIVE+REP, 그 외 PENDING+REP
- `sync_kpi_on_deal_close`: 딜이 계약완료 → profiles.current_sales/completed_meetings 자동 누적, 롤백 시 차감
- `protect_last_manager`: 마지막 ACTIVE MANAGER 의 권한/상태 변경 차단
- `guard_deal_stage_transition`: REP 가 '계약완료' 직접 이동 차단 (클로징 승인대기 → MANAGER 승인 강제)

### RLS
- 모든 테이블 RLS 활성화
- 헬퍼 함수: `is_active_manager()`, `is_active_user()`
- REP 는 본인 deal 만 INSERT/UPDATE/DELETE

## 코드 규약
- **Server Component** 가 데이터 fetch → **Client Component (`*Client.tsx`)** 로 props 전달
- Mutation 은 모두 `lib/actions.ts` 의 Server Actions 통해서만
- Optimistic UI: useState + startTransition 패턴
- 토스트 알림: `useToast()` (ToastProvider 컨텍스트)
- 컬러 팔레트: `#3182F6` (blue), `#191F28` (text), `#4E5968` (sub), `#8B95A1` (muted), `#F2F4F6` (bg)
- 둥근 모서리: `rounded-[16px]` ~ `rounded-[24px]`
- 컨테이너 너비: `max-w-screen-2xl`

## 인증/권한 흐름
1. 미들웨어가 세션 체크 + 상태별 라우트 가드 (PENDING → /pending)
2. `(app)/layout.tsx` 가 `getCurrentProfile()` 로 한 번 fetch (React `cache()` 로 dedup)
3. 페이지에서 다시 `getCurrentProfile()` 호출해도 cache hit (라운드트립 0)
4. MANAGER 전용 페이지는 자체적으로 role 체크 + redirect

## 현재까지 완료된 것 (Wave 정리)
- **Wave A**: tel: 링크, 카톡 번호 복사, 카드 마지막 활동, 검색 normalize, 할일→딜 모달 직접 열기
- **Wave B**: 마이그레이션 003 (고객상세 7필드 + 활동타입 11종 + 자격증)
- **Wave C**: 활동 타임라인 모달 위로, 고객 상세 collapsible, 인라인 승인 버튼
- **Wave D**: 캘린더/리더보드/분석 페이지, CSV export
- **Wave E**: 스크립트 라이브러리, 자격증 필드 UI
- **Perf 1차**: getCurrentProfile cache helper, Promise.all 병렬화 모든 페이지, middleware status fetch 1회로

## 남아있는 작업

### 알림 시스템 (보류)
README.md "7. 알림 셋업 가이드" 참고. Supabase pg_cron + Edge Function 또는 외부 cron 으로 매일 아침 발송. 구현 시 알아야 할 것:
- 다음 컨택 예정일 D-1 인 딜 → 영업맨에게
- 새 클로징(승인대기) → 매니저에게
- 자격증 만료 D-30 → 매니저에게

### Perf 2차 (옵션)
- 데이터 보존 기간 제한 (최근 90일 / 1년만 fetch — 사용자가 1차에서 명시적으로 보류 요청함)
- React Suspense 로 layout/page 병렬 렌더링
- `unstable_cache` 로 자주 안 바뀌는 데이터 캐싱 (sales_scripts, team_settings)

### UX 미세 조정 거리
- 자격증 만료 D-30 임박 시 매니저 테이블에 빨간 경고 배지
- 단계별 모달 필드 강조 차등 (현재는 모든 필드 항상 표시)
- 모바일 카드 정보 위계 재정렬 (이름 + D-N 다음컨택 강조)
- 검색에 한글 초성 검색 추가
- 음성 입력 마이크 버튼 (모바일 활동 기록)

## 자주 하는 일

### 새 마이그레이션 적용
1. `supabase/migrations/00X_*.sql` 작성
2. Supabase 대시보드 SQL Editor 에 붙여넣고 Run
3. `lib/types.ts` 업데이트
4. 빌드 → 푸시

### 새 페이지 추가
1. `app/(app)/<route>/page.tsx` (Server Component, dynamic = 'force-dynamic')
2. `getCurrentProfile()` + `Promise.all` 패턴
3. `components/<Name>Client.tsx` (Client Component)
4. `components/NavBar.tsx` 의 tabs 배열에 추가

### 빌드 검증
```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
npx next build
```
(env 채워서 빌드만 검증 — 실제 .env.local 의 값 노출 방지)

## 주의사항
- 사용자는 한국어 영업 매니저 (Dante-950617) — 답변은 한국어, 간결하게
- 보안상 비밀번호/계정 생성/Vercel 배포 직접 클릭은 사용자 직접 (Claude 가 대신 못 함)
- Supabase 자동화(SQL editor)는 가능 — chrome MCP 로 진행
- 코드 변경 후 항상 빌드 검증 → git push (Vercel 자동 재배포)
- `force-dynamic` 페이지가 cookies 사용으로 자동 dynamic 이라 redundant 이지만 명시적으로 유지
