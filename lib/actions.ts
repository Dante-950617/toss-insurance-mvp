'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { DealStage, DealOutcome, UserStatus, ActivityType } from './types';

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

// 결과(WIN/LOSE/PENDING) 설정 — 단계와 분리
// WIN: stage='후속조치(대면)' 일 때만 가능 (트리거에서 강제)
// LOSE: 어느 단계에서든 가능 (현재 stage 보존하여 단계별 퍼널 분석)
// 되돌리기: PENDING 으로 복귀
export async function setDealOutcome(
  dealId: string,
  outcome: DealOutcome,
  reason?: string
) {
  const { supabase } = await requireAuth();
  const patch: { outcome: DealOutcome; reason?: string } = { outcome };
  if (outcome === 'LOSE' && reason !== undefined) patch.reason = reason;
  if (outcome === 'PENDING') patch.reason = '';
  const { error } = await supabase.from('deals').update(patch).eq('id', dealId);
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  revalidatePath('/dashboard');
  revalidatePath('/analytics');
  revalidatePath('/leaderboard');
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
    outcome?: DealOutcome;
    deal_value?: number;
    phone?: string;
    next_contact_date?: string | null;
    notes?: string;
    referrer?: string;
    // 카테고리 (대/소)
    insurance_line?: string;
    category_sub?: string;
    category_custom?: string;
    // 보장 형태
    coverage_type?: string;
    coverage_detail?: string;
    coverage_custom?: string;
  }
) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('deals').update(patch).eq('id', dealId);
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteDeal(dealId: string) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  revalidatePath('/dashboard');
  return { success: true };
}

// -------------------- Activities --------------------
export async function addActivity(
  dealId: string,
  activityType: ActivityType,
  content: string
) {
  const { supabase, user } = await requireAuth();
  const trimmed = content.trim();
  if (!trimmed) return { error: '내용을 입력해주세요' };
  const { error } = await supabase.from('deal_activities').insert({
    deal_id: dealId,
    author_id: user.id,
    activity_type: activityType,
    content: trimmed,
  });
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  return { success: true };
}

export async function deleteActivity(activityId: string) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('deal_activities').delete().eq('id', activityId);
  if (error) return { error: error.message };
  revalidatePath('/pipeline');
  return { success: true };
}

// -------------------- Tasks --------------------
export async function createTask(
  title: string,
  dueDate?: string | null,
  dealId?: string | null
) {
  const { supabase, user } = await requireAuth();
  const trimmed = title.trim();
  if (!trimmed) return { error: '내용을 입력해주세요' };
  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    title: trimmed,
    due_date: dueDate || null,
    deal_id: dealId || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}

export async function toggleTask(taskId: string, done: boolean) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('tasks').update({ done }).eq('id', taskId);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteTask(taskId: string) {
  const { supabase } = await requireAuth();
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}

// -------------------- Member invite/delete (Manager) --------------------
export async function inviteMember(payload: {
  email: string;
  name: string;
  target_sales?: number;
  conversion_rate?: number;
  lead_time?: number;
}) {
  const { supabase, user } = await requireActiveManager();
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();
  if (!email || !name) return { error: '이메일/이름을 모두 입력해주세요' };

  // 이미 가입된 사용자인지 확인
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, status')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfile) {
    return {
      error:
        existingProfile.status === 'INACTIVE'
          ? '이미 등록된 사용자입니다. 권한 복구 버튼을 사용하세요'
          : '이미 가입된 사용자입니다',
    };
  }

  const { error } = await supabase.from('member_invitations').upsert({
    email,
    name,
    invited_by: user.id,
    target_sales: payload.target_sales ?? 10000000,
    conversion_rate: payload.conversion_rate ?? 10,
    lead_time: payload.lead_time ?? 7,
  });
  if (error) return { error: error.message };
  revalidatePath('/manager');
  return { success: true };
}

export async function cancelInvitation(email: string) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase
    .from('member_invitations')
    .delete()
    .eq('email', email.toLowerCase());
  if (error) return { error: error.message };
  revalidatePath('/manager');
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
    license_type?: string;
    license_number?: string;
    license_expiry?: string | null;
    hire_date?: string | null;
    phone?: string;
  }
) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('profiles').update(patch).eq('id', memberId);
  if (error) return { error: error.message };
  revalidatePath('/manager');
  revalidatePath('/dashboard');
  return { success: true };
}

// -------------------- Sales Scripts --------------------
export async function createScript(payload: {
  title: string;
  category: string;
  content: string;
}) {
  const { supabase, user } = await requireActiveManager();
  const { error } = await supabase.from('sales_scripts').insert({
    title: payload.title.trim(),
    category: payload.category || 'general',
    content: payload.content.trim(),
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/scripts');
  return { success: true };
}

export async function updateScript(
  id: string,
  patch: { title?: string; category?: string; content?: string }
) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('sales_scripts').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/scripts');
  return { success: true };
}

export async function deleteScript(id: string) {
  const { supabase } = await requireActiveManager();
  const { error } = await supabase.from('sales_scripts').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/scripts');
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
