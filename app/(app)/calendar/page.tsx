import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import CalendarClient from '@/components/CalendarClient';
import type { Profile, Deal } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const [{ data: members }, { data: deals }] = await Promise.all([
    supabase.from('profiles').select('*').eq('status', 'ACTIVE').order('name'),
    supabase
      .from('deals')
      .select('*')
      .not('next_contact_date', 'is', null)
      .order('next_contact_date'),
  ]);

  return (
    <CalendarClient
      currentUser={profileData}
      members={(members ?? []) as Profile[]}
      deals={(deals ?? []) as Deal[]}
    />
  );
}
