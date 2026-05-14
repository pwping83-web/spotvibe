import React from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { signInWithKakaoOAuth } from '@/lib/kakaoAuth';
import { BusinessInfoSection } from './BusinessInfoSection';

function KakaoSymbol({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 22" width="20" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 0C5.373 0 0 3.582 0 8c0 2.81 1.91 5.29 4.804 6.735L3.6 21.6l5.044-2.77c1.08.3 2.22.464 3.356.464 6.627 0 12-3.582 12-8S18.627 0 12 0z"
      />
    </svg>
  );
}

export interface SignupPageProps {
  onLoginSuccess: () => void;
}

/**
 * 카카오 개발자 콘솔·개인정보 동의 심사용 회원가입 화면.
 * 약관·개인정보 동의 후 카카오 버튼 활성화.
 */
export function SignupPage({ onLoginSuccess }: SignupPageProps) {
  const [agreeTerms, setAgreeTerms] = React.useState(false);
  const [agreePrivacy, setAgreePrivacy] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const canStart = agreeTerms && agreePrivacy;

  const handleKakaoSignup = async () => {
    if (!canStart || pending) return;
    setPending(true);
    try {
      const result = await signInWithKakaoOAuth();
      if (result === 'mock_ok') onLoginSuccess();
      if (result === 'missing_config') {
        window.alert(
          '배포 사이트에 Supabase 설정이 없습니다.\n\nVercel → 프로젝트 → Settings → Environment Variables에\nVITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 넣고\n다시 배포(Deploy)해 주세요.',
        );
        setPending(false);
      }
    } catch {
      setPending(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col bg-[#0A0A0E] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.028]"
        aria-hidden
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,1) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-12 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="shrink-0"
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-400/60">SpotVibe</p>
          <p className="mb-2 text-[12px]">
            <Link to="/service" className="font-semibold text-cyan-400/75 underline underline-offset-2">
              서비스 안내·이용 동선(로그인 없이 보기)
            </Link>
          </p>
          <h1 className="text-[1.65rem] font-black tracking-tight text-white">회원가입</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-white/45">
            카카오 계정으로 간편 가입 후<br />
            지도·이벤트·맞춤 설정을 이용할 수 있습니다.
          </p>
        </motion.div>

        {/* 카카오 심사: 본 화면에 이름·전화 등 입력란 없음 — 수집 항목만 고지 */}
        <div
          className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3.5"
          aria-labelledby="signup-pi-heading"
        >
          <p id="signup-pi-heading" className="mb-2 text-[12px] font-bold text-cyan-200/90">
            가입 시 수집·이용되는 정보
          </p>
          <ul className="list-inside list-disc space-y-1.5 text-[11.5px] leading-relaxed text-white/55">
            <li>
              <span className="font-semibold text-white/65">본 화면</span>: 이름·전화번호·이메일 등을 직접 입력하는
              칸은 없습니다.
            </li>
            <li>
              <span className="font-semibold text-white/65">카카오 로그인</span>: 회원 식별(필수), 앱 설정
              동기화를 위해 카카오가 제공하는 범위의 정보. 동의하신 경우에 한해 성별·연령대 등(선택)이 전달될 수
              있습니다.
            </li>
            <li>
              <span className="font-semibold text-white/65">가입 이후</span>: 마이페이지에서 이동 수단·관심 태그 등
              서비스 이용을 위한 설정을 추가로 저장할 수 있습니다.
            </li>
          </ul>
          <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-[10px] leading-relaxed text-white/35">
            심사·캡처 제출 시: 실제 개인정보를 입력하지 말고, 아래 약관 체크는 해제하거나 필요 시에만 표시해 주세요.
          </p>
        </div>

        <div className="mt-8 flex min-h-0 flex-1 flex-col justify-center gap-5">
          <div
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
            role="group"
            aria-label="약관 동의"
          >
            <p className="mb-3 text-[12px] font-semibold text-white/55">가입 전 확인</p>

            <label className="flex cursor-pointer items-start gap-3 border-b border-white/[0.06] py-3">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 accent-cyan-400"
              />
              <span className="text-[13px] leading-snug text-white/75">
                <Link to="/terms" className="font-semibold text-cyan-300/90 underline underline-offset-2">
                  서비스 이용약관
                </Link>
                에 동의합니다 (필수)
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 py-3">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 accent-cyan-400"
              />
              <span className="text-[13px] leading-snug text-white/75">
                <Link to="/privacy" className="font-semibold text-cyan-300/90 underline underline-offset-2">
                  개인정보 처리방침
                </Link>
                에 동의합니다 (필수)
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleKakaoSignup}
            disabled={!canStart || pending}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-[15px] text-[15px] font-bold text-[#191600] transition-opacity active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: '#FEE500', boxShadow: '0 4px 24px rgba(254,229,0,0.22)' }}
          >
            <KakaoSymbol className="shrink-0" />
            {pending ? '카카오 연결 중…' : '카카오로 회원가입'}
          </button>

          <p className="text-center text-[11px] text-white/30">
            가입 시 카카오 로그인 화면에서 추가 동의가 있을 수 있습니다.
          </p>

          <div className="mx-auto w-full max-w-[340px]">
            <BusinessInfoSection variant="compact" tone="page" />
            <p className="mt-2 text-center text-[10px] tracking-tight text-white/35">
              <Link to="/company" className="font-medium text-cyan-400/65 underline underline-offset-2">
                사업자정보
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-auto shrink-0 pt-6 text-center text-[12px] text-white/35">
          이미 가입하셨나요?{' '}
          <Link to="/login" className="font-semibold text-cyan-400/80 underline underline-offset-2">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
