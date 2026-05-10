-- =============================================================
-- 008 - 인사 (recruits) 테이블
--   * 데려오고 싶은 지인 / 지원자 인적사항 리스트
--   * REP 본인 리스트 관리, MANAGER 는 전체 조회
-- =============================================================

create table if not exists public.recruits (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'acquaintance', -- 'acquaintance' | 'applicant'
  name text not null,
  age int,
  gender text default '',     -- 'M' | 'F' | ''
  referrer text default '',
  memo text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint recruits_kind_check check (kind in ('acquaintance','applicant')),
  constraint recruits_gender_check check (gender in ('M','F',''))
);

create index if not exists recruits_owner_idx on public.recruits(owner_id, created_at desc);
create index if not exists recruits_kind_idx on public.recruits(kind);

alter table public.recruits enable row level security;

-- 본인 행: 모든 권한
drop policy if exists "recruits_owner_all" on public.recruits;
create policy "recruits_owner_all"
  on public.recruits for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- MANAGER 는 전체 조회 (코칭/관리 목적)
drop policy if exists "recruits_manager_select" on public.recruits;
create policy "recruits_manager_select"
  on public.recruits for select
  using (public.is_active_manager());

-- updated_at 자동 갱신
drop trigger if exists recruits_touch on public.recruits;
create trigger recruits_touch before update on public.recruits
  for each row execute function public.touch_updated_at();
