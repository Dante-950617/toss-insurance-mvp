-- PART B: 딜 12건 + 활동 + 태스크
do $$
declare
  rep1_id uuid := (select id from auth.users where email = 'rep1@dummy.com');
  rep2_id uuid := (select id from auth.users where email = 'rep2@dummy.com');
  rep3_id uuid := (select id from auth.users where email = 'rep3@dummy.com');
begin
  delete from public.deals where member_id in (rep1_id, rep2_id, rep3_id);

  -- 김지원 (5건)
  insert into public.deals (
    member_id, customer_name, stage, outcome, monthly_premium,
    phone, next_contact_date, notes, referrer,
    insurance_line, category_sub, coverage_type, coverage_detail,
    customer_birth_date, customer_gender, family_info, occupation, income_range,
    date, last_updated, won_at, manager_comment
  ) values
  (rep1_id, '강미정', '후속조치(대면)', 'WIN', 250000,
   '010-1111-2222', null, '40대 자녀 학자금 대비. 종신보험 가입 완료', '이상철 부장 소개',
   '생보', '종신', '비갱신형', '20/100',
   '1985-03-15', 'F', '배우자 + 자녀 2명', '간호사', '5_8M',
   '2026-04-15', '2026-05-08', '2026-05-08 14:30:00', '안정적인 클로징 케이스. 추가 추천 고객 확보 가능성 높음.'),
  (rep1_id, '오성민', '후속조치(대면)', 'WIN', 180000,
   '010-2222-3333', null, '30대 직장인 건강 종합', '강미정 고객 소개',
   '생보', '건강(암/CI/뇌/심)', '갱신형', '20년갱신',
   '1990-07-22', 'M', '미혼', '대기업 직원', '5_8M',
   '2026-04-20', '2026-05-05', '2026-05-05 11:00:00', ''),
  (rep1_id, '문진호', '대면미팅', 'LOSE', 0,
   '010-3333-4444', null, '경쟁사 견적이 더 저렴', '',
   '손보', '자동차', '비갱신형', '20/100',
   '1988-11-10', 'M', '배우자', '자영업', '3_5M',
   '2026-04-10', '2026-04-25', null, ''),
  (rep1_id, '한지혜', '보고서 컨펌 요청', 'PENDING', 320000,
   '010-4444-5555', '2026-05-12', '연금+실손 패키지 제안 중. 승인 요청', '직접 발굴',
   '생보', '연금', '비갱신형', '30/100',
   '1980-05-20', 'F', '배우자 + 자녀 1명', '교사', '5_8M',
   '2026-04-25', '2026-05-09', null, ''),
  (rep1_id, '서동현', '대면미팅', 'PENDING', 200000,
   '010-5555-6666', '2026-05-15', '암보험 검토 중. 가족력 우려', '한지혜 고객 소개',
   '생보', '건강(암/CI/뇌/심)', '비갱신형', '20/80',
   '1975-12-03', 'M', '배우자 + 자녀 2명', '회사원', '8_12M',
   '2026-05-01', '2026-05-09', null, '');

  -- 이현주 (4건)
  insert into public.deals (
    member_id, customer_name, stage, outcome, monthly_premium,
    phone, next_contact_date, notes, referrer,
    insurance_line, category_sub, coverage_type, coverage_detail,
    customer_birth_date, customer_gender, family_info, occupation, income_range,
    date, last_updated, won_at
  ) values
  (rep2_id, '김보경', '후속조치(대면)', 'WIN', 150000,
   '010-6666-7777', null, '실손의료 종합 가입 완료', '회사 동료 추천',
   '손보', '실손의료', '갱신형', '10년갱신',
   '1992-08-30', 'F', '미혼', '디자이너', '3_5M',
   '2026-04-12', '2026-05-03', '2026-05-03 16:00:00'),
  (rep2_id, '장석호', '콜미팅', 'LOSE', 0,
   '010-7777-8888', null, '연락 두절', '',
   '손보', '자동차', '비갱신형', '20/100',
   '1986-04-18', 'M', '배우자', '엔지니어', '5_8M',
   '2026-04-05', '2026-04-22', null),
  (rep2_id, '윤소영', '보고서 전달', 'PENDING', 280000,
   '010-8888-9999', '2026-05-13', '제안서 전달. 최종 검토 중', '직접 발굴',
   '생보', '종신', '비갱신형', '20/100',
   '1983-02-14', 'F', '배우자 + 자녀 1명', '약사', '8_12M',
   '2026-04-18', '2026-05-08', null),
  (rep2_id, '최우진', '콜미팅', 'PENDING', 0,
   '010-9999-0000', '2026-05-11', '첫 상담. 실손+자동차 패키지 관심', '윤소영 고객 소개',
   '손보', '실손의료', '갱신형', '10년갱신',
   '1995-09-25', 'M', '미혼', '프리랜서', '3_5M',
   '2026-05-02', '2026-05-09', null);

  -- 박민수 (3건)
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
end $$;

select count(*) as total_deals from public.deals where member_id in (
  select id from auth.users where email like '%@dummy.com'
);
