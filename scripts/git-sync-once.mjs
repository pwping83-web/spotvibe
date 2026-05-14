/** 한 번만: 변경 있으면 add → commit → push */
import { execFileSync } from 'node:child_process';
import path from 'path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function hasChanges() {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
  } catch {
    return false;
  }
}

if (!hasChanges()) {
  console.log('[git-sync-once] 변경 없음');
  process.exit(0);
}
execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'inherit' });
execFileSync(
  'git',
  ['commit', '-m', `chore: sync ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`],
  { cwd: root, stdio: 'inherit' },
);
execFileSync('git', ['push'], { cwd: root, stdio: 'inherit' });
console.log('[git-sync-once] 완료');
