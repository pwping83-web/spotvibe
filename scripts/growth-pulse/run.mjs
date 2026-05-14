/**
 * SpotVibe 성장 펄스 — 주기 점검 질문·아이디어·선택적 grant:watch 실행
 *
 * 사용:
 *   npm run growth:pulse
 *   npm run growth:pulse -- --write-md
 *   npm run growth:pulse -- --run=grant-watch
 *   npm run growth:pulse -- --run=grant-watch --force
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const pulseDir = path.join(root, 'scripts', 'growth-pulse');
const artifactsDir = path.join(root, 'artifacts', 'growth-pulse');
const defaultConfigPath = path.join(pulseDir, 'config.default.json');
const userConfigPath = path.join(pulseDir, 'config.json');
const statePath = path.join(artifactsDir, 'state.json');
const logPath = path.join(artifactsDir, 'sessions.log');
const latestMdPath = path.join(artifactsDir, 'latest-prompt.md');

function parseArgs(argv) {
  const flags = { writeMd: false, runGrantWatch: false, forceGrantWatch: false, noLog: false, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write-md') flags.writeMd = true;
    else if (a === '--no-log') flags.noLog = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--force') flags.forceGrantWatch = true;
    else if (a === '--run=grant-watch' || a === '--grant-watch') flags.runGrantWatch = true;
  }
  return flags;
}

function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function daysBetween(a, b) {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function pickN(pool, n, rng = Math.random) {
  const copy = [...pool];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function pickOnePerCategory(config, categories, rng) {
  const picks = [];
  const used = new Set();
  for (const cat of categories) {
    const pool = config.questionPools?.[cat];
    if (!Array.isArray(pool) || !pool.length) continue;
    const [q] = pickN(pool, 1, rng);
    if (q && !used.has(q)) {
      used.add(q);
      picks.push({ category: cat, text: q });
    }
  }
  return picks;
}

function nowIso() {
  return new Date().toISOString();
}

function kstLine() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function loadConfig() {
  const defaults = readJson(defaultConfigPath, {});
  const user = fs.existsSync(userConfigPath) ? readJson(userConfigPath, {}) : {};
  return {
    ...defaults,
    ...user,
    questionPools: { ...defaults.questionPools, ...user.questionPools },
    ideaSeeds:
      user.ideaSeeds?.length > 0
        ? [...(defaults.ideaSeeds || []), ...user.ideaSeeds]
        : defaults.ideaSeeds || [],
    pulse: { ...defaults.pulse, ...user.pulse },
    autoExecute: { ...defaults.autoExecute, ...user.autoExecute },
  };
}

function loadState() {
  ensureDir(artifactsDir);
  const s = readJson(statePath, {});
  return {
    lastPulseAt: s.lastPulseAt || null,
    lastGrantWatchAt: s.lastGrantWatchAt || null,
    notes: typeof s.notes === 'object' && s.notes ? s.notes : {},
  };
}

function saveState(partial) {
  const prev = loadState();
  const next = { ...prev, ...partial, notes: { ...prev.notes, ...(partial.notes || {}) } };
  fs.writeFileSync(statePath, JSON.stringify(next, null, 2), 'utf8');
}

function appendLog(text) {
  fs.appendFileSync(logPath, text, 'utf8');
}

function runNpmGrantWatch() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npmCmd, ['run', 'grant:watch'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env },
  });
  return r.status ?? 1;
}

function gitShortStatus() {
  try {
    return execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '(git 없음 또는 비저장소)';
  }
}

function buildPulse(config, state) {
  const rng = Math.random;
  const cats = config.pulse?.categoriesPerPulse || ['patent', 'grant', 'product', 'growth'];
  const qCount = Math.min(config.pulse?.questionCount ?? 4, cats.length + 4);
  const perCat = pickOnePerCategory(config, cats, rng);
  const pickedTexts = new Set(perCat.map((p) => p.text));
  let questions = perCat.map((p) => `**[${p.category}]** ${p.text}`);
  if (questions.length < qCount) {
    const flat = Object.values(config.questionPools || {}).flat();
    const extra = pickN(
      flat.filter((q) => !pickedTexts.has(q)),
      qCount - questions.length,
      rng,
    );
    for (const q of extra) questions.push(`**[extra]** ${q}`);
  }
  questions = questions.slice(0, qCount);

  const ideaN = config.pulse?.ideaCount ?? 2;
  const ideas = pickN([...(config.ideaSeeds || [])], ideaN, rng);

  const lines = [];
  lines.push(`# SpotVibe 성장 펄스`);
  lines.push('');
  lines.push(`- 실행 시각(KST): **${kstLine()}**`);
  lines.push(`- 이전 펄스: ${state.lastPulseAt ? state.lastPulseAt : '없음'}`);
  lines.push('');
  lines.push(`## 오늘의 질문`);
  lines.push('');
  for (let i = 0; i < questions.length; i++) lines.push(`${i + 1}. ${questions[i]}`);
  lines.push('');
  lines.push(`## 아이템·실험 시드`);
  lines.push('');
  ideas.forEach((idea, i) => lines.push(`${i + 1}. ${idea}`));
  lines.push('');
  lines.push(`## 작업 트리 (참고)`);
  lines.push('');
  lines.push('```');
  lines.push(gitShortStatus() || '(변경 없음)');
  lines.push('```');
  lines.push('');
  lines.push(`## 자동 실행 안내`);
  lines.push(`- 공고 갱신: \`npm run growth:pulse -- --run=grant-watch\` (간격: state + config, \`--force\`로 무시)`);
  lines.push(`- Windows 작업 스케줄러: \`scripts/growth-pulse/README.md\` 참고`);

  return { markdown: lines.join('\n'), questions, ideas };
}

function main() {
  const flags = parseArgs(process.argv);
  const config = loadConfig();
  const state = loadState();

  const { markdown, questions, ideas } = buildPulse(config, state);

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          kst: kstLine(),
          lastPulseAt: state.lastPulseAt,
          questions,
          ideas,
          gitStatus: gitShortStatus(),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(markdown);
  }

  if (flags.writeMd) {
    ensureDir(artifactsDir);
    fs.writeFileSync(latestMdPath, markdown, 'utf8');
    if (!flags.json) console.error(`\n[성장 펄스] Markdown 저장: ${latestMdPath}`);
  }

  if (!flags.noLog) {
    ensureDir(artifactsDir);
    appendLog(`\n---\n${nowIso()} KST≈${kstLine()}\n${markdown}\n`);
  }

  let grantExit = null;
  if (flags.runGrantWatch) {
    const minDays = config.autoExecute?.grantWatchMinIntervalDays ?? 7;
    let should = flags.forceGrantWatch;
    if (!should && state.lastGrantWatchAt) {
      const d = daysBetween(new Date(state.lastGrantWatchAt), new Date());
      should = d >= minDays;
      if (!flags.json) console.error(`\n[성장 펄스] grant:watch 간격: ${d}일 (최소 ${minDays}일), 실행: ${should ? '예' : '아니오 — --force 로 강제'}`);
    } else if (!should && !state.lastGrantWatchAt) {
      should = true;
    }
    if (should) {
      if (!flags.json) console.error('\n[성장 펄스] npm run grant:watch 실행 중...\n');
      grantExit = runNpmGrantWatch();
      saveState({ lastGrantWatchAt: nowIso() });
    }
  }

  saveState({ lastPulseAt: nowIso() });

  if (grantExit !== null && grantExit !== 0) {
    process.exit(grantExit);
  }
}

main();
