import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import type { Profile } from './types';

/**
 * 현재 로그인 사용자의 profile 을 가져옴.
 * React `cache()` 로 한 요청 안에서 호출 횟수와 무관하게 단 1회만 DB hit.
 * 즉 layout / page 가 각각 호출해도 라운드트립은 한 번.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  return profile ?? null;
});

/** 인증 필요 — 없으면 /login 으로 리다이렉트 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** ACTIVE MANAGER 만 — 아니면 /dashboard 로 */
export async function requireActiveManagerProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'MANAGER' || profile.status !== 'ACTIVE') {
    redirect('/dashboard');
  }
  return profile;
}
