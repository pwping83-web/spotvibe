/**
 * Markdown → PDF (한글 폰트)
 *
 * 사용:
 *   npx playwright install chromium   (최초 1회)
 *   npm run docs:pdf -- "문서/지원사업/04_현장실사-인천지식재산센터-방어스크립트.md"
 *
 * 환경 변수:
 *   MD_PDF_OUT  출력 경로 (기본: 입력 파일과 같은 이름 .pdf)
 *
 * VS Code에서 .pdf를 텍스트로 열면 %PDF-1.4·깨진 글자가 보입니다 — 정상입니다.
 * Edge·Chrome·Adobe로 열거나, 아래 스크립트로 만든 PDF를 사용하세요.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('사용: npm run docs:pdf -- "<markdown 파일 경로>"');
  process.exit(1);
}

const inputPath = path.resolve(root, inputArg);
if (!fs.existsSync(inputPath)) {
  console.error('파일 없음:', inputPath);
  process.exit(1);
}

const outPath = process.env.MD_PDF_OUT
  ? path.resolve(root, process.env.MD_PDF_OUT)
  : inputPath.replace(/\.md$/i, '.pdf');

const md = fs.readFileSync(inputPath, 'utf8');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${path.basename(inputPath)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"></script>
  <style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #111;
      max-width: 210mm;
      margin: 0 auto;
      padding: 12px 8px 24px;
    }
    h1 { font-size: 1.45rem; border-bottom: 2px solid #222; padding-bottom: 0.35em; margin-top: 0; }
    h2 { font-size: 1.15rem; margin-top: 1.4em; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
    h3 { font-size: 1rem; margin-top: 1.1em; }
    p, li { word-break: keep-all; overflow-wrap: break-word; }
    code, pre { font-family: Consolas, "D2Coding", monospace; font-size: 0.88em; }
    pre {
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 10px 12px;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    :not(pre) > code { background: #f0f0f0; padding: 0.1em 0.35em; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 0.95em; }
    th, td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eee; font-weight: 700; }
    blockquote { margin: 0.8em 0; padding: 0.4em 0.8em; border-left: 4px solid #888; background: #fafafa; color: #333; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.2em 0; }
    ul, ol { padding-left: 1.4em; }
    a { color: #0b57d0; word-break: break-all; }
    strong { font-weight: 700; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    marked.setOptions({ gfm: true, breaks: true });
    document.getElementById("root").innerHTML = marked.parse(${JSON.stringify(md)});
  </script>
</body>
</html>`;

const tmpDir = path.join(root, 'output', 'md-pdf-tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const tmpHtml = path.join(tmpDir, `${path.basename(inputPath, '.md')}.html`);
fs.writeFileSync(tmpHtml, html, 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`file:///${tmpHtml.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
  });
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log('[docs:pdf] 저장:', outPath, `(${kb} KB)`);
  console.log('[docs:pdf] Edge/Chrome으로 열어 한글이 보이는지 확인하세요.');
} finally {
  await browser.close();
}
