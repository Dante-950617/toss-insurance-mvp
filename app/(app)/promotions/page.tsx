import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import PromotionsListClient from '@/components/PromotionsListClient';
import type { Promotion, Deal, DealPromotion, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PromotionsPage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const [
    { data: promotions },
    { data: deals },
    { data: mappings },
    { data: members },
  ] = await Promise.all([
    supabase.from('promotions').select('*').order('start_date', { ascending: false }),
    supabase.from('deals').select('*'),
    supabase.from('deal_promotions').select('*'),
    supabase.from('profiles').select('*').order('name'),
  ]);

  return (
    <PromotionsListClient
      currentUser={profileData}
      initialPromotions={(promotions ?? []) as Promotion[]}
      deals={(deals ?? []) as Deal[]}
      mappings={(mappings ?? []) as DealPromotion[]}
      members={(members ?? []) as Profile[]}
    />
  );
}
