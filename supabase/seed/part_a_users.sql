-- PART A: 트리거 비활성화 + auth.users 3명 생성
alter table public.deals disable trigger deals_stage_guard;
alter table public.deals disable trigger deals_kpi_sync;

insert into auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, role, aud
)
select
  uuid_generate_v4(), '00000000-0000-0000-0000-000000000000',
  email, crypt('demo1234', gen_salt('bf')),
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

update public.profiles
   set name='김지원', status='ACTIVE', role='REP',
       target_sales=15000000, current_sales=8000000,
       last_month_sales=4500000, avg_deal_size=600000,
       conversion_rate=18, last_month_conversion=15,
       lead_time=7, completed_meetings=12,
       hire_date='2023-03-01', license_type='생명보험설계사',
       license_number='LIFE-2023-1042', license_expiry='2027-12-31',
       phone='010-7777-1111'
 where id = (select id from auth.users where email = 'rep1@dummy.com');

update public.profiles
   set name='이현주', status='ACTIVE', role='REP',
       target_sales=12000000, current_sales=6000000,
       last_month_sales=3500000, avg_deal_size=500000,
       conversion_rate=15, last_month_conversion=12,
       lead_time=7, completed_meetings=8,
       hire_date='2024-06-15', license_type='손해보험설계사',
       license_number='NONLIFE-2024-2087', license_expiry='2026-08-15',
       phone='010-7777-2222'
 where id = (select id from auth.users where email = 'rep2@dummy.com');

update public.profiles
   set name='박민수', status='ACTIVE', role='REP',
       target_sales=8000000, current_sales=2000000,
       last_month_sales=800000, avg_deal_size=400000,
       conversion_rate=10, last_month_conversion=5,
       lead_time=10, completed_meetings=2,
       hire_date='2025-09-01', license_type='생명보험설계사',
       license_number='LIFE-2025-3105', license_expiry='2028-09-01',
       phone='010-7777-3333'
 where id = (select id from auth.users where email = 'rep3@dummy.com');

select email, name, role, status from public.profiles where email like '%@dummy.com';
