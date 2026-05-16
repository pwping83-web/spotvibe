import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  MANUAL_MODE_LABELS,
  USER_MANUAL_SECTIONS,
  type UserManualMode,
} from '@/app/content/userManual';
import { BookOpen, ChevronLeft } from 'lucide-react';

const MODES: UserManualMode[] = ['summary', 'standard', 'detail'];

export function UserManualPage() {
  const [mode, setMode] = useState<UserManualMode>('standard');

  return (
    <div className="min-h-full overflow-y-auto bg-[#0A0A0E] px-5 py-8 text-white/85">
      <div className="mx-auto max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/50 transition-colors hover:text-[#00F0FF]"
        >
          <ChevronLeft size={18} />
          지도로 돌아가기
        </Link>

        <div className="mb-6 flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,240,255,0.10)', border: '1px solid rgba(0,240,255,0.25)' }}
          >
            <BookOpen size={22} style={{ color: '#00F0FF' }} />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-400/60">
              SpotVibe
            </p>
            <h1 className="text-xl font-bold text-white">사용 설명서</h1>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              이용자 입장에서 기능을 익히는 안내입니다. 아래에서 보기 방식을 고르세요.
            </p>
          </div>
        </div>

        <div
          className="mb-8 flex rounded-xl p-1"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          role="tablist"
          aria-label="설명서 보기 방식"
        >
          {MODES.map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMode(m)}
                className="flex-1 rounded-lg py-2.5 text-[12.5px] font-bold transition-all"
                style={
                  active
                    ? {
                        background: 'rgba(0,240,255,0.14)',
                        color: '#00F0FF',
                        boxShadow: '0 1px 8px rgba(0,240,255,0.12)',
                      }
                    : { color: 'rgba(255,255,255,0.42)' }
                }
              >
                {MANUAL_MODE_LABELS[m]}
              </button>
            );
          })}
        </div>

        {mode === 'summary' && (
          <p className="mb-5 text-[11.5px] leading-relaxed text-white/40">
            핵심만 빠르게 훑을 때 보세요. 자세한 단계는 「표준」·「상세」를 참고하세요.
          </p>
        )}
        {mode === 'standard' && (
          <p className="mb-5 text-[11.5px] leading-relaxed text-white/40">
            처음 쓰실 때 권장하는 기본 설명입니다. 화면별로 순서대로 읽어 보세요.
          </p>
        )}
        {mode === 'detail' && (
          <p className="mb-5 text-[11.5px] leading-relaxed text-white/40">
            버튼 위치·제한·예외까지 구체적으로 정리했습니다.
          </p>
        )}

        <div className="flex flex-col gap-5 pb-10">
          {USER_MANUAL_SECTIONS.map((section) => {
            const lines =
              mode === 'summary'
                ? section.summary
                : mode === 'standard'
                  ? section.standard
                  : section.detail;
            return (
              <section
                key={section.id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4"
              >
                <h2 className="mb-3 text-[14px] font-semibold text-white">{section.title}</h2>
                <ul className="space-y-2.5">
                  {lines.map((line, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-[12.5px] leading-relaxed text-white/65"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: '#00F0FF', opacity: 0.7 }}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/[0.08] pt-6">
          <Link
            to="/service"
            className="inline-block rounded-xl border border-white/15 px-4 py-2.5 text-[13px] font-semibold text-cyan-300/90"
          >
            서비스 소개
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
