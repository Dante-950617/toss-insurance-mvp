import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ManagerClient from '@/components/ManagerClient';
import { calcMember } from '@/lib/utils';
import type { Profile, TeamSettings, MemberInvitation } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (!profileData || profileData.role !== 'MANAGER') redirect('/dashboard');

  const { data: allMembers } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: teamSettings } = await supabase
    .from('team_settings')
    .select('*')
    .eq('id', 1)
    .single<TeamSettings>();

  const { data: invitations } = await supabase
    .from('member_invitations')
    .select('*')
    .order('invited_at', { ascending: false });

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
