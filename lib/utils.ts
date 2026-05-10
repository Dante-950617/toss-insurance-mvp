import type { Profile, CalculatedMember, Deal } from './types';

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
