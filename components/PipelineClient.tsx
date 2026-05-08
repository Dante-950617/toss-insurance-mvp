'use client';

import { useState, useTransition, useMemo, type FormEvent } from 'react';
import {
  Plus,
  X,
  XCircle,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
  Timer,
  FileText,
  CreditCard,
  Save,
  Users,
  Search,
  Trash2,
  Phone,
  CalendarClock,
  StickyNote,
  UserPlus,
  Clock,
  History,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  createDeal,
  updateDealStage,
  updateDealDetail,
  deleteDeal,
  addActivity,
} from '@/lib/actions';
import { formatCurrency, getDwellDays } from '@/lib/utils';
import { STAGES, ACTIVITY_LABELS } from '@/lib/types';
import type {
  Profile,
  Deal,
  DealStage,
  DealActivity,
  ActivityType,
} from '@/lib/types';

const FAILURE_REASONS = [
  '보험료 부담',
  '타사 상품 비교 우위',
  '단순 변심',
  '연락 두절',
  '가족 반대',
];

export default function PipelineClient({
  currentUser,
  members,
  initialDeals,
  initialActivities,
}: {
  currentUser: Profile;
  members: Profile[];
  initialDeals: Deal[];
  initialActivities: DealActivity[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [activities, setActivities] = useState<DealActivity[]>(initialActivities);

  const isManager = currentUser.role === 'MANAGER';

  const repMembers = useMemo(
    () => members.filter((m) => m.role === 'REP' || m.id === currentUser.id),
    [members, currentUser.id]
  );

  const [activeMemberId, setActiveMemberId] = useState<string>(
    isManager ? repMembers[0]?.id ?? currentUser.id : currentUser.id
  );
  const [newCustomer, setNewCustomer] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<DealStage | 'ALL'>('ALL');
  const [mobileStage, setMobileStage] = useState<DealStage>('진행대기');

  const [reasonModalDeal, setReasonModalDeal] = useState<Deal | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [confirmDeleteDealId, setConfirmDeleteDealId] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState({
    type: 'call' as ActivityType,
    content: '',
  });

  const pipelineMember = members.find((m) => m.id === activeMemberId);

  const filteredDeals = useMemo(() => {
    const memberFiltered = deals.filter((d) => d.member_id === activeMemberId);
    const searchLower = search.trim().toLowerCase();
    return memberFiltered.filter((d) => {
      if (stageFilter !== 'ALL' && d.stage !== stageFilter) return false;
      if (!searchLower) return true;
      return (
        d.customer_name.toLowerCase().includes(searchLower) ||
        d.product_type.toLowerCase().includes(searchLower) ||
        d.phone.toLowerCase().includes(searchLower) ||
        d.notes.toLowerCase().includes(searchLower)
      );
    });
  }, [deals, activeMemberId, search, stageFilter]);

  const optimisticPatch = (id: string, patch: Partial<Deal>) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const handleAddDeal = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newCustomer.trim();
    if (!trimmed) {
      showToast('신규 고객명을 입력해주세요.');
      return;
    }
    const targetMemberId = isManager ? activeMemberId : currentUser.id;
    if (!targetMemberId) {
      showToast('할당할 담당자가 없습니다.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const tempId = `temp-${Date.now()}`;
    const optimisticDeal: Deal = {
      id: tempId,
      member_id: targetMemberId,
      customer_name: trimmed,
      stage: '진행대기',
      reason: '',
      product_type: '',
      monthly_premium: 0,
      competitor: '',
      manager_comment: '',
      date: today,
      last_updated: today,
      created_at: new Date().toISOString(),
      deal_value: 0,
      phone: '',
      next_contact_date: null,
      notes: '',
      referrer: '',
    };
    setDeals((prev) => [optimisticDeal, ...prev]);
    setNewCustomer('');

    startTransition(async () => {
      const res = await createDeal({
        customer_name: trimmed,
        member_id: targetMemberId,
      });
      if (res.error) {
        setDeals((prev) => prev.filter((d) => d.id !== tempId));
        showToast(`등록 실패: ${res.error}`);
      } else {
        showToast(`'${trimmed}' 딜이 진행대기에 등록되었습니다.`);
      }
    });
  };

  const handleStageSelect = (deal: Deal, raw: string) => {
    let newStage = raw as DealStage;

    if (!isManager && newStage === '계약완료') {
      showToast("클로징 처리는 관리자의 승인이 필요합니다. '승인요청' 상태로 변경합니다.");
      newStage = '클로징(승인대기)';
    }

    if (newStage === '실패') {
      setReasonModalDeal(deal);
      return;
    }

    const prevStage = deal.stage;
    const today = new Date().toISOString().slice(0, 10);
    optimisticPatch(deal.id, { stage: newStage, reason: '', last_updated: today });

    startTransition(async () => {
      const res = await updateDealStage(deal.id, newStage, '');
      if (res.error) {
        optimisticPatch(deal.id, { stage: prevStage });
        showToast(`변경 실패: ${res.error}`);
      }
    });
  };

  const handleSaveFailure = (e: FormEvent) => {
    e.preventDefault();
    if (!reasonModalDeal || !failureReason) return;
    const id = reasonModalDeal.id;
    const today = new Date().toISOString().slice(0, 10);
    const prevStage = reasonModalDeal.stage;
    const prevReason = reasonModalDeal.reason;

    optimisticPatch(id, { stage: '실패', reason: failureReason, last_updated: today });
    setReasonModalDeal(null);
    const reason = failureReason;
    setFailureReason('');

    startTransition(async () => {
      const res = await updateDealStage(id, '실패', reason);
      if (res.error) {
        optimisticPatch(id, { stage: prevStage, reason: prevReason });
        showToast(`저장 실패: ${res.error}`);
      } else {
        showToast('실패 사유가 저장되었습니다.');
      }
    });
  };

  const handleSaveDetail = (e: FormEvent) => {
    e.preventDefault();
    if (!detailDeal) return;
    const id = detailDeal.id;
    const original = deals.find((d) => d.id === id) ?? detailDeal;
    const patch = {
      product_type: detailDeal.product_type,
      monthly_premium: detailDeal.monthly_premium,
      competitor: detailDeal.competitor,
      manager_comment: detailDeal.manager_comment,
      stage: detailDeal.stage,
      deal_value: detailDeal.deal_value,
      phone: detailDeal.phone,
      next_contact_date: detailDeal.next_contact_date,
      notes: detailDeal.notes,
      referrer: detailDeal.referrer,
    };

    const today = new Date().toISOString().slice(0, 10);
    optimisticPatch(id, { ...patch, last_updated: today });
    setDetailDeal(null);

    startTransition(async () => {
      const res = await updateDealDetail(id, patch);
      if (res.error) {
        optimisticPatch(id, original);
        showToast(`저장 실패: ${res.error}`);
      } else {
        showToast('딜 상세 정보가 저장되었습니다.');
      }
    });
  };

  const handleDeleteDeal = (dealId: string) => {
    const original = deals.find((d) => d.id === dealId);
    if (!original) return;
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    setConfirmDeleteDealId(null);
    setDetailDeal(null);
    startTransition(async () => {
      const res = await deleteDeal(dealId);
      if (res.error) {
        setDeals((prev) => [original, ...prev]);
        showToast(`삭제 실패: ${res.error}`);
      } else {
        showToast('딜이 삭제되었습니다.');
      }
    });
  };

  const handleAddActivity = (e: FormEvent) => {
    e.preventDefault();
    if (!detailDeal) return;
    const trimmed = newActivity.content.trim();
    if (!trimmed) return;
    const tempId = `temp-act-${Date.now()}`;
    const optimisticAct: DealActivity = {
      id: tempId,
      deal_id: detailDeal.id,
      author_id: currentUser.id,
      activity_type: newActivity.type,
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setActivities((prev) => [optimisticAct, ...prev]);
    setNewActivity({ type: newActivity.type, content: '' });

    startTransition(async () => {
      const res = await addActivity(detailDeal.id, newActivity.type, trimmed);
      if (res.error) {
        setActivities((prev) => prev.filter((a) => a.id !== tempId));
        showToast(`기록 실패: ${res.error}`);
      } else {
        showToast('활동 기록이 저장되었습니다.');
      }
    });
  };

  const dealActivities = detailDeal
    ? activities
        .filter((a) => a.deal_id === detailDeal.id)
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    : [];

  const canManageDeal = (d: Deal) => isManager || d.member_id === currentUser.id;

  const renderCard = (deal: Deal) => {
    const dwellDays = getDwellDays(deal.last_updated);
    const stage = deal.stage;
    const isStale =
      dwellDays >= 5 && ['진행대기', '상담중', '클로징(승인대기)'].includes(stage);
    const upcomingContact =
      deal.next_contact_date &&
      new Date(deal.next_contact_date) >= new Date(Date.now() - 86400000);

    return (
      <div
        key={deal.id}
        onClick={() => setDetailDeal({ ...deal })}
        className={`bg-white rounded-[16px] p-4 shadow-sm border ${
          isStale ? 'border-red-300' : 'border-gray-100'
        } hover:border-[#3182F6] hover:shadow-md transition-all group cursor-pointer`}
      >
        <div className="flex flex-col mb-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold text-sm text-[#191F28] truncate">
              {deal.customer_name}
            </span>
            {canManageDeal(deal) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteDealId(deal.id);
                }}
                className="text-gray-300 hover:text-red-500 transition-colors p-1 -m-1 shrink-0"
                aria-label="딜 삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
            {!isManager && (stage === '클로징(승인대기)' || stage === '계약완료') ? (
              <span className="text-[10px] bg-blue-50 text-[#3182F6] px-2 py-1 rounded-md font-bold block w-fit">
                승인 진행중
              </span>
            ) : (
              <select
                className="w-full text-xs border border-gray-200 rounded-lg p-1.5 outline-none focus:border-[#3182F6] text-[#4E5968] bg-white cursor-pointer font-bold hover:bg-gray-50 transition-colors"
                value={deal.stage}
                onChange={(e) => handleStageSelect(deal, e.target.value)}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {deal.product_type && (
            <span className="inline-flex items-center text-[11px] bg-[#F2F4F6] text-[#4E5968] px-2 py-1 rounded-md font-medium">
              <FileText className="w-3 h-3 mr-1 text-gray-400" /> {deal.product_type}
            </span>
          )}
          {deal.deal_value > 0 && (
            <span className="inline-flex items-center text-[11px] bg-blue-50 text-[#3182F6] px-2 py-1 rounded-md font-bold">
              계약 {formatCurrency(deal.deal_value)}원
            </span>
          )}
          {deal.monthly_premium > 0 && (
            <span className="inline-flex items-center text-[11px] bg-green-50 text-green-700 px-2 py-1 rounded-md font-medium">
              <CreditCard className="w-3 h-3 mr-1" /> 월 {formatCurrency(deal.monthly_premium)}
            </span>
          )}
          {deal.phone && (
            <span className="inline-flex items-center text-[11px] bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-medium">
              <Phone className="w-3 h-3 mr-1" /> {deal.phone}
            </span>
          )}
        </div>

        {upcomingContact && (
          <div className="text-[11px] font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded-md flex items-center w-fit mb-2">
            <CalendarClock className="w-3 h-3 mr-1" /> 다음 연락: {deal.next_contact_date}
          </div>
        )}

        <div className="flex flex-col mt-2 border-t border-gray-50 pt-2 space-y-1.5">
          <div className="text-[10px] text-gray-400 font-medium">등록: {deal.date}</div>
          {['진행대기', '상담중', '클로징(승인대기)'].includes(stage) && (
            <div
              className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center w-fit ${
                isStale ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
              }`}
            >
              {isStale ? (
                <>
                  <AlertCircle className="w-3 h-3 mr-1" /> {dwellDays}일째 방치됨
                </>
              ) : (
                <>
                  <Timer className="w-3 h-3 mr-1" /> {dwellDays}일째 체류중
                </>
              )}
            </div>
          )}
        </div>

        {deal.stage === '실패' && deal.reason && (
          <div className="bg-red-50 text-red-600 text-[11px] font-bold p-2.5 rounded-xl break-words line-clamp-2 mt-2">
            사유: {deal.reason}
          </div>
        )}

        {deal.manager_comment && (
          <div className="mt-3 bg-blue-50/50 text-[#191F28] text-[11px] font-medium p-3 rounded-xl border border-blue-100">
            <span className="font-bold mb-1 text-[#3182F6] flex items-center">
              <ShieldCheck className="w-3 h-3 mr-1" />
              지점장 피드백
            </span>
            {deal.manager_comment}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 flex flex-col lg:h-[calc(100vh-140px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center flex-wrap">
            {isManager && repMembers.length > 0 ? (
              <select
                className="bg-transparent border-none text-xl md:text-2xl font-bold text-[#3182F6] cursor-pointer outline-none mr-2 p-0"
                value={activeMemberId}
                onChange={(e) => setActiveMemberId(e.target.value)}
              >
                {repMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[#3182F6] mr-2">
                {pipelineMember?.name ?? currentUser.name}
              </span>
            )}
            매니저의 딜 파이프라인
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            고객 미팅 진행 상황 및 체류 시간(업데이트 주기)을 세밀하게 관리하세요.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 shrink-0">
        <form onSubmit={handleAddDeal} className="flex gap-2">
          <input
            type="text"
            placeholder="신규 고객명 입력 후 엔터"
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
            className="flex-1 border-none bg-[#F2F4F6] rounded-xl p-3 px-4 focus:ring-2 focus:ring-[#3182F6] outline-none text-sm font-medium"
          />
          <button
            type="submit"
            className="bg-[#191F28] hover:bg-black text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1" /> 신규 딜
          </button>
        </form>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="검색 (고객명/전화/상품/메모)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-none bg-[#F2F4F6] rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] outline-none w-full md:w-72"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as DealStage | 'ALL')}
          className="bg-[#F2F4F6] border-none rounded-xl px-4 py-3 text-sm font-bold cursor-pointer focus:ring-2 focus:ring-[#3182F6] outline-none"
        >
          <option value="ALL">전체 단계</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Mobile: 단계 탭 + 단일 리스트 */}
      <div className="lg:hidden flex flex-col flex-1 min-h-0 gap-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-white rounded-2xl shadow-sm border border-gray-100 shrink-0">
          {STAGES.map((s) => {
            const count = filteredDeals.filter((d) => d.stage === s).length;
            const active = mobileStage === s;
            return (
              <button
                key={s}
                onClick={() => setMobileStage(s)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  active ? 'bg-[#191F28] text-white' : 'bg-transparent text-[#4E5968]'
                }`}
              >
                {s === '계약완료' && <CheckCircle className="w-3 h-3" />}
                {s === '클로징(승인대기)' && <ShieldCheck className="w-3 h-3" />}
                {s === '실패' && <XCircle className="w-3 h-3" />}
                {s}
                <span
                  className={`text-[10px] font-extrabold px-1.5 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-[#F2F4F6] text-[#8B95A1]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto pb-4 no-scrollbar">
          {filteredDeals
            .filter((d) => d.stage === mobileStage)
            .map((deal) => renderCard(deal))}
          {filteredDeals.filter((d) => d.stage === mobileStage).length === 0 && (
            <div className="text-center text-[#8B95A1] text-xs py-12 border-2 border-dashed border-gray-200 rounded-[16px] font-medium bg-white">
              해당되는 딜이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Desktop: 5단계 칸반 */}
      <div className="hidden lg:grid grid-cols-5 gap-4 pb-4 flex-1 min-h-0">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="bg-[#F2F4F6] rounded-[24px] p-4 flex flex-col h-full border border-gray-200/50 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4 px-1 shrink-0">
              <h3 className="font-bold text-[#191F28] text-sm flex items-center">
                {stage === '계약완료' && (
                  <CheckCircle className="w-4 h-4 mr-1.5 text-green-500" />
                )}
                {stage === '클로징(승인대기)' && (
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-[#3182F6]" />
                )}
                {stage === '실패' && <XCircle className="w-4 h-4 mr-1.5 text-red-500" />}
                {stage}
              </h3>
              <span className="bg-white text-[#4E5968] text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                {filteredDeals.filter((m) => m.stage === stage).length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pb-2 pr-1 no-scrollbar">
              {filteredDeals
                .filter((m) => m.stage === stage)
                .map((deal) => renderCard(deal))}

              {filteredDeals.filter((m) => m.stage === stage).length === 0 && (
                <div className="text-center text-[#8B95A1] text-xs py-10 border-2 border-dashed border-gray-200 rounded-[16px] font-medium mt-2">
                  해당되는 딜이 없습니다
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {detailDeal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-[24px] sm:rounded-[24px] p-6 sm:p-8 w-full max-w-2xl shadow-xl relative max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setDetailDeal(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center mb-6 pb-6 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mr-4 text-[#3182F6]">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-[#191F28] tracking-tight">
                  {detailDeal.customer_name}
                </h3>
                <p className="text-sm text-[#4E5968] mt-1 font-medium">
                  현재 상태:{' '}
                  <span className="font-bold text-[#3182F6] bg-blue-50 px-2 py-0.5 rounded-md ml-1">
                    {detailDeal.stage}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveDetail} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                  연락처 (전화번호)
                </label>
                <input
                  type="text"
                  placeholder="010-1234-5678"
                  value={detailDeal.phone}
                  onChange={(e) =>
                    setDetailDeal({ ...detailDeal, phone: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                  readOnly={!canManageDeal(detailDeal)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    다음 컨택 예정일
                  </label>
                  <input
                    type="date"
                    value={detailDeal.next_contact_date ?? ''}
                    onChange={(e) =>
                      setDetailDeal({
                        ...detailDeal,
                        next_contact_date: e.target.value || null,
                      })
                    }
                    className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                    readOnly={!canManageDeal(detailDeal)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    추천인
                  </label>
                  <input
                    type="text"
                    placeholder="예: 김토스 고객님 소개"
                    value={detailDeal.referrer}
                    onChange={(e) =>
                      setDetailDeal({ ...detailDeal, referrer: e.target.value })
                    }
                    className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                    readOnly={!canManageDeal(detailDeal)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                  제안 상품 유형
                </label>
                <input
                  type="text"
                  placeholder="예: 종합건강보험, 종신보험 등"
                  value={detailDeal.product_type}
                  onChange={(e) =>
                    setDetailDeal({ ...detailDeal, product_type: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                  readOnly={!canManageDeal(detailDeal)}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    예상 월 납입액
                  </label>
                  <input
                    type="number"
                    value={detailDeal.monthly_premium || ''}
                    onChange={(e) =>
                      setDetailDeal({
                        ...detailDeal,
                        monthly_premium: Number(e.target.value),
                      })
                    }
                    className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                    readOnly={!canManageDeal(detailDeal)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    계약 매출액 (원) <span className="text-[#3182F6]">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="계약완료 시 자동 합산"
                    value={detailDeal.deal_value || ''}
                    onChange={(e) =>
                      setDetailDeal({
                        ...detailDeal,
                        deal_value: Number(e.target.value),
                      })
                    }
                    className="w-full border border-blue-200 bg-blue-50/30 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                    readOnly={!canManageDeal(detailDeal)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                    경쟁사
                  </label>
                  <input
                    type="text"
                    placeholder="A생명"
                    value={detailDeal.competitor}
                    onChange={(e) =>
                      setDetailDeal({ ...detailDeal, competitor: e.target.value })
                    }
                    className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                    readOnly={!canManageDeal(detailDeal)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#4E5968] mb-2 flex items-center">
                  <StickyNote className="w-3.5 h-3.5 mr-1" /> 자유 메모
                </label>
                <textarea
                  rows={3}
                  placeholder="고객 특이사항, 가입 의향, 관심 상품 등"
                  value={detailDeal.notes}
                  onChange={(e) =>
                    setDetailDeal({ ...detailDeal, notes: e.target.value })
                  }
                  className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none resize-none font-medium"
                  readOnly={!canManageDeal(detailDeal)}
                />
              </div>

              {isManager ? (
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                  <label className="block text-sm font-bold text-[#3182F6] mb-3 flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5" /> 내부 컨펌 및 지점장 코멘트
                  </label>
                  <textarea
                    rows={3}
                    placeholder="승인 전 확인 사항이나 클로징 조언을 입력하세요."
                    value={detailDeal.manager_comment}
                    onChange={(e) =>
                      setDetailDeal({ ...detailDeal, manager_comment: e.target.value })
                    }
                    className="w-full border border-blue-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-[#3182F6] outline-none resize-none font-medium"
                  />
                  {detailDeal.stage === '클로징(승인대기)' && (
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setDetailDeal({ ...detailDeal, stage: '계약완료' })
                        }
                        className="flex-1 bg-[#3182F6] text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm"
                      >
                        계약 승인 완료
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailDeal({ ...detailDeal, stage: '상담중' })}
                        className="flex-1 bg-white text-[#4E5968] border border-gray-200 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                      >
                        보류 (반려)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                detailDeal.manager_comment && (
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                    <h4 className="text-sm font-bold text-[#3182F6] mb-2 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1" /> 지점장 피드백
                    </h4>
                    <p className="text-sm text-blue-900 font-medium leading-relaxed">
                      {detailDeal.manager_comment}
                    </p>
                  </div>
                )
              )}

              <div className="pt-4 flex justify-between items-center gap-3">
                {canManageDeal(detailDeal) && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteDealId(detailDeal.id)}
                    className="px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> 딜 삭제
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setDetailDeal(null)}
                    className="px-5 py-3 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3 text-sm font-bold text-white bg-[#191F28] rounded-xl hover:bg-black transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-1.5" /> 변경사항 저장
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <h4 className="text-base font-bold text-[#191F28] mb-4 flex items-center">
                <History className="w-5 h-5 mr-2 text-[#3182F6]" /> 활동 타임라인
              </h4>

              <form
                onSubmit={handleAddActivity}
                className="bg-[#F9FAFB] rounded-xl p-3 mb-4 flex gap-2 items-stretch border border-gray-100"
              >
                <select
                  value={newActivity.type}
                  onChange={(e) =>
                    setNewActivity({
                      ...newActivity,
                      type: e.target.value as ActivityType,
                    })
                  }
                  className="bg-white border border-gray-200 rounded-lg px-3 text-xs font-bold cursor-pointer"
                >
                  {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((t) => (
                    <option key={t} value={t}>
                      {ACTIVITY_LABELS[t]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="활동 내용 (예: 첫 통화. 자녀 보험 관심 있음)"
                  value={newActivity.content}
                  onChange={(e) =>
                    setNewActivity({ ...newActivity, content: e.target.value })
                  }
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] outline-none"
                />
                <button
                  type="submit"
                  className="bg-[#3182F6] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 flex items-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {dealActivities.length === 0 ? (
                  <p className="text-xs text-[#8B95A1] text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                    아직 기록된 활동이 없습니다
                  </p>
                ) : (
                  dealActivities.map((act) => {
                    const author = members.find((m) => m.id === act.author_id);
                    return (
                      <div
                        key={act.id}
                        className="bg-white border border-gray-100 rounded-xl p-3 flex gap-3 items-start"
                      >
                        <div className="bg-blue-50 text-[#3182F6] text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shrink-0">
                          {ACTIVITY_LABELS[act.activity_type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#191F28] font-medium leading-relaxed break-words">
                            {act.content}
                          </p>
                          <p className="text-[10px] text-[#8B95A1] mt-1 font-medium">
                            {author?.name ?? '알 수 없음'} ·{' '}
                            {new Date(act.created_at).toLocaleString('ko-KR', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteDealId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[24px] p-8 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold text-[#191F28] mb-2 flex items-center">
              <Trash2 className="w-6 h-6 mr-2 text-red-500" /> 딜 삭제
            </h3>
            <p className="text-sm text-[#4E5968] mb-6 font-medium">
              이 딜과 관련된 활동 기록도 함께 삭제됩니다. 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteDealId(null)}
                className="px-5 py-3 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() =>
                  confirmDeleteDealId && handleDeleteDeal(confirmDeleteDealId)
                }
                className="px-5 py-3 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {reasonModalDeal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] p-8 w-full max-w-sm shadow-xl relative">
            <h3 className="text-xl font-bold text-[#191F28] mb-2 flex items-center">
              <XCircle className="w-6 h-6 mr-2 text-red-500" /> 딜 실패 사유
            </h3>
            <p className="text-sm text-[#4E5968] mb-6 font-medium">
              정확한 원인 파악이 더 나은 성장을 만듭니다.
            </p>

            <form onSubmit={handleSaveFailure}>
              <div className="space-y-2 mb-6">
                {FAILURE_REASONS.map((r) => (
                  <label
                    key={r}
                    className="flex items-center p-3.5 border border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="failureReason"
                      value={r}
                      onChange={(e) => setFailureReason(e.target.value)}
                      className="w-4 h-4 text-[#3182F6] border-gray-300 focus:ring-[#3182F6]"
                    />
                    <span className="ml-3 text-sm text-[#333D4B] font-bold">{r}</span>
                  </label>
                ))}
                <input
                  type="text"
                  placeholder="기타 직접 입력..."
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3.5 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none text-sm mt-3 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReasonModalDeal(null);
                    setFailureReason('');
                  }}
                  className="px-5 py-3 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!failureReason}
                  className="px-5 py-3 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-all"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
