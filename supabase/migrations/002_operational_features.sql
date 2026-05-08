-- =============================================================
-- 002 - 영업 운영 기능 보강
--   1) deals 추가 컬럼 (deal_value, phone, next_contact_date, notes, referrer)
--   2) deal_activities 활동 타임라인
--   3) tasks 개인 할 일
--   4) member_invitations 팀원 초대
--   5) handle_new_user 갱신: 초대된 이메일은 즉시 ACTIVE+REP
--   6) 자동 KPI 반영 (계약완료 시 current_sales/completed_meetings)
--   7) 마지막 ACTIVE MANAGER 보호 트리거
-- =============================================================

-- 1) deals 컬럼 추가 -----------------------------------
alter table public.deals add column if not exists deal_value bigint default 0;
alter table public.deals add column if not exists phone text default '';
alter table public.deals add column if not exists next_contact_date date;
alter table public.deals add column if not exists notes text default '';
alter table public.deals add column if not exists referrer text default '';

-- 2) deal_activities -----------------------------------
create table if not exists public.deal_activities (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null check (activity_type in ('call','meeting','proposal','note','other')),
  content text not null,
  created_at timestamptz default now()
);

create index if not exists deal_activities_deal_idx on public.deal_activities(deal_id, created_at desc);

alter table public.deal_activities enable row level security;

drop policy if exists "deal_activities_select_active" on public.deal_activities;
create policy "deal_activities_select_active"
  on public.deal_activities for select
  using (public.is_active_user());

drop policy if exists "deal_activities_insert_self" on public.deal_activities;
create policy "deal_activities_insert_self"
  on public.deal_activities for insert
  with check (public.is_active_user() and author_id = auth.uid());

drop policy if exists "deal_activities_delete_self_or_manager" on public.deal_activities;
create policy "deal_activities_delete_self_or_manager"
  on public.deal_activities for delete
  using (author_id = auth.uid() or public.is_active_manager());

-- 3) tasks ---------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  title text not null,
  due_date date,
  done boolean default false,
  created_at timestamptz default now()
);

create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);

alter table public.tasks enable row level security;

drop policy if exists "tasks_owner_all" on public.tasks;
create policy "tasks_owner_all"
  on public.tasks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "tasks_manager_view" on public.tasks;
create policy "tasks_manager_view"
  on public.tasks for select
  using (public.is_active_manager());

-- 4) member_invitations --------------------------------
create table if not exists public.member_invitations (
  email text primary key,
  invited_by uuid references public.profiles(id) on delete set null,
  name text not null,
  target_sales bigint default 10000000,
  conversion_rate int default 10,
  lead_time int default 7,
  invited_at timestamptz default now()
);

alter table public.member_invitations enable row level security;

drop policy if exists "invitations_manager_all" on public.member_invitations;
create policy "invitations_manager_all"
  on public.member_invitations for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

-- 5) handle_new_user 갱신: 초대 이메일은 즉시 활성화 ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  is_first_user boolean;
  invite record;
begin
  -- 초대 확인 (대소문자 무시)
  select * into invite from public.member_invitations
  where lower(email) = lower(new.email);

  if found then
    insert into public.profiles (id, email, name, role, status, target_sales, conversion_rate, lead_time)
    values (
      new.id, new.email, invite.name,
      'REP'::user_role, 'ACTIVE'::user_status,
      invite.target_sales, invite.conversion_rate, invite.lead_time
    );
    delete from public.member_invitations where lower(email) = lower(new.email);
    return new;
  end if;

  -- 초대가 없으면 기존 부트스트랩 로직
  select count(*) = 0 into is_first_user from public.profiles;
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when is_first_user then 'MANAGER'::user_role else 'REP'::user_role end,
    case when is_first_user then 'ACTIVE'::user_status else 'PENDING'::user_status end
  );
  return new;
end;
$f$;

-- 6) 자동 KPI 반영 -------------------------------------
create or replace function public.sync_kpi_on_deal_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  if (tg_op = 'INSERT' and new.stage = '계약완료')
     or (tg_op = 'UPDATE' and new.stage = '계약완료' and (old.stage is distinct from '계약완료')) then
    update public.profiles
    set current_sales = coalesce(current_sales, 0) + coalesce(new.deal_value, 0),
        completed_meetings = coalesce(completed_meetings, 0) + 1
    where id = new.member_id;
  end if;

  if tg_op = 'UPDATE' and old.stage = '계약완료' and (new.stage is distinct from '계약완료') then
    update public.profiles
    set current_sales = greatest(0, coalesce(current_sales, 0) - coalesce(old.deal_value, 0)),
        completed_meetings = greatest(0, coalesce(completed_meetings, 0) - 1)
    where id = old.member_id;
  end if;

  return new;
end;
$f$;

drop trigger if exists deals_kpi_sync on public.deals;
create trigger deals_kpi_sync
  after insert or update on public.deals
  for each row execute function public.sync_kpi_on_deal_close();

-- 7) 마지막 ACTIVE MANAGER 보호 ------------------------
create or replace function public.protect_last_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  active_manager_count int;
begin
  if (old.role = 'MANAGER' and old.status = 'ACTIVE')
     and (new.role <> 'MANAGER' or new.status <> 'ACTIVE') then
    select count(*) into active_manager_count
    from public.profiles
    where role = 'MANAGER' and status = 'ACTIVE' and id <> old.id;

    if active_manager_count = 0 then
      raise exception '마지막 활성 관리자입니다. 다른 관리자를 먼저 지정하세요.';
    end if;
  end if;
  return new;
end;
$f$;

drop trigger if exists protect_last_manager_trigger on public.profiles;
create trigger protect_last_manager_trigger
  before update on public.profiles
  for each row execute function public.protect_last_manager();
