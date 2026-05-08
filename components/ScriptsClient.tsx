'use client';

import { useState, useTransition, useMemo, type FormEvent } from 'react';
import { BookOpen, Plus, Edit2, Trash2, X, Copy } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { createScript, updateScript, deleteScript } from '@/lib/actions';
import type { Profile, SalesScript } from '@/lib/types';

const CATEGORIES = [
  { id: 'opening', label: '오프닝' },
  { id: 'objection', label: '거절 응대' },
  { id: 'closing', label: '클로징' },
  { id: 'product', label: '상품 안내' },
  { id: 'general', label: '기타' },
];

const CAT_COLORS: Record<string, string> = {
  opening: 'bg-blue-50 text-[#3182F6] border-blue-100',
  objection: 'bg-red-50 text-red-600 border-red-100',
  closing: 'bg-green-50 text-green-700 border-green-100',
  product: 'bg-purple-50 text-purple-700 border-purple-100',
  general: 'bg-gray-100 text-[#4E5968] border-gray-200',
};

export default function ScriptsClient({
  currentUser,
  initialScripts,
}: {
  currentUser: Profile;
  initialScripts: SalesScript[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [scripts, setScripts] = useState<SalesScript[]>(initialScripts);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [editingScript, setEditingScript] = useState<SalesScript | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'general',
    content: '',
  });

  const isManager = currentUser.role === 'MANAGER';

  const filtered = useMemo(() => {
    if (activeCategory === 'ALL') return scripts;
    return scripts.filter((s) => s.category === activeCategory);
  }, [scripts, activeCategory]);

  const openCreate = () => {
    setForm({ title: '', category: 'general', content: '' });
    setEditingScript(null);
    setCreating(true);
  };

  const openEdit = (script: SalesScript) => {
    setForm({ title: script.title, category: script.category, content: script.content });
    setEditingScript(script);
    setCreating(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const t = form.title.trim();
    const c = form.content.trim();
    if (!t || !c) {
      showToast('제목과 내용을 입력해주세요.');
      return;
    }
    setCreating(false);

    if (editingScript) {
      const id = editingScript.id;
      const original = editingScript;
      setScripts((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, title: t, category: form.category, content: c } : s
        )
      );
      startTransition(async () => {
        const res = await updateScript(id, {
          title: t,
          category: form.category,
          content: c,
        });
        if (res.error) {
          setScripts((prev) => prev.map((s) => (s.id === id ? original : s)));
          showToast(`저장 실패: ${res.error}`);
        } else {
          showToast('스크립트가 수정되었습니다.');
        }
      });
    } else {
      const tempId = `temp-${Date.now()}`;
      const optimistic: SalesScript = {
        id: tempId,
        title: t,
        category: form.category,
        content: c,
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setScripts((prev) => [optimistic, ...prev]);
      startTransition(async () => {
        const res = await createScript({
          title: t,
          category: form.category,
          content: c,
        });
        if (res.error) {
          setScripts((prev) => prev.filter((s) => s.id !== tempId));
          showToast(`등록 실패: ${res.error}`);
        } else {
          showToast('스크립트가 등록되었습니다.');
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    const original = scripts.find((s) => s.id === id);
    setScripts((prev) => prev.filter((s) => s.id !== id));
    startTransition(async () => {
      const res = await deleteScript(id);
      if (res.error && original) {
        setScripts((prev) => [...prev, original]);
        showToast(`삭제 실패: ${res.error}`);
      }
    });
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast('스크립트가 클립보드에 복사되었습니다.');
    } catch {
      showToast('복사 실패');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            <BookOpen className="w-6 h-6 mr-2 text-[#3182F6]" />
            영업 스크립트
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            오프닝 멘트, 거절 응대, 클로징 화법 — 통화 중 빠르게 참고하세요.
          </p>
        </div>
        {isManager && (
          <button
            onClick={openCreate}
            className="bg-[#191F28] hover:bg-black text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> 스크립트 추가
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar p-1 bg-white rounded-2xl shadow-sm border border-gray-100">
        <button
          onClick={() => setActiveCategory('ALL')}
          className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
            activeCategory === 'ALL'
              ? 'bg-[#191F28] text-white'
              : 'bg-transparent text-[#4E5968]'
          }`}
        >
          전체 ({scripts.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = scripts.filter((s) => s.category === cat.id).length;
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                active ? 'bg-[#191F28] text-white' : 'bg-transparent text-[#4E5968]'
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-[#8B95A1] font-medium">
            등록된 스크립트가 없습니다.
            {isManager && ' 우측 상단의 "스크립트 추가" 버튼으로 등록해보세요.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm group hover:border-[#3182F6] transition-colors"
            >
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md border mb-2 ${
                      CAT_COLORS[s.category] ?? CAT_COLORS.general
                    }`}
                  >
                    {CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category}
                  </span>
                  <h3 className="text-base font-bold text-[#191F28] leading-tight">
                    {s.title}
                  </h3>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopy(s.content)}
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-[#3182F6]"
                    title="복사"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {isManager && (
                    <>
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-[#4E5968]"
                        title="수정"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-[#333D4B] font-medium leading-relaxed whitespace-pre-wrap">
                {s.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-[24px] sm:rounded-[24px] p-6 sm:p-8 w-full max-w-lg shadow-xl relative max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => setCreating(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-[#191F28] mb-6">
              {editingScript ? '스크립트 수정' : '스크립트 추가'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                  제목
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="예: 첫 통화 오프닝 멘트"
                  className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                  카테고리
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#4E5968] mb-2">
                  내용
                </label>
                <textarea
                  required
                  rows={8}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="실제 사용할 멘트 또는 화법을 그대로 입력"
                  className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-[#3182F6] outline-none resize-none font-medium"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-5 py-3 text-sm font-bold text-[#4E5968] bg-[#F2F4F6] rounded-xl hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 text-sm font-bold text-white bg-[#3182F6] rounded-xl hover:bg-blue-600"
                >
                  {editingScript ? '저장' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
