import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import LeaderboardClient from '@/components/LeaderboardClient';
import type { Profile, Deal, DealActivity } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const [{ data: members }, { data: deals }, { data: activities }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'REP')
      .eq('status', 'ACTIVE')
      .order('name'),
    supabase.from('deals').select('*'),
    supabase
      .from('deal_activities')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <LeaderboardClient
      currentUser={profileData}
      members={(members ?? []) as Profile[]}
      deals={(deals ?? []) as Deal[]}
      activities={(activities ?? []) as DealActivity[]}
    />
  );
}
