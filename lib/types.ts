export type UserRole = 'MANAGER' | 'REP';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE';
export type DealStage = '진행대기' | '상담중' | '클로징(승인대기)' | '계약완료' | '실패';

export const STAGES: DealStage[] = [
  '진행대기',
  '상담중',
  '클로징(승인대기)',
  '계약완료',
  '실패',
];

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
  // 고객 상세 정보 (영업 자산)
  customer_birth_date: string | null;
  customer_gender: string | null;
  family_info: string;
  occupation: string;
  income_range: string;
  existing_insurance: string;
  interest_keywords: string;
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
