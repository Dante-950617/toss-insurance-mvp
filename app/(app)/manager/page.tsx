import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import ManagerClient from '@/components/ManagerClient';
import { calcMember } from '@/lib/utils';
import type { Profile, TeamSettings, MemberInvitation } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) redirect('/login');
  if (profileData.role !== 'MANAGER') redirect('/dashboard');

  const supabase = await createClient();

  const [
    { data: allMembers },
    { data: teamSettings },
    { data: invitations },
  ] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: true }),
    supabase.from('team_settings').select('*').eq('id', 1).single<TeamSettings>(),
    supabase.from('member_invitations').select('*').order('invited_at', { ascending: false }),
  ]);

  const members = ((allMembers ?? []) as Profile[]).map(calcMember);

  return (
    <ManagerClient
      currentUser={profileData}
      members={members}
      invitations={(invitations ?? []) as MemberInvitation[]}
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
    />
  );
}
