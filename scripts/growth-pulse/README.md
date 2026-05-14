# SpotVibe 성장 펄스 (`growth:pulse`)

주기적으로 **특허·지원사업·제품·파트너** 관점의 질문과 아이디어 시드를 출력합니다. Cursor 채팅에 붙여 넣고 답을 정리하거나, `latest-prompt.md`로 열어 두고 활용하세요.

## 명령

| 명령 | 설명 |
|------|------|
| `npm run growth:pulse` | 콘솔에 질문·아이디어·git 상태 요약 출력, `artifacts/growth-pulse/sessions.log`에 누적 |
| `npm run growth:pulse -- --write-md` | 위 + `artifacts/growth-pulse/latest-prompt.md` 갱신 (에디터에서 열기 좋음) |
| `npm run growth:pulse -- --json` | JSON만 stdout (자동화용) |
| `npm run growth:pulse -- --no-log` | 세션 로그 파일에 append 안 함 |
| `npm run growth:pulse -- --run=grant-watch` | 마지막 실행(`state.json`) 기준 **최소 간격(기본 7일)**이 지났을 때만 `npm run grant:watch` 실행 |
| `npm run growth:pulse -- --run=grant-watch --force` | 간격 무시하고 `grant:watch` 실행 |

## 설정

- 기본: `scripts/growth-pulse/config.default.json`
- 사용자 오버라이드(선택): 같은 폴더에 `config.json`을 두면 `questionPools`, `ideaSeeds`, `pulse`, `autoExecute` 등을 병합합니다.

## Windows 작업 스케줄러 예시

1. 작업 스케줄러 → 기본 작업 만들기  
2. 트리거: 매주 월요일 09:00  
3. 동작: 프로그램 시작  
   - 프로그램: `powershell.exe`  
   - 인수: `-NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'D:\SpotVibe'; npm run growth:pulse -- --write-md"`  
4. (선택) 같은 방식으로 주 1회 `--run=grant-watch`만 단독 작업으로 두어도 됩니다(네트워크·API 키 필요).

## Cursor에서 “AI가 물어보게” 하기

1. 주기적으로 위 스케줄러로 `latest-prompt.md`를 갱신  
2. Cursor에서 해당 파일을 열고 **@latest-prompt.md** 를 채팅에 포함해 “이 질문에 답하고 다음 액션 3개만 제안해줘”라고 요청  

또는 채팅 시작 시 `npm run growth:pulse` 출력을 붙여 넣어도 동일합니다.

## 상태 파일

- `artifacts/growth-pulse/state.json` — `lastPulseAt`, `lastGrantWatchAt` (Git에 올리지 않음)  
- `artifacts/growth-pulse/sessions.log` — 실행 이력
