# 행안부 긴급재난문자 오픈API — 승인·키 정리

> 잊지 않기용 메모. (재난안전데이터공유플랫폼)

## 현재 단계

- **마이페이지 → 데이터 이용 내역**에서 **「행정안전부_긴급재난문자」** 신청 상태 확인
- 승인 전: **승인대기** → 기다림 (반려 시 안내에 따라 수정·재신청)

## 승인된 다음에 할 일

1. 신청 상세에서 **`serviceKey`(서비스키)** 복사
2. Supabase Dashboard → **Edge Functions → Secrets**  
   - `SAFETY_DATA_API_KEY` = 위 서비스키
3. `sync-public-notices` Edge Function **재배포** 후, 관리자 **데이터 수집** 탭에서 수동 실행 테스트

## API (코드 기준)

- 엔드포인트: `https://www.safetydata.go.kr/V2/api/DSSP-IF-00247`
- 구현: `supabase/functions/sync-public-notices/index.ts`

## 문의

- 재난안전데이터공유플랫폼: **044-205-8461, 8462** / **safetydata@korea.kr**
