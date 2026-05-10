-- =============================================================
-- 004 - 딜 모달 슬림화 (영업 핵심 5필드 도입)
--   1) deals 추가 컬럼
--      - category / category_custom            (카테고리)
--      - annual_premium                        (연납 기준액 — KPI 합산 기준)
--      - renewal_type                          (갱신 여부)
--      - maturity_type / maturity_custom       (만기 구분)
--   2) sync_kpi_on_deal_close 트리거를 annual_premium 기준으로 갱신
--      (annual_premium 0 일 때만 기존 deal_value 로 fallback — 데이터 호환)
--   ※ product_type / competitor / deal_value 는 UI 에서 제거하지만
--      DB 컬럼은 유지 (기존 데이터 보호 + 추후 분석 가능성)
-- =============================================================

-- 1) deals 추가 컬럼 -----------------------------------
alter table public.deals add column if not exists category text default '';
alter table public.deals add column if not exists category_custom text default '';
alter table public.deals add column if not exists annual_premium bigint default 0;
alter table public.deals add column if not exists renewal_type text default '';
alter table public.deals add column if not exists maturity_type text default '';
alter table public.deals add column if not exists maturity_custom text default '';

-- 2) KPI 트리거 갱신: annual_premium → fallback deal_value -------
create or replace function public.sync_kpi_on_deal_close()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_close_amount bigint;
  v_open_amount bigint;
begin
  if (tg_op = 'INSERT' and new.stage = '계약완료')
     or (tg_op = 'UPDATE' and new.stage = '계약완료' and (old.stage is distinct from '계약완료')) then
    v_close_amount := coalesce(nullif(new.annual_premium, 0), new.deal_value, 0);
    update public.profiles
    set current_sales = coalesce(current_sales, 0) + v_close_amount,
        completed_meetings = coalesce(completed_meetings, 0) + 1
    where id = new.member_id;
  end if;

  if tg_op = 'UPDATE' and old.stage = '계약완료' and (new.stage is distinct from '계약완료') then
    v_open_amount := coalesce(nullif(old.annual_premium, 0), old.deal_value, 0);
    update public.profiles
    set current_sales = greatest(0, coalesce(current_sales, 0) - v_open_amount),
        completed_meetings = greatest(0, coalesce(completed_meetings, 0) - 1)
    where id = old.member_id;
  end if;

  return new;
end;
$f$;
-- (트리거 자체는 002 에서 생성된 deals_kpi_sync 가 함수만 새로 가리키므로 재생성 불필요)
