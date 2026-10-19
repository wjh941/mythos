/* ============================================================
 * MYTHOS · 计分模拟验证
 * 用法：node tools/verify.mjs
 * 检查：配置完整性 / 全人格可达性 / 均匀随机下的胜出分布
 * ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 在假 window 里加载浏览器脚本
function loadBrowserScript(relPath, sandbox) {
  const code = readFileSync(join(root, relPath), 'utf8');
  new Function('window', 'globalThis', code)(sandbox, sandbox);
}

const sandbox = { console, MYTHOS_QUIZZES: undefined };
sandbox.window = sandbox;
loadBrowserScript('js/scoring.js', sandbox);
for (const f of ['quiz-olympus.js', 'quiz-runes.js', 'quiz-paintings.js']) {
  loadBrowserScript('js/' + f, sandbox);
}
const { score } = sandbox.MYTHOS_SCORING;
const quizzes = sandbox.MYTHOS_QUIZZES;

let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

for (const quiz of quizzes) {
  console.log('\n=== ' + quiz.title + ' ===');

  // 1. 配置完整性
  const ids = new Set(quiz.personas.map(p => p.id));
  if (quiz.personas.length !== ids.size) fail('存在重复 persona id');
  for (const p of quiz.personas) {
    for (const k of ['name', 'epithet', 'rarity', 'desc', 'quote', 'sigil', 'tags', 'glint']) {
      if (!p[k]) fail(`persona ${p.id} 缺少字段 ${k}`);
    }
  }
  let optCount = 0;
  quiz.questions.forEach((q, qi) => {
    if (q.options.length !== 4) fail(`第 ${qi + 1} 题选项数 != 4`);
    q.options.forEach((o, oi) => {
      optCount++;
      for (const pid of Object.keys(o.p || {})) {
        if (!ids.has(pid)) fail(`第 ${qi + 1} 题选项 ${oi} 引用了不存在的人格 ${pid}`);
      }
      if (!quiz.dims.find(d => d.key === o.d)) fail(`第 ${qi + 1} 题选项 ${oi} 引用了不存在的维度 ${o.d}`);
    });
  });
  if (failures === 0) ok(`配置完整：${quiz.questions.length} 题 / ${optCount} 选项 / ${quiz.personas.length} 人格`);

  // 2. 随机模拟：可达性 + 分布
  const N = 100000;
  const wins = Object.fromEntries(quiz.personas.map(p => [p.id, 0]));
  for (let i = 0; i < N; i++) {
    const answers = quiz.questions.map(q => Math.floor(Math.random() * q.options.length));
    wins[score(quiz, answers).winner.persona.id]++;
  }
  const entries = Object.entries(wins).sort((a, b) => b[1] - a[1]);
  const unreachable = entries.filter(([, c]) => c === 0);
  if (unreachable.length) fail('不可达人格：' + unreachable.map(([id]) => id).join(', '));
  else ok('全部人格可达');

  const maxShare = entries[0][1] / N, minShare = entries[entries.length - 1][1] / N;
  const pct = (x) => (x * 100).toFixed(1) + '%';
  for (const [id, c] of entries) {
    console.log(`    ${pct(c / N).padStart(6)}  ${id}`);
  }
  if (maxShare > 0.30) fail(`最热人格占比过高：${pct(maxShare)}`);
  if (minShare < 0.01) fail(`最冷人格占比过低：${pct(minShare)}`);
  if (failures === 0 && maxShare <= 0.30 && minShare >= 0.01) ok(`分布合理（最高 ${pct(maxShare)} / 最低 ${pct(minShare)}）`);

  // 3. 确定性 + 平局稳定
  const a1 = quiz.questions.map(q => Math.floor(Math.random() * q.options.length));
  const r1 = score(quiz, a1), r2 = score(quiz, a1);
  if (r1.winner.persona.id !== r2.winner.persona.id) fail('同一输入结果不稳定');
  const ties = quiz.personas.length && Object.values(r1.totals);
  if (failures === 0) ok('同输入结果稳定');
}

console.log('\n' + (failures ? `✗ ${failures} 个问题待修复` : '✓ 全部通过'));
process.exit(failures ? 1 : 0);
