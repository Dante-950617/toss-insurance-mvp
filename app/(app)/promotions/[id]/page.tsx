import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import PromotionDetailClient from '@/components/PromotionDetailClient';
import type { Promotion, Deal, DealPromotion, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PromotionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const profileData = await getCurrentProfile();
  if (!profileData) return null;

  const supabase = await createClient();

  const [{ data: promotion }, { data: deals }, { data: mappings }, { data: members }] =
    await Promise.all([
      supabase.from('promotions').select('*').eq('id', params.id).single(),
      supabase.from('deals').select('*'),
      supabase.from('deal_promotions').select('*').eq('promotion_id', params.id),
      supabase.from('profiles').select('*').order('name'),
    ]);

  if (!promotion) notFound();

  return (
    <PromotionDetailClient
      currentUser={profileData}
      promotion={promotion as Promotion}
      deals={(deals ?? []) as Deal[]}
      mappings={(mappings ?? []) as DealPromotion[]}
      members={(members ?? []) as Profile[]}
    />
  );
}
