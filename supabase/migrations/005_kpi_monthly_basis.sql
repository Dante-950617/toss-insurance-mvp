-- =============================================================
-- 005 - KPI 합산 기준을 월납입 예정액(monthly_premium) 으로 전환
--   * 004 에서 annual_premium 으로 잡았으나, 실제 운영에서는
--     월납으로 보는 게 맞다는 결정.
--   * annual_premium 컬럼은 DB 에 남겨두지만 UI/트리거에서 미사용.
--   * 신규 데이터: monthly_premium 으로 합산
--     레거시 데이터: monthly_premium=0 인 경우 deal_value 로 fallback
-- =============================================================

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
    v_close_amount := coalesce(nullif(new.monthly_premium, 0), new.deal_value, 0);
    update public.profiles
    set current_sales = coalesce(current_sales, 0) + v_close_amount,
        completed_meetings = coalesce(completed_meetings, 0) + 1
    where id = new.member_id;
  end if;

  if tg_op = 'UPDATE' and old.stage = '계약완료' and (new.stage is distinct from '계약완료') then
    v_open_amount := coalesce(nullif(old.monthly_premium, 0), old.deal_value, 0);
    update public.profiles
    set current_sales = greatest(0, coalesce(current_sales, 0) - v_open_amount),
        completed_meetings = greatest(0, coalesce(completed_meetings, 0) - 1)
    where id = old.member_id;
  end if;

  return new;
end;
$f$;
