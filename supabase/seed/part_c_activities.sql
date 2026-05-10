-- PART C: 활동 + 태스크 + 인사
do $$
declare
  rep1_id uuid := (select id from auth.users where email = 'rep1@dummy.com');
  rep2_id uuid := (select id from auth.users where email = 'rep2@dummy.com');
  rep3_id uuid := (select id from auth.users where email = 'rep3@dummy.com');
begin
  -- 활동: 모든 딜에 첫 통화 시도
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
  select d.id, d.member_id, 'proposal_sent', '맞춤 제안서 발송 완료',
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

  -- Tasks
  delete from public.tasks where user_id in (rep1_id, rep2_id, rep3_id);
  insert into public.tasks (user_id, title, due_date, done) values
  (rep1_id, '강미정 고객 사후관리 일정 조율', '2026-05-12', false),
  (rep1_id, '한지혜 고객 매니저 승인 받기', '2026-05-10', false),
  (rep2_id, '윤소영 고객 최종 컨펌 통화', '2026-05-13', false),
  (rep2_id, '월간 영업일지 정리', '2026-05-31', false),
  (rep3_id, '신입 교육 자료 복습', '2026-05-15', false),
  (rep3_id, '신지원 고객 자녀 보험 자료 준비', '2026-05-12', false);

  -- Recruits
  delete from public.recruits where owner_id in (rep1_id, rep2_id, rep3_id);
  insert into public.recruits (owner_id, kind, name, age, gender, referrer, memo) values
  (rep1_id, 'acquaintance', '한정수', 35, 'M', '대학 동기', '연구원, 자녀 출산 예정 — 어린이보험 관심 높을 듯'),
  (rep1_id, 'acquaintance', '오은지', 32, 'F', '아내 친구', '직장인, 결혼 1년차'),
  (rep1_id, 'applicant',    '서지훈', 28, 'M', '강미정 고객 추천', '전 보험 영업 1년 경력. 정식 입사 검토 중'),
  (rep2_id, 'acquaintance', '김유진', 30, 'F', '학원 동기', '프리랜서 디자이너'),
  (rep2_id, 'acquaintance', '박철민', 38, 'M', '동네 모임', '자영업, 자동차 보험 갱신 시점'),
  (rep2_id, 'applicant',    '윤다은', 26, 'F', '윤소영 고객 추천', '대졸 신입. 영업 경험 없음'),
  (rep3_id, 'acquaintance', '강현우', 27, 'M', '동기 모임', '같은 신입 동기'),
  (rep3_id, 'acquaintance', '문지원', 29, 'F', '대학원 선배', '연구실 후배');
end $$;

select 'activities' as kind, count(*) as cnt from public.deal_activities
 where author_id in (select id from auth.users where email like '%@dummy.com')
union all
select 'tasks', count(*) from public.tasks
 where user_id in (select id from auth.users where email like '%@dummy.com')
union all
select 'recruits', count(*) from public.recruits
 where owner_id in (select id from auth.users where email like '%@dummy.com');
