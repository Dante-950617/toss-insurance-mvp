'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import type { Profile, Deal } from '@/lib/types';

const STAGE_COLOR: Record<string, string> = {
  진행대기: 'bg-gray-200 text-[#191F28]',
  콜미팅: 'bg-yellow-100 text-yellow-800',
  대면미팅: 'bg-amber-100 text-amber-800',
  '보고서 컨펌 요청': 'bg-blue-100 text-[#3182F6]',
  '보고서 전달': 'bg-indigo-100 text-indigo-700',
  클로징: 'bg-purple-100 text-purple-700',
  '후속조치(대면)': 'bg-green-100 text-green-800',
};

export default function CalendarClient({
  currentUser,
  members,
  deals,
}: {
  currentUser: Profile;
  members: Profile[];
  deals: Deal[];
}) {
  const isManager = currentUser.role === 'MANAGER';
  const [activeMemberId, setActiveMemberId] = useState<string>(
    isManager ? 'ALL' : currentUser.id
  );
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const filtered = useMemo(() => {
    if (activeMemberId === 'ALL') return deals;
    return deals.filter((d) => d.member_id === activeMemberId);
  }, [deals, activeMemberId]);

  const dealsByDate = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const d of filtered) {
      if (!d.next_contact_date) continue;
      const arr = map.get(d.next_contact_date) ?? [];
      arr.push(d);
      map.set(d.next_contact_date, arr);
    }
    return map;
  }, [filtered]);

  const monthFirst = new Date(cursor.year, cursor.month, 1);
  const startWeekday = monthFirst.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = today.toISOString().slice(0, 10);

  const prevMonth = () => {
    setCursor((c) =>
      c.month === 0
        ? { year: c.year - 1, month: 11 }
        : { ...c, month: c.month - 1 }
    );
  };
  const nextMonth = () => {
    setCursor((c) =>
      c.month === 11
        ? { year: c.year + 1, month: 0 }
        : { ...c, month: c.month + 1 }
    );
  };
  const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center">
            <CalIcon className="w-6 h-6 mr-2 text-[#3182F6]" />
            컨택 캘린더
          </h1>
          <p className="text-[#4E5968] mt-1 text-xs md:text-sm font-medium">
            다음 컨택 예정일이 등록된 딜들을 한눈에 확인하세요.
          </p>
        </div>
        {isManager && (
          <select
            value={activeMemberId}
            onChange={(e) => setActiveMemberId(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold cursor-pointer outline-none focus:ring-2 focus:ring-[#3182F6]"
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
        )}
      </div>

      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg md:text-xl font-extrabold text-[#191F28]">
              {cursor.year}년 {cursor.month + 1}월
            </h2>
            <button
              onClick={goToday}
              className="text-xs font-bold text-[#3182F6] bg-blue-50 px-3 py-1 rounded-md hover:bg-blue-100"
            >
              오늘
            </button>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2 text-center">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div
              key={d}
              className={`text-xs font-bold py-2 ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-[#4E5968]'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }
            const dayDeals = dealsByDate.get(cell.date) ?? [];
            const isToday = cell.date === todayStr;
            const dow = idx % 7;
            return (
              <div
                key={cell.date}
                className={`min-h-[80px] md:min-h-[110px] p-1.5 rounded-xl border transition-colors ${
                  isToday
                    ? 'bg-blue-50 border-[#3182F6]'
                    : 'bg-[#F9FAFB] border-gray-100'
                }`}
              >
                <div
                  className={`text-xs font-bold mb-1 ${
                    isToday
                      ? 'text-[#3182F6]'
                      : dow === 0
                        ? 'text-red-500'
                        : dow === 6
                          ? 'text-blue-500'
                          : 'text-[#4E5968]'
                  }`}
                >
                  {cell.day}
                </div>
                <div className="space-y-1">
                  {dayDeals.slice(0, 3).map((deal) => {
                    const member = members.find((m) => m.id === deal.member_id);
                    return (
                      <Link
                        key={deal.id}
                        href={`/pipeline?deal=${deal.id}`}
                        className={`block text-[10px] md:text-[11px] font-bold px-1.5 py-0.5 rounded truncate hover:opacity-80 transition-opacity ${
                          STAGE_COLOR[deal.stage] ?? 'bg-gray-100'
                        }`}
                        title={`${deal.customer_name} (${deal.stage})${
                          isManager && member ? ` - ${member.name}` : ''
                        }`}
                      >
                        {deal.customer_name}
                      </Link>
                    );
                  })}
                  {dayDeals.length > 3 && (
                    <div className="text-[9px] font-bold text-[#8B95A1] px-1">
                      +{dayDeals.length - 3}건
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-bold text-[#191F28] mb-4">단계별 색상</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STAGE_COLOR).map(([stage, cls]) => (
            <span key={stage} className={`text-xs font-bold px-2.5 py-1 rounded-md ${cls}`}>
              {stage}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
