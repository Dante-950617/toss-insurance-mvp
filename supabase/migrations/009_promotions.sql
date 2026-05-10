-- =============================================================
-- 009 - 프로모션 시스템
--   1) deals.won_at      WIN 처리 시점 (이후 last_updated 변경되어도 보존)
--   2) promotions        프로모션 메타 + 달성 조건 (단월/누적 OR)
--   3) deal_promotions   M:N 매핑 (한 딜 ↔ 여러 프로모션, PIV율 포함)
--   4) guard_deal_stage_transition: won_at 자동 세팅 추가
-- =============================================================

-- 1) deals.won_at -----------------------------------
alter table public.deals add column if not exists won_at timestamptz;

-- 기존 WIN 딜 백필: last_updated 시점으로 (정확하진 않지만 분석용 안전값)
update public.deals
   set won_at = (last_updated::timestamptz + time '12:00:00')
 where outcome = 'WIN' and won_at is null;

-- 2) promotions -------------------------------------
create table if not exists public.promotions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'active',     -- 'draft' | 'active' | 'closed'
  description text default '',
  -- 달성 조건 (둘 중 하나라도 달성 시 인정. 0 = 미사용)
  per_month_threshold bigint default 0,
  total_threshold     bigint default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint promotions_status_check check (status in ('draft','active','closed')),
  constraint promotions_threshold_check check (per_month_threshold > 0 or total_threshold > 0),
  constraint promotions_period_check check (start_date <= end_date)
);

create index if not exists promotions_status_idx on public.promotions(status);
create index if not exists promotions_period_idx on public.promotions(start_date, end_date);

alter table public.promotions enable row level security;

drop policy if exists "promotions_select_active" on public.promotions;
create policy "promotions_select_active"
  on public.promotions for select
  using (public.is_active_user());

drop policy if exists "promotions_manager_write" on public.promotions;
create policy "promotions_manager_write"
  on public.promotions for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

drop trigger if exists promotions_touch on public.promotions;
create trigger promotions_touch before update on public.promotions
  for each row execute function public.touch_updated_at();

-- 3) deal_promotions (M:N) ------------------------------
create table if not exists public.deal_promotions (
  deal_id uuid not null references public.deals(id) on delete cascade,
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  piv_rate numeric(6,2) not null default 0,   -- 32.5 = 32.5% (0~999.99 허용)
  created_at timestamptz default now(),
  primary key (deal_id, promotion_id)
);

create index if not exists deal_promotions_promotion_idx on public.deal_promotions(promotion_id);

alter table public.deal_promotions enable row level security;

-- ACTIVE 사용자는 모든 매핑 조회 가능
drop policy if exists "deal_promotions_select_active" on public.deal_promotions;
create policy "deal_promotions_select_active"
  on public.deal_promotions for select
  using (public.is_active_user());

-- 본인 딜에 대해서만 매핑 추가/삭제 가능 (REP)
drop policy if exists "deal_promotions_owner_write" on public.deal_promotions;
create policy "deal_promotions_owner_write"
  on public.deal_promotions for all
  using (
    exists (select 1 from public.deals d where d.id = deal_id and d.member_id = auth.uid())
  )
  with check (
    exists (select 1 from public.deals d where d.id = deal_id and d.member_id = auth.uid())
  );

-- MANAGER 는 모든 매핑 권한
drop policy if exists "deal_promotions_manager_all" on public.deal_promotions;
create policy "deal_promotions_manager_all"
  on public.deal_promotions for all
  using (public.is_active_manager())
  with check (public.is_active_manager());

-- 4) won_at 자동 세팅 — guard 트리거 갱신 ----------------
create or replace function public.guard_deal_stage_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  is_mgr boolean;
begin
  is_mgr := public.is_active_manager();

  -- (A) REP 매니저 승인 게이트
  if (tg_op = 'UPDATE' and not is_mgr and (old.stage is distinct from new.stage)) then
    if new.stage in ('보고서 전달', '클로징', '후속조치(대면)') then
      raise exception 'REP 는 매니저 승인 후에만 % 단계로 이동할 수 있습니다 (현재: %)', new.stage, old.stage;
    end if;
  end if;

  -- (B) WIN 게이트
  if (tg_op = 'UPDATE' and new.outcome = 'WIN' and (old.outcome is distinct from 'WIN')) then
    if new.stage <> '후속조치(대면)' then
      raise exception 'WIN 처리는 "후속조치(대면)" 단계에서만 가능합니다 (현재: %)', new.stage;
    end if;
  end if;

  -- (C) won_at 자동 세팅 (WIN 진입/이탈)
  if (tg_op = 'INSERT' and new.outcome = 'WIN') then
    new.won_at := now();
  end if;
  if (tg_op = 'UPDATE' and new.outcome = 'WIN' and (old.outcome is distinct from 'WIN')) then
    new.won_at := now();
  end if;
  if (tg_op = 'UPDATE' and old.outcome = 'WIN' and (new.outcome is distinct from 'WIN')) then
    new.won_at := null;
  end if;

  -- (D) last_updated 자동 갱신
  if tg_op = 'UPDATE' and (
       new.stage is distinct from old.stage
       or new.outcome is distinct from old.outcome
       or new.reason is distinct from old.reason
       or new.monthly_premium is distinct from old.monthly_premium
       or new.manager_comment is distinct from old.manager_comment) then
    new.last_updated := current_date;
  end if;

  return new;
end;
$f$;

-- 트리거를 INSERT 도 포함하도록 재생성
drop trigger if exists deals_stage_guard on public.deals;
create trigger deals_stage_guard before insert or update on public.deals
  for each row execute function public.guard_deal_stage_transition();
