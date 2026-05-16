import React from 'react';
import { Link } from 'react-router';
import {
  ENX_CONTACT_EMAIL,
  ENX_CONTACT_PHONE_DISPLAY,
  ENX_CONTACT_PHONE_TEL,
  ENX_REPRESENTATIVE_NAME,
} from '@/app/constants/operatorContact';
import { BusinessInfoSection } from './BusinessInfoSection';

/** 카카오·스토어 심사용 공개 페이지 — 법률 검토 전 초안 */
export function PrivacyPage() {
  return (
    <div className="min-h-full overflow-y-auto bg-[#0A0A0E] px-5 py-8 text-white/85">
      <div className="mx-auto max-w-md">
        <h1 className="mb-2 text-xl font-bold text-white">개인정보 처리방침</h1>
        <p className="mb-8 text-[12px] text-white/45">스팟바이브(SpotVibe) — 시행일 2026-05-01</p>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">1. 수집 항목</h2>
          <p className="text-white/70">
            서비스 이용을 위해 카카오 로그인 시 동의하신 범위의 정보(예: 회원 식별, 선택 동의 시 성별·연령대 등)와
            서비스 내에서 입력하신 설정(이동 수단, 선호 시간, 관심 태그 등)을 저장할 수 있습니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">2. 이용 목적</h2>
          <p className="text-white/70">회원 식별, 서비스 제공·개선, 고지·문의 응대.</p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">3. 위치정보</h2>
          <p className="text-white/70">
            지도·내 위치·현장 제보 등 서비스 제공을 위해 브라우저 등으로부터 위치정보를 이용할 수 있습니다. 「내 위치
            찾기」를 켠 동안에 한해 프로필에 좌표가 반영될 수 있으며, 끄면 해당 좌표는 비워집니다. 지도에서 이동·접속
            경로를 타임라인 형태로 저장하지 않습니다. 구체적 처리 항목·보관은 관련 법령·본 방침 및 서비스 내 안내(
            <span className="font-semibold text-white/80">지도 · 「내 위치 찾기」</span> 등)를 따릅니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">4. 보관 및 파기</h2>
          <p className="text-white/70">
            관련 법령 또는 이용약관에 따른 기간 동안 보관하며, 목적 달성 후 지체 없이 파기합니다.
          </p>
        </section>

        <section className="mb-6 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">5. 처리 위탁·제3자</h2>
          <p className="text-white/70">
            인증·데이터 저장을 위해 Supabase 등 신뢰할 수 있는 인프라를 이용할 수 있으며, 상세는 서비스 운영 정책에
            따릅니다.
          </p>
        </section>

        <section className="mb-8 space-y-2 text-[13px] leading-relaxed">
          <h2 className="text-[14px] font-semibold text-white">6. 문의</h2>
          <p className="text-white/70">
            앱 내 문의 또는 아래 연락처로 문의해 주세요. 담당: {ENX_REPRESENTATIVE_NAME} ·{' '}
            <a href={`tel:${ENX_CONTACT_PHONE_TEL}`} className="text-cyan-300/90 underline-offset-2 hover:underline">
              {ENX_CONTACT_PHONE_DISPLAY}
            </a>
            {' · '}
            <a href={`mailto:${ENX_CONTACT_EMAIL}`} className="text-cyan-300/90 underline-offset-2 hover:underline">
              {ENX_CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <BusinessInfoSection tone="page" />

        <div className="flex flex-wrap gap-3">
          <Link
            to="/signup"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-cyan-300/90"
          >
            회원가입
          </Link>
          <Link
            to="/login"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-white/70"
          >
            로그인
          </Link>
          <Link
            to="/company"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[12px] font-semibold tracking-tight text-white/70"
          >
            사업자정보
          </Link>
        </div>
      </div>
    </div>
  );
}
