-- =============================================================
-- 003 - 영업 심화 데이터
--   1) deals: 고객 상세 정보 (생년월일/성별/가족/직업/소득/보유보험/관심상품)
--   2) deal_activities: activity_type 확장 (영업 의미 명확화)
--   3) profiles: 자격증/위촉/입사일 (보험설계사 정보)
--   4) sales_scripts: 회사 운영 스크립트 라이브러리
-- =============================================================

-- 1) deals 추가 컬럼 -----------------------------------
alter table public.deals add column if not exists customer_birth_date date;
alter table public.deals add column if not exists customer_gender text;
alter table public.deals add column if not exists family_info text default '';
alter table public.deals add column if not exists occupation text default '';
alter table public.deals add column if not exists income_range text default '';
alter table public.deals add column if not exists existing_insurance text default '';
alter table public.deals add column if not exists interest_keywords text default '';

-- 2) activity_type CHECK 제약 갱신 (영업적 의미 명확)
alter table public.deal_activities drop constraint if exists deal_activities_activity_type_check;
alter table public.deal_activities add constraint deal_activities_activity_type_check
  check (activity_type in (
    'call_attempt',   -- 통화 시도 (수신 안 함)
    'call_success',   -- 통화 (대화 성공)
    'kakao_send',     -- 카톡 발송
    'meeting_set',    -- 미팅 약속
    'meeting_done',   -- 미팅 진행
    'proposal_sent',  -- 가입설계서 발송
    'review_request', -- 검토 요청
    'callback_set',   -- 재통화 약속
    'on_hold',        -- 보류
    'note',           -- 메모
    'other',          -- 기타
    -- 하위호환 (기존 데이터)
    'call', 'meeting', 'proposal'
  ));

-- 3) profiles 추가 컬럼 (보험설계사 정보) ------------
alter table public.profiles add column if not exists license_type text default '';
alter table public.profiles add column if not exists license_number text default '';
alter table public.profiles add column if not exists license_expiry date;
alter table public.profiles add column if not exists hire_date date;
alter table public.profiles add column if not exists phone text default '';

-- 4) sales_scripts: 영업 스크립트 라이브러리 -----------
create table if not exists public.sales_scripts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text default 'general',  -- e.g. opening, objection, closing
  content text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sales_scripts_category_idx on public.sales_scripts(category);

alter table public.sales_scripts enable row level security;

drop policy if exists "scripts_select_active" on public.sales_scripts;
create policy "scripts_select_active"
  on public.sales_scripts for select
  using (public.is_active_user());

drop policy if exists "scripts_manager_write" on public.sales_scripts;
create policy "scripts_manager_write"
  on public.sales_scripts for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

create trigger sales_scripts_touch before update on public.sales_scripts
  for each row execute function public.touch_updated_at();
