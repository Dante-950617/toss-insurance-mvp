import { createClient } from '@/lib/supabase/server';
import ScriptsClient from '@/components/ScriptsClient';
import type { Profile, SalesScript } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ScriptsPage() {
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

  const { data: scripts } = await supabase
    .from('sales_scripts')
    .select('*')
    .order('category')
    .order('created_at', { ascending: false });

  return (
    <ScriptsClient
      currentUser={profileData!}
      initialScripts={(scripts ?? []) as SalesScript[]}
    />
  );
}
