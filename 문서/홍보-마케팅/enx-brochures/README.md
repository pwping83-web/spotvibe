# ENX 1장 제안 브로슈어 (A4 HTML)

예시 레이아웃 기준으로 **소방청·환경부·시각장애인** 제출·메일용 HTML입니다.

## 파일

| 파일 | 대상 | 제품 |
|------|------|------|
| `01-소방청-지금여기-안전망.html` | 소방청·지자체 재난안전 | 지금여기(SpotVibe) SOS·소화기 |
| `02-환경부-SeaRestore-해양관제.html` | 환경부·해양수산부 | SeaRestore 해양 종자 살포 관제 |
| `03-시각장애인-지금여기-이웃도움.html` | 시각장애인 단체·복지·지자체 | 지금여기 이웃 도움·음성 |

## 사용법

1. 브라우저에서 해당 HTML을 연다 (같은 폴더의 `assets/` 경로 유지).
2. 상단 **인쇄 / PDF 저장** → A4, 여백 **없음**, **배경 그래픽** 체크.
3. 메일 첨부 시 HTML+`assets` 폴더를 zip으로 묶거나, PDF로 변환해 보낸다.

## assets (선택)

| 파일 | 설명 |
|------|------|
| `assets/brochure-qr-spotvibe.png` | 지금여기 시연 QR (포함됨) |
| `assets/brochure-dashboard-searestore.png` | 환경부용 관제 화면 캡처 |
| `assets/brochure-dashboard-spotvibe-sos.png` | 소방청용 SOS·소화기 화면 |
| `assets/brochure-dashboard-spotvibe-vi.png` | 시각장애인용 마커·메시지 화면 |
| `assets/enx-logo.png` | 푸터 로고 (없으면 ENX 텍스트 박스) |

캡처 이미지를 넣으려면 HTML의 `visual-placeholder` 블록을 예시처럼 `<img src="assets/..." alt="..." />` 로 바꾸면 된다.
