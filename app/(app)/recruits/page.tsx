import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import RecruitsClient from '@/components/RecruitsClient';
import type { Profile, Recruit } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RecruitsPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  // RLS 가 자동으로 본인 행 (REP) 또는 전체 (MANAGER) 필터링
  const [{ data: recruits }, { data: members }] = await Promise.all([
    supabase
      .from('recruits')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').order('name'),
  ]);

  return (
    <RecruitsClient
      currentUser={profileData}
      members={(members ?? []) as Profile[]}
      initialRecruits={(recruits ?? []) as Recruit[]}
    />
  );
}
