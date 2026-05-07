-- =============================================================
-- Toss Insurance Sales Management - Initial Schema
-- 역할: MANAGER (지점장), REP (실무자)
-- 계정 상태: ACTIVE / INACTIVE / PENDING (Soft Delete 정책)
-- =============================================================

create extension if not exists "uuid-ossp";

-- -----------------------------
-- enums
-- -----------------------------
create type user_role as enum ('MANAGER', 'REP');
create type user_status as enum ('PENDING', 'ACTIVE', 'INACTIVE');
create type deal_stage as enum ('진행대기', '상담중', '클로징(승인대기)', '계약완료', '실패');

-- -----------------------------
-- profiles (auth.users 1:1 확장)
-- -----------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role user_role not null default 'REP',
  status user_status not null default 'PENDING',
  -- 개인 KPI (REP 전용; MANAGER는 NULL 허용)
  target_sales bigint default 10000000,
  current_sales bigint default 0,
  last_month_sales bigint default 0,
  avg_deal_size bigint default 500000,
  conversion_rate int default 10,
  last_month_conversion int default 10,
  lead_time int default 7,
  completed_meetings int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index profiles_role_idx on public.profiles(role);
create index profiles_status_idx on public.profiles(status);

-- -----------------------------
-- team_settings (싱글톤: id=1만 존재)
-- -----------------------------
create table public.team_settings (
  id int primary key default 1,
  target_sales bigint not null default 40000000,
  avg_deal_size bigint not null default 500000,
  conversion_rate int not null default 15,
  lead_time int not null default 7,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into public.team_settings (id) values (1) on conflict do nothing;

-- -----------------------------
-- deals (영업 파이프라인 카드)
-- -----------------------------
create table public.deals (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  customer_name text not null,
  stage deal_stage not null default '진행대기',
  reason text default '',
  product_type text default '',
  monthly_premium bigint default 0,
  competitor text default '',
  manager_comment text default '',
  date date not null default current_date,
  last_updated date not null default current_date,
  created_at timestamptz default now()
);

create index deals_member_idx on public.deals(member_id);
create index deals_stage_idx on public.deals(stage);
create index deals_last_updated_idx on public.deals(last_updated);

-- -----------------------------
-- 신규 가입 시 자동으로 profiles 레코드 생성
-- 첫 사용자만 자동 ACTIVE+MANAGER로 부트스트랩 (관리자 본인 계정)
-- 이후 가입자는 PENDING + REP로 들어와 관리자 승인 필요
-- -----------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select count(*) = 0 into is_first_user from public.profiles;

  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when is_first_user then 'MANAGER'::user_role else 'REP'::user_role end,
    case when is_first_user then 'ACTIVE'::user_status else 'PENDING'::user_status end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------
-- RLS: Row Level Security
-- -----------------------------
alter table public.profiles enable row level security;
alter table public.team_settings enable row level security;
alter table public.deals enable row level security;

-- Helper: 현재 사용자가 ACTIVE MANAGER 인지
create or replace function public.is_active_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'MANAGER' and status = 'ACTIVE'
  );
$$;

-- Helper: 현재 사용자가 ACTIVE 인지 (MANAGER 또는 REP)
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'ACTIVE'
  );
$$;

-- ----- profiles 정책 -----
-- 본인 행은 항상 조회 가능 (PENDING/INACTIVE도 자기 상태 확인용)
create policy "profiles_select_self"
  on public.profiles for select
  using (id = auth.uid());

-- ACTIVE 사용자는 다른 ACTIVE 사용자의 기본 정보 조회 가능
create policy "profiles_select_active_peers"
  on public.profiles for select
  using (public.is_active_user());

-- 본인 행 update 가능하지만 role/status는 변경 불가 (트리거로 차단)
create policy "profiles_update_self_basic"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- MANAGER는 모든 profiles 수정 가능 (KPI 세팅, 상태 변경)
create policy "profiles_manager_all"
  on public.profiles for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

-- 본인은 role/status를 직접 수정할 수 없게 트리거로 차단
create or replace function public.prevent_self_role_status_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.uid() = old.id and not public.is_active_manager() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'role/status 변경 권한이 없습니다';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.prevent_self_role_status_change();

-- ----- team_settings 정책 -----
create policy "team_settings_read_active"
  on public.team_settings for select
  using (public.is_active_user());

create policy "team_settings_manager_write"
  on public.team_settings for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

-- ----- deals 정책 -----
-- ACTIVE 사용자는 모든 deals 조회 가능 (팀 가시성)
create policy "deals_select_active"
  on public.deals for select
  using (public.is_active_user());

-- REP: 본인 deals 만 insert/update/delete 가능
create policy "deals_rep_insert_own"
  on public.deals for insert
  with check (
    public.is_active_user()
    and member_id = auth.uid()
  );

create policy "deals_rep_update_own"
  on public.deals for update
  using (
    public.is_active_user()
    and member_id = auth.uid()
  )
  with check (
    public.is_active_user()
    and member_id = auth.uid()
  );

create policy "deals_rep_delete_own"
  on public.deals for delete
  using (
    public.is_active_user()
    and member_id = auth.uid()
  );

-- MANAGER: 모든 deals 권한 (insert/update/delete 전부)
create policy "deals_manager_all"
  on public.deals for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

-- REP가 deals.stage 를 직접 '계약완료'로 못 바꾸게 차단 (승인 플로우 강제)
create or replace function public.guard_deal_stage_transition()
returns trigger
language plpgsql
security definer
as $$
declare
  is_mgr boolean;
begin
  is_mgr := public.is_active_manager();

  if not is_mgr then
    -- REP는 '계약완료'로 직접 이동 금지
    if new.stage = '계약완료' and (old.stage is distinct from '계약완료') then
      raise exception 'REP는 계약완료를 직접 처리할 수 없습니다. 클로징(승인대기)로 요청하세요';
    end if;
  end if;

  -- last_updated 자동 갱신 (stage 또는 reason/comment 변경 시)
  if new.stage is distinct from old.stage
     or new.reason is distinct from old.reason
     or new.product_type is distinct from old.product_type
     or new.monthly_premium is distinct from old.monthly_premium
     or new.competitor is distinct from old.competitor
     or new.manager_comment is distinct from old.manager_comment then
    new.last_updated := current_date;
  end if;

  return new;
end;
$$;

drop trigger if exists deals_stage_guard on public.deals;
create trigger deals_stage_guard
  before update on public.deals
  for each row execute function public.guard_deal_stage_transition();

-- -----------------------------
-- updated_at 자동 갱신 (profiles, team_settings)
-- -----------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger team_settings_touch before update on public.team_settings
  for each row execute function public.touch_updated_at();
