/**
 * 직접 찍은 스크린샷(PNG/JPEG) 여러 장 → PDF 1개로 합칩니다. (카카오 심사 첨부용)
 *
 * 권장 순서 (한 PDF에 묶을 때):
 *   A) `review-input-web/` — 사이트(주소창 보이게). 예: 00-service.png, 01-company.png,
 *      02-terms.png, 03-privacy.png (파일명 정렬 순 = 페이지 순)
 *   B) `review-input/` — 앱 이용 동선 01.png … 10.png
 *
 * 1) 위 폴더에 이미지를 넣습니다.
 * 2) npm run review:merge-images
 *    → `review-input-web`에 파일이 있으면 그 페이지들이 먼저 오고, 이어서 `review-input`이 붙습니다.
 *    → 웹 폴더가 비어 있으면 예전처럼 `review-input`만 사용합니다.
 *
 * 환경 변수:
 *   REVIEW_PREFIX_DIR  기본 ./review-input-web (없거나 비어 있으면 무시)
 *   REVIEW_INPUT_DIR   기본 ./review-input
 *   REVIEW_OUT         기본 ./output/kakao-review-from-images.pdf
 *                      웹+앱을 합칠 때는 예: ./output/kakao-review-full-bundle.pdf
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const PREFIX = path.resolve(root, (process.env.REVIEW_PREFIX_DIR ?? 'review-input-web').trim() || 'review-input-web');
const INPUT = path.resolve(root, process.env.REVIEW_INPUT_DIR || 'review-input');
const OUT = process.env.REVIEW_OUT
  ? path.resolve(process.env.REVIEW_OUT)
  : path.join(root, 'output', 'kakao-review-from-images.pdf');

const EXT = /\.(png|jpe?g)$/i;

/** 확장자와 무관 — 실제 바이트로 판별 (Cursor 등에서 .png 이름으로 JPEG 저장되는 경우 대응) */
function sniffImageKind(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  return null;
}

function listImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => EXT.test(name) && !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }))
    .map((name) => path.join(dir, name));
}

async function main() {
  const prefixFiles = fs.existsSync(PREFIX) ? listImages(PREFIX) : [];
  const mainFiles = listImages(INPUT);
  const files = [...prefixFiles, ...mainFiles];

  if (files.length === 0) {
    console.error('[review:merge-images] 이미지가 없습니다.');
    console.error('  웹:', PREFIX, '| 앱 동선:', INPUT);
    console.error('  → PNG/JPEG를 넣은 뒤 다시 실행하세요. (파일명 정렬 순 = PDF 페이지 순)');
    process.exit(1);
  }

  if (prefixFiles.length) {
    console.log('[review:merge-images] 웹(앞쪽):', PREFIX);
    prefixFiles.forEach((f, i) => console.log(`  ${i + 1}. ${path.basename(f)}`));
  }
  console.log('[review:merge-images] 본문:', INPUT);
  mainFiles.forEach((f, i) => console.log(`  ${prefixFiles.length + i + 1}. ${path.basename(f)}`));

  const pdfDoc = await PDFDocument.create();

  for (const filePath of files) {
    const buf = fs.readFileSync(filePath);
    const kind = sniffImageKind(buf);
    if (!kind) {
      throw new Error(`지원하지 않는 이미지 형식: ${path.basename(filePath)} (PNG/JPEG만)`);
    }
    const image = kind === 'png' ? await pdfDoc.embedPng(buf) : await pdfDoc.embedJpg(buf);
    const w = image.width;
    const h = image.height;
    const page = pdfDoc.addPage([w, h]);
    page.drawImage(image, { x: 0, y: 0, width: w, height: h });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(OUT, pdfBytes);
  const mb = (pdfBytes.length / (1024 * 1024)).toFixed(2);
  console.log('[review:merge-images] 저장:', OUT, `(${mb} MB, ${files.length}페이지)`);
  if (pdfBytes.length > 20 * 1024 * 1024) {
    console.warn('[review:merge-images] 20MB 초과 — 장 수 줄이거나 JPEG로 변환해 보세요.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
