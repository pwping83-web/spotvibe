import React from 'react';
import { Link } from 'react-router';

/**
 * 카카오 심사 첨부 PDF 앞장용 — 이용 동선 캡처(01~10장)와 같은 순서의 페이지별 설명.
 */
const FLOW_PAGES: { title: string; body: string }[] = [
  {
    title: '1페이지',
    body:
      '이용: 서비스 첫 화면(랜딩)에서 스팟바이브 소개·핵심 기능(실시간 지도, 이벤트, 알림)을 확인한 뒤 「카카오로 시작」으로 로그인·가입 절차로 이동합니다.',
  },
  {
    title: '2페이지',
    body:
      '이용: 회원가입 화면에서 이용약관·개인정보 처리방침 등 필수 항목에 동의하고, 카카오 연동 가입 버튼으로 다음 단계(카카오 인증)로 진행합니다.',
  },
  {
    title: '3페이지',
    body:
      '이용: 카카오 계정 로그인 화면에서 아이디·비밀번호(또는 카카오 앱 연동)로 본인 확인을 마치면 서비스 쪽으로 돌아가 로그인이 완료됩니다.',
  },
  {
    title: '4페이지',
    body:
      '이용: 로그인 직후 지도 메인에서 지역 검색·실시간 위치 추적 등을 켜고, 현재 위치(또는 선택 지역) 주변을 지도로 탐색합니다.',
  },
  {
    title: '5페이지',
    body:
      '이용: 지도 위 핫스팟·클러스터와 함께 하단 AI 인사이트 카드를 열어, 특정 장소가 왜 지금 주목되는지 안내 문구를 읽고 필요 시 동선 보기로 이어집니다.',
  },
  {
    title: '6페이지',
    body:
      '이용: 「지금 뜨는 핫스팟」 등 목록 화면에서 연령 필터를 바꾸며 인기 장소·행사를 거리·인기도와 함께 비교·선택합니다.',
  },
  {
    title: '7페이지',
    body:
      '이용: AI 인사이트 피드에서 카드를 넘기며 장소 사진·혼잡·대기 등 현장 참고 정보를 확인합니다.',
  },
  {
    title: '8페이지',
    body:
      '이용: 「오늘은 이렇게 가 보세요」 등 동선 화면에서 출발(내 위치)부터 목적지까지 경로·소요 시간을 보고, 주변 킥보드·스쿠터 안내를 참고합니다.',
  },
  {
    title: '9페이지',
    body:
      '이용: 마이 탭에서 카카오 연동 상태, 연령·성별 등 맞춤 설정과 지도 모드·알림(배터리·킥보드 편의 등)을 확인·조정합니다.',
  },
  {
    title: '10페이지',
    body:
      '이용: 지역·즐겨찾기 영역에서 주 활동 지역(경기·서울 등)과 자주 가는 장소(집·회사 등)를 저장해 이후 안내·지도 기준에 반영합니다.',
  },
];

export function ReviewFlowTocPage() {
  return (
    <div className="min-h-full overflow-y-auto bg-[#0A0A0E] px-5 py-8 text-white/85">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold">
          <Link to="/service" className="text-cyan-300/90 underline-offset-2 hover:underline">
            ← 서비스 안내
          </Link>
        </div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-400/60">SpotVibe</p>
        <h1 className="mb-2 text-xl font-bold text-white">심사 첨부용 — 이용 동선(페이지별)</h1>
        <p className="mb-6 text-[12px] leading-relaxed text-white/50">
          아래 <span className="text-white/70">1~10페이지</span> 설명은 제출하시는{' '}
          <span className="font-semibold text-white/80">이용 동선 캡처 이미지 01~10번 순서</span>와 같게 맞춰
          두었습니다. PDF 맨 앞에 본 화면을 한 장(또는 길면 두 장) 캡처해 넣은 뒤, 기존 동선 캡처를 그대로
          이어 붙이시면 됩니다. 앞에 <span className="text-white/70">/service·약관·사업자정보</span> 등 웹 화면을
          넣으신 경우에도, <span className="font-semibold text-white/80">첫 번째 「앱 이용 동선」캡처가 아래 1페이지</span>
          에 해당합니다.
        </p>

        <div className="space-y-4 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-4">
          {FLOW_PAGES.map((row) => (
            <div key={row.title} className="border-b border-white/[0.06] pb-4 last:border-0 last:pb-0">
              <p className="mb-1 text-[13px] font-bold text-cyan-200/95">{row.title}</p>
              <p className="text-[12px] leading-relaxed text-white/72">{row.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
