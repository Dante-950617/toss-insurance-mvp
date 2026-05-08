import { createClient } from '@/lib/supabase/server';
import LeaderboardClient from '@/components/LeaderboardClient';
import type { Profile, Deal, DealActivity } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
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

  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'REP')
    .eq('status', 'ACTIVE')
    .order('name');

  const { data: deals } = await supabase.from('deals').select('*');
  const { data: activities } = await supabase
    .from('deal_activities')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <LeaderboardClient
      currentUser={profileData!}
      members={(members ?? []) as Profile[]}
      deals={(deals ?? []) as Deal[]}
      activities={(activities ?? []) as DealActivity[]}
    />
  );
}
