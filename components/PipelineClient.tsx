'use client';

import { useState, useTransition, type FormEvent } from 'react';
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
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  createDeal,
  updateDealStage,
  updateDealDetail,
} from '@/lib/actions';
import { formatCurrency, getDwellDays } from '@/lib/utils';
import { STAGES } from '@/lib/types';
import type { Profile, Deal, DealStage } from '@/lib/types';

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
}: {
  currentUser: Profile;
  members: Profile[];
  initialDeals: Deal[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);

  const isManager = currentUser.role === 'MANAGER';

  const [activeMemberId, setActiveMemberId] = useState<string>(
    isManager ? members[0]?.id ?? currentUser.id : currentUser.id
  );
  const [newCustomer, setNewCustomer] = useState('');

  const [reasonModalDeal, setReasonModalDeal] = useState<Deal | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);

  const pipelineMember = members.find((m) => m.id === activeMemberId);
  const memberDeals = deals.filter((m) => m.member_id === activeMemberId);

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

    if (!isManager && (newStage === '계약완료')) {
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
    const original = initialDeals.find((d) => d.id === id) ?? detailDeal;
    const patch = {
      product_type: detailDeal.product_type,
      monthly_premium: detailDeal.monthly_premium,
      competitor: detailDeal.competitor,
      manager_comment: detailDeal.manager_comment,
      stage: detailDeal.stage,
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

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            {isManager && members.length > 0 ? (
              <select
                className="bg-transparent border-none text-2xl font-bold text-[#3182F6] cursor-pointer outline-none mr-2 p-0"
                value={activeMemberId}
                onChange={(e) => setActiveMemberId(e.target.value)}
              >
                {members.map((m) => (
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
          <p className="text-[#4E5968] mt-1 text-sm font-medium">
            고객 미팅 진행 상황 및 체류 시간(업데이트 주기)을 세밀하게 관리하세요.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex gap-2 shrink-0">
        <form onSubmit={handleAddDeal} className="w-full flex gap-2">
          <input
            type="text"
            placeholder="신규 고객명 (예: 김토스 고객님) 입력 후 엔터"
            value={newCustomer}
            onChange={(e) => setNewCustomer(e.target.value)}
            className="flex-1 border-none bg-[#F2F4F6] rounded-xl p-3 px-4 focus:ring-2 focus:ring-[#3182F6] outline-none text-sm font-medium"
          />
          <button
            type="submit"
            className="bg-[#191F28] hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> 신규 딜 등록
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pb-4 flex-1 min-h-0">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="bg-[#F2F4F6] rounded-[24px] p-4 flex flex-col h-full border border-gray-200/50 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4 px-1 shrink-0">
              <h3 className="font-bold text-[#191F28] text-sm flex items-center">
                {stage === '계약완료' && <CheckCircle className="w-4 h-4 mr-1.5 text-green-500" />}
                {stage === '클로징(승인대기)' && (
                  <ShieldCheck className="w-4 h-4 mr-1.5 text-[#3182F6]" />
                )}
                {stage === '실패' && <XCircle className="w-4 h-4 mr-1.5 text-red-500" />}
                {stage}
              </h3>
              <span className="bg-white text-[#4E5968] text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                {memberDeals.filter((m) => m.stage === stage).length}
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pb-2 pr-1 no-scrollbar">
              {memberDeals
                .filter((m) => m.stage === stage)
                .map((deal) => {
                  const dwellDays = getDwellDays(deal.last_updated);
                  const isStale =
                    dwellDays >= 5 &&
                    ['진행대기', '상담중', '클로징(승인대기)'].includes(stage);

                  return (
                    <div
                      key={deal.id}
                      onClick={() => setDetailDeal({ ...deal })}
                      className={`bg-white rounded-[16px] p-4 shadow-sm border ${
                        isStale ? 'border-red-300' : 'border-gray-100'
                      } hover:border-[#3182F6] hover:shadow-md transition-all group cursor-pointer`}
                    >
                      <div className="flex flex-col mb-3 space-y-2">
                        <span className="font-bold text-sm text-[#191F28] truncate w-full">
                          {deal.customer_name}
                        </span>
                        <div
                          className="relative w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isManager &&
                          (stage === '클로징(승인대기)' || stage === '계약완료') ? (
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

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {deal.product_type && (
                          <span className="inline-flex items-center text-[11px] bg-[#F2F4F6] text-[#4E5968] px-2 py-1 rounded-md font-medium">
                            <FileText className="w-3 h-3 mr-1 text-gray-400" />{' '}
                            {deal.product_type}
                          </span>
                        )}
                        {deal.monthly_premium > 0 && (
                          <span className="inline-flex items-center text-[11px] bg-green-50 text-green-700 px-2 py-1 rounded-md font-medium">
                            <CreditCard className="w-3 h-3 mr-1" />{' '}
                            {formatCurrency(deal.monthly_premium)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col mt-2 border-t border-gray-50 pt-2 space-y-1.5">
                        <div className="text-[10px] text-gray-400 font-medium">
                          등록: {deal.date}
                        </div>
                        {['진행대기', '상담중', '클로징(승인대기)'].includes(stage) && (
                          <div
                            className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center w-fit ${
                              isStale
                                ? 'bg-red-50 text-red-600'
                                : 'bg-gray-50 text-gray-500'
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
                })}

              {memberDeals.filter((m) => m.stage === stage).length === 0 && (
                <div className="text-center text-[#8B95A1] text-xs py-10 border-2 border-dashed border-gray-200 rounded-[16px] font-medium mt-2">
                  해당되는 딜이 없습니다
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {detailDeal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] p-8 w-full max-w-lg shadow-xl relative">
            <button
              onClick={() => setDetailDeal(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center mb-8 pb-6 border-b border-gray-100">
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

            <form onSubmit={handleSaveDetail} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-base font-bold text-[#191F28]">딜(Deal) 상세 정보</h4>

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
                    readOnly={isManager}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                      예상 월 납입액 (원)
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
                      readOnly={isManager}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                      경쟁사 / 비교 업체
                    </label>
                    <input
                      type="text"
                      placeholder="예: A생명, B손보"
                      value={detailDeal.competitor}
                      onChange={(e) =>
                        setDetailDeal({ ...detailDeal, competitor: e.target.value })
                      }
                      className="w-full border border-gray-200 bg-gray-50/50 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none transition-all font-medium"
                      readOnly={isManager}
                    />
                  </div>
                </div>
              </div>

              {isManager ? (
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 mt-6">
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
                        onClick={() => setDetailDeal({ ...detailDeal, stage: '계약완료' })}
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
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 mt-6">
                    <h4 className="text-sm font-bold text-[#3182F6] mb-2 flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1" /> 지점장 피드백
                    </h4>
                    <p className="text-sm text-blue-900 font-medium leading-relaxed">
                      {detailDeal.manager_comment}
                    </p>
                  </div>
                )
              )}

              <div className="pt-6 mt-2 flex justify-end gap-3">
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
            </form>
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
