'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const reset = () => {
    setError('');
    setInfo('');
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    reset();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    reset();

    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('이름, 이메일, 비밀번호(6자 이상)를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    // 이메일 확인이 켜져있으면 session === null 로 옴
    if (!data.session) {
      setInfo('가입이 완료되었습니다. 받으신 인증 메일을 확인 후 로그인해주세요.');
      setLoading(false);
      setMode('LOGIN');
      setPassword('');
      return;
    }

    // 이메일 확인이 꺼져있으면 즉시 세션 생성됨 → 미들웨어가 /pending 으로 보냄
    router.push('/pending');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#F2F4F6] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-[24px] p-10 shadow-sm border border-gray-100 max-w-md w-full">
        <div className="text-center mb-8">
          <TrendingUp className="w-12 h-12 text-[#3182F6] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#191F28] tracking-tight mb-2">
            토스 인슈어런스
          </h1>
          <p className="text-[#4E5968] text-sm">영업 퍼포먼스 및 활동 관리 솔루션</p>
        </div>

        <div className="flex gap-1 p-1 bg-[#F2F4F6] rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              reset();
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'LOGIN' ? 'bg-white text-[#191F28] shadow-sm' : 'text-[#8B95A1]'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              reset();
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
              mode === 'REGISTER' ? 'bg-white text-[#191F28] shadow-sm' : 'text-[#8B95A1]'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={mode === 'LOGIN' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'REGISTER' && (
            <div>
              <label className="block text-xs font-bold text-[#4E5968] mb-1.5">이름</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full bg-[#F2F4F6] border-transparent rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#3182F6] focus:bg-white outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#4E5968] mb-1.5">이메일</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#F2F4F6] border-transparent rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#3182F6] focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#4E5968] mb-1.5">
              비밀번호 {mode === 'REGISTER' && <span className="text-[#8B95A1]">(6자 이상)</span>}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'REGISTER' ? '6자 이상 입력' : '비밀번호'}
                className="w-full bg-[#F2F4F6] border-transparent rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#3182F6] focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex items-start gap-2 bg-blue-50 text-[#3182F6] text-xs font-bold p-3 rounded-xl">
              <CheckCircle className="w-4 h-4 shrink-0 mt-px" />
              <span>{info}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3182F6] hover:bg-blue-600 disabled:opacity-50 transition-colors py-3.5 rounded-xl text-sm font-bold text-white shadow-sm mt-2"
          >
            {loading ? '처리 중...' : mode === 'LOGIN' ? '로그인' : '가입 신청하기'}
          </button>
        </form>

        <p className="text-[11px] text-[#8B95A1] text-center font-medium leading-relaxed mt-6">
          ※ 첫 가입자는 자동으로 <strong className="text-[#3182F6]">관리자(MANAGER)</strong> 권한이
          부여됩니다.
          <br />
          이후 가입자는 <strong className="text-orange-500">관리자 승인 후</strong> 정상 접속이
          가능합니다.
        </p>
      </div>
    </div>
  );
}

function translateAuthError(msg: string): string {
  if (/Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 일치하지 않습니다.';
  if (/User already registered/i.test(msg)) return '이미 가입된 이메일입니다. 로그인해주세요.';
  if (/Password should be/i.test(msg)) return '비밀번호는 6자 이상이어야 합니다.';
  if (/Email not confirmed/i.test(msg))
    return '이메일 인증이 필요합니다. 받으신 메일에서 인증 링크를 클릭해주세요.';
  return msg;
}
