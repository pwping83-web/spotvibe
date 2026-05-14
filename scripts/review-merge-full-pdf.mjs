/**
 * 웹 캡처(review-input-web) + 앱 동선(review-input) → output/kakao-review-full-bundle.pdf
 * `npm run review:merge-full`
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output', 'kakao-review-full-bundle.pdf');

execSync('node scripts/review-images-to-pdf.mjs', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, REVIEW_OUT: out },
});
