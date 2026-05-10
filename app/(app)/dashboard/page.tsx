import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import DashboardClient from '@/components/DashboardClient';
import { calcMember } from '@/lib/utils';
import type { Profile, TeamSettings, Deal, Task } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const [
    { data: membersRaw },
    { data: teamSettings },
    { data: deals },
    { data: tasks },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'REP')
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase.from('team_settings').select('*').eq('id', 1).single<TeamSettings>(),
    supabase.from('deals').select('*').order('last_updated', { ascending: false }),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', profileData.id)
      .order('done', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false }),
  ]);

  const members = ((membersRaw ?? []) as Profile[]).map(calcMember);

  return (
    <DashboardClient
      currentUser={profileData}
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
