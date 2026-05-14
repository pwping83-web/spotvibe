# grant-watch

IRIS · NTIS · SMES(중소벤처24) 수집 → 키워드 매칭 → 마감 필터 → 리포트.

## 실행

저장소 루트에서 `npm run grant:watch` / `npm run grant:watch:cache`.

## 산출

- `artifacts/grant-watch/grant-hub-last-run.json` — `tier1Recommendations`(고확률 목록 + `tier1Reason`)
- `문서/지원사업/99_공고-모니터링-최근결과.md` — 동일 + Tier 1 절에 **이유** 줄

## 설정

| 파일 | 역할 |
|------|------|
| `scripts/grant-watch/config.json` | IRIS·NTIS·SMES·키워드·출력 경로 |
| `config/support-notice-recommend-heuristic.json` | Tier 1 필터 + `tier1ReasonRules` |
| 루트 `.env` | `SMES_EXT_PBLANC_KEY` = API 가이드 **token** |

## 에이전트 동작

Cursor 규칙: `.cursor/rules/grant-watch-on-request.mdc` (항상 적용). 핸드오프 블록: `문서/지원사업/98_Cursor-핸드오프-grant-watch.md`.

## 모듈

- `run.mjs` — 오케스트레이션
- `fetch-iris.mjs`, `fetch-ntis.mjs`, `fetch-smes.mjs`
- `grant-utils.mjs` — 병합·마감·키워드
- `recommend-heuristic.mjs` — `pickTier1ItemsWithReasons`, `tier1ReasonForItem`
