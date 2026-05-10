'use client';

import { useState, useTransition, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Gift,
  Plus,
  X,
  Calendar,
  Trophy,
  Edit3,
  Trash2,
  Save,
  Target,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '@/lib/actions';
import {
  formatCurrency,
  calcMemberPromotionScore,
  promotionPrimaryPct,
} from '@/lib/utils';
import { PROMOTION_STATUS_LABEL } from '@/lib/types';
import type {
  Profile,
  Promotion,
  PromotionStatus,
  Deal,
  DealPromotion,
} from '@/lib/types';

type FormState = {
  name: string;
  start_date: string;
  end_date: string;
  status: PromotionStatus;
  description: string;
  use_monthly: boolean;
  per_month_threshold: string; // 입력은 문자열, 저장 시 숫자
  use_total: boolean;
  total_threshold: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// 종료일 기본값: 오늘 + N일
const datePlusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const EMPTY_FORM: FormState = {
  name: '',
  start_date: todayStr(),
  end_date: datePlusDays(30), // 1일짜리 프로모션 실수 방지
  status: 'active',
  description: '',
  use_monthly: false,
  per_month_threshold: '',
  use_total: true,
  total_threshold: '',
};

export default function PromotionsListClient({
  currentUser,
  initialPromotions,
  deals,
  mappings,
  members,
}: {
  currentUser: Profile;
  initialPromotions: Promotion[];
  deals: Deal[];
  mappings: DealPromotion[];
  members: Profile[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions);
  const isManager = currentUser.role === 'MANAGER';

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const today = todayStr();

  const grouped = useMemo(() => {
    const active: Promotion[] = [];
    const draft: Promotion[] = [];
    const closed: Promotion[] = [];
    for (const p of promotions) {
      if (p.status === 'closed') closed.push(p);
      else if (p.status === 'draft') draft.push(p);
      else active.push(p);
    }
    return { active, draft, closed };
  }, [promotions]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, start_date: today, end_date: datePlusDays(30) });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (p: Promotion) => {
    setForm({
      name: p.name,
      start_date: p.start_date,
      end_date: p.end_date,
      status: p.status,
      description: p.description,
      use_monthly: p.per_month_threshold > 0,
      per_month_threshold: p.per_month_threshold > 0 ? String(p.per_month_threshold) : '',
      use_total: p.total_threshold > 0,
      total_threshold: p.total_threshold > 0 ? String(p.total_threshold) : '',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleCopy = (p: Promotion) => {
    setForm({
      name: `${p.name} (복사)`,
      start_date: today,
      end_date: datePlusDays(30),
      status: 'draft',
      description: p.description,
      use_monthly: p.per_month_threshold > 0,
      per_month_threshold: p.per_month_threshold > 0 ? String(p.per_month_threshold) : '',
      use_total: p.total_threshold > 0,
      total_threshold: p.total_threshold > 0 ? String(p.total_threshold) : '',
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      showToast('프로모션 이름을 입력해주세요.');
      return;
    }
    if (form.start_date > form.end_date) {
      showToast('시작일이 종료일보다 늦을 수 없습니다.');
      return;
    }
    const monthly =
      form.use_monthly && form.per_month_threshold.trim()
        ? Number(form.per_month_threshold)
        : 0;
    const total =
      form.use_total && form.total_threshold.trim()
        ? Number(form.total_threshold)
        : 0;
    if (monthly <= 0 && total <= 0) {
      showToast('단월 또는 누적 기준 중 하나는 반드시 입력해야 합니다.');
      return;
    }

    const payload = {
      name,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      description: form.description.trim(),
      per_month_threshold: monthly,
      total_threshold: total,
    };

    if (editingId) {
      const prevList = promotions;
      setPromotions((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, ...payload } : p))
      );
      const id = editingId;
      resetForm();
      startTransition(async () => {
        const res = await updatePromotion(id, payload);
        if (res.error) {
          setPromotions(prevList);
          showToast(`수정 실패: ${res.error}`);
        } else {
          showToast('프로모션이 수정되었습니다.');
        }
      });
      return;
    }

    // 신규 생성
    startTransition(async () => {
      const res = await createPromotion(payload);
      if (res.error || !res.id) {
        showToast(`등록 실패: ${res.error}`);
        return;
      }
      const optimistic: Promotion = {
        id: res.id,
        ...payload,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPromotions((prev) => [optimistic, ...prev]);
      resetForm();
      showToast('프로모션이 등록되었습니다.');
    });
  };

  const handleDelete = (id: string) => {
    const original = promotions.find((p) => p.id === id);
    if (!original) return;
    setPromotions((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
    startTransition(async () => {
      const res = await deletePromotion(id);
      if (res.error) {
        setPromotions((prev) => [original, ...prev]);
        showToast(`삭제 실패: ${res.error}`);
      } else {
        showToast('삭제되었습니다.');
      }
    });
  };

  const renderCard = (p: Promotion) => {
    const myScore = calcMemberPromotionScore(p, currentUser.id, deals, mappings);
    const myPct = promotionPrimaryPct(myScore);
    const dDays = Math.ceil(
      (new Date(p.end_date).getTime() - new Date(today).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const statusColor =
      p.status === 'active'
        ? 'bg-green-50 text-green-700 border-green-100'
        : p.status === 'draft'
        ? 'bg-gray-100 text-gray-600 border-gray-200'
        : 'bg-gray-50 text-[#8B95A1] border-gray-100';

    return (
      <div
        key={p.id}
        className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 hover:border-[#3182F6] hover:shadow-md transition-all"
      >
        <div className="flex justify-between items-start mb-3 gap-2">
          <Link href={`/promotions/${p.id}`} className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-[#191F28] truncate hover:text-[#3182F6] transition-colors">
              {p.name}
            </h3>
            <p className="text-xs text-[#8B95A1] mt-0.5 font-medium flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              {p.start_date} ~ {p.end_date}
              {p.status === 'active' && (
                <span className="ml-2 text-[#3182F6] font-bold">
                  {dDays >= 0 ? `D-${dDays}` : `종료 ${Math.abs(dDays)}일`}
                </span>
              )}
            </p>
          </Link>
          <span
            className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${statusColor}`}
          >
            {PROMOTION_STATUS_LABEL[p.status]}
          </span>
        </div>

        {/* 본인 진척 */}
        <div className="bg-[#F9FAFB] rounded-xl p-3 mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-bold text-[#4E5968]">
              내 진척률
            </span>
            <span className="text-sm font-extrabold text-[#3182F6]">
              {myPct.toFixed(1)}%
              {myScore.achieved && (
                <span className="ml-1 text-green-600">
                  <Trophy className="w-3.5 h-3.5 inline" />
                </span>
              )}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                myScore.achieved ? 'bg-green-500' : 'bg-[#3182F6]'
              }`}
              style={{ width: `${Math.min(myPct, 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-[#8B95A1] mt-1.5 flex flex-wrap gap-x-2">
            <span>적용 딜 {myScore.appliedDealCount}건</span>
            <span>·</span>
            <span>누적 {formatCurrency(Math.round(myScore.totalPiv))}원</span>
          </div>
        </div>

        {/* 달성 조건 */}
        <div className="text-[10px] text-[#4E5968] font-medium space-y-0.5">
          {p.per_month_threshold > 0 && (
            <p>
              · 단월 ≥ {formatCurrency(p.per_month_threshold)}원
            </p>
          )}
          {p.total_threshold > 0 && (
            <p>
              · 누적 ≥ {formatCurrency(p.total_threshold)}원
            </p>
          )}
        </div>

        {p.description && (
          <p className="text-[11px] text-[#4E5968] font-medium mt-3 bg-blue-50/50 p-2 rounded-lg border border-blue-100 line-clamp-2">
            {p.description}
          </p>
        )}

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
          <Link
            href={`/promotions/${p.id}`}
            className="text-xs font-bold text-[#3182F6] hover:underline flex items-center"
          >
            <Target className="w-3 h-3 mr-1" /> 상세 보기
          </Link>
          {isManager && (
            <div className="flex gap-1">
              <button
                onClick={() => handleCopy(p)}
                className="text-[10px] font-bold text-[#4E5968] bg-[#F2F4F6] px-2 py-1 rounded hover:bg-gray-200"
                title="복사하여 새로 만들기"
              >
                복사
              </button>
              <button
                onClick={() => openEdit(p)}
                className="text-[#4E5968] hover:text-[#3182F6] hover:bg-blue-50 p-1 rounded"
                aria-label="수정"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDeleteId(p.id)}
                className="text-[#4E5968] hover:text-red-500 hover:bg-red-50 p-1 rounded"
                aria-label="삭제"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            <Gift className="w-6 h-6 mr-2 text-[#3182F6]" />
            프로모션
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            진행 중인 프로모션과 달성 현황을 한눈에 확인하세요.
          </p>
        </div>
        {isManager && (
          <button
            onClick={openCreate}
            className="bg-[#3182F6] hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> 신규 프로모션
          </button>
        )}
      </div>

      {/* 진행중 */}
      <section>
        <h2 className="text-sm font-bold text-[#191F28] mb-3 flex items-center">
          진행중 ({grouped.active.length})
          <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </h2>
        {grouped.active.length === 0 ? (
          <div className="bg-white rounded-[20px] p-8 text-center text-[#8B95A1] text-sm font-medium border border-gray-100">
            진행중인 프로모션이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.active.map((p) => renderCard(p))}
          </div>
        )}
      </section>

      {/* 준비중 */}
      {grouped.draft.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-[#191F28] mb-3">
            준비중 ({grouped.draft.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.draft.map((p) => renderCard(p))}
          </div>
        </section>
      )}

      {/* 종료 */}
      {grouped.closed.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-[#8B95A1] mb-3">
            종료 ({grouped.closed.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.closed.map((p) => renderCard(p))}
          </div>
        </section>
      )}

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-[24px] sm:rounded-[24px] p-6 w-full max-w-xl shadow-xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[#191F28] flex items-center">
                {editingId ? (
                  <>
                    <Edit3 className="w-5 h-5 mr-2 text-[#3182F6]" /> 프로모션 수정
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2 text-[#3182F6]" /> 신규 프로모션
                  </>
                )}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4E5968] mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: 2026 Q1 프로모션"
                  className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl p-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#4E5968] mb-1">
                    시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl p-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#4E5968] mb-1">
                    종료일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                    className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl p-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E5968] mb-1">
                  상태
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as PromotionStatus,
                    }))
                  }
                  className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl p-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none cursor-pointer"
                >
                  <option value="draft">준비중 (딜에 노출 X)</option>
                  <option value="active">진행중 (딜에 노출)</option>
                  <option value="closed">종료</option>
                </select>
              </div>

              {/* 달성 조건 */}
              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-[#3182F6]">
                  달성 조건 (둘 중 하나라도 달성 시 인정)
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-[#191F28]">
                    <input
                      type="checkbox"
                      checked={form.use_monthly}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, use_monthly: e.target.checked }))
                      }
                      className="w-4 h-4"
                    />
                    단월 기준 — 매 월 PIV ≥
                  </label>
                  <input
                    type="number"
                    placeholder="예: 650000"
                    value={form.per_month_threshold}
                    disabled={!form.use_monthly}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        per_month_threshold: e.target.value,
                      }))
                    }
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-[#191F28]">
                    <input
                      type="checkbox"
                      checked={form.use_total}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, use_total: e.target.checked }))
                      }
                      className="w-4 h-4"
                    />
                    누적 기준 — 전체 합산 PIV ≥
                  </label>
                  <input
                    type="number"
                    placeholder="예: 2200000"
                    value={form.total_threshold}
                    disabled={!form.use_total}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, total_threshold: e.target.value }))
                    }
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] outline-none disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4E5968] mb-1">
                  설명 (자유 메모 — 보상·여행 안내 등)
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="달성 시 2026.6 일본 북해도 여행 등 자유롭게 입력"
                  className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl p-3 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-bold text-white bg-[#3182F6] rounded-xl hover:bg-blue-600 flex items-center"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {editingId ? '저장' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] p-7 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-[#191F28] mb-2 flex items-center">
              <Trash2 className="w-5 h-5 mr-2 text-red-500" /> 프로모션 삭제
            </h3>
            <p className="text-sm text-[#4E5968] mb-6 font-medium">
              매핑된 딜의 프로모션 적용도 함께 해제됩니다. 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2.5 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                className="px-4 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
