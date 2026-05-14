import React from 'react';
import { Link } from 'react-router';
import { BusinessInfoSection } from './BusinessInfoSection';
import { getBusinessInfo, hasAnyBusinessInfo } from '@/lib/businessInfo';

/** 카카오 비즈니스·스토어 심사용 — 사업자등록증·비즈 앱과 동일한 고지가 `VITE_BUSINESS_*`에 있을 때 표시 */
export function CompanyInfoPage() {
  const filled = hasAnyBusinessInfo(getBusinessInfo());

  return (
    <div className="min-h-full overflow-y-auto bg-[#0A0A0E] px-5 py-8 text-white/85">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-semibold">
          <Link to="/login" className="text-cyan-300/90 underline-offset-2 hover:underline">
            ← 로그인
          </Link>
          <Link to="/service" className="text-cyan-300/90 underline-offset-2 hover:underline">
            서비스 안내
          </Link>
        </div>

        <h1 className="mb-2 text-lg font-bold tracking-tight text-white">사업자정보</h1>
        <p className="mb-6 text-[11px] leading-relaxed tracking-tight text-white/45">
          전자상거래 등에서의 소비자보호에 관한 법률에 따른 사업자 고지입니다. 배포 환경(Vercel 등)의{' '}
          <span className="font-mono text-[11px] text-white/55">VITE_BUSINESS_*</span> 변수에 등록증과 동일한 값을
          넣어 주세요.
        </p>

        {filled ? (
          <BusinessInfoSection tone="page" />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3.5 text-[12px] leading-relaxed text-amber-100/85">
              현재 빌드에 사업자 환경 변수가 비어 있어 표시할 수 없습니다.{' '}
              <span className="font-semibold text-amber-50/95">등록증과 동일한 값</span>은 운영자만 알 수 있으므로,
              아래 변수에 직접 입력한 뒤 로컬은 <span className="font-mono text-[11px]">npm run dev</span> 재시작,
              배포는 Vercel Production 환경 변수 + <span className="font-semibold">Redeploy</span>가 필요합니다.
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold text-white/45">
                복사용 키 (루트의 <span className="font-mono text-white/55">env.business.template</span> 참고)
              </p>
              <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40 p-3 text-[10px] leading-relaxed text-cyan-200/85">
                {`VITE_BUSINESS_TRADE_NAME=
VITE_BUSINESS_REPRESENTATIVE=
VITE_BUSINESS_REG_NUMBER=
VITE_BUSINESS_INDUSTRY=
VITE_BUSINESS_ADDRESS=
VITE_BUSINESS_PHONE=
VITE_BUSINESS_EMAIL=
VITE_BUSINESS_ECOMMERCE_REPORT_NUMBER=`}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/terms"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-white/70"
          >
            이용약관
          </Link>
          <Link
            to="/privacy"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-white/70"
          >
            개인정보 처리방침
          </Link>
        </div>
      </div>
    </div>
  );
}
