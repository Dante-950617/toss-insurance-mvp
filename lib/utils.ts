import type {
  Profile,
  CalculatedMember,
  Deal,
  Promotion,
  DealPromotion,
} from './types';

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ko-KR').format(value);

export const formatDateKR = (date: Date) => `${date.getMonth() + 1}월 ${date.getDate()}일`;

export const safeDateParse = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  const d = new Date(String(dateStr).replace(/-/g, '/'));
  return isNaN(d.getTime()) ? new Date() : d;
};

export const getDwellDays = (lastUpdatedStr: string | null | undefined): number => {
  if (!lastUpdatedStr) return 0;
  const updatedDate = safeDateParse(lastUpdatedStr);
  const current = new Date();
  const diffTime = current.getTime() - updatedDate.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

export const calcMember = (m: Profile): CalculatedMember => {
  const tSales = m.target_sales || 1;
  const cSales = m.current_sales || 0;
  const aDealSize = m.avg_deal_size || 1;
  const cRate = m.conversion_rate || 0;
  const lSales = m.last_month_sales || 0;
  const lConv = m.last_month_conversion || 0;

  const remaining_sales = Math.max(0, tSales - cSales);
  const needed_deals = Math.ceil(remaining_sales / aDealSize);
  const needed_meetings = cRate > 0 ? Math.ceil(needed_deals / (cRate / 100)) : 0;
  const sales_growth = lSales > 0 ? ((cSales - lSales) / lSales) * 100 : 0;
  const conv_growth = cRate - lConv;

  return { ...m, remaining_sales, needed_deals, needed_meetings, sales_growth, conv_growth };
};

export const buildTeamAggregate = (
  members: CalculatedMember[],
  teamSettings: { target_sales: number; avg_deal_size: number; conversion_rate: number; lead_time: number }
): CalculatedMember => {
  const currentSales = members.reduce((s, m) => s + (m.current_sales || 0), 0);
  const lastMonthSales = members.reduce((s, m) => s + (m.last_month_sales || 0), 0);
  const completedMeetings = members.reduce((s, m) => s + (m.completed_meetings || 0), 0);
  const lastMonthConversion =
    members.length > 0
      ? Math.round(members.reduce((s, m) => s + (m.last_month_conversion || 0), 0) / members.length)
      : 0;

  const targetSales = teamSettings.target_sales || 1;
  const remainingSales = Math.max(0, targetSales - currentSales);
  const neededDeals = Math.ceil(remainingSales / (teamSettings.avg_deal_size || 1));
  const neededMeetings =
    teamSettings.conversion_rate > 0
      ? Math.ceil(neededDeals / (teamSettings.conversion_rate / 100))
      : 0;
  const salesGrowth =
    lastMonthSales > 0 ? ((currentSales - lastMonthSales) / lastMonthSales) * 100 : 0;
  const convGrowth = teamSettings.conversion_rate - lastMonthConversion;

  return {
    id: 'ALL',
    email: '',
    name: '팀 전체',
    role: 'MANAGER',
    status: 'ACTIVE',
    target_sales: targetSales,
    current_sales: currentSales,
    last_month_sales: lastMonthSales,
    avg_deal_size: teamSettings.avg_deal_size,
    conversion_rate: teamSettings.conversion_rate,
    last_month_conversion: lastMonthConversion,
    lead_time: teamSettings.lead_time,
    completed_meetings: completedMeetings,
    created_at: '',
    updated_at: '',
    remaining_sales: remainingSales,
    needed_deals: neededDeals,
    needed_meetings: neededMeetings,
    sales_growth: salesGrowth,
    conv_growth: convGrowth,
  };
};

// 결과(WIN/LOSE)나 후속조치 단계가 아닌 진행중 딜만 stale 검사
export const isStaleDeal = (deal: Deal): boolean => {
  if (deal.outcome && deal.outcome !== 'PENDING') return false;
  if (deal.stage === '후속조치(대면)') return false;
  return getDwellDays(deal.last_updated) >= 5;
};

// =====================================================
// 프로모션 달성도 계산
// =====================================================

// "YYYY-MM" 형식으로 캘린더 월 키 생성
const monthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// 프로모션 기간 내 캘린더 월 목록
export function getPromotionMonths(promo: Promotion): string[] {
  const start = safeDateParse(promo.start_date);
  const end = safeDateParse(promo.end_date);
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endCursor) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

// 특정 멤버의 프로모션 달성 상황
export interface MemberPromotionScore {
  memberId: string;
  appliedDealCount: number;
  monthlyPiv: Record<string, number>;   // {"2026-01": 650000, ...}
  minMonthlyPiv: number;                // 단월 최저 (모든 월 중)
  totalPiv: number;                     // 누적 합
  monthPctIfApplicable: number | null;  // 단월 %, A=0이면 null
  totalPctIfApplicable: number | null;  // 누적 %, B=0이면 null
  achieved: boolean;                    // A 충족 OR B 충족
  achievedByMonth: boolean;             // A 충족
  achievedByTotal: boolean;             // B 충족
}

// 한 멤버의 프로모션별 달성도
export function calcMemberPromotionScore(
  promo: Promotion,
  memberId: string,
  deals: Deal[],
  mappings: DealPromotion[]
): MemberPromotionScore {
  const months = getPromotionMonths(promo);
  const monthlyPiv: Record<string, number> = {};
  for (const m of months) monthlyPiv[m] = 0;

  // 이 프로모션이 적용된 매핑만 추출
  const promoMappings = mappings.filter((m) => m.promotion_id === promo.id);
  const mappingByDealId = new Map<string, number>();
  for (const m of promoMappings) mappingByDealId.set(m.deal_id, m.piv_rate);

  let appliedDealCount = 0;
  for (const d of deals) {
    if (d.member_id !== memberId) continue;
    if (d.outcome !== 'WIN') continue;
    if (!d.won_at) continue;
    const rate = mappingByDealId.get(d.id);
    if (rate == null) continue;

    // WIN 시점이 프로모션 기간 내인지 확인
    const wonDate = safeDateParse(d.won_at);
    const wonStr = wonDate.toISOString().slice(0, 10);
    if (wonStr < promo.start_date || wonStr > promo.end_date) continue;

    const mk = monthKey(wonDate);
    if (!(mk in monthlyPiv)) continue;
    const piv = (d.monthly_premium || 0) * (rate / 100);
    monthlyPiv[mk] += piv;
    appliedDealCount += 1;
  }

  const totalPiv = Object.values(monthlyPiv).reduce((s, v) => s + v, 0);
  const minMonthlyPiv = Math.min(...Object.values(monthlyPiv));

  const A = promo.per_month_threshold;
  const B = promo.total_threshold;
  const monthPctIfApplicable = A > 0 ? (minMonthlyPiv / A) * 100 : null;
  const totalPctIfApplicable = B > 0 ? (totalPiv / B) * 100 : null;
  const achievedByMonth = A > 0 && minMonthlyPiv >= A;
  const achievedByTotal = B > 0 && totalPiv >= B;

  return {
    memberId,
    appliedDealCount,
    monthlyPiv,
    minMonthlyPiv,
    totalPiv,
    monthPctIfApplicable,
    totalPctIfApplicable,
    achieved: achievedByMonth || achievedByTotal,
    achievedByMonth,
    achievedByTotal,
  };
}

// 프로모션 진행률 (전체 % — UI 우선 표시용)
// A·B 모두 있으면 max(둘 다), 하나만 있으면 그 값
export function promotionPrimaryPct(score: MemberPromotionScore): number {
  const a = score.monthPctIfApplicable;
  const b = score.totalPctIfApplicable;
  if (a != null && b != null) return Math.max(a, b);
  return a ?? b ?? 0;
}

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
  // BOM 포함 (Excel 한글 깨짐 방지)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
