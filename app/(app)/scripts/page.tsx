import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import ScriptsClient from '@/components/ScriptsClient';
import type { SalesScript } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ScriptsPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const { data: scripts } = await supabase
    .from('sales_scripts')
    .select('*')
    .order('category')
    .order('created_at', { ascending: false });

  return (
    <ScriptsClient
      currentUser={profileData}
      initialScripts={(scripts ?? []) as SalesScript[]}
    />
  );
}
