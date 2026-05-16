import {
  ENX_BUSINESS_REG_NUMBER,
  ENX_CONTACT_EMAIL,
  ENX_CONTACT_PHONE_DISPLAY,
  ENX_REPRESENTATIVE_NAME,
  ENX_TRADE_NAME,
} from '@/app/constants/operatorContact';

export type BusinessInfo = {
  tradeName: string;
  representative: string;
  regNumber: string;
  /** 업태·종목 등(등록증 기재와 동일) */
  industry: string;
  address: string;
  phone: string;
  ecommerceReport: string;
  email: string;
};

/** env 미설정 시 로그인·/company 등에 쓰는 기본 사업장 소재지(등록증과 다르면 `VITE_BUSINESS_ADDRESS`로 덮어쓰기) */
export const DEFAULT_BUSINESS_ADDRESS =
  '인천 중구 운북동 506-59, 대영라비앙로즈빌 제에이동 401호';

function trimEnv(key: string): string {
  const v = import.meta.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

/** Vite `VITE_*` — 빌드 시 주입. 값은 공개 고지용이며 `.env`는 커밋하지 마세요. */
export function getBusinessInfo(): BusinessInfo {
  const addressFromEnv = trimEnv('VITE_BUSINESS_ADDRESS');
  return {
    tradeName: trimEnv('VITE_BUSINESS_TRADE_NAME') || ENX_TRADE_NAME,
    representative: trimEnv('VITE_BUSINESS_REPRESENTATIVE') || ENX_REPRESENTATIVE_NAME,
    regNumber: trimEnv('VITE_BUSINESS_REG_NUMBER') || ENX_BUSINESS_REG_NUMBER,
    industry: trimEnv('VITE_BUSINESS_INDUSTRY'),
    address: addressFromEnv || DEFAULT_BUSINESS_ADDRESS,
    phone: trimEnv('VITE_BUSINESS_PHONE') || ENX_CONTACT_PHONE_DISPLAY,
    ecommerceReport: trimEnv('VITE_BUSINESS_ECOMMERCE_REPORT_NUMBER'),
    email: trimEnv('VITE_BUSINESS_EMAIL') || ENX_CONTACT_EMAIL,
  };
}

export function hasAnyBusinessInfo(info: BusinessInfo): boolean {
  return Object.values(info).some((v) => v.length > 0);
}
