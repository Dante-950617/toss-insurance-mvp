'use client';

import { useMemo, useState } from 'react';
import { Trophy, Medal, Phone, MessageCircle, Briefcase, FileText } from 'lucide-react';
import type { Profile, Deal, DealActivity } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

type Period = 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_30D';

const PERIOD_LABELS: Record<Period, string> = {
  THIS_WEEK: '이번 주',
  THIS_MONTH: '이번 달',
  LAST_30D: '최근 30일',
};

interface RepStats {
  member: Profile;
  callCount: number;
  kakaoCount: number;
  meetingCount: number;
  proposalCount: number;
  closedCount: number;
  closedRevenue: number;
  totalActivities: number;
}

export default function LeaderboardClient({
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

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'THIS_WEEK') {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((day + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      return monday;
    }
    if (period === 'THIS_MONTH')
      return new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }, [period]);

  const periodStartStr = periodStart.toISOString().slice(0, 10);

  const stats: RepStats[] = useMemo(() => {
    return members.map((member) => {
      const myActs = activities.filter(
        (a) =>
          a.author_id === member.id && a.created_at.slice(0, 10) >= periodStartStr
      );
      const myDeals = deals.filter((d) => d.member_id === member.id);

      const closed = myDeals.filter(
        (d) => d.stage === '계약완료' && d.last_updated >= periodStartStr
      );

      const callCount = myActs.filter(
        (a) => a.activity_type === 'call_success' || a.activity_type === 'call'
      ).length;
      const kakaoCount = myActs.filter((a) => a.activity_type === 'kakao_send').length;
      const meetingCount = myActs.filter(
        (a) =>
          a.activity_type === 'meeting_done' ||
          a.activity_type === 'meeting_set' ||
          a.activity_type === 'meeting'
      ).length;
      const proposalCount = myActs.filter(
        (a) => a.activity_type === 'proposal_sent' || a.activity_type === 'proposal'
      ).length;

      return {
        member,
        callCount,
        kakaoCount,
        meetingCount,
        proposalCount,
        closedCount: closed.length,
        closedRevenue: closed.reduce((s, d) => s + (d.deal_value || 0), 0),
        totalActivities: myActs.length,
      };
    });
  }, [members, activities, deals, periodStartStr]);

  const ranked = useMemo(
    () =>
      [...stats].sort(
        (a, b) =>
          b.closedRevenue - a.closedRevenue ||
          b.closedCount - a.closedCount ||
          b.totalActivities - a.totalActivities
      ),
    [stats]
  );

  const maxRevenue = Math.max(1, ...ranked.map((r) => r.closedRevenue));
  const isCurrentUser = (id: string) => id === currentUser.id;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-yellow-500" />
            팀 리더보드
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            {PERIOD_LABELS[period]} 활동량과 실적 순위.
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold cursor-pointer outline-none focus:ring-2 focus:ring-[#3182F6]"
        >
          {Object.entries(PERIOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {ranked.length === 0 ? (
          <p className="text-sm text-[#8B95A1] text-center py-12 bg-white rounded-2xl border border-gray-100">
            아직 활성 팀원이 없습니다.
          </p>
        ) : (
          ranked.map((s, idx) => {
            const rankIcon =
              idx === 0
                ? '🥇'
                : idx === 1
                  ? '🥈'
                  : idx === 2
                    ? '🥉'
                    : `${idx + 1}.`;
            const isMe = isCurrentUser(s.member.id);
            return (
              <div
                key={s.member.id}
                className={`bg-white rounded-[20px] p-5 shadow-sm border ${
                  isMe ? 'border-[#3182F6] ring-2 ring-blue-100' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold w-10 text-center">
                      {rankIcon}
                    </span>
                    <div>
                      <p className="text-base font-bold text-[#191F28]">
                        {s.member.name}{' '}
                        {isMe && (
                          <span className="text-[10px] font-extrabold text-[#3182F6] bg-blue-50 px-1.5 py-0.5 rounded ml-1">
                            나
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#8B95A1] font-medium">
                        총 활동 {s.totalActivities}건
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg md:text-xl font-extrabold text-[#3182F6]">
                      {formatCurrency(s.closedRevenue)}원
                    </p>
                    <p className="text-[11px] text-[#8B95A1] font-medium">
                      계약 {s.closedCount}건
                    </p>
                  </div>
                </div>

                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-[#3182F6] rounded-full transition-all"
                    style={{ width: `${(s.closedRevenue / maxRevenue) * 100}%` }}
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <ActivityChip Icon={Phone} label="통화" count={s.callCount} />
                  <ActivityChip
                    Icon={MessageCircle}
                    label="카톡"
                    count={s.kakaoCount}
                  />
                  <ActivityChip Icon={Briefcase} label="미팅" count={s.meetingCount} />
                  <ActivityChip
                    Icon={FileText}
                    label="설계서"
                    count={s.proposalCount}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ActivityChip({
  Icon,
  label,
  count,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <div className="bg-[#F9FAFB] rounded-lg p-2 text-center border border-gray-100">
      <div className="flex items-center justify-center text-[#4E5968] mb-1">
        <Icon className="w-3 h-3 mr-1" />
        <span className="text-[10px] font-bold">{label}</span>
      </div>
      <p className="text-sm font-extrabold text-[#191F28]">{count}</p>
    </div>
  );
}
