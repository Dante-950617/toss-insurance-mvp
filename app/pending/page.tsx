import { Clock, ShieldOff, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, status')
    .eq('id', user.id)
    .single();

  const status = profile?.status ?? 'PENDING';
  const isInactive = status === 'INACTIVE';

  return (
    <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-[24px] p-10 shadow-sm border border-gray-100 max-w-md w-full text-center">
        {isInactive ? (
          <ShieldOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
        ) : (
          <Clock className="w-12 h-12 text-orange-500 mx-auto mb-4" />
        )}
        <h1 className="text-xl font-bold text-[#191F28] tracking-tight mb-2">
          {isInactive ? '접근 권한이 회수되었습니다' : '관리자 승인 대기 중'}
        </h1>
        <p className="text-sm text-[#4E5968] font-medium leading-relaxed mb-6">
          {profile?.name ? `${profile.name}님, ` : ''}
          {isInactive
            ? '계정 접속 권한이 회수된 상태입니다. 관리자에게 문의해주세요.'
            : '가입은 완료되었습니다. 관리자 승인 후 정상 접속이 가능합니다.'}
        </p>
        <div className="text-xs text-[#8B95A1] font-medium bg-[#F9FAFB] p-4 rounded-xl border border-gray-100 mb-4">
          현재 상태:{' '}
          <strong className={isInactive ? 'text-red-600' : 'text-orange-600'}>
            {status}
          </strong>
        </div>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full bg-[#F2F4F6] hover:bg-gray-200 text-[#4E5968] py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}
