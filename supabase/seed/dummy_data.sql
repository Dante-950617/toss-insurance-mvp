-- =============================================================
-- DUMMY SEED DATA (1회성 — 모든 탭 동작 확인용)
--
-- 생성:
--   * REP 3명 (rep1@dummy.com / rep2@dummy.com / rep3@dummy.com, pw 'demo1234')
--   * 딜 12건 (다양한 단계/결과/카테고리)
--   * 활동 기록 (각 딜 2~4건)
--   * 개인 할 일 (각 REP 2건)
--   * 인사 — 지인/지원자 (각 REP 2~3명)
--   * 프로모션 3건 (active 2 / closed 1)
--   * 딜↔프로모션 매핑
--
-- 재실행:
--   * 'rep1@dummy.com' 등 이메일 존재 시 신규 user 생성은 skip 됨
--   * 데이터 새로 깔고 싶으면 먼저:
--       delete from auth.users where email like '%@dummy.com';
--     (cascade 로 profiles, deals, recruits, deal_promotions 등 자동 삭제)
-- =============================================================

-- 트리거 일시 비활성화 (won_at / KPI 자동 계산 회피하여 정확한 과거 데이터 시드)
alter table public.deals disable trigger deals_stage_guard;
alter table public.deals disable trigger deals_kpi_sync;

-- 1) auth.users 3명 (handle_new_user 트리거가 profiles 자동 생성)
insert into auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  role, aud
)
select
  uuid_generate_v4(),
  '00000000-0000-0000-0000-000000000000',
  email,
  crypt('demo1234', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', name),
  'authenticated', 'authenticated'
from (values
  ('rep1@dummy.com', '김지원'),
  ('rep2@dummy.com', '이현주'),
  ('rep3@dummy.com', '박민수')
) as t(email, name)
where not exists (select 1 from auth.users u where u.email = t.email);

do $$
declare
  rep1_id uuid;
  rep2_id uuid;
  rep3_id uuid;
  d_uuid uuid;
  promo_q2 uuid;
  promo_rookie uuid;
  promo_closed uuid;
begin
  select id into rep1_id from auth.users where email = 'rep1@dummy.com';
  select id into rep2_id from auth.users where email = 'rep2@dummy.com';
  select id into rep3_id from auth.users where email = 'rep3@dummy.com';

  -- 2) profiles 활성화 + KPI 스냅샷
  update public.profiles
     set name='김지원', status='ACTIVE', role='REP',
         target_sales=15000000, current_sales=8000000,
         last_month_sales=4500000, avg_deal_size=600000,
         conversion_rate=18, last_month_conversion=15,
         lead_time=7, completed_meetings=12,
         hire_date='2023-03-01', license_type='생명보험설계사',
         license_number='LIFE-2023-1042', license_expiry='2027-12-31',
         phone='010-7777-1111'
   where id = rep1_id;

  update public.profiles
     set name='이현주', status='ACTIVE', role='REP',
         target_sales=12000000, current_sales=6000000,
         last_month_sales=3500000, avg_deal_size=500000,
         conversion_rate=15, last_month_conversion=12,
         lead_time=7, completed_meetings=8,
         hire_date='2024-06-15', license_type='손해보험설계사',
         license_number='NONLIFE-2024-2087', license_expiry='2026-08-15',
         phone='010-7777-2222'
   where id = rep2_id;

  update public.profiles
     set name='박민수', status='ACTIVE', role='REP',
         target_sales=8000000, current_sales=2000000,
         last_month_sales=800000, avg_deal_size=400000,
         conversion_rate=10, last_month_conversion=5,
         lead_time=10, completed_meetings=2,
         hire_date='2025-09-01', license_type='생명보험설계사',
         license_number='LIFE-2025-3105', license_expiry='2028-09-01',
         phone='010-7777-3333'
   where id = rep3_id;

  -- 기존 딜 데이터 정리 (재실행 시 dupe 방지)
  delete from public.deals where member_id in (rep1_id, rep2_id, rep3_id);

  -- 3) 딜 12건 -----------------------------------------
  -- 김지원 — 시니어 (2 WIN, 1 LOSE, 2 PENDING)
  insert into public.deals (
    member_id, customer_name, stage, outcome, monthly_premium,
    phone, next_contact_date, notes, referrer,
    insurance_line, category_sub, coverage_type, coverage_detail,
    customer_birth_date, customer_gender, family_info, occupation, income_range,
    date, last_updated, won_at, manager_comment
  ) values
  -- WIN 1
  (rep1_id, '강미정', '후속조치(대면)', 'WIN', 250000,
   '010-1111-2222', null, '40대 자녀 학자금 대비. 종신보험 가입 완료', '이상철 부장 소개',
   '생보', '종신', '비갱신형', '20/100',
   '1985-03-15', 'F', '배우자 + 자녀 2명', '간호사', '5_8M',
   '2026-04-15', '2026-05-08', '2026-05-08 14:30:00', '안정적인 클로징 케이스. 추가 추천 고객 확보 가능성 높음.'),
  -- WIN 2
  (rep1_id, '오성민', '후속조치(대면)', 'WIN', 180000,
   '010-2222-3333', null, '30대 직장인 건강 종합', '강미정 고객 소개',
   '생보', '건강(암/CI/뇌/심)', '갱신형', '20년갱신',
   '1990-07-22', 'M', '미혼', '대기업 직원', '5_8M',
   '2026-04-20', '2026-05-05', '2026-05-05 11:00:00', ''),
  -- LOSE
  (rep1_id, '문진호', '대면미팅', 'LOSE', 0,
   '010-3333-4444', null, '경쟁사 견적이 더 저렴', '',
   '손보', '자동차', '비갱신형', '20/100',
   '1988-11-10', 'M', '배우자', '자영업', '3_5M',
   '2026-04-10', '2026-04-25', null, ''),
  -- PENDING (승인대기)
  (rep1_id, '한지혜', '보고서 컨펌 요청', 'PENDING', 320000,
   '010-4444-5555', '2026-05-12', '연금+실손 패키지 제안 중. 승인 요청', '직접 발굴',
   '생보', '연금', '비갱신형', '30/100',
   '1980-05-20', 'F', '배우자 + 자녀 1명', '교사', '5_8M',
   '2026-04-25', '2026-05-09', null, ''),
  -- PENDING (대면미팅)
  (rep1_id, '서동현', '대면미팅', 'PENDING', 200000,
   '010-5555-6666', '2026-05-15', '암보험 검토 중. 가족력 우려', '한지혜 고객 소개',
   '생보', '건강(암/CI/뇌/심)', '비갱신형', '20/80',
   '1975-12-03', 'M', '배우자 + 자녀 2명', '회사원', '8_12M',
   '2026-05-01', '2026-05-09', null, '');

  -- 이현주 — 미들 (1 WIN, 1 LOSE, 2 PENDING)
  insert into public.deals (
    member_id, customer_name, stage, outcome, monthly_premium,
    phone, next_contact_date, notes, referrer,
    insurance_line, category_sub, coverage_type, coverage_detail,
    customer_birth_date, customer_gender, family_info, occupation, income_range,
    date, last_updated, won_at
  ) values
  -- WIN
  (rep2_id, '김보경', '후속조치(대면)', 'WIN', 150000,
   '010-6666-7777', null, '실손의료 종합 가입 완료', '회사 동료 추천',
   '손보', '실손의료', '갱신형', '10년갱신',
   '1992-08-30', 'F', '미혼', '디자이너', '3_5M',
   '2026-04-12', '2026-05-03', '2026-05-03 16:00:00'),
  -- LOSE
  (rep2_id, '장석호', '콜미팅', 'LOSE', 0,
   '010-7777-8888', null, '연락 두절', '',
   '손보', '자동차', '비갱신형', '20/100',
   '1986-04-18', 'M', '배우자', '엔지니어', '5_8M',
   '2026-04-05', '2026-04-22', null),
  -- PENDING (보고서 전달 — 매니저 승인 받음)
  (rep2_id, '윤소영', '보고서 전달', 'PENDING', 280000,
   '010-8888-9999', '2026-05-13', '제안서 전달. 최종 검토 중', '직접 발굴',
   '생보', '종신', '비갱신형', '20/100',
   '1983-02-14', 'F', '배우자 + 자녀 1명', '약사', '8_12M',
   '2026-04-18', '2026-05-08', null),
  -- PENDING (콜미팅)
  (rep2_id, '최우진', '콜미팅', 'PENDING', 0,
   '010-9999-0000', '2026-05-11', '첫 상담. 실손+자동차 패키지 관심', '윤소영 고객 소개',
   '손보', '실손의료', '갱신형', '10년갱신',
   '1995-09-25', 'M', '미혼', '프리랜서', '3_5M',
   '2026-05-02', '2026-05-09', null);

  -- 박민수 — 신입 (0 WIN, 1 LOSE, 2 PENDING)
  insert into public.deals (
    member_id, customer_name, stage, outcome, monthly_premium,
    phone, next_contact_date, notes, referrer,
    insurance_line, category_sub, coverage_type, coverage_detail,
    customer_birth_date, customer_gender, family_info, occupation, income_range,
    date, last_updated, won_at
  ) values
  (rep3_id, '정세영', '진행대기', 'LOSE', 0,
   '010-1234-1234', null, '단순 변심', '',
   '손보', '여행자', '', '',
   '1990-06-01', 'F', '미혼', '회사원', '3_5M',
   '2026-04-28', '2026-05-02', null),
  (rep3_id, '신지원', '콜미팅', 'PENDING', 120000,
   '010-2345-2345', '2026-05-12', '관심도 보통. 자녀 어린이보험 가능성', '신입 교육 시 만남',
   '생보', '어린이종합', '비갱신형', '30/100',
   '1988-03-20', 'F', '배우자 + 자녀 2명', '주부', 'UNDER_3M',
   '2026-05-03', '2026-05-08', null),
  (rep3_id, '이재훈', '대면미팅', 'PENDING', 80000,
   '010-3456-3456', '2026-05-14', '운전자 + 자동차 견적 요청', '직접 발굴',
   '손보', '운전자', '비갱신형', '20/100',
   '1985-11-15', 'M', '배우자 + 자녀 1명', '회사원', '5_8M',
   '2026-05-04', '2026-05-09', null);

  -- 4) 활동 기록 -----------------------------------------
  -- 모든 딜에 첫 통화 시도
  insert into public.deal_activities (deal_id, author_id, activity_type, content, created_at)
  select d.id, d.member_id, 'call_attempt', '첫 통화 시도 — 부재중',
         d.date::timestamptz + interval '1 day' + interval '10 hour'
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id);

  -- LOSE 아닌 딜은 통화 성공
  insert into public.deal_activities (deal_id, author_id, activity_type, content, created_at)
  select d.id, d.member_id, 'call_success',
         '통화 성공. 보험 검토 의향 있음. 미팅 일정 조율',
         d.date::timestamptz + interval '2 day' + interval '14 hour'
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id) and d.outcome <> 'LOSE';

  -- 대면미팅 이상은 미팅 완료
  insert into public.deal_activities (deal_id, author_id, activity_type, content, created_at)
  select d.id, d.member_id, 'meeting_done',
         '대면 미팅 완료. 가족 구성 청취 + 니즈 파악',
         d.date::timestamptz + interval '5 day' + interval '15 hour'
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id)
     and d.stage in ('대면미팅','보고서 컨펌 요청','보고서 전달','클로징','후속조치(대면)');

  -- 보고서 전달 이상은 제안서 발송
  insert into public.deal_activities (deal_id, author_id, activity_type, content, created_at)
  select d.id, d.member_id, 'proposal_sent',
         '맞춤 제안서 발송 완료',
         d.date::timestamptz + interval '8 day' + interval '11 hour'
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id)
     and d.stage in ('보고서 전달','클로징','후속조치(대면)');

  -- WIN 딜에 추가 메모
  insert into public.deal_activities (deal_id, author_id, activity_type, content, created_at)
  select d.id, d.member_id, 'note',
         '계약 체결 완료. 추가 추천 고객 확보 진행 중',
         d.won_at + interval '1 day'
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id) and d.outcome = 'WIN';

  -- 5) Tasks (개인 할 일)
  delete from public.tasks where user_id in (rep1_id, rep2_id, rep3_id);
  insert into public.tasks (user_id, title, due_date, done) values
  (rep1_id, '강미정 고객 사후관리 일정 조율', '2026-05-12', false),
  (rep1_id, '한지혜 고객 매니저 승인 받기', '2026-05-10', false),
  (rep2_id, '윤소영 고객 최종 컨펌 통화', '2026-05-13', false),
  (rep2_id, '월간 영업일지 정리', '2026-05-31', false),
  (rep3_id, '신입 교육 자료 복습', '2026-05-15', false),
  (rep3_id, '신지원 고객 자녀 보험 자료 준비', '2026-05-12', false);

  -- 6) Recruits (인사)
  delete from public.recruits where owner_id in (rep1_id, rep2_id, rep3_id);
  insert into public.recruits (owner_id, kind, name, age, gender, referrer, memo) values
  -- 김지원
  (rep1_id, 'acquaintance', '한정수', 35, 'M', '대학 동기', '연구원, 자녀 출산 예정 — 어린이보험 관심 높을 듯'),
  (rep1_id, 'acquaintance', '오은지', 32, 'F', '아내 친구', '직장인, 결혼 1년차'),
  (rep1_id, 'applicant',    '서지훈', 28, 'M', '강미정 고객 추천', '전 보험 영업 1년 경력. 정식 입사 검토 중'),
  -- 이현주
  (rep2_id, 'acquaintance', '김유진', 30, 'F', '학원 동기', '프리랜서 디자이너'),
  (rep2_id, 'acquaintance', '박철민', 38, 'M', '동네 모임', '자영업, 자동차 보험 갱신 시점'),
  (rep2_id, 'applicant',    '윤다은', 26, 'F', '윤소영 고객 추천', '대졸 신입. 영업 경험 없음'),
  -- 박민수
  (rep3_id, 'acquaintance', '강현우', 27, 'M', '동기 모임', '같은 신입 동기'),
  (rep3_id, 'acquaintance', '문지원', 29, 'F', '대학원 선배', '연구실 후배');

  -- 7) Promotions (이미 있으면 skip — 이름 unique 보장 위해 select 후 분기)
  select id into promo_q2 from public.promotions where name = '2026 Q2 종합 영업 프로모션';
  if promo_q2 is null then
    insert into public.promotions (
      name, start_date, end_date, status, description,
      per_month_threshold, total_threshold
    ) values (
      '2026 Q2 종합 영업 프로모션', '2026-04-01', '2026-06-30', 'active',
      E'달성 시 2026.9 일본 오사카 여행 (2박 3일)\n\n[달성 조건]\n- 단월: 매월 PIV 65만원 이상\n- 누적: 3개월 합산 220만원 이상\n둘 중 하나라도 달성 시 인정',
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

  -- 8) Deal ↔ Promotion 매핑 ----------------------------
  -- WIN 딜 (Q2 기간) → Q2 프로모션 (50% PIV율)
  insert into public.deal_promotions (deal_id, promotion_id, piv_rate)
  select d.id, promo_q2, 50.0
    from public.deals d
   where d.member_id in (rep1_id, rep2_id, rep3_id)
     and d.outcome = 'WIN'
     and d.won_at::date between '2026-04-01' and '2026-06-30'
  on conflict do nothing;

  -- PENDING 진행중 딜 (보고서 컨펌 요청 / 보고서 전달) → Q2 프로모션 (32.5% PIV율)
  insert into public.deal_promotions (deal_id, promotion_id, piv_rate)
  select d.id, promo_q2, 32.5
    from public.deals d
   where d.member_id in (rep1_id, rep2_id)
     and d.outcome = 'PENDING'
     and d.stage in ('보고서 컨펌 요청', '보고서 전달')
  on conflict do nothing;

  -- 박민수 (신입) → 신입 캠페인 (100% PIV율)
  insert into public.deal_promotions (deal_id, promotion_id, piv_rate)
  select d.id, promo_rookie, 100.0
    from public.deals d
   where d.member_id = rep3_id
  on conflict do nothing;

end $$;

-- 트리거 재활성화
alter table public.deals enable trigger deals_kpi_sync;
alter table public.deals enable trigger deals_stage_guard;

-- 결과 확인 ------------------------------------------------
select '--- profiles ---' as label;
select email, name, role, status, target_sales, current_sales
  from public.profiles
 where email like '%@dummy.com' or role='MANAGER'
 order by role, name;

select '--- deals 카운트 ---' as label;
select p.name, count(d.id) as deals,
       sum(case when d.outcome='WIN' then 1 else 0 end) as wins,
       sum(case when d.outcome='LOSE' then 1 else 0 end) as loses,
       sum(case when d.outcome='PENDING' then 1 else 0 end) as pending
  from public.profiles p
  left join public.deals d on d.member_id = p.id
 where p.email like '%@dummy.com'
 group by p.name
 order by p.name;
