-- PART D: 프로모션 + 매핑 + 트리거 재활성화
do $$
declare
  rep1_id uuid := (select id from auth.users where email = 'rep1@dummy.com');
  rep2_id uuid := (select id from auth.users where email = 'rep2@dummy.com');
  rep3_id uuid := (select id from auth.users where email = 'rep3@dummy.com');
  promo_q2 uuid;
  promo_rookie uuid;
  promo_closed uuid;
begin
  -- 프로모션 (이름 unique 가정)
  select id into promo_q2 from public.promotions where name = '2026 Q2 종합 영업 프로모션';
  if promo_q2 is null then
    insert into public.promotions (
      name, start_date, end_date, status, description,
      per_month_threshold, total_threshold
    ) values (
      '2026 Q2 종합 영업 프로모션', '2026-04-01', '2026-06-30', 'active',
      '달성 시 2026.9 일본 오사카 여행 (2박 3일). 단월 65만원 또는 누적 220만원 둘 중 하나라도 달성 시 인정',
      650000, 2200000
    ) returning id into promo_q2;
  end if;

  select id into promo_rookie from public.promotions where name = '2026 신입설계사 응원 캠페인';
  if promo_rookie is null then
    insert into public.promotions (
      name, start_date, end_date, status, description,
      per_month_threshold, total_threshold
    ) values (
      '2026 신입설계사 응원 캠페인', '2026-05-01', '2026-05-31', 'active',
      '신규 입사자 1개월 응원 캠페인. 50만원 누적 시 인정.',
      0, 500000
    ) returning id into promo_rookie;
  end if;

  select id into promo_closed from public.promotions where name = '2025 Q4 종료 프로모션 (참고)';
  if promo_closed is null then
    insert into public.promotions (
      name, start_date, end_date, status, description,
      per_month_threshold, total_threshold
    ) values (
      '2025 Q4 종료 프로모션 (참고)', '2025-10-01', '2025-12-31', 'closed',
      '종료된 프로모션 — 참고용으로 표시', 0, 1500000
    ) returning id into promo_closed;
  end if;

  -- 기존 매핑 정리
  delete from public.deal_promotions
   where deal_id in (select id from public.deals where member_id in (rep1_id, rep2_id, rep3_id));

  -- WIN 딜 (Q2 기간) → Q2 프로모션 (50% PIV율)
  insert into public.deal_promotions (deal_id, promotion_id, piv_rate)
  select d.id, promo_q2, 50.0
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id)
     and d.outcome = 'WIN'
     and d.won_at::date between '2026-04-01' and '2026-06-30';

  -- PENDING 진행중 딜 → Q2 프로모션 (32.5% PIV율)
  insert into public.deal_promotions (deal_id, promotion_id, piv_rate)
  select d.id, promo_q2, 32.5
    from public.deals d
   where d.member_id in (rep1_id, rep2_id)
     and d.outcome = 'PENDING'
     and d.stage in ('보고서 컨펌 요청', '보고서 전달');

  -- 박민수 → 신입 캠페인 (100% PIV율, monthly_premium 있는 딜만)
  insert into public.deal_promotions (deal_id, promotion_id, piv_rate)
  select d.id, promo_rookie, 100.0
    from public.deals d
   where d.member_id = rep3_id and d.monthly_premium > 0;
end $$;

-- 트리거 재활성화
alter table public.deals enable trigger deals_kpi_sync;
alter table public.deals enable trigger deals_stage_guard;

-- 결과 확인
select '--- profiles ---' as label;
select email, name, role, status, target_sales, current_sales
  from public.profiles
 where email like '%@dummy.com' or role='MANAGER'
 order by role, name;

select '--- 딜 ---' as label;
select p.name, count(d.id) as deals,
       sum(case when d.outcome='WIN' then 1 else 0 end) as wins,
       sum(case when d.outcome='LOSE' then 1 else 0 end) as loses,
       sum(case when d.outcome='PENDING' then 1 else 0 end) as pending
  from public.profiles p
  left join public.deals d on d.member_id = p.id
 where p.email like '%@dummy.com'
 group by p.name
 order by p.name;
