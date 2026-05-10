-- =============================================================
-- 007 - 파이프라인 7단계 재구성 + WIN/LOSE outcome 분리
--
-- 단계 변경:
--   기존 5단계: 진행대기 / 상담중 / 클로징(승인대기) / 계약완료 / 실패
--   새 7단계 : 진행대기 / 콜미팅 / 대면미팅 / 보고서 컨펌 요청 /
--              보고서 전달 / 클로징 / 후속조치(대면)
--
-- 결과는 stage 와 분리된 outcome 컬럼으로 관리:
--   outcome: 'PENDING' | 'WIN' | 'LOSE'
--
-- 가드:
--   1) REP 는 '보고서 전달' / '클로징' / '후속조치(대면)' 진입 차단
--      ('보고서 컨펌 요청' = 매니저 승인 게이트)
--   2) WIN 처리는 '후속조치(대면)' 단계에서만 가능
--   3) LOSE 는 어느 단계에서든 가능 (단계별 퍼널 분석을 위해 stage 보존)
--
-- KPI 트리거: outcome='WIN' 진입/이탈 기준 합산 (기존 stage='계약완료' 대체)
--
-- 데이터 매핑:
--   계약완료     → stage='후속조치(대면)', outcome='WIN'
--   클로징(승인대기) → stage='보고서 컨펌 요청'
--   상담중       → stage='콜미팅'
--   실패         → stage='진행대기'(단계 정보 손실), outcome='LOSE'
-- =============================================================

-- 1) outcome 컬럼 추가 ----------------------------------
alter table public.deals
  add column if not exists outcome text default 'PENDING';

alter table public.deals
  drop constraint if exists deals_outcome_check;
alter table public.deals
  add constraint deals_outcome_check check (outcome in ('PENDING','WIN','LOSE'));

-- 2) 기존 트리거 임시 제거 (데이터 매핑 시 가드 회피) -----
drop trigger if exists deals_stage_guard on public.deals;
drop trigger if exists deals_kpi_sync on public.deals;

-- 3) stage 컬럼을 enum 에서 text 로 전환 ------------------
alter table public.deals alter column stage drop default;
alter table public.deals alter column stage type text using stage::text;
alter table public.deals alter column stage set default '진행대기';

-- 4) 데이터 매핑 ----------------------------------------
-- 계약완료 → WIN + 후속조치(대면)
update public.deals
   set outcome = 'WIN',
       stage  = '후속조치(대면)'
 where stage = '계약완료';

-- 실패 → LOSE + 진행대기 (단계 정보 손실 — 매니저가 이후 수동 보정 가능)
update public.deals
   set outcome = 'LOSE',
       stage  = '진행대기'
 where stage = '실패';

-- 클로징(승인대기) → 보고서 컨펌 요청
update public.deals
   set stage = '보고서 컨펌 요청'
 where stage = '클로징(승인대기)';

-- 상담중 → 콜미팅
update public.deals
   set stage = '콜미팅'
 where stage = '상담중';

-- 5) 새 7단계 CHECK 제약 ---------------------------------
alter table public.deals
  drop constraint if exists deals_stage_check;
alter table public.deals
  add constraint deals_stage_check check (stage in (
    '진행대기',
    '콜미팅',
    '대면미팅',
    '보고서 컨펌 요청',
    '보고서 전달',
    '클로징',
    '후속조치(대면)'
  ));

-- 6) KPI 트리거 — outcome 기반 ----------------------------
create or replace function public.sync_kpi_on_deal_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_amount bigint;
begin
  -- WIN 진입
  if (tg_op = 'INSERT' and new.outcome = 'WIN')
     or (tg_op = 'UPDATE' and new.outcome = 'WIN' and (old.outcome is distinct from 'WIN')) then
    v_amount := coalesce(nullif(new.monthly_premium, 0), new.deal_value, 0);
    update public.profiles
       set current_sales = coalesce(current_sales, 0) + v_amount,
           completed_meetings = coalesce(completed_meetings, 0) + 1
     where id = new.member_id;
  end if;

  -- WIN 이탈 (롤백)
  if tg_op = 'UPDATE' and old.outcome = 'WIN' and (new.outcome is distinct from 'WIN') then
    v_amount := coalesce(nullif(old.monthly_premium, 0), old.deal_value, 0);
    update public.profiles
       set current_sales = greatest(0, coalesce(current_sales, 0) - v_amount),
           completed_meetings = greatest(0, coalesce(completed_meetings, 0) - 1)
     where id = old.member_id;
  end if;

  return new;
end;
$f$;

create trigger deals_kpi_sync
  after insert or update on public.deals
  for each row execute function public.sync_kpi_on_deal_close();

-- 7) Stage / Outcome 가드 트리거 ---------------------------
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

  -- (A) REP 매니저 승인 게이트 — '보고서 컨펌 요청' 이후 단계 진입 차단
  if (tg_op = 'UPDATE' and not is_mgr and (old.stage is distinct from new.stage)) then
    if new.stage in ('보고서 전달', '클로징', '후속조치(대면)') then
      raise exception 'REP 는 매니저 승인 후에만 % 단계로 이동할 수 있습니다 (현재: %)', new.stage, old.stage;
    end if;
  end if;

  -- (B) WIN 게이트 — '후속조치(대면)' 단계에서만 WIN 처리 가능
  if (tg_op = 'UPDATE' and new.outcome = 'WIN' and (old.outcome is distinct from 'WIN')) then
    if new.stage <> '후속조치(대면)' then
      raise exception 'WIN 처리는 "후속조치(대면)" 단계에서만 가능합니다 (현재: %)', new.stage;
    end if;
  end if;

  -- (C) last_updated 자동 갱신
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

create trigger deals_stage_guard
  before update on public.deals
  for each row execute function public.guard_deal_stage_transition();

-- 8) deal_stage enum 정리 (이제 text 컬럼이라 더 이상 안 씀) ---
drop type if exists deal_stage;

-- 9) 인덱스 보강 (퍼널 분석 쿼리용) -----------------------
create index if not exists deals_outcome_idx on public.deals(outcome);
