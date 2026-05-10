import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import NavBar from '@/components/NavBar';
import { ToastProvider } from '@/components/Toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.status !== 'ACTIVE') redirect('/pending');

  let pendingApprovals = 0;
  let pendingUsers = 0;
  if (profile.role === 'MANAGER') {
    const supabase = await createClient();
    const [{ count: dealCount }, { count: userCount }] = await Promise.all([
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('stage', '클로징(승인대기)'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING'),
    ]);
    pendingApprovals = dealCount ?? 0;
    pendingUsers = userCount ?? 0;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F2F4F6] text-[#333D4B] pb-10">
        <NavBar
          role={profile.role}
          userName={profile.name}
          pendingApprovals={pendingApprovals}
          pendingUsers={pendingUsers}
        />
        <div className="max-w-screen-2xl mx-auto px-6">{children}</div>
      </div>
    </ToastProvider>
  );
}
