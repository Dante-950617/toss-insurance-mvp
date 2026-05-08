import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnalyticsClient from '@/components/AnalyticsClient';
import type { Profile, Deal, DealActivity } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
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

  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('name');

  const { data: deals } = await supabase.from('deals').select('*');
  const { data: activities } = await supabase
    .from('deal_activities')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <AnalyticsClient
      currentUser={profileData}
      members={(members ?? []) as Profile[]}
      deals={(deals ?? []) as Deal[]}
      activities={(activities ?? []) as DealActivity[]}
    />
  );
}
