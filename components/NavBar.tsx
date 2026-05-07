'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp, Target, KanbanSquare, Settings, LogOut } from 'lucide-react';
import type { UserRole } from '@/lib/types';

export default function NavBar({
  role,
  userName,
}: {
  role: UserRole;
  userName: string;
}) {
  const pathname = usePathname();

  const tabs: { href: string; label: string; icon: typeof Target; managerOnly?: boolean }[] = [
    { href: '/dashboard', label: '대시보드', icon: Target },
    {
      href: '/pipeline',
      label: role === 'REP' ? '나의 파이프라인' : '팀원 파이프라인',
      icon: KanbanSquare,
    },
    { href: '/manager', label: '조직 관리', icon: Settings, managerOnly: true },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-4 mb-6 sticky top-0 z-40 shadow-sm">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <Link href="/dashboard" className="font-extrabold text-xl text-[#191F28] tracking-tight flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-[#3182F6]" />
          Toss Insurance
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5 p-1.5 bg-[#F2F4F6] rounded-2xl">
            {tabs
              .filter((t) => !t.managerOnly || role === 'MANAGER')
              .map((t) => {
                const active = pathname.startsWith(t.href);
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center ${
                      active
                        ? 'bg-white text-[#191F28] shadow-sm'
                        : 'text-[#4E5968] hover:text-[#191F28]'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" /> {t.label}
                  </Link>
                );
              })}
          </div>
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <span className="text-xs font-bold text-[#4E5968] hidden sm:inline">
            {userName} ({role === 'MANAGER' ? '지점장' : '실무자'})
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm font-bold text-[#8B95A1] hover:text-[#191F28] flex items-center transition-colors"
            >
              <LogOut className="w-4 h-4 mr-1" /> 로그아웃
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
