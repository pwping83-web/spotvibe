# Supabase — 비밀·RLS·권한 실행 가이드

SpotVibe는 **PostgreSQL RLS**와 **Supabase Auth(JWT)**에 많이 의존합니다. 여기서 틀리면 앱 기능 전체가 위험해집니다.

---

## 1. 키 종류 (반드시 구분)

| 키 | 노출 위치 | 용도 |
|----|------------|------|
| **anon (public)** | 브라우저 번들 가능 | RLS가 허용한 범위만 DB 접근 |
| **service_role** | **서버·Edge Function·CI만** | RLS 우회 — 유출 시 치명적 |

**실행 규칙**

- [ ] 프론트(Vite) 소스·`index.html`·클라이언트 번들에 `service_role` **절대 금지**.
- [ ] Edge Function 시크릿은 **Supabase Secrets** 또는 호스팅 시크릿에만 저장.

---

## 2. 키 회전 절차 (유출·퇴사자 대응)

1. Supabase Dashboard → Settings → API → **새 키 발급/회전**(제품 UI에 따름).  
2. **Edge Functions**, **GitHub Actions**, **로컬 팀원 `.env`** 순으로 교체.  
3. 배포 후 **로그인·SOS·제보·스토리지 업로드** 스모크 테스트.  
4. 구 키 무효화(제품이 구 키 폐기를 지원하는 경우).

**기능 영향**: 교체 누락 시 일부 서버 작업만 실패 — 체크리스트로 빠짐 방지.

---

## 3. RLS 점검 (기능 유지하면서 막기)

**목표**: `anon`·`authenticated`가 **의도한 테이블·연산**만 하도록.

실행:

- [ ] `supabase/migrations/`에서 **새 테이블**마다 `enable row level security` 여부 확인.
- [ ] `INSERT`/`UPDATE` 정책에 **`auth.uid()`와 행 소유자** 일치 여부 확인 (타인 행 수정 불가).
- [ ] **`SECURITY DEFINER` RPC**는 최소 권한·입력 검증·내부에서 `auth.uid()` 재검증 패턴인지 코드 리뷰.

**기능 영향**: 정책을 잘못 조이면 클라이언트에서 “permission denied” 다발 — **스테이징에서 동일 JWT로 CRUD 시나리오 테스트**.

---

## 4. Storage 버킷

- [ ] 공개 읽기가 필요한 버킷만 공개, 나머지는 인증·RLS 정책 명시.
- [ ] 업로드 파일 MIME·크기 제한은 **클라이언트 + 서버(Edge/RPC)** 이중이 안전.

---

## 5. 이미 있는 “남용 방지” DB 로직 (참고만)

- SOS **한국일 기준 1일 1회** 등: `supabase/migrations/` 내 `sos_daily_limit` 관련 파일.  
- 신고·제재: `user_moderation`, `sos_signal_abuse_reports` 등.

새 기능 추가 시 **동일 패턴**(트리거·RPC·한도)을 검토하면, 앱만 두껍게 만들지 않아도 됩니다.

---

## 6. 정기 작업 (월 1회 · 30분)

- [ ] Dashboard에서 **비활성 OAuth 클라이언트**·불필요 Redirect URI 제거.  
- [ ] **백업·PITR**(유료 플랜 시) 복구 테스트 주기 합의.
