/**
 * 파일 변경이 잠잠해진 뒤(기본 60초) git add → commit → push.
 * 터미널에서 `npm run git:watch` 로 실행. 백그라운드로 두면 자동 동기화에 가깝게 동작합니다.
 * 디바운스(ms): 환경 변수 GIT_AUTOSYNC_MS (기본 60000)
 */
import { watch } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const DEBOUNCE_MS = Number(process.env.GIT_AUTOSYNC_MS || 60_000);

function ignored(rel) {
  const n = rel.replace(/\\/g, '/').toLowerCase();
  return (
    n.includes('/node_modules/') ||
    n.startsWith('node_modules/') ||
    n.includes('/.git/') ||
    n.startsWith('.git/') ||
    n.includes('/dist/') ||
    n.startsWith('dist/')
  );
}

function hasChanges() {
  try {
    const o = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    return o.trim().length > 0;
  } catch {
    return false;
  }
}

function sync() {
  if (!hasChanges()) return;
  try {
    execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'inherit' });
  } catch (e) {
    console.error('[git-autowatch] add 실패:', e.message);
    return;
  }
  try {
    execFileSync(
      'git',
      ['commit', '-m', `chore: auto sync ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`],
      { cwd: root, stdio: 'inherit' },
    );
  } catch {
    // 스테이징만 있고 커밋할 내용 없음 등
    return;
  }
  try {
    execFileSync('git', ['push'], { cwd: root, stdio: 'inherit' });
  } catch (e) {
    console.error('[git-autowatch] push 실패(원격·브랜치 확인):', e.message);
  }
}

let timer;
function bump() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log('[git-autowatch] syncing…');
    sync();
  }, DEBOUNCE_MS);
}

try {
  watch(
    root,
    { recursive: true },
    (_evt, name) => {
      if (!name) return;
      const rel = path.relative(root, path.join(root, name));
      if (ignored(rel)) return;
      bump();
    },
  );
} catch (e) {
  console.error('[git-autowatch] watch 실패(OS·Node 버전):', e.message);
  process.exit(1);
}

console.log(`[git-autowatch] ${root}`);
console.log(`[git-autowatch] 변경 후 ${DEBOUNCE_MS}ms 동안 추가 변경이 없으면 commit + push 합니다. 종료: Ctrl+C`);
