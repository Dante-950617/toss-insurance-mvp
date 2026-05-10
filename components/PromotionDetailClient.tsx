'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Gift,
  ArrowLeft,
  Calendar,
  Trophy,
  Users,
  Download,
  Target,
} from 'lucide-react';
import {
  formatCurrency,
  calcMemberPromotionScore,
  promotionPrimaryPct,
  getPromotionMonths,
  downloadCSV,
} from '@/lib/utils';
import { PROMOTION_STATUS_LABEL } from '@/lib/types';
import type {
  Profile,
  Promotion,
  Deal,
  DealPromotion,
} from '@/lib/types';

export default function PromotionDetailClient({
  currentUser,
  promotion,
  deals,
  mappings,
  members,
}: {
  currentUser: Profile;
  promotion: Promotion;
  deals: Deal[];
  mappings: DealPromotion[];
  members: Profile[];
}) {
  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  // 매핑된 딜 ID 집합
  const mappedDealIds = useMemo(
    () => new Set(mappings.map((m) => m.deal_id)),
    [mappings]
  );

  // 참여 멤버 = 이 프로모션이 적용된 딜의 owner
  // + 매니저는 모든 ACTIVE REP 도 표시 (0%)
  const isManager = currentUser.role === 'MANAGER';
  const involvedMemberIds = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      if (mappedDealIds.has(d.id)) set.add(d.member_id);
    }
    return set;
  }, [deals, mappedDealIds]);

  const displayMembers = useMemo(() => {
    if (isManager) {
      // 매니저: 모든 ACTIVE REP + 매핑된 매니저들
      const ids = new Set<string>(involvedMemberIds);
      members
        .filter((m) => m.role === 'REP' && m.status === 'ACTIVE')
        .forEach((m) => ids.add(m.id));
      return Array.from(ids).map((id) => memberMap.get(id)!).filter(Boolean);
    }
    // REP: 본인만
    return members.filter((m) => m.id === currentUser.id);
  }, [isManager, members, involvedMemberIds, memberMap, currentUser.id]);

  const scores = useMemo(
    () =>
      displayMembers.map((m) => ({
        member: m,
        score: calcMemberPromotionScore(promotion, m.id, deals, mappings),
      })),
    [displayMembers, promotion, deals, mappings]
  );

  // 정렬: 달성자 우선 → 누적/단월 % desc
  const sortedScores = useMemo(() => {
    return [...scores].sort((a, b) => {
      if (a.score.achieved !== b.score.achieved) return a.score.achieved ? -1 : 1;
      return promotionPrimaryPct(b.score) - promotionPrimaryPct(a.score);
    });
  }, [scores]);

  // 본인 score
  const mySelf = scores.find((s) => s.member.id === currentUser.id);

  // 매핑된 딜 목록 (테이블)
  const mappedDeals = useMemo(() => {
    return deals
      .filter((d) => mappedDealIds.has(d.id))
      .map((d) => ({
        deal: d,
        rate: mappings.find((m) => m.deal_id === d.id)?.piv_rate ?? 0,
      }))
      .sort((a, b) => {
        const at = a.deal.won_at ?? a.deal.last_updated;
        const bt = b.deal.won_at ?? b.deal.last_updated;
        return bt.localeCompare(at);
      });
  }, [deals, mappedDealIds, mappings]);

  const months = getPromotionMonths(promotion);

  const dDays = Math.ceil(
    (new Date(promotion.end_date).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const exportLeaderboard = () => {
    const rows: (string | number | null | undefined)[][] = [
      ['담당자', '적용 딜 수', '단월 최저 PIV', '단월 %', '누적 PIV', '누적 %', '달성', ...months.map((m) => `${m} PIV`)],
    ];
    for (const { member, score } of sortedScores) {
      rows.push([
        member.name,
        score.appliedDealCount,
        Math.round(score.minMonthlyPiv),
        score.monthPctIfApplicable != null ? score.monthPctIfApplicable.toFixed(1) : '-',
        Math.round(score.totalPiv),
        score.totalPctIfApplicable != null ? score.totalPctIfApplicable.toFixed(1) : '-',
        score.achieved
          ? score.achievedByMonth && score.achievedByTotal
            ? 'A·B'
            : score.achievedByMonth
            ? 'A'
            : 'B'
          : '미달성',
        ...months.map((m) => Math.round(score.monthlyPiv[m] ?? 0)),
      ]);
    }
    downloadCSV(`promotion_${promotion.name}_leaderboard.csv`, rows);
  };

  const statusColor =
    promotion.status === 'active'
      ? 'bg-green-50 text-green-700 border-green-100'
      : promotion.status === 'draft'
      ? 'bg-gray-100 text-gray-600 border-gray-200'
      : 'bg-gray-50 text-[#8B95A1] border-gray-100';

  return (
    <div className="space-y-6 py-6">
      <Link
        href="/promotions"
        className="text-sm font-bold text-[#3182F6] hover:underline flex items-center w-fit"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> 프로모션 목록
      </Link>

      {/* 헤더 */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-start mb-3 gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
              <Gift className="w-6 h-6 mr-2 text-[#3182F6]" />
              {promotion.name}
            </h1>
            <p className="text-xs md:text-sm text-[#4E5968] mt-2 font-medium flex items-center flex-wrap gap-x-2">
              <Calendar className="w-3.5 h-3.5" />
              {promotion.start_date} ~ {promotion.end_date}
              {promotion.status === 'active' && (
                <span className="text-[#3182F6] font-bold">
                  {dDays >= 0 ? `D-${dDays}` : `종료 ${Math.abs(dDays)}일`}
                </span>
              )}
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusColor}`}>
                {PROMOTION_STATUS_LABEL[promotion.status]}
              </span>
            </p>
          </div>
          <button
            onClick={exportLeaderboard}
            className="bg-white border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2 text-xs font-bold flex items-center transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {promotion.per_month_threshold > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
              <p className="text-[11px] font-bold text-[#3182F6]">단월 기준</p>
              <p className="text-base font-extrabold text-[#191F28] mt-0.5">
                매월 PIV ≥ {formatCurrency(promotion.per_month_threshold)}원
              </p>
            </div>
          )}
          {promotion.total_threshold > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
              <p className="text-[11px] font-bold text-[#3182F6]">누적 기준</p>
              <p className="text-base font-extrabold text-[#191F28] mt-0.5">
                전체 합산 PIV ≥ {formatCurrency(promotion.total_threshold)}원
              </p>
            </div>
          )}
        </div>

        {promotion.description && (
          <div className="mt-4 bg-[#F9FAFB] border border-gray-100 rounded-xl p-3 text-sm text-[#4E5968] font-medium whitespace-pre-wrap">
            {promotion.description}
          </div>
        )}
      </div>

      {/* 본인 진척 (REP·매니저 모두) */}
      {mySelf && mySelf.score.appliedDealCount > 0 && (
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-[#191F28] mb-4 flex items-center">
            <Target className="w-4 h-4 mr-1.5 text-[#3182F6]" /> 내 진척률
          </h2>
          <ScoreBars score={mySelf.score} promo={promotion} />
        </div>
      )}

      {/* 담당자 리더보드 */}
      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-[#191F28] mb-4 flex items-center">
          <Users className="w-4 h-4 mr-1.5 text-[#3182F6]" />
          담당자 달성 현황 ({sortedScores.length}명)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F9FAFB] text-[#4E5968] text-xs">
              <tr>
                <th className="py-2.5 px-3 font-bold w-10">#</th>
                <th className="py-2.5 px-3 font-bold">담당자</th>
                <th className="py-2.5 px-3 font-bold text-right">적용 딜</th>
                {promotion.per_month_threshold > 0 && (
                  <th className="py-2.5 px-3 font-bold text-right">단월 최저 / A</th>
                )}
                {promotion.total_threshold > 0 && (
                  <th className="py-2.5 px-3 font-bold text-right">누적 / B</th>
                )}
                <th className="py-2.5 px-3 font-bold text-center">달성</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {sortedScores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#8B95A1] font-medium">
                    아직 적용된 딜이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedScores.map(({ member, score }, idx) => (
                  <tr
                    key={member.id}
                    className={`border-t border-gray-100 hover:bg-[#F9FAFB] transition-colors ${
                      member.id === currentUser.id ? 'bg-blue-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-[#8B95A1] font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 font-bold text-[#191F28]">
                      {member.name}
                      {member.id === currentUser.id && (
                        <span className="ml-1 text-[10px] text-[#3182F6] font-bold">(나)</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-[#4E5968]">
                      {score.appliedDealCount}건
                    </td>
                    {promotion.per_month_threshold > 0 && (
                      <td className="py-3 px-3 text-right">
                        <span className="text-[#191F28] font-medium">
                          {formatCurrency(Math.round(score.minMonthlyPiv))}원
                        </span>
                        <br />
                        <span
                          className={`text-[11px] font-extrabold ${
                            score.achievedByMonth ? 'text-green-600' : 'text-[#8B95A1]'
                          }`}
                        >
                          {(score.monthPctIfApplicable ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    )}
                    {promotion.total_threshold > 0 && (
                      <td className="py-3 px-3 text-right">
                        <span className="text-[#191F28] font-medium">
                          {formatCurrency(Math.round(score.totalPiv))}원
                        </span>
                        <br />
                        <span
                          className={`text-[11px] font-extrabold ${
                            score.achievedByTotal ? 'text-green-600' : 'text-[#8B95A1]'
                          }`}
                        >
                          {(score.totalPctIfApplicable ?? 0).toFixed(1)}%
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-3 text-center">
                      {score.achieved ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                          <Trophy className="w-3 h-3" />
                          {score.achievedByMonth && score.achievedByTotal
                            ? 'A·B'
                            : score.achievedByMonth
                            ? 'A'
                            : 'B'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#8B95A1]">
                          미달성
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 적용 딜 목록 (매니저만 / 또는 본인 딜) */}
      {(isManager || mappedDeals.some((d) => d.deal.member_id === currentUser.id)) && (
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-bold text-[#191F28] mb-4">
            적용된 딜 ({mappedDeals.filter((d) => isManager || d.deal.member_id === currentUser.id).length}건)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F9FAFB] text-[#4E5968] text-xs">
                <tr>
                  <th className="py-2.5 px-3 font-bold">고객</th>
                  <th className="py-2.5 px-3 font-bold">담당</th>
                  <th className="py-2.5 px-3 font-bold text-right">월납</th>
                  <th className="py-2.5 px-3 font-bold text-right">PIV율</th>
                  <th className="py-2.5 px-3 font-bold text-right">환산 PIV</th>
                  <th className="py-2.5 px-3 font-bold">WIN 시점</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {mappedDeals
                  .filter((d) => isManager || d.deal.member_id === currentUser.id)
                  .map(({ deal, rate }) => {
                    const piv = (deal.monthly_premium || 0) * (rate / 100);
                    return (
                      <tr key={deal.id} className="border-t border-gray-100 hover:bg-[#F9FAFB]">
                        <td className="py-3 px-3 font-bold text-[#191F28]">
                          <Link
                            href={`/pipeline?deal=${deal.id}`}
                            className="hover:text-[#3182F6]"
                          >
                            {deal.customer_name}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-[#4E5968]">
                          {memberMap.get(deal.member_id)?.name ?? '-'}
                        </td>
                        <td className="py-3 px-3 text-right text-[#4E5968]">
                          {formatCurrency(deal.monthly_premium || 0)}원
                        </td>
                        <td className="py-3 px-3 text-right text-[#4E5968]">
                          {rate.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right text-[#3182F6] font-bold">
                          {formatCurrency(Math.round(piv))}원
                        </td>
                        <td className="py-3 px-3 text-[#8B95A1] text-xs">
                          {deal.won_at ? deal.won_at.slice(0, 10) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                {mappedDeals.filter((d) => isManager || d.deal.member_id === currentUser.id).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#8B95A1] font-medium">
                      적용된 딜이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBars({
  score,
  promo,
}: {
  score: ReturnType<typeof calcMemberPromotionScore>;
  promo: Promotion;
}) {
  return (
    <div className="space-y-4">
      {promo.per_month_threshold > 0 && (
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] font-bold text-[#4E5968]">
              단월 (매월 ≥ {formatCurrency(promo.per_month_threshold)}원)
            </span>
            <span
              className={`text-sm font-extrabold ${
                score.achievedByMonth ? 'text-green-600' : 'text-[#3182F6]'
              }`}
            >
              {(score.monthPctIfApplicable ?? 0).toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                score.achievedByMonth ? 'bg-green-500' : 'bg-[#3182F6]'
              }`}
              style={{
                width: `${Math.min((score.monthPctIfApplicable ?? 0), 100)}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-[#8B95A1] font-medium mt-1">
            단월 최저 = {formatCurrency(Math.round(score.minMonthlyPiv))}원
          </p>
        </div>
      )}
      {promo.total_threshold > 0 && (
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] font-bold text-[#4E5968]">
              누적 (전체 ≥ {formatCurrency(promo.total_threshold)}원)
            </span>
            <span
              className={`text-sm font-extrabold ${
                score.achievedByTotal ? 'text-green-600' : 'text-[#3182F6]'
              }`}
            >
              {(score.totalPctIfApplicable ?? 0).toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                score.achievedByTotal ? 'bg-green-500' : 'bg-[#3182F6]'
              }`}
              style={{
                width: `${Math.min((score.totalPctIfApplicable ?? 0), 100)}%`,
              }}
            />
          </div>
          <p className="text-[10px] text-[#8B95A1] font-medium mt-1">
            누적 = {formatCurrency(Math.round(score.totalPiv))}원
          </p>
        </div>
      )}
    </div>
  );
}
