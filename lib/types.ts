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
}

export type ActivityType = 'call' | 'meeting' | 'proposal' | 'note' | 'other';

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: '전화',
  meeting: '미팅',
  proposal: '제안서',
  note: '메모',
  other: '기타',
};

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
