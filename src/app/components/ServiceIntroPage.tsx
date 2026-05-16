import React from 'react';
import { Link } from 'react-router';
import {
  ENX_CONTACT_EMAIL,
  ENX_CONTACT_PHONE_DISPLAY,
  ENX_CONTACT_PHONE_TEL,
  ENX_REPRESENTATIVE_NAME,
} from '@/app/constants/operatorContact';
import { LocationRealtimeInfoBlock } from '@/app/components/LocationRealtimeInfoBlock';
import { BusinessInfoSection } from '@/app/components/BusinessInfoSection';

export function ServiceIntroPage() {
  return (
    <div className="min-h-full overflow-y-auto bg-[#0A0A0E] px-5 py-10 text-white/85">
      <div className="mx-auto max-w-md">

        {/* 헤더 */}
        <div className="mb-8 text-center">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-cyan-400/60">SpotVibe</p>
          <h1 className="mb-3 text-2xl font-bold text-white">지금 여기</h1>
          <p className="text-[13px] leading-relaxed text-white/50">
            내 주변 지금 이 순간, 핫스팟·이벤트·이웃 소식을 한눈에
          </p>
        </div>

        {/* 핵심 기능 3가지 */}
        <div className="mb-8 grid grid-cols-3 gap-2.5">
          {[
            { icon: '🗺️', title: '지역 상권', desc: '내 주변 소상공인·핫플·이벤트 실시간 안내' },
            { icon: '✈️', title: '관광·탐색', desc: '여행지 실시간 혼잡·추천·동선 안내' },
            { icon: '🆘', title: '시민 도움', desc: '반경 3km 이웃에게 도움 알리기' },
          ].map((v) => (
            <div
              key={v.title}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-4 text-center"
            >
              <span className="text-2xl">{v.icon}</span>
              <p className="text-[11px] font-bold text-white/85">{v.title}</p>
              <p className="text-[9.5px] leading-snug text-white/42">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* 서비스 소개 */}
        <section className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-5">
          <h2 className="mb-3 text-[14px] font-semibold text-white">SpotVibe란?</h2>
          <p className="mb-4 text-[12.5px] leading-relaxed text-white/60">
            <span className="font-semibold text-white/80">지금 여기(SpotVibe)</span>는 실시간 위치 기반으로
            내 주변에서 지금 사람들이 모이는 곳, 주목할 이벤트, 지역 상권 정보를 알려주는 모바일 웹 서비스입니다.
          </p>
          <ul className="space-y-3 text-[12.5px] leading-relaxed text-white/60">
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-cyan-400">✦</span>
              <span>
                <span className="font-semibold text-white/80">실시간 지도</span> — 현재 위치 기준으로 주변 핫스팟·혼잡 구간을 지도에서 바로 확인합니다.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-cyan-400">✦</span>
              <span>
                <span className="font-semibold text-white/80">이벤트·행사 안내</span> — 내 주변 공연, 축제, 팝업스토어 등 다양한 이벤트를 거리·인기도 순으로 탐색합니다.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-cyan-400">✦</span>
              <span>
                <span className="font-semibold text-white/80">맞춤 알림</span> — 자주 가는 지역과 관심사를 설정하면 딱 맞는 소식을 먼저 알려드립니다.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-cyan-400">✦</span>
              <span>
                <span className="font-semibold text-white/80">시민 도움 알리기</span> — 주변 이웃에게 도움을 요청하거나, 작은 제보를 공유할 수 있는 커뮤니티 기능입니다.
                <span className="mt-1 block text-[11px] text-white/35">※ 공식 응급기관을 대체하지 않습니다.</span>
              </span>
            </li>
          </ul>
        </section>

        {/* 이용 방법 */}
        <section className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-5">
          <h2 className="mb-3 text-[14px] font-semibold text-white">이용 방법</h2>
          <ol className="space-y-3 text-[12.5px] leading-relaxed text-white/60">
            {[
              { step: '01', title: '카카오로 가입', desc: '카카오 계정으로 빠르게 회원가입합니다. 별도 비밀번호 없이 시작할 수 있어요.' },
              { step: '02', title: '위치 허용', desc: '내 위치를 기반으로 주변 정보를 불러옵니다. 위치 없이도 지역을 직접 검색할 수 있습니다.' },
              { step: '03', title: '탐색 시작', desc: '지도에서 핫스팟을 보거나, 이벤트 목록을 훑거나, 알림을 설정해 두세요.' },
              { step: '04', title: '즐겨찾기·설정', desc: '자주 가는 장소와 지역을 저장하면 더 빠르게 확인할 수 있습니다.' },
            ].map((item) => (
              <li key={item.step} className="flex gap-3">
                <span className="mt-0.5 shrink-0 font-mono text-[11px] font-bold text-cyan-400/70">{item.step}</span>
                <span>
                  <span className="font-semibold text-white/80">{item.title}</span>
                  <span className="block text-white/50">{item.desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-5">
          <h2 className="mb-3 text-[14px] font-semibold text-white">실시간 위치·분포</h2>
          <LocationRealtimeInfoBlock className="text-[12px] leading-relaxed text-white/55" />
        </section>

        <section className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-center">
          <h2 className="mb-2 text-[13px] font-semibold text-white">문의</h2>
          <p className="text-[12px] leading-relaxed text-white/55">
            담당 {ENX_REPRESENTATIVE_NAME} ·{' '}
            <a href={`tel:${ENX_CONTACT_PHONE_TEL}`} className="text-cyan-300/90 underline-offset-2 hover:underline">
              {ENX_CONTACT_PHONE_DISPLAY}
            </a>
            {' · '}
            <a href={`mailto:${ENX_CONTACT_EMAIL}`} className="text-cyan-300/90 underline-offset-2 hover:underline">
              {ENX_CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <BusinessInfoSection tone="page" variant="compact" />

        {/* 안내 문구 */}
        <p className="mb-8 text-center text-[11.5px] leading-relaxed text-white/35">
          서비스 이용 시 <Link to="/terms" className="text-white/55 underline underline-offset-2">이용약관</Link>과{' '}
          <Link to="/privacy" className="text-white/55 underline underline-offset-2">개인정보 처리방침</Link>이 적용됩니다.
        </p>

        {/* CTA 버튼 */}
        <div className="flex flex-col gap-3">
          <Link
            to="/signup"
            className="block rounded-xl bg-cyan-500 px-4 py-3 text-center text-[14px] font-bold text-white shadow-lg shadow-cyan-500/20 active:opacity-80"
          >
            무료로 시작하기
          </Link>
          <Link
            to="/login"
            className="block rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-center text-[13px] font-semibold text-white/70 active:opacity-80"
          >
            이미 계정이 있어요
          </Link>
        </div>

      </div>
    </div>
  );
}
