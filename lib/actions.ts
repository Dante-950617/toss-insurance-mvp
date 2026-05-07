'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { DealStage, UserStatus } from './types';

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');
  return { supabase, user };
}

async function requireActiveManager() {
  const { supabase, user } = await requireAuth();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'MANAGER' || profile.status !== 'ACTIVE') {
    throw new Error('관리자 권한이 필요합니다');
  }
  return { supabase, user };
}

// -------------------- Deals --------------------
export async function createDeal(formData: { customer_name: string; member_id?: string }) {
  const { supabase, user } = await requireAuth();
  const trimmed = formData.customer_name.trim();
  if (!trimmed) return { error: '고객명을 입력해주세요' };

  const memberId = formData.member_id ?? user.id;
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('deals').insert({
    member_id: memberId,
    customer_name: trimmed,
    stage: '진행대기' as DealStage,
    date: today,
    last_updated: today,
  });

  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateDealStage(dealId: string, newStage: DealStage, reason?: string) {
  const { supabase } = await requireAuth();
  const { error } = await supabase
    .from('deals')
    .update({ stage: newStage, ...(reason !== undefined ? { reason } : {}) })
    .eq('id', dealId);

  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateDealDetail(
  dealId: string,
  patch: {
    product_type?: string;
    monthly_premium?: number;
    competitor?: string;
    manager_comment?: string;
    stage?: DealStage;
  }
) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('deals').update(patch).eq('id', dealId);
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  return { success: true };
}

export async function deleteDeal(dealId: string) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  return { success: true };
}

// -------------------- Manager-only --------------------
export async function updateMemberKpi(
  memberId: string,
  patch: {
    name?: string;
    target_sales?: number;
    current_sales?: number;
    conversion_rate?: number;
    lead_time?: number;
  }
) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('profiles').update(patch).eq('id', memberId);
  if (error) return { error: error.message };
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateTeamSettings(patch: {
  target_sales: number;
  avg_deal_size: number;
  conversion_rate: number;
  lead_time: number;
}) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('team_settings').update(patch).eq('id', 1);
  if (error) return { error: error.message };
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function setUserStatus(userId: string, status: UserStatus) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('profiles').update({ status }).eq('id', userId);
  if (error) return { error: error.message };
  revalidatePath('/manager');
  return { success: true };
}

export async function setUserRole(userId: string, role: 'MANAGER' | 'REP') {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: error.message };
  revalidatePath('/manager');
  return { success: true };
}
