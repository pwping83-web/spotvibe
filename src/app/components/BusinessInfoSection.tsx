import React from 'react';
import { getBusinessInfo, hasAnyBusinessInfo, type BusinessInfo } from '@/lib/businessInfo';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/[0.06] py-2.5 last:border-0 last:pb-0 first:pt-0">
      <p className="text-[9px] font-semibold tracking-tight text-white/38">{label}</p>
      <div className="mt-1 text-[11px] leading-relaxed text-white/80">{children}</div>
    </div>
  );
}

type BusinessInfoSectionProps = {
  /** `page`: /company 등 본문 상단 — 상단 구분선 없음 */
  tone?: 'footer' | 'page';
  /**
   * `compact`: 로그인·가입 하단 — 요약 한 줄
   * `full`(기본): 전자상거래법 안내 + 상세 항목
   */
  variant?: 'full' | 'compact';
};

/** `이앤엑스(ENX) · 대표 … · 사업자등록번호 …` */
function BusinessIdentityOneLine({ info, className }: { info: BusinessInfo; className: string }) {
  const rep = info.representative?.trim();
  const reg = info.regNumber?.trim();

  return (
    <p className={className}>
      <span className="text-white/82">이앤엑스(ENX)</span>
      {rep ? (
        <>
          <span className="mx-2 text-white/28">·</span>
          <span className="text-white/68">
            대표 <span className="font-medium text-white/88">{rep}</span>
          </span>
        </>
      ) : null}
      {reg ? (
        <>
          <span className="mx-2 text-white/28">·</span>
          <span className="text-white/68">
            사업자등록번호 <span className="font-medium tabular-nums text-white/88">{reg}</span>
          </span>
        </>
      ) : null}
    </p>
  );
}

/** `VITE_BUSINESS_*` 환경 변수에 값이 있을 때만 렌더링. 로그인·약관·/company 등 공개 경로에 배치. */
export function BusinessInfoSection({ tone = 'footer', variant = 'full' }: BusinessInfoSectionProps) {
  const info = getBusinessInfo();
  if (!hasAnyBusinessInfo(info)) return null;

  if (variant === 'compact') {
    return (
      <section className="mt-5 border-t border-white/[0.08] pt-4 text-center">
        <BusinessIdentityOneLine
          info={info}
          className="flex flex-wrap items-baseline justify-center gap-y-1 text-center text-[10.5px] leading-relaxed tracking-tight text-white/68"
        />
      </section>
    );
  }

  const sectionClass =
    tone === 'page' ? 'mb-8' : 'mb-8 mt-8 border-t border-white/[0.08] pt-8';

  return (
    <section className={sectionClass}>
      <h2 className="mb-2 text-[12px] font-semibold tracking-tight text-white">사업자정보</h2>
      <p className="mb-2.5 text-[10.5px] leading-relaxed tracking-tight text-white/42">
        전자상거래 등에서의 소비자보호에 관한 법률 등에 따른 사업자 고지입니다.
      </p>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1">
        <div className="border-b border-white/[0.06] pb-3 pt-1">
          <BusinessIdentityOneLine
            info={info}
            className="text-[11px] leading-relaxed tracking-tight text-white/80"
          />
        </div>
        {info.tradeName ? <Row label="상호">{info.tradeName}</Row> : null}
        {info.ecommerceReport ? <Row label="통신판매업 신고">{info.ecommerceReport}</Row> : null}
        {info.phone ? (
          <Row label="전화">
            <a href={`tel:${info.phone.replace(/\s/g, '')}`} className="text-cyan-300/90 underline-offset-2 hover:underline">
              {info.phone}
            </a>
          </Row>
        ) : null}
        {info.email ? (
          <Row label="이메일">
            <a href={`mailto:${info.email}`} className="text-cyan-300/90 underline-offset-2 hover:underline">
              {info.email}
            </a>
          </Row>
        ) : null}
      </div>
    </section>
  );
}
