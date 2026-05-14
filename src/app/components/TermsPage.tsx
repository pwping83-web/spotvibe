import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { BusinessInfoSection } from './BusinessInfoSection';

/** 카카오·스토어 심사용 공개 페이지 — 법률 검토 전 초안 */
export function TermsPage() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#spot-report-terms') {
      window.requestAnimationFrame(() => {
        document.getElementById('spot-report-terms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash]);

  return (
    <div className="min-h-full overflow-y-auto bg-[#0A0A0E] px-5 py-8 text-white/85">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-xl font-bold text-white">서비스 이용약관</h1>
        <p className="mb-8 text-[12px] text-white/45">스팟바이브(SpotVibe) — 시행일 2026-05-01</p>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제1조 (목적)</h2>
          <p className="text-white/70">
            본 약관은 스팟바이브(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간 권리·의무 및 책임사항을
            규정합니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제2조 (서비스 내용)</h2>
          <p className="text-white/70">
            지역 기반 지도·이벤트·알림 등 모바일 웹 기능을 제공합니다. 세부 기능은 앱 내 안내에 따릅니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제2조의2 (만남 주선·소개 없음)</h2>
          <p className="text-white/70">
            본 서비스는 이성·친목을 목적으로 한 소개, 만남 주선, 데이팅 매칭 등을 제공하지 않으며, 이용자 간
            오프라인 만남을 알선·중개하지 않습니다. 지도 및 AI 인사이트는 장소·이벤트 정보 제공 목적에 한합니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제3조 (회원가입)</h2>
          <p className="text-white/70">
            카카오 등 제3자 인증을 통해 가입할 수 있으며, 가입 시 개인정보 처리방침 및 본 약관에 동의한 것으로
            봅니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제3조의2 (본인확인·연령 및 허위 가입 금지)</h2>
          <p className="text-white/70">
            회사는 정보통신망법·청소년 보호 관련 법령, 앱 마켓 및 제3자 인증·결제 플랫폼 정책에 따라{' '}
            <span className="font-semibold text-white/85">만 19세 미만의 가입 및 이용을 허용하지 않거나 제한</span>
            할 수 있으며, 이에 따라{' '}
            <span className="font-semibold text-white/85">
              휴대폰 본인확인(PASS, 카카오 인증 등) 또는 이에 상응하는 본인·성인 확인 절차
            </span>
            를 요구할 수 있습니다. 해당 절차가 도입·갱신되는 경우, 인증을 완료한 회원에 한하여 일부 또는 전
            서비스를 제공할 수 있습니다.
          </p>
          <p className="text-white/70">
            본인확인을 통해 확인된 실명·생년월일·성별 등의 범위에서 프로필·이용 자격이 관리되어야 하며, 타인
            명의 도용·허위 인증 시도가 확인되는 경우 회사는{' '}
            <span className="font-semibold text-white/85">가입 거절, 이용 정지, 계약 해지</span> 등 필요한 조치를
            할 수 있습니다. 인증·자격 여부는 <span className="font-semibold text-white/85">서버 측 기록</span>을
            우선하며, 클라이언트만의 표시로는 이용 자격이 보장되지 않습니다.
          </p>
          <p className="text-[12px] leading-relaxed text-white/48">
            본 조항은 법령·가이드라인 및 사업계획상의 기술적 통제(예: 인증 시각·무결성 필드의 서버 기록)를 반영한
            것으로, 실제 본인확인 API 연동·DB 스키마는 별도 배포·공지 시 확정됩니다.
          </p>
        </section>

        <section className="mb-8 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제4조 (면책·문의)</h2>
          <p className="text-white/70">
            서비스는 현 상태로 제공됩니다. 문의는 앱 내 경로를 이용해 주시기 바랍니다.
          </p>
        </section>

        <section id="spot-report-terms" className="mb-8 scroll-mt-6 space-y-3 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">제5조 (현장 제보 사진·글)</h2>
          <p className="text-white/70">
            이용자가 업로드하는 현장 제보 사진·장소명·설명 등(이하 &quot;제보 콘텐츠&quot;)에 관한 법적 책임은{' '}
            <span className="font-semibold text-white/85">전적으로 해당 이용자 본인</span>에게 있습니다.
          </p>
          <p className="text-white/70">
            서비스는 제보 시 <span className="font-semibold text-white/85">얼굴 자동 모자이크</span>를 시도할 수
            있으나, 이는 보조 기능일 뿐 완전성·정확성을 보장하지 않습니다. 이용자는{' '}
            <span className="font-semibold text-white/85">모자이크 처리된 미리보기를 직접 확인</span>한 뒤, 타인의
            초상·인격권, 퍼블리시티권, 저작권 등 제3자 권리를 침해하지 않는지 스스로 판단하고 등록해야 합니다.
          </p>
          <p className="text-white/70">
            이용자는 제보 콘텐츠에 대해 필요한 권원(촬영·게재 동의 등)을 확보했음을 진술·보증하며, 제보 콘텐츠로
            인해 제3자가 운영자에게 이의·신고·소송 등을 제기하는 경우 이용자가 자신의 비용과 책임으로 이를
            방어하고, 운영자가 지출한 합리적인 비용·손해를 배상할 의무를 집니다(운영자의 고의·중대한 과실이 있는
            경우는 예외로 할 수 있습니다).
          </p>
          <p className="text-[12px] leading-relaxed text-white/48">
            본 조항은 서비스 운영·분쟁 대비를 위한 것으로, 최종 해석은 관계 법령 및 법원 판례에 따릅니다. 정식
            사업자정보·약관 개정 시 내용이 조정될 수 있습니다.
          </p>
        </section>

        <BusinessInfoSection />

        <div className="flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-cyan-300/90"
          >
            회원가입
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
