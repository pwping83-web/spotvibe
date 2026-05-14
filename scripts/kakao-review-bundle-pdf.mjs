/**
 * 카카오 비즈·스토어 심사용 — 공개 URL들을 순서대로 캡처해 PDF 1개로 합칩니다.
 *
 * 1) 최초 1회: npx playwright install chromium
 * 2) 터미널 A: npm run dev  (기본 포트 5199)
 * 3) 터미널 B: npm run review:pdf
 *
 * 환경 변수:
 *   REVIEW_BASE_URL       기본 http://localhost:5199 (배포 URL도 가능)
 *   REVIEW_OUT            기본 ./output/kakao-review-bundle.pdf
 *   REVIEW_STORAGE_STATE  Playwright storage state JSON — 있으면 `/` 메인(지도) 1장 추가
 *   REVIEW_FULL_PAGE=1    전체 페이지 스크롤 캡처(고정 UI가 세로로 반복·겹쳐 보일 수 있음)
 *   REVIEW_TALL_VIEWPORT  뷰포트 높이(px) — 기본 1200. fullPage 끈 채로 한 장에 더 많이 담기
 *   REVIEW_PNG=1          PNG 캡처+PDF(텍스트 선명, 용량 큼)
 *
 * 로그인 세션 JSON 만들기(예시):
 *   npx playwright codegen http://localhost:5199
 *   로그인 후 터미널에서 storage state 저장 API 사용하거나, 아래 문서 참고:
 *   https://playwright.dev/docs/auth#session-storage
 *
 * 제출 전 PDF를 열어 닉네임·이메일·채팅 등 개인정보가 없는지 반드시 확인하세요.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const BASE = (process.env.REVIEW_BASE_URL || 'http://localhost:5199').replace(/\/$/, '');
const OUT = process.env.REVIEW_OUT || path.join(root, 'output', 'kakao-review-bundle.pdf');
const storageStatePath = (process.env.REVIEW_STORAGE_STATE || '').trim();
const useFullPage = process.env.REVIEW_FULL_PAGE === '1' || process.env.REVIEW_FULL_PAGE === 'true';
const usePng = process.env.REVIEW_PNG === '1' || process.env.REVIEW_PNG === 'true';
const tallVp = Math.min(Math.max(Number(process.env.REVIEW_TALL_VIEWPORT || '1200') || 1200, 700), 4000);

/** 기본은 뷰포트만(고정 헤더·탭바가 fullPage 스티치에서 세로로 겹쳐 보이는 문제 방지) */
/** @type {{ path: string; fullPage?: boolean; settleMs: number }[]} */
const PUBLIC_PAGES = [
  { path: '/review-flow', settleMs: 1200 },
  { path: '/service', settleMs: 1800 },
  { path: '/signup', settleMs: 1400 },
  { path: '/login', settleMs: 1400 },
  { path: '/company', settleMs: 1400 },
  { path: '/terms', settleMs: 1400 },
  { path: '/privacy', settleMs: 1400 },
];

/** 로그인된 컨텍스트일 때만 순서대로 추가 */
const LOGGED_IN_PAGES = [{ path: '/', fullPage: false, settleMs: 5000 }];

async function capturePage(page, url, fullPage, settleMs) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, settleMs));
  if (usePng) {
    return page.screenshot({ type: 'png', fullPage });
  }
  return page.screenshot({
    type: 'jpeg',
    quality: 93,
    fullPage,
  });
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  if (useFullPage) {
    console.warn('[review:pdf] REVIEW_FULL_PAGE: 고정 UI가 길게 반복될 수 있습니다. 가능하면 끄고 REVIEW_TALL_VIEWPORT만 쓰세요.');
  } else {
    console.log('[review:pdf] 뷰포트 캡처 + 높이', tallVp, 'px (전체 스크롤 캡처는 REVIEW_FULL_PAGE=1)');
  }

  const contextOpts = {
    viewport: { width: 430, height: tallVp },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  };

  if (storageStatePath) {
    if (!fs.existsSync(storageStatePath)) {
      console.warn('[review:pdf] REVIEW_STORAGE_STATE 파일 없음 — 로그인 캡처 생략:', storageStatePath);
    } else {
      contextOpts.storageState = storageStatePath;
      console.log('[review:pdf] storage state 사용:', storageStatePath);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  /** @type {Buffer[]} */
  const imageBuffers = [];

  for (const item of PUBLIC_PAGES) {
    const url = `${BASE}${item.path}`;
    const fp = useFullPage || item.fullPage === true;
    console.log('[review:pdf] 캡처:', url, fp ? '(fullPage)' : '(viewport)');
    imageBuffers.push(await capturePage(page, url, fp, item.settleMs));
  }

  if (contextOpts.storageState) {
    // 지도는 짧은 뷰포트가 자연스러움
    await page.setViewportSize({ width: 430, height: 932 });
    for (const item of LOGGED_IN_PAGES) {
      const url = `${BASE}${item.path}`;
      console.log('[review:pdf] 캡처(로그인):', url);
      imageBuffers.push(await capturePage(page, url, item.fullPage, item.settleMs));
    }
  }

  await browser.close();

  const pdfDoc = await PDFDocument.create();
  for (const buf of imageBuffers) {
    const image = usePng ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
    const w = image.width;
    const h = image.height;
    const pdfPage = pdfDoc.addPage([w, h]);
    // PDF 좌표는 하단 기준 — 이미지 하단을 페이지 하단에 맞춤
    pdfPage.drawImage(image, { x: 0, y: 0, width: w, height: h });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(OUT, pdfBytes);
  const mb = (pdfBytes.length / (1024 * 1024)).toFixed(2);
  console.log('[review:pdf] 저장:', OUT, `(${mb} MB)`);
  if (pdfBytes.length > 20 * 1024 * 1024) {
    console.warn('[review:pdf] 20MB 초과 — 품질/페이지 수 줄이거나 한 장만 남기세요.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
