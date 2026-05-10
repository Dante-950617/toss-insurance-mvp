'use client';

import { useState, useMemo, useTransition, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Target,
  Calendar,
  TrendingUp,
  AlertCircle,
  Clock,
  Award,
  ChevronRight,
  Phone,
  Sparkles,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Timer,
  XCircle,
  MessageSquare,
  ShieldCheck,
  CheckSquare,
  Square,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  Profile,
  CalculatedMember,
  TeamSettings,
  Deal,
  Task,
} from '@/lib/types';
import {
  formatCurrency,
  formatDateKR,
  buildTeamAggregate,
  getDwellDays,
  isStaleDeal,
} from '@/lib/utils';
import { createTask, toggleTask, deleteTask, updateDealStage } from '@/lib/actions';
import { useToast } from '@/components/Toast';
import type { DealStage } from '@/lib/types';
import { APPROVAL_STAGE, STAGES } from '@/lib/types';

type AutoTaskType =
  | 'today_contact'
  | 'overdue_contact'
  | 'stale_deal'
  | 'pending_approval';

interface AutoTask {
  key: string;
  type: AutoTaskType;
  dealId: string;
  customerName: string;
  sub: string;
  priority: number; // 낮을수록 더 위
}

const GrowthIndicator = ({
  label,
  value,
  isPercent = false,
}: {
  label: string;
  value: number;
  isPercent?: boolean;
}) => {
  const isPositive = value >= 0;
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[#8B95A1] font-medium mb-1">{label}</span>
      <div className="flex items-center">
        <span
          className={`text-base font-bold ${
            isPositive ? 'text-red-500' : 'text-blue-500'
          } flex items-center`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 mr-0.5" />
          ) : (
            <ArrowDownRight className="w-4 h-4 mr-0.5" />
          )}
          {Math.abs(value).toFixed(1)}
          {isPercent ? '%p' : '%'}
        </span>
      </div>
    </div>
  );
};

export default function DashboardClient({
  currentUser,
  members,
  teamSettings,
  deals,
  initialTasks,
}: {
  currentUser: Profile;
  members: CalculatedMember[];
  teamSettings: TeamSettings;
  deals: Deal[];
  initialTasks: Task[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');

  const [activeMemberId, setActiveMemberId] = useState<string>(
    currentUser.role === 'MANAGER' ? 'ALL' : currentUser.id
  );

  // 자동 할일 "오늘 가리기" — localStorage 기반 (사용자 디바이스별 dismissal)
  // key = autoTask.key, value = ISO date string (가린 시점)
  const DISMISS_KEY = `dismissed_auto_tasks_${currentUser.id}`;
  const [dismissedTasks, setDismissedTasks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) setDismissedTasks(JSON.parse(raw));
    } catch {
      // 무시
    }
  }, [DISMISS_KEY]);

  const dismissAutoTask = (key: string) => {
    const next = { ...dismissedTasks, [key]: new Date().toISOString() };
    setDismissedTasks(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      // localStorage 용량 초과 등 무시
    }
  };

  const handleAddTask = (e: FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Task = {
      id: tempId,
      user_id: currentUser.id,
      deal_id: null,
      title,
      due_date: newTaskDate || null,
      done: false,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [optimistic, ...prev]);
    setNewTaskTitle('');
    setNewTaskDate('');
    startTransition(async () => {
      const res = await createTask(title, newTaskDate || null);
      if (res.error) {
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        showToast(`등록 실패: ${res.error}`);
      }
    });
  };

  const handleToggleTask = (task: Task) => {
    const newDone = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: newDone } : t))
    );
    startTransition(async () => {
      const res = await toggleTask(task.id, newDone);
      if (res.error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t))
        );
        showToast(`변경 실패: ${res.error}`);
      }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    const original = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      const res = await deleteTask(taskId);
      if (res.error && original) {
        setTasks((prev) => [...prev, original]);
        showToast(`삭제 실패: ${res.error}`);
      }
    });
  };

  const handleQuickApproval = (
    dealId: string,
    newStage: DealStage,
    label: string
  ) => {
    startTransition(async () => {
      const res = await updateDealStage(dealId, newStage);
      if (res.error) showToast(`처리 실패: ${res.error}`);
      else showToast(`${label} 처리되었습니다.`);
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (!a.due_date && b.due_date) return 1;
    if (a.due_date && !b.due_date) return -1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return 0;
  });

  const autoTasks: AutoTask[] = useMemo(() => {
    const items: AutoTask[] = [];
    const isMgr = currentUser.role === 'MANAGER';
    const myDeals = isMgr ? deals : deals.filter((d) => d.member_id === currentUser.id);
    // 진행중(PENDING) 인 딜만 자동 할일 생성. WIN/LOSE 결정난 딜은 제외.
    const isOpen = (d: Deal) => (d.outcome ?? 'PENDING') === 'PENDING';

    // 1) 오늘 컨택 예정
    myDeals
      .filter(
        (d) =>
          d.next_contact_date === todayStr && isOpen(d)
      )
      .forEach((d) =>
        items.push({
          key: `today_${d.id}`,
          type: 'today_contact',
          dealId: d.id,
          customerName: d.customer_name,
          sub: d.phone || d.product_type || d.stage,
          priority: 1,
        })
      );

    // 2) 지연된 컨택 (예정일이 오늘 이전)
    myDeals
      .filter(
        (d) =>
          d.next_contact_date &&
          d.next_contact_date < todayStr &&
          isOpen(d)
      )
      .forEach((d) =>
        items.push({
          key: `over_${d.id}`,
          type: 'overdue_contact',
          dealId: d.id,
          customerName: d.customer_name,
          sub: `예정일 ${d.next_contact_date} 지남`,
          priority: 0, // 가장 위
        })
      );

    // 3) 5일 이상 방치 (REP 본인 / MANAGER 전체)
    myDeals.filter(isStaleDeal).forEach((d) => {
      const member = members.find((m) => m.id === d.member_id);
      items.push({
        key: `stale_${d.id}`,
        type: 'stale_deal',
        dealId: d.id,
        customerName: d.customer_name,
        sub: `${getDwellDays(d.last_updated)}일째 ${d.stage}${
          isMgr && member ? ` · ${member.name}` : ''
        }`,
        priority: 2,
      });
    });

    // 4) MANAGER 전용: 보고서 컨펌 요청 (승인 게이트)
    if (isMgr) {
      deals
        .filter((d) => d.stage === APPROVAL_STAGE && (d.outcome ?? 'PENDING') === 'PENDING')
        .forEach((d) => {
          const member = members.find((m) => m.id === d.member_id);
          items.push({
            key: `approve_${d.id}`,
            type: 'pending_approval',
            dealId: d.id,
            customerName: d.customer_name,
            sub: `${member?.name ?? ''} 승인 요청${d.monthly_premium ? ` · 월 ${formatCurrency(d.monthly_premium)}원` : ''}`,
            priority: 0,
          });
        });
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [deals, currentUser, members, todayStr]);

  // 오늘 dismiss된 항목은 가림 (다음날 자정 후 다시 보임)
  const visibleAutoTasks = useMemo(() => {
    return autoTasks.filter((t) => {
      const dismissedAt = dismissedTasks[t.key];
      if (!dismissedAt) return true;
      // dismissedAt 이 오늘 날짜면 가림
      return dismissedAt.slice(0, 10) !== todayStr;
    });
  }, [autoTasks, dismissedTasks, todayStr]);

  const autoTaskMeta: Record<
    AutoTaskType,
    { label: string; bg: string; text: string; emoji: string }
  > = {
    overdue_contact: {
      label: '지연',
      bg: 'bg-red-50',
      text: 'text-red-600',
      emoji: '⚠️',
    },
    today_contact: {
      label: '오늘',
      bg: 'bg-blue-50',
      text: 'text-[#3182F6]',
      emoji: '📞',
    },
    pending_approval: {
      label: '승인',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      emoji: '🔔',
    },
    stale_deal: {
      label: '방치',
      bg: 'bg-gray-100',
      text: 'text-[#4E5968]',
      emoji: '⏱',
    },
  };

  const teamAggregate = useMemo(
    () => buildTeamAggregate(members, teamSettings),
    [members, teamSettings]
  );

  const displayMemberId =
    currentUser.role === 'REP' ? currentUser.id : activeMemberId;
  const isTeamView = displayMemberId === 'ALL';
  const activeData: CalculatedMember = isTeamView
    ? teamAggregate
    : members.find((m) => m.id === displayMemberId) ?? teamAggregate;

  const activeMeetings = isTeamView
    ? deals
    : deals.filter((m) => m.member_id === displayMemberId);
  const failedMeetings = activeMeetings.filter((m) => (m.outcome ?? 'PENDING') === 'LOSE');
  const inProgressMeetings = activeMeetings.filter(
    (m) => (m.outcome ?? 'PENDING') === 'PENDING' && (m.stage === '콜미팅' || m.stage === '대면미팅')
  );
  const staleMeetings = deals.filter((m) => isStaleDeal(m));

  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysRemaining = Math.max(
    0,
    Math.floor((monthEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );

  const deadlineDate = new Date(monthEnd);
  deadlineDate.setDate(monthEnd.getDate() - (activeData.lead_time || 0));
  const isDeadlinePassed = deadlineDate < today;
  const isDeadlineImminent =
    !isDeadlinePassed &&
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 3;

  const contactTarget = activeData.needed_meetings * 4;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#191F28] tracking-tight flex items-center flex-wrap">
            {currentUser.role === 'MANAGER' ? (
              <select
                className="bg-transparent border-none text-xl md:text-2xl font-bold text-[#3182F6] cursor-pointer outline-none focus:ring-0 mr-2 p-0"
                value={activeMemberId}
                onChange={(e) => setActiveMemberId(e.target.value)}
              >
                <option value="ALL">팀 전체 요약</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} 매니저
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[#3182F6] mr-2">{currentUser.name}</span>
            )}
            퍼포 리뷰
          </h1>
          <p className="text-[#4E5968] mt-1 text-sm">
            {today.getFullYear()}년 {today.getMonth() + 1}월 {activeData.name} 실적 및 활동 목표
            역산 대시보드
          </p>
        </div>
        <div className="text-right flex items-center gap-2">
          <span className="inline-flex items-center bg-white px-4 py-2 rounded-[12px] text-sm font-bold text-[#191F28] shadow-sm border border-gray-200">
            <Calendar className="w-4 h-4 mr-1.5 text-[#3182F6]" />
            오늘: {formatDateKR(today)} (마감 D-{daysRemaining})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="월간 목표 달성률"
          value={`${Math.min(100, activeData.target_sales > 0 ? (activeData.current_sales / activeData.target_sales) * 100 : 0).toFixed(1)}%`}
          sub={`${formatCurrency(activeData.current_sales)} / ${formatCurrency(activeData.target_sales)}원`}
          Icon={Target}
          iconColor="text-[#3182F6]"
        />
        <KpiCard
          label={isTeamView ? '팀 기준 전환율' : '기준 계약 전환율'}
          value={`${activeData.conversion_rate}%`}
          sub={isTeamView ? '팀 목표 전환율' : '최근 3개월 평균'}
          Icon={TrendingUp}
          iconColor="text-green-500"
        />
        <KpiCard
          label={isTeamView ? '팀 기준 리드타임' : '평균 리드타임'}
          value={`${activeData.lead_time}일`}
          sub="최초 미팅 ~ 최종 체결"
          Icon={Clock}
          iconColor="text-orange-500"
        />
        <KpiCard
          label={isTeamView ? '팀 기준 객단가' : '평균 객단가'}
          value={`${formatCurrency(activeData.avg_deal_size)}원`}
          sub="1건당 환산 성적 기준"
          Icon={Award}
          iconColor="text-purple-500"
        />
      </div>

      <FunnelMini
        deals={activeMeetings}
        title={isTeamView ? '팀 퍼널 잔존율' : `${activeData.name} 퍼널 잔존율`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[24px] p-7 shadow-sm border border-gray-100 relative overflow-hidden">
            {activeData.remaining_sales <= 0 && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                <Award className="w-16 h-16 text-[#3182F6] mb-4" />
                <h2 className="text-2xl font-bold text-[#191F28]">목표 달성 완료!</h2>
                <p className="text-[#4E5968] mt-2 font-medium">
                  이번 달 목표를 이미 초과 달성하셨습니다.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#191F28] flex items-center">
                <Target className="w-5 h-5 mr-2 text-[#3182F6]" />
                목표 달성을 위한 역산 엔진 {isTeamView && '(팀 합산)'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-[#F9FAFB] rounded-2xl p-6 border border-gray-100 flex flex-col justify-center items-center text-center">
                <p className="text-sm text-[#4E5968] font-bold mb-1">
                  잔여 실적({formatCurrency(activeData.remaining_sales)}원)을 위해
                </p>
                <div className="text-4xl font-extrabold text-[#3182F6] my-2">
                  추가{' '}
                  <span className="underline decoration-blue-200 underline-offset-4">
                    {activeData.needed_meetings}건
                  </span>
                  의 미팅
                </div>
                <p className="text-sm text-[#4E5968] font-bold mt-1">이 필요합니다.</p>
                <p className="text-xs text-[#8B95A1] font-medium mt-3">
                  필요 예상 계약: {activeData.needed_deals}건
                </p>
              </div>

              <div className="space-y-5 flex flex-col justify-center">
                <ProgressRow
                  label={`현재 적용된 ${isTeamView ? '팀 목표' : '나의'} 전환율`}
                  rightLabel={`${activeData.conversion_rate}%`}
                  rightColor="text-[#3182F6]"
                  fillWidth={`${Math.min(100, activeData.conversion_rate)}%`}
                  fillColor="bg-[#3182F6]"
                />
                <ProgressRow
                  label="현재 적용된 평균 리드타임"
                  rightLabel={`${activeData.lead_time}일`}
                  rightColor="text-orange-500"
                  fillWidth={`${Math.min(100, (activeData.lead_time / 30) * 100)}%`}
                  fillColor="bg-orange-400"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#191F28] mb-3">
                진척도 모니터링 (완료 {activeData.completed_meetings}건 / 총 필요{' '}
                {activeData.completed_meetings + activeData.needed_meetings}건)
              </h3>
              <div className="relative pt-1">
                <div className="overflow-hidden h-3.5 mb-2 text-xs flex rounded-full bg-gray-100">
                  <div
                    style={{
                      width: `${
                        (activeData.completed_meetings /
                          Math.max(1, activeData.completed_meetings + activeData.needed_meetings)) *
                        100
                      }%`,
                    }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-[#3182F6] rounded-full"
                  />
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#3182F6]">
                    {Math.round(
                      (activeData.completed_meetings /
                        Math.max(1, activeData.completed_meetings + activeData.needed_meetings)) *
                        100
                    )}
                    % 달성
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-7 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-[#191F28] mb-6 flex items-center">
              <BarChart2 className="w-5 h-5 mr-2 text-[#3182F6]" />
              {isTeamView
                ? '팀원별 퍼포먼스 및 성장 트렌드 (전월 대비)'
                : '나의 퍼포먼스 성장 트렌드 (전월 대비)'}
            </h3>

            {isTeamView ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="bg-[#F9FAFB] rounded-[16px] p-5 border border-gray-100"
                  >
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
                      <span className="font-bold text-[#191F28] text-base">
                        {m.name} 매니저
                      </span>
                      <span className="text-xs font-bold bg-white border border-gray-200 px-2 py-1 rounded-md text-[#4E5968]">
                        목표 달성{' '}
                        {Math.min(
                          100,
                          m.target_sales > 0 ? (m.current_sales / m.target_sales) * 100 : 0
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <GrowthIndicator label="매출 성장률" value={m.sales_growth} />
                      <GrowthIndicator
                        label="전환율 변동"
                        value={m.conv_growth}
                        isPercent
                      />
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="md:col-span-2 text-center text-sm text-[#8B95A1] py-8 bg-gray-50 rounded-xl">
                    아직 등록된 팀원이 없습니다.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-[#F9FAFB] rounded-[16px] p-6 border border-gray-100 flex flex-col justify-center items-center text-center">
                  <span className="text-sm text-[#4E5968] font-bold mb-2">
                    전월 동기 대비 매출액
                  </span>
                  <div className="text-3xl font-extrabold text-[#191F28] mb-2">
                    {formatCurrency(activeData.current_sales)}원
                  </div>
                  <span
                    className={`text-sm font-bold flex items-center px-2 py-1 rounded-md ${
                      activeData.sales_growth >= 0
                        ? 'bg-red-50 text-red-600'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {activeData.sales_growth >= 0 ? (
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 mr-1" />
                    )}
                    {Math.abs(activeData.sales_growth).toFixed(1)}%{' '}
                    {activeData.sales_growth >= 0 ? '성장' : '감소'}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div className="bg-white border border-gray-100 rounded-[16px] p-4 flex justify-between items-center shadow-sm">
                    <span className="text-sm font-bold text-[#4E5968]">계약 전환율 개선도</span>
                    <GrowthIndicator
                      label=""
                      value={activeData.conv_growth}
                      isPercent
                    />
                  </div>
                  <div className="bg-white border border-gray-100 rounded-[16px] p-4 flex justify-between items-center shadow-sm">
                    <span className="text-sm font-bold text-[#4E5968]">완료된 미팅 건수</span>
                    <span className="text-lg font-bold text-[#191F28]">
                      {activeData.completed_meetings}건
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-[90px]">
          <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#191F28] flex items-center">
                <CheckSquare className="w-5 h-5 mr-2 text-[#3182F6]" />
                오늘 할 일
              </h3>
              <span className="text-xs font-bold text-[#8B95A1]">
                {visibleAutoTasks.length + tasks.filter((t) => !t.done).length}건
                {autoTasks.length > visibleAutoTasks.length && (
                  <span className="ml-1 text-[10px] text-[#8B95A1]">
                    (가린 {autoTasks.length - visibleAutoTasks.length})
                  </span>
                )}
              </span>
            </div>

            {visibleAutoTasks.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-bold text-[#8B95A1] uppercase tracking-wider mb-2 px-1">
                  딜에서 자동 추출됨
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                  {visibleAutoTasks.map((task) => {
                    const meta = autoTaskMeta[task.type];
                    const isApproval = task.type === 'pending_approval';
                    return (
                      <div
                        key={task.key}
                        className={`flex items-start gap-2 p-2.5 rounded-xl border border-gray-100 ${meta.bg} hover:border-[#3182F6] transition-colors group`}
                      >
                        <span
                          className={`text-[10px] font-extrabold ${meta.text} bg-white px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 mt-0.5`}
                        >
                          {meta.emoji} {meta.label}
                        </span>
                        <Link
                          href={`/pipeline?deal=${task.dealId}`}
                          className="flex-1 min-w-0"
                        >
                          <p className="text-sm font-bold text-[#191F28] truncate group-hover:text-[#3182F6] transition-colors">
                            {task.customerName}
                          </p>
                          <p className="text-[10px] font-medium text-[#8B95A1] truncate">
                            {task.sub}
                          </p>
                        </Link>
                        {isApproval && currentUser.role === 'MANAGER' ? (
                          <div className="flex gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickApproval(task.dealId, '보고서 전달', '승인')
                              }
                              className="bg-[#3182F6] text-white text-[10px] font-extrabold px-2 py-1 rounded-md hover:bg-blue-600 transition-colors"
                              title="승인 → 보고서 전달"
                            >
                              ✓ 승인
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickApproval(task.dealId, '대면미팅', '반려')
                              }
                              className="bg-white border border-gray-200 text-[#4E5968] text-[10px] font-extrabold px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
                              title="반려"
                            >
                              ↩ 반려
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => dismissAutoTask(task.key)}
                            className="text-gray-300 hover:text-[#3182F6] hover:bg-blue-50 transition-colors p-1 rounded shrink-0"
                            title="오늘 가리기 (자정 후 다시 표시)"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold text-[#8B95A1] uppercase tracking-wider mb-2 px-1">
                직접 등록
              </p>

              <form onSubmit={handleAddTask} className="space-y-2 mb-3">
                <input
                  type="text"
                  placeholder="할 일 입력 (예: 월말 보고서 정리)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-[#F2F4F6] border-transparent rounded-xl py-2.5 px-3 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] focus:bg-white outline-none transition-all"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="flex-1 bg-[#F2F4F6] border-transparent rounded-xl py-2.5 px-3 text-sm font-medium focus:ring-2 focus:ring-[#3182F6] focus:bg-white outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="bg-[#191F28] hover:bg-black disabled:opacity-40 text-white px-4 rounded-xl text-sm font-bold flex items-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {sortedTasks.length === 0 ? (
                  <p className="text-xs text-[#8B95A1] text-center py-4 bg-gray-50 rounded-xl border border-gray-100 font-medium">
                    {autoTasks.length > 0
                      ? '딜과 무관한 별도 할 일이 있다면 여기에 추가'
                      : '등록된 할 일이 없습니다'}
                  </p>
                ) : (
                  sortedTasks.map((task) => {
                    const isOverdue =
                      !task.done && task.due_date && task.due_date < todayStr;
                    const isToday = task.due_date === todayStr;
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                          task.done
                            ? 'bg-gray-50 border-gray-100 opacity-60'
                            : isOverdue
                              ? 'bg-red-50/50 border-red-100'
                              : isToday
                                ? 'bg-blue-50/40 border-blue-100'
                                : 'bg-white border-gray-100'
                        } transition-colors group`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleTask(task)}
                          className={`shrink-0 ${
                            task.done
                              ? 'text-[#3182F6]'
                              : 'text-gray-300 hover:text-[#3182F6]'
                          }`}
                        >
                          {task.done ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-bold text-[#191F28] truncate ${
                              task.done ? 'line-through' : ''
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.due_date && (
                            <p
                              className={`text-[10px] font-bold mt-0.5 ${
                                isOverdue
                                  ? 'text-red-600'
                                  : isToday
                                    ? 'text-[#3182F6]'
                                    : 'text-[#8B95A1]'
                              }`}
                            >
                              {isOverdue ? '⚠ 지남: ' : isToday ? '📅 오늘: ' : ''}
                              {task.due_date}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div
            className={`bg-white rounded-[24px] p-6 shadow-sm border ${
              isDeadlinePassed
                ? 'border-red-200'
                : isDeadlineImminent
                  ? 'border-orange-200'
                  : 'border-gray-100'
            }`}
          >
            <div
              className={`mb-6 p-4 rounded-xl ${
                isDeadlinePassed
                  ? 'bg-red-50/50'
                  : isDeadlineImminent
                    ? 'bg-orange-50/50'
                    : 'bg-[#F2F4F6]'
              }`}
            >
              <div className="flex items-start mb-2">
                <AlertCircle
                  className={`w-5 h-5 mr-1.5 mt-0.5 ${
                    isDeadlinePassed
                      ? 'text-red-500'
                      : isDeadlineImminent
                        ? 'text-orange-500'
                        : 'text-[#3182F6]'
                  }`}
                />
                <h3
                  className={`text-sm font-bold ${
                    isDeadlinePassed
                      ? 'text-red-700'
                      : isDeadlineImminent
                        ? 'text-orange-800'
                        : 'text-[#191F28]'
                  }`}
                >
                  스마트 데드라인 가이드
                </h3>
              </div>
              <p className="text-[13px] text-[#4E5968] font-medium leading-relaxed mb-3">
                고객의 고민 리드타임({activeData.lead_time}일)을 고려할 때,{' '}
                <strong
                  className={
                    isDeadlinePassed
                      ? 'text-red-600'
                      : isDeadlineImminent
                        ? 'text-orange-600'
                        : 'text-[#3182F6]'
                  }
                >
                  {formatDateKR(deadlineDate)}
                </strong>{' '}
                까지는 미팅이 성사되어야 합니다.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[#191F28] mb-3 flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-blue-500" />
                AI 추천 액션 플랜 (To-Do)
              </h4>
              <div className="space-y-3">
                {activeData.needed_meetings > 0 && (
                  <div className="flex items-start p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group">
                    <div className="bg-[#F2F4F6] text-[#4E5968] p-2.5 rounded-xl mr-3 group-hover:bg-[#3182F6] group-hover:text-white transition-colors">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#191F28] mb-1">
                        가망 고객 {contactTarget}명 연락 타겟팅
                      </div>
                      <div className="text-[11px] font-medium text-[#8B95A1] leading-tight">
                        필요 미팅 {activeData.needed_meetings}건 확보를 위해 최소{' '}
                        {contactTarget}명에게 지금 연락을 시도하세요.
                      </div>
                    </div>
                  </div>
                )}
                {inProgressMeetings.length > 0 && (
                  <Link
                    href="/pipeline"
                    className="flex items-start p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="bg-[#F2F4F6] text-[#4E5968] p-2.5 rounded-xl mr-3 group-hover:bg-[#3182F6] group-hover:text-white transition-colors">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#191F28] flex items-center mb-1">
                        상담 대기 고객 {inProgressMeetings.length}명 팔로업{' '}
                        <ChevronRight className="w-3 h-3 ml-1 text-gray-400" />
                      </div>
                      <div className="text-[11px] font-medium text-[#8B95A1] leading-tight">
                        {inProgressMeetings
                          .slice(0, 2)
                          .map((m) => m.customer_name)
                          .join(', ')}{' '}
                        등 결정을 미루는 고객에게 추가 제안을 보내세요.
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {isTeamView ? (
            <div className="bg-white rounded-[24px] p-6 shadow-sm border border-red-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-[#191F28] flex items-center">
                  <Timer className="w-5 h-5 mr-2 text-red-500" />
                  업데이트 지연 모니터링
                </h3>
                <Link
                  href="/pipeline"
                  className="text-xs font-medium text-red-500 hover:underline"
                >
                  상세 확인
                </Link>
              </div>
              <p className="text-xs text-[#8B95A1] font-medium mb-4">
                상태 변경 없이 5일 이상 방치된 딜 현황입니다.
              </p>

              {staleMeetings.length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(
                    staleMeetings.reduce<Record<string, number>>((acc, curr) => {
                      const member = members.find((m) => m.id === curr.member_id);
                      const mName = member ? member.name : '알수없음';
                      acc[mName] = (acc[mName] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div
                        key={name}
                        className="flex justify-between items-center bg-red-50/50 p-3 rounded-xl border border-red-100"
                      >
                        <span className="text-sm font-bold text-[#191F28]">
                          {name} 매니저
                        </span>
                        <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded-md">
                          장기 방치 {count}건
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-sm text-[#8B95A1] bg-gray-50 p-4 rounded-xl text-center border border-gray-100">
                  장기 체류 중인 딜이 없습니다.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-[#191F28] flex items-center">
                    <XCircle className="w-5 h-5 mr-2 text-red-500" />
                    최근 미팅 실패(Drop) 분석
                  </h3>
                </div>
                {failedMeetings.length > 0 ? (
                  <ul className="space-y-3 mb-4">
                    {failedMeetings.slice(0, 3).map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-col bg-red-50/50 px-4 py-3 rounded-xl border border-red-100"
                      >
                        <span className="font-bold text-gray-900 text-sm mb-1">
                          {m.customer_name}
                        </span>
                        <span className="text-red-600 font-medium text-xs">{m.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-[#8B95A1] bg-gray-50 p-4 rounded-xl text-center border border-gray-100 font-medium">
                    최근 실패한 미팅 이력이 없습니다.
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-[#191F28] mb-4 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2 text-gray-700" />
                  지점장 코칭 노트
                </h3>
                <div className="bg-[#F9FAFB] rounded-2xl p-5 border border-gray-100 text-[13px] font-medium text-[#4E5968] leading-relaxed">
                  &ldquo;{activeData.name} 매니저님, 전월 대비 전환율이{' '}
                  {activeData.conv_growth > 0
                    ? `+${activeData.conv_growth}%p 상승`
                    : `${Math.abs(activeData.conv_growth)}%p 하락`}
                  했습니다. 파이프라인에서 &lsquo;상담중&rsquo; 딜의 클로징률을 높이기 위해, 오후 1:1
                  세션에서 스크립트를 점검하겠습니다.&rdquo;
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  Icon,
  iconColor,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <span className="text-[#8B95A1] text-sm font-bold">{label}</span>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <div className="text-2xl font-bold text-[#191F28]">{value}</div>
        <div className="text-xs text-[#4E5968] mt-1 font-medium">{sub}</div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  rightLabel,
  rightColor,
  fillWidth,
  fillColor,
}: {
  label: string;
  rightLabel: string;
  rightColor: string;
  fillWidth: string;
  fillColor: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-sm font-bold text-[#4E5968]">{label}</label>
        <span className={`text-sm font-extrabold ${rightColor}`}>{rightLabel}</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div style={{ width: fillWidth }} className={`h-full ${fillColor} rounded-full`}></div>
      </div>
    </div>
  );
}

// ---------- 미니 퍼널 잔존율 위젯 (Mixpanel 스타일) ----------
function FunnelMini({ deals, title }: { deals: Deal[]; title: string }) {
  const total = deals.length;
  if (total === 0) return null;

  const stageIdx = (s: DealStage) => STAGES.indexOf(s);
  const rows = STAGES.map((s, i) => {
    const reached = deals.filter((d) => stageIdx(d.stage) >= i).length;
    const lost = deals.filter(
      (d) => (d.outcome ?? 'PENDING') === 'LOSE' && d.stage === s
    ).length;
    const won = deals.filter(
      (d) => (d.outcome ?? 'PENDING') === 'WIN' && d.stage === s
    ).length;
    const pct = (reached / total) * 100;
    return { stage: s, reached, lost, won, pct };
  });
  const finalConv = (rows[rows.length - 1].reached / total) * 100;

  return (
    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[#191F28] flex items-center">
          <BarChart2 className="w-4 h-4 mr-1.5 text-[#3182F6]" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#8B95A1] font-bold">
            진입 {total}건
          </span>
          <span className="text-[11px] font-extrabold text-[#3182F6] bg-blue-50 px-2.5 py-0.5 rounded-full">
            전환율 {finalConv.toFixed(1)}%
          </span>
        </div>
      </div>
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((r, idx) => {
          const heightPct = Math.max(r.pct, 4);
          const dropFromPrev =
            idx > 0 && rows[idx - 1].reached > 0
              ? (r.reached / rows[idx - 1].reached) * 100
              : 100;
          return (
            <div key={r.stage} className="flex flex-col items-center min-w-0">
              {/* 상단 비율 */}
              <div className="text-center mb-1.5 w-full">
                <div className="text-sm font-extrabold text-[#191F28] leading-tight">
                  {r.pct.toFixed(0)}%
                </div>
                <div className="text-[10px] text-[#8B95A1] font-bold">
                  {r.reached}건
                </div>
              </div>
              {/* 막대 */}
              <div className="w-full h-24 bg-[#F2F4F6] rounded-t-md relative flex flex-col justify-end overflow-hidden border-b-2 border-[#3182F6]">
                <div
                  className="w-full bg-gradient-to-b from-[#5B9BFF] to-[#3182F6]"
                  style={{ height: `${heightPct}%` }}
                />
                {idx > 0 && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-white text-[#4E5968] text-[9px] font-extrabold px-1 py-0 rounded-full shadow-sm border border-gray-200 whitespace-nowrap">
                    {dropFromPrev.toFixed(0)}%
                  </div>
                )}
              </div>
              {/* 단계명 */}
              <div className="text-[10px] font-bold text-[#4E5968] mt-1.5 truncate w-full text-center">
                <span className="text-[#8B95A1] mr-0.5">{idx + 1}.</span>
                {r.stage}
              </div>
              {(r.lost > 0 || r.won > 0) && (
                <div className="text-[10px] mt-0.5 flex items-center justify-center gap-1 flex-wrap">
                  {r.lost > 0 && (
                    <span className="text-red-500 font-bold">✖{r.lost}</span>
                  )}
                  {r.won > 0 && (
                    <span className="text-green-600 font-bold">🏆{r.won}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
