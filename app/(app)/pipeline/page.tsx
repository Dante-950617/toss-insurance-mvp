import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import PipelineClient from '@/components/PipelineClient';
import type {
  Profile,
  Deal,
  DealActivity,
  Promotion,
  DealPromotion,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const [
    { data: members },
    { data: deals },
    { data: activities },
    { data: promotions },
    { data: dealPromotions },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('status', 'ACTIVE').order('name'),
    supabase.from('deals').select('*').order('created_at', { ascending: false }),
    supabase
      .from('deal_activities')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('promotions')
      .select('*')
      .eq('status', 'active')
      .order('end_date'),
    supabase.from('deal_promotions').select('*'),
  ]);

  return (
    <PipelineClient
      currentUser={profileData}
      members={(members ?? []) as Profile[]}
      initialDeals={(deals ?? []) as Deal[]}
      initialActivities={(activities ?? []) as DealActivity[]}
      activePromotions={(promotions ?? []) as Promotion[]}
      initialDealPromotions={(dealPromotions ?? []) as DealPromotion[]}
    />
  );
}
