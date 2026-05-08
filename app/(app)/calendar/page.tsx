import { createClient } from '@/lib/supabase/server';
import CalendarClient from '@/components/CalendarClient';
import type { Profile, Deal } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
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
    .eq('status', 'ACTIVE')
    .order('name');

  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .not('next_contact_date', 'is', null)
    .order('next_contact_date');

  return (
    <CalendarClient
      currentUser={profileData!}
      members={(members ?? []) as Profile[]}
      deals={(deals ?? []) as Deal[]}
    />
  );
}
