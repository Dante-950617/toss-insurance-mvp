import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import AnalyticsClient from '@/components/AnalyticsClient';
import type { Profile, Deal, DealActivity } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) redirect('/login');
  if (profileData.role !== 'MANAGER') redirect('/dashboard');

  const supabase = await createClient();

  const [{ data: members }, { data: deals }, { data: activities }] = await Promise.all([
    supabase.from('profiles').select('*').eq('status', 'ACTIVE').order('name'),
    supabase.from('deals').select('*'),
    supabase
      .from('deal_activities')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <AnalyticsClient
      currentUser={profileData}
      members={(members ?? []) as Profile[]}
      deals={(deals ?? []) as Deal[]}
      activities={(activities ?? []) as DealActivity[]}
    />
  );
}
