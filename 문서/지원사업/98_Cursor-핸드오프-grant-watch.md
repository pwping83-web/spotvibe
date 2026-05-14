# 다른 Cursor 채팅 맨 위에 붙일 블록 (grant-watch)

아래 **한 줄**을 새 채팅 최상단에 붙이면 된다.

> `d:\SpotVibe` — `npm run grant:watch`, SMES=`SMES_EXT_PBLANC_KEY`(token). 산출=`99_공고-모니터링-최근결과.md`·`grant-hub-last-run.json`. 고확률=`config/support-notice-recommend-heuristic.json`. 절차=`.cursor/rules/grant-watch-on-request.mdc`.

---

## 프로그램화 요약 (본 저장소 기준)

| 구분 | 위치 |
|------|------|
| 에이전트 단일 기준 | `.cursor/rules/grant-watch-on-request.mdc` (`alwaysApply: true`) |
| 정부지원 문서 답변과의 관계 | `gov-doc-kakao-inquiry-first.mdc` — 공고 **목록·실행·Tier1** 는 grant-watch 규칙 우선 |
| Tier 1 필터 + 이유 문구 | `config/support-notice-recommend-heuristic.json` (`tier1ReasonRules`) |
| 스크립트 설명 | `scripts/grant-watch/README.md` |

## 역할

IRIS(접수중) + NTIS(선택) + SMES API → 키워드 매칭 → 마감 필터 → JSON·`99` 마크다운 갱신. **`99`에 Tier 1(고확률) + 링크 + 이유** 자동 기입.

## 실행 (PowerShell)

```powershell
Set-Location d:\SpotVibe
npm run grant:watch
```

- 캐시만: `npm run grant:watch:cache`
- NTIS 생략: `$env:GRANT_WATCH_SKIP_NTIS='1'; npm run grant:watch`
- SMES 생략: `$env:GRANT_WATCH_SKIP_SMES='1'; npm run grant:watch`

## 환경

루트 `.env` — `SMES_EXT_PBLANC_KEY` = 「공고정보 연계 API」**token** (not serviceKey). 가이드 V2: `extPblancInfo` + `strDt`/`endDt`.

## SMES 400 / 14

- `serviceKey`·페이지 파라미터 사용 금지 — `fetch-smes.mjs` 참고.
- 결과코드 **14**: IP 제한 가능.

## 산출물

- `artifacts/grant-watch/grant-hub-last-run.json` — `tier1Recommendations.items[].tier1Reason`
- `문서/지원사업/99_공고-모니터링-최근결과.md`

## 한 줄 규칙 (시간 낭비 축소)

JSON `oneLineRule` 과 동일: 전국 단위 OI·PoC·창진원·대기업 연계 사업화만 1차, 입주·교육·타지역·다른 업종은 딱 맞을 때만. 지역 예외: `allowedRegionalBrackets`.

## 에이전트 답변 순서 (요약)

실행 여부 → 건수 → **Tier 1 먼저(이유 포함)** → 마감 임박 → SpotVibe 적합도 표 → 링크 → 원문 면책. 상세는 `.cursor/rules/grant-watch-on-request.mdc` §4.
