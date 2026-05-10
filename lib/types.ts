export type UserRole = 'MANAGER' | 'REP';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';

// 7단계 영업 파이프라인 (007 마이그레이션)
export type DealStage =
  | '진행대기'
  | '콜미팅'
  | '대면미팅'
  | '보고서 컨펌 요청'
  | '보고서 전달'
  | '클로징'
  | '후속조치(대면)';

export const STAGES: DealStage[] = [
  '진행대기',
  '콜미팅',
  '대면미팅',
  '보고서 컨펌 요청',
  '보고서 전달',
  '클로징',
  '후속조치(대면)',
];

// REP 가 직접 진입할 수 없는 단계 (매니저 승인 필요)
export const MANAGER_ONLY_STAGES: DealStage[] = [
  '보고서 전달',
  '클로징',
  '후속조치(대면)',
];

// WIN 처리 허용 단계 — 후속조치(대면) 끝난 딜만
export const WIN_ALLOWED_STAGE: DealStage = '후속조치(대면)';

// 매니저 승인 게이트 — 이 단계에서 매니저가 승인하면 다음 단계로
export const APPROVAL_STAGE: DealStage = '보고서 컨펌 요청';

// ---------- 결과 (WIN / LOSE / 진행중) ----------
export type DealOutcome = 'PENDING' | 'WIN' | 'LOSE';

export const OUTCOME_LABEL: Record<DealOutcome, string> = {
  PENDING: '진행중',
  WIN: '계약 성공',
  LOSE: '계약 실패',
};

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  target_sales: number;
  current_sales: number;
  last_month_sales: number;
  avg_deal_size: number;
  conversion_rate: number;
  last_month_conversion: number;
  lead_time: number;
  completed_meetings: number;
  created_at: string;
  updated_at: string;
  // 보험설계사 정보
  license_type?: string;
  license_number?: string;
  license_expiry?: string | null;
  hire_date?: string | null;
  phone?: string;
}

export interface TeamSettings {
  id: number;
  target_sales: number;
  avg_deal_size: number;
  conversion_rate: number;
  lead_time: number;
  updated_at: string;
}

export interface Deal {
  id: string;
  member_id: string;
  customer_name: string;
  stage: DealStage;
  outcome: DealOutcome;
  reason: string;
  product_type: string;
  monthly_premium: number;
  competitor: string;
  manager_comment: string;
  date: string;
  last_updated: string;
  created_at: string;
  deal_value: number;
  phone: string;
  next_contact_date: string | null;
  notes: string;
  referrer: string;
  // 카테고리 (006: 대/소 분리)
  insurance_line: string;       // '손보' | '생보'
  category_sub: string;         // 소카테고리 값
  category_custom: string;      // 소카 "기타" 직접입력
  // 보장 형태
  coverage_type: string;        // '갱신형' | '비갱신형' | '종신형'
  coverage_detail: string;      // 세부 옵션 (10년갱신, 20/100, 5년납 등)
  coverage_custom: string;      // 보장 형태 "기타" 직접입력
  // legacy (DB 호환 — 더 이상 사용 안 함)
  category: string;
  annual_premium: number;
  renewal_type: string;
  maturity_type: string;
  maturity_custom: string;
  // 고객 상세 정보 (영업 자산)
  customer_birth_date: string | null;
  customer_gender: string | null;
  family_info: string;
  occupation: string;
  income_range: string;
  existing_insurance: string;
  interest_keywords: string;
}

// ---------- 카테고리 (대/소) ----------
export const INSURANCE_LINES: { value: string; label: string }[] = [
  { value: '손보', label: '손해보험' },
  { value: '생보', label: '생명보험' },
];

export const SUB_CATEGORIES_BY_LINE: Record<
  string,
  { value: string; label: string }[]
> = {
  '손보': [
    { value: '자동차', label: '자동차' },
    { value: '운전자', label: '운전자' },
    { value: '어린이·태아', label: '어린이·태아' },
    { value: '실손의료', label: '실손의료' },
    { value: '화재', label: '화재' },
    { value: '여행자', label: '여행자' },
    { value: '펫', label: '펫' },
    { value: '배상책임', label: '배상책임' },
    { value: 'other', label: '기타 (직접입력)' },
  ],
  '생보': [
    { value: '종신', label: '종신' },
    { value: '정기', label: '정기' },
    { value: '건강(암/CI/뇌/심)', label: '건강 (암/CI/뇌/심)' },
    { value: '어린이종합', label: '어린이종합' },
    { value: '연금', label: '연금' },
    { value: '저축·변액', label: '저축·변액' },
    { value: 'other', label: '기타 (직접입력)' },
  ],
};

// ---------- 보장 형태 (갱신/비갱신/종신) ----------
export const COVERAGE_TYPES: { value: string; label: string; lifeOnly?: boolean }[] = [
  { value: '갱신형', label: '갱신형' },
  { value: '비갱신형', label: '비갱신형' },
  { value: '종신형', label: '종신형 (생보 전용)', lifeOnly: true },
];

export const COVERAGE_DETAILS_BY_TYPE: Record<
  string,
  { value: string; label: string }[]
> = {
  '갱신형': [
    { value: '10년갱신', label: '10년 갱신' },
    { value: '20년갱신', label: '20년 갱신' },
    { value: '30년갱신', label: '30년 갱신' },
    { value: 'other', label: '기타 (직접입력)' },
  ],
  '비갱신형': [
    { value: '20/100', label: '20년납 / 100세 만기' },
    { value: '20/90', label: '20년납 / 90세 만기' },
    { value: '20/80', label: '20년납 / 80세 만기' },
    { value: '30/100', label: '30년납 / 100세 만기' },
    { value: '30/90', label: '30년납 / 90세 만기' },
    { value: '30/80', label: '30년납 / 80세 만기' },
    { value: 'other', label: '기타 (직접입력)' },
  ],
  '종신형': [
    { value: '5년납', label: '5년납' },
    { value: '7년납', label: '7년납' },
    { value: '10년납', label: '10년납' },
    { value: '15년납', label: '15년납' },
    { value: '20년납', label: '20년납' },
    { value: 'other', label: '기타 (직접입력)' },
  ],
};

// ---------- 카드/배지 표시 헬퍼 ----------
export function subCategoryDisplay(
  d: Pick<Deal, 'insurance_line' | 'category_sub' | 'category_custom'>
): string {
  if (!d.category_sub) return '';
  if (d.category_sub === 'other') return d.category_custom || '기타';
  return d.category_sub;
}

export function coverageDetailDisplay(
  d: Pick<Deal, 'coverage_type' | 'coverage_detail' | 'coverage_custom'>
): string {
  if (!d.coverage_detail) return '';
  if (d.coverage_detail === 'other') return d.coverage_custom || '기타';
  const opts = COVERAGE_DETAILS_BY_TYPE[d.coverage_type] ?? [];
  return opts.find((o) => o.value === d.coverage_detail)?.label ?? d.coverage_detail;
}

export type ActivityType =
  | 'call_attempt'
  | 'call_success'
  | 'kakao_send'
  | 'meeting_set'
  | 'meeting_done'
  | 'proposal_sent'
  | 'review_request'
  | 'callback_set'
  | 'on_hold'
  | 'note'
  | 'other'
  // 하위호환
  | 'call'
  | 'meeting'
  | 'proposal';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call_attempt: '통화시도',
  call_success: '통화성공',
  kakao_send: '카톡발송',
  meeting_set: '미팅예약',
  meeting_done: '미팅완료',
  proposal_sent: '설계서발송',
  review_request: '검토요청',
  callback_set: '재통화약속',
  on_hold: '보류',
  note: '메모',
  other: '기타',
  call: '전화(구)',
  meeting: '미팅(구)',
  proposal: '제안서(구)',
};

export const ACTIVE_ACTIVITY_TYPES: ActivityType[] = [
  'call_success',
  'call_attempt',
  'kakao_send',
  'meeting_set',
  'meeting_done',
  'proposal_sent',
  'callback_set',
  'review_request',
  'on_hold',
  'note',
  'other',
];

export interface SalesScript {
  id: string;
  title: string;
  category: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  author_id: string;
  activity_type: ActivityType;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  deal_id: string | null;
  title: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

export interface MemberInvitation {
  email: string;
  invited_by: string | null;
  name: string;
  target_sales: number;
  conversion_rate: number;
  lead_time: number;
  invited_at: string;
}

export interface CalculatedMember extends Profile {
  remaining_sales: number;
  needed_deals: number;
  needed_meetings: number;
  sales_growth: number;
  conv_growth: number;
}
