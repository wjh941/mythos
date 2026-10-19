/* ============================================================
 * MYTHOS · 计分引擎
 * 模式：每题 4 个选项，每个选项为若干人格加分（主推 +2，友军 +1），
 *       同时携带一个维度标签 d，仅用于结果页的四维展示条。
 * 得分最高者即结果人格；同分时取 config 中排序靠前者（稳定可复现）。
 * 此文件同时兼容浏览器（window.MYTHOS_SCORING）与 Node 验证脚本。
 * ============================================================ */
(function (root) {
  'use strict';

  /**
   * @param {object} quiz   测试配置（questions/personas/dims）
   * @param {number[]} answers 每题所选选项的下标数组
   * @returns {{totals:Object, winner:object, margin:number, ranked:Array, dims:Object}}
   */
  function score(quiz, answers) {
    var totals = {};
    quiz.personas.forEach(function (p) { totals[p.id] = 0; });

    var dims = {};
    (quiz.dims || []).forEach(function (d) { dims[d.key] = 0; });

    answers.forEach(function (optIdx, qIdx) {
      var opt = quiz.questions[qIdx] && quiz.questions[qIdx].options[optIdx];
      if (!opt) return;
      Object.keys(opt.p || {}).forEach(function (pid) {
        if (pid in totals) totals[pid] += opt.p[pid];
      });
      if (opt.d && opt.d in dims) dims[opt.d] += 2;
    });

    var ranked = quiz.personas
      .map(function (p) { return { persona: p, score: totals[p.id] }; })
      .sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        // 平局：保持配置顺序（map 保序 + 稳定排序）
        return 0;
      });

    var winner = ranked[0];
    var margin = ranked.length > 1 ? winner.score - ranked[1].score : winner.score;

    // 契合度：由领先分差映射到 80–99，平局约 80，碾压约 99
    var match = Math.round(Math.min(99, Math.max(80, 80 + margin * 6)));

    return { totals: totals, winner: winner, margin: margin, ranked: ranked, dims: dims, match: match };
  }

  root.MYTHOS_SCORING = { score: score };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MYTHOS_SCORING;
})(typeof window !== 'undefined' ? window : globalThis);
