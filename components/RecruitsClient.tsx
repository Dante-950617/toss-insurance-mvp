'use client';

import { useState, useTransition, useMemo, type FormEvent } from 'react';
import {
  Users,
  UserPlus,
  Plus,
  X,
  Trash2,
  Edit3,
  Save,
  Search,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  createRecruit,
  updateRecruit,
  deleteRecruit,
} from '@/lib/actions';
import { RECRUIT_KIND_LABEL } from '@/lib/types';
import type { Profile, Recruit, RecruitKind } from '@/lib/types';

const GENDER_LABEL: Record<string, string> = { M: '남', F: '여', '': '-' };

type FormState = {
  name: string;
  age: string; // 입력은 string, 저장 시 number
  gender: 'M' | 'F' | '';
  referrer: string;
  memo: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  age: '',
  gender: '',
  referrer: '',
  memo: '',
};

export default function RecruitsClient({
  currentUser,
  members,
  initialRecruits,
}: {
  currentUser: Profile;
  members: Profile[];
  initialRecruits: Recruit[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [recruits, setRecruits] = useState<Recruit[]>(initialRecruits);
  const isManager = currentUser.role === 'MANAGER';

  const [activeKind, setActiveKind] = useState<RecruitKind>('acquaintance');
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<string>('ALL'); // 매니저용 담당자 필터
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m.name])),
    [members]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recruits.filter((r) => {
      if (r.kind !== activeKind) return false;
      if (isManager && memberFilter !== 'ALL' && r.owner_id !== memberFilter)
        return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.referrer.toLowerCase().includes(q) ||
        r.memo.toLowerCase().includes(q)
      );
    });
  }, [recruits, activeKind, search, isManager, memberFilter]);

  const counts = useMemo(() => {
    const visible = isManager
      ? recruits
      : recruits.filter((r) => r.owner_id === currentUser.id);
    return {
      acquaintance: visible.filter((r) => r.kind === 'acquaintance').length,
      applicant: visible.filter((r) => r.kind === 'applicant').length,
    };
  }, [recruits, isManager, currentUser.id]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (r: Recruit) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      age: r.age != null ? String(r.age) : '',
      gender: r.gender,
      referrer: r.referrer,
      memo: r.memo,
    });
    // 폼 영역으로 스크롤
    if (typeof window !== 'undefined') {
      setTimeout(
        () => document.getElementById('recruit-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        50
      );
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      showToast('이름을 입력해주세요.');
      return;
    }
    const ageNum = form.age.trim() ? Number(form.age) : null;
    if (form.age.trim() && (Number.isNaN(ageNum) || (ageNum ?? 0) < 0 || (ageNum ?? 0) > 120)) {
      showToast('나이는 0~120 사이의 숫자여야 합니다.');
      return;
    }

    if (editingId) {
      // 수정
      const original = recruits.find((r) => r.id === editingId);
      if (!original) return;
      const updated = {
        ...original,
        name,
        age: ageNum,
        gender: form.gender,
        referrer: form.referrer.trim(),
        memo: form.memo.trim(),
      };
      setRecruits((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      const id = editingId;
      resetForm();

      startTransition(async () => {
        const res = await updateRecruit(id, {
          name,
          age: ageNum,
          gender: form.gender,
          referrer: form.referrer.trim(),
          memo: form.memo.trim(),
        });
        if (res.error) {
          setRecruits((prev) => prev.map((r) => (r.id === id ? original : r)));
          showToast(`수정 실패: ${res.error}`);
        } else {
          showToast('수정되었습니다.');
        }
      });
      return;
    }

    // 신규 등록
    const tempId = `temp-${Date.now()}`;
    const optimistic: Recruit = {
      id: tempId,
      owner_id: currentUser.id,
      kind: activeKind,
      name,
      age: ageNum,
      gender: form.gender,
      referrer: form.referrer.trim(),
      memo: form.memo.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setRecruits((prev) => [optimistic, ...prev]);
    resetForm();

    startTransition(async () => {
      const res = await createRecruit({
        kind: activeKind,
        name,
        age: ageNum,
        gender: form.gender,
        referrer: optimistic.referrer,
        memo: optimistic.memo,
      });
      if (res.error) {
        setRecruits((prev) => prev.filter((r) => r.id !== tempId));
        showToast(`등록 실패: ${res.error}`);
      } else {
        showToast(`${RECRUIT_KIND_LABEL[activeKind]} 명단에 추가되었습니다.`);
      }
    });
  };

  const handleDelete = (id: string) => {
    const original = recruits.find((r) => r.id === id);
    if (!original) return;
    setRecruits((prev) => prev.filter((r) => r.id !== id));
    setConfirmDeleteId(null);

    startTransition(async () => {
      const res = await deleteRecruit(id);
      if (res.error) {
        setRecruits((prev) => [original, ...prev]);
        showToast(`삭제 실패: ${res.error}`);
      } else {
        showToast('삭제되었습니다.');
      }
    });
  };

  const canEditDelete = (r: Recruit) => r.owner_id === currentUser.id;

  return (
    <div className="space-y-5 py-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            <Users className="w-6 h-6 mr-2 text-[#3182F6]" />
            인사
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            데려오고 싶은 지인 / 지원자 인적사항을 관리하세요.
          </p>
        </div>
      </div>

      {/* 카테고리 탭 + 필터 */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex gap-2">
          {(['acquaintance', 'applicant'] as RecruitKind[]).map((k) => {
            const active = activeKind === k;
            return (
              <button
                key={k}
                onClick={() => setActiveKind(k)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#191F28] text-white'
                    : 'bg-white border border-gray-200 text-[#4E5968] hover:bg-gray-50'
                }`}
              >
                {RECRUIT_KIND_LABEL[k]}
                <span
                  className={`text-[10px] font-extrabold px-1.5 rounded-md ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-[#F2F4F6] text-[#8B95A1]'
                  }`}
                >
                  {counts[k]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {isManager && (
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold cursor-pointer outline-none focus:ring-2 focus:ring-[#3182F6]"
            >
              <option value="ALL">전체 담당자</option>
              {members
                .filter((m) => m.role === 'REP' && m.status === 'ACTIVE')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름/추천인/메모 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-none bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] outline-none w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* 등록/수정 폼 */}
      <form
        id="recruit-form"
        onSubmit={handleSubmit}
        className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 space-y-4"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-[#191F28] flex items-center">
            {editingId ? (
              <>
                <Edit3 className="w-4 h-4 mr-1.5 text-[#3182F6]" />
                수정 중
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-1.5 text-[#3182F6]" />
                {RECRUIT_KIND_LABEL[activeKind]} 신규 등록
              </>
            )}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-[#8B95A1] hover:text-[#191F28] flex items-center"
            >
              <X className="w-3 h-3 mr-1" /> 취소
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] font-bold text-[#4E5968] mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="홍길동"
              className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#4E5968] mb-1">나이</label>
            <input
              type="number"
              min={0}
              max={120}
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              placeholder="34"
              className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#4E5968] mb-1">성별</label>
            <select
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value as 'M' | 'F' | '' }))
              }
              className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none cursor-pointer"
            >
              <option value="">선택</option>
              <option value="M">남</option>
              <option value="F">여</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-2">
            <label className="block text-[10px] font-bold text-[#4E5968] mb-1">추천인</label>
            <input
              type="text"
              value={form.referrer}
              onChange={(e) => setForm((f) => ({ ...f, referrer: e.target.value }))}
              placeholder="예: 김토스 매니저"
              className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#4E5968] mb-1">메모</label>
          <textarea
            rows={2}
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="대화 포인트, 관심사, 접촉 시점 등"
            className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#3182F6] outline-none resize-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-[#3182F6] hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center transition-colors"
          >
            {editingId ? (
              <>
                <Save className="w-4 h-4 mr-1.5" /> 수정 저장
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1.5" /> 명단에 추가
              </>
            )}
          </button>
        </div>
      </form>

      {/* 리스트 */}
      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F9FAFB] text-[#4E5968] text-xs">
              <tr>
                <th className="py-3 px-4 font-bold">이름</th>
                <th className="py-3 px-4 font-bold w-16">나이</th>
                <th className="py-3 px-4 font-bold w-16">성별</th>
                <th className="py-3 px-4 font-bold">추천인</th>
                <th className="py-3 px-4 font-bold">메모</th>
                {isManager && (
                  <th className="py-3 px-4 font-bold">담당자</th>
                )}
                <th className="py-3 px-4 font-bold w-28 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={isManager ? 7 : 6}
                    className="py-12 text-center text-[#8B95A1] text-sm font-medium"
                  >
                    아직 등록된 {RECRUIT_KIND_LABEL[activeKind]}이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-[#191F28]">
                      {r.name}
                    </td>
                    <td className="py-3 px-4 text-[#4E5968]">
                      {r.age ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-[#4E5968]">
                      {GENDER_LABEL[r.gender] ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-[#4E5968] truncate max-w-[180px]">
                      {r.referrer || '-'}
                    </td>
                    <td className="py-3 px-4 text-[#4E5968] truncate max-w-[280px]">
                      {r.memo || '-'}
                    </td>
                    {isManager && (
                      <td className="py-3 px-4 text-[#8B95A1] font-medium">
                        {memberMap.get(r.owner_id) ?? '알 수 없음'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center">
                      {canEditDelete(r) ? (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="text-[#4E5968] hover:text-[#3182F6] hover:bg-blue-50 p-1.5 rounded transition-colors"
                            aria-label="수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(r.id)}
                            className="text-[#4E5968] hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                            aria-label="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#8B95A1]">조회</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 삭제 확인 */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[24px] p-7 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-[#191F28] mb-2 flex items-center">
              <Trash2 className="w-5 h-5 mr-2 text-red-500" /> 삭제 확인
            </h3>
            <p className="text-sm text-[#4E5968] mb-6 font-medium">
              해당 인적사항을 삭제하시겠어요? 되돌릴 수 없습니다.
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
