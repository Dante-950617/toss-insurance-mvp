import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NavBar from '@/components/NavBar';
import { ToastProvider } from '@/components/Toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, status')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  if (profile.status !== 'ACTIVE') redirect('/pending');

  let pendingApprovals = 0;
  let pendingUsers = 0;
  if (profile.role === 'MANAGER') {
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
        <div className="max-w-5xl mx-auto px-6">{children}</div>
      </div>
    </ToastProvider>
  );
}
