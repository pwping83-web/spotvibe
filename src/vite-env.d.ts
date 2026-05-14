/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** localhost/127 접속 시에만 OAuth 복귀 URL로 사용 (예: http://localhost:5199/) — LAN IP로 접속 시에는 현재 origin 사용 */
  readonly VITE_AUTH_REDIRECT_URL?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
  /** Public Key와 동일 값으로 쓰는 경우 inquiryEmailjs에서 대체로 읽음 */
  readonly VITE_EMAILJS_USER_ID?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_BUSINESS_TRADE_NAME?: string;
  readonly VITE_BUSINESS_REPRESENTATIVE?: string;
  readonly VITE_BUSINESS_REG_NUMBER?: string;
  /** 업태·종목(등록증과 동일) */
  readonly VITE_BUSINESS_INDUSTRY?: string;
  readonly VITE_BUSINESS_ADDRESS?: string;
  readonly VITE_BUSINESS_PHONE?: string;
  readonly VITE_BUSINESS_EMAIL?: string;
  readonly VITE_BUSINESS_ECOMMERCE_REPORT_NUMBER?: string;
  /** test | real — 미설정 시 test */
  readonly VITE_SPOTVIBE_DATA_MODE?: string;
  readonly VITE_GROQ_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
