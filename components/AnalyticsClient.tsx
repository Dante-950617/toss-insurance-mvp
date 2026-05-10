'use client';

import { useMemo, useState } from 'react';
import { BarChart2, XCircle, Activity, Download, Filter } from 'lucide-react';
import type {
  Profile,
  Deal,
  DealActivity,
  ActivityType,
  DealStage,
} from '@/lib/types';
import { ACTIVITY_LABELS, STAGES } from '@/lib/types';
import { formatCurrency, downloadCSV } from '@/lib/utils';

type Period = 'THIS_MONTH' | 'LAST_30D' | 'ALL';

export default function AnalyticsClient({
  currentUser,
  members,
  deals,
  activities,
}: {
  currentUser: Profile;
  members: Profile[];
  deals: Deal[];
  activities: DealActivity[];
}) {
  const [period, setPeriod] = useState<Period>('THIS_MONTH');
  const [memberFilter, setMemberFilter] = useState<string>('ALL');

  const now = useMemo(() => new Date(), []);
  const periodStart = useMemo(() => {
    if (period === 'THIS_MONTH')
      return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'LAST_30D')
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return new Date(0);
  }, [period, now]);

  const periodStartStr = periodStart.toISOString().slice(0, 10);

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      if (memberFilter !== 'ALL' && d.member_id !== memberFilter) return false;
      // 진행대기 진입 시점 = date (등록일) 기준으로 퍼널 분석 (잔존율의 분모)
      return d.date >= periodStartStr;
    });
  }, [deals, memberFilter, periodStartStr]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (memberFilter !== 'ALL' && a.author_id !== memberFilter) return false;
      return a.created_at.slice(0, 10) >= periodStartStr;
    });
  }, [activities, memberFilter, periodStartStr]);

  // -------- 퍼널 잔존율 --------
  // 각 딜의 현재 stage 인덱스 = 도달한 최고 단계 (LOSE 처리되어도 stage 보존됨)
  const stageIndex = (s: DealStage) => STAGES.indexOf(s);
  const totalEntered = filteredDeals.length; // 진행대기 진입 (= 분모)

  const funnelRows = useMemo(() => {
    return STAGES.map((s, i) => {
      const reached = filteredDeals.filter((d) => stageIndex(d.stage) >= i).length;
      const lostHere = filteredDeals.filter(
        (d) => (d.outcome ?? 'PENDING') === 'LOSE' && d.stage === s
      ).length;
      const stillHere = filteredDeals.filter(
        (d) => d.stage === s && (d.outcome ?? 'PENDING') === 'PENDING'
      ).length;
      const wonHere = filteredDeals.filter(
        (d) => d.stage === s && (d.outcome ?? 'PENDING') === 'WIN'
      ).length;
      const pct = totalEntered > 0 ? (reached / totalEntered) * 100 : 0;
      return { stage: s, reached, lostHere, stillHere, wonHere, pct };
    });
  }, [filteredDeals, totalEntered]);

  // -------- Drop 사유 (LOSE) --------
  const dropReasonCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of filteredDeals.filter(
      (x) => (x.outcome ?? 'PENDING') === 'LOSE' && x.reason
    )) {
      map.set(d.reason, (map.get(d.reason) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredDeals]);

  // -------- 활동 타입별 집계 --------
  const activityCounts = useMemo(() => {
    const map = new Map<ActivityType, number>();
    for (const a of filteredActivities) {
      map.set(a.activity_type, (map.get(a.activity_type) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredActivities]);

  // -------- 요약 --------
  const wonDeals = filteredDeals.filter((d) => (d.outcome ?? 'PENDING') === 'WIN');
  const lostDeals = filteredDeals.filter((d) => (d.outcome ?? 'PENDING') === 'LOSE');
  const totalRevenue = wonDeals.reduce((s, d) => s + (d.monthly_premium || 0), 0);
  const conversionRate =
    totalEntered > 0 ? ((wonDeals.length / totalEntered) * 100).toFixed(1) : '0';

  const maxDropCount = dropReasonCounts[0]?.[1] ?? 1;
  const maxActivityCount = activityCounts[0]?.[1] ?? 1;

  const exportDeals = () => {
    const memberMap = new Map(members.map((m) => [m.id, m.name]));
    const rows: (string | number | null | undefined)[][] = [
      [
        '담당자',
        '고객명',
        '단계',
        '결과',
        '월납',
        '전화',
        '다음컨택',
        'LOSE사유',
        '등록일',
        '최종갱신',
      ],
    ];
    for (const d of filteredDeals) {
      rows.push([
        memberMap.get(d.member_id) ?? '',
        d.customer_name,
        d.stage,
        d.outcome ?? 'PENDING',
        d.monthly_premium || 0,
        d.phone || '',
        d.next_contact_date || '',
        d.reason || '',
        d.date,
        d.last_updated,
      ]);
    }
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCSV(`deals_${dateTag}.csv`, rows);
  };

  const exportFunnel = () => {
    const rows: (string | number | null | undefined)[][] = [
      ['단계', '도달', '도달률(%)', '체류중', 'LOSE', 'WIN'],
    ];
    for (const r of funnelRows) {
      rows.push([
        r.stage,
        r.reached,
        r.pct.toFixed(1),
        r.stillHere,
        r.lostHere,
        r.wonHere,
      ]);
    }
    const memberLabel =
      memberFilter === 'ALL'
        ? 'team'
        : (members.find((m) => m.id === memberFilter)?.name ?? 'member');
    downloadCSV(
      `funnel_${memberLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    );
  };

  const exportActivities = () => {
    const memberMap = new Map(members.map((m) => [m.id, m.name]));
    const rows: (string | number | null | undefined)[][] = [
      ['담당자', '활동타입', '내용', '딜ID', '시각'],
    ];
    for (const a of filteredActivities) {
      rows.push([
        memberMap.get(a.author_id) ?? '',
        ACTIVITY_LABELS[a.activity_type] ?? a.activity_type,
        a.content,
        a.deal_id,
        new Date(a.created_at).toLocaleString('ko-KR'),
      ]);
    }
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCSV(`activities_${dateTag}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            <BarChart2 className="w-6 h-6 mr-2 text-[#3182F6]" />
            영업 분석
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            퍼널 잔존율 / LOSE 사유 / 활동 패턴 — 담당자별·팀별 코칭 데이터.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold cursor-pointer outline-none focus:ring-2 focus:ring-[#3182F6]"
          >
            <option value="ALL">팀 전체</option>
            {members
              .filter((m) => m.role === 'REP')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold cursor-pointer outline-none focus:ring-2 focus:ring-[#3182F6]"
          >
            <option value="THIS_MONTH">이번 달</option>
            <option value="LAST_30D">최근 30일</option>
            <option value="ALL">전체</option>
          </select>
          <button
            type="button"
            onClick={exportFunnel}
            className="bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold flex items-center transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> 퍼널 CSV
          </button>
          <button
            type="button"
            onClick={exportDeals}
            className="bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold flex items-center transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> 딜 CSV
          </button>
          <button
            type="button"
            onClick={exportActivities}
            className="bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold flex items-center transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> 활동 CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="진입 (분모)"
          value={`${totalEntered}건`}
          sub="기간 내 등록된 딜"
          color="text-[#3182F6]"
        />
        <SummaryCard
          label="WIN"
          value={`${wonDeals.length}건`}
          sub={`월납 합 ${formatCurrency(totalRevenue)}원`}
          color="text-green-600"
        />
        <SummaryCard
          label="LOSE"
          value={`${lostDeals.length}건`}
          color="text-red-500"
        />
        <SummaryCard
          label="WIN 전환율"
          value={`${conversionRate}%`}
          color="text-purple-600"
        />
      </div>

      {/* 퍼널 잔존율 */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-[#191F28] mb-1 flex items-center">
          <Filter className="w-5 h-5 mr-2 text-[#3182F6]" />
          퍼널 잔존율
        </h2>
        <p className="text-xs text-[#8B95A1] font-medium mb-5">
          {memberFilter === 'ALL'
            ? '팀 전체'
            : members.find((m) => m.id === memberFilter)?.name ?? ''}{' '}
          · 분모 = 기간 내 등록된 딜 ({totalEntered}건)
        </p>
        {totalEntered === 0 ? (
          <p className="text-sm text-[#8B95A1] text-center py-8 bg-gray-50 rounded-xl">
            해당 기간에 등록된 딜이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {funnelRows.map((r) => (
              <div key={r.stage}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-sm font-bold text-[#191F28]">
                    {r.stage}
                  </span>
                  <div className="text-xs font-medium text-[#8B95A1] flex gap-2 items-center">
                    {r.lostHere > 0 && (
                      <span className="text-red-500 font-bold">
                        ✖ {r.lostHere}
                      </span>
                    )}
                    {r.wonHere > 0 && (
                      <span className="text-green-600 font-bold">
                        🏆 {r.wonHere}
                      </span>
                    )}
                    {r.stillHere > 0 && (
                      <span className="text-[#3182F6]">
                        체류 {r.stillHere}
                      </span>
                    )}
                    <span className="font-extrabold text-[#191F28]">
                      {r.reached}건
                    </span>
                    <span className="font-extrabold text-[#3182F6] w-12 text-right">
                      {r.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#3182F6] to-blue-400 rounded-full"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* LOSE 사유 + 활동 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-[#191F28] mb-5 flex items-center">
            <XCircle className="w-5 h-5 mr-2 text-red-500" />
            LOSE 사유 TOP
          </h2>
          {dropReasonCounts.length === 0 ? (
            <p className="text-sm text-[#8B95A1] text-center py-8 bg-gray-50 rounded-xl">
              해당 기간에 LOSE 사유가 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {dropReasonCounts.map(([reason, count]) => (
                <div key={reason}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-[#191F28] truncate pr-2">
                      {reason}
                    </span>
                    <span className="text-xs font-extrabold text-red-600 shrink-0">
                      {count}건
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${(count / maxDropCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-[#191F28] mb-5 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-[#3182F6]" />
            활동 분포
          </h2>
          {activityCounts.length === 0 ? (
            <p className="text-sm text-[#8B95A1] text-center py-8 bg-gray-50 rounded-xl">
              해당 기간에 활동 기록이 없습니다.
            </p>
          ) : (
            <div className="space-y-3">
              {activityCounts.map(([type, count]) => (
                <div key={type}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-bold text-[#191F28]">
                      {ACTIVITY_LABELS[type] ?? type}
                    </span>
                    <span className="text-xs font-extrabold text-[#3182F6] shrink-0">
                      {count}건
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3182F6] rounded-full"
                      style={{ width: `${(count / maxActivityCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100">
      <p className="text-xs text-[#8B95A1] font-bold mb-1">{label}</p>
      <p className={`text-xl md:text-2xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#8B95A1] mt-1 font-medium">{sub}</p>}
    </div>
  );
}
