import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/DashboardClient';
import { calcMember } from '@/lib/utils';
import type { Profile, TeamSettings, Deal, Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  const { data: membersRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'REP')
    .eq('status', 'ACTIVE')
    .order('name');

  const { data: teamSettings } = await supabase
    .from('team_settings')
    .select('*')
    .eq('id', 1)
    .single<TeamSettings>();

  const { data: deals } = await supabase.from('deals').select('*').order('last_updated', {
    ascending: false,
  });

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });

  const members = ((membersRaw ?? []) as Profile[]).map(calcMember);

  return (
    <DashboardClient
      currentUser={profileData!}
      members={members}
      teamSettings={
        teamSettings ?? {
          id: 1,
          target_sales: 0,
          avg_deal_size: 0,
          conversion_rate: 0,
          lead_time: 0,
          updated_at: '',
        }
      }
      deals={(deals ?? []) as Deal[]}
      initialTasks={(tasks ?? []) as Task[]}
    />
  );
}
