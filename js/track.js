/* ============================================================
 * MYTHOS · 漏斗统计（轻量、无 Cookie、可选后端）
 *
 * 默认零配置工作：事件镜像到 localStorage（window.MYTHOS_TRACK.counters 可查）。
 * 后端（可选其一，见 README「统计」一节）：
 *   1. Vercel Web Analytics —— 在 *.vercel.app 上自动注入官方脚本，
 *      在 Vercel 项目后台打开 Web Analytics 开关即可看数据。
 *   2. GoatCounter —— index.html 设置：
 *      window.MYTHOS_STATS = { goatcounter: 'https://你的站点.goatcounter.com' };
 * ============================================================ */
(function () {
  'use strict';

  var cfg = (typeof window !== 'undefined' && window.MYTHOS_STATS) || {};

  // Vercel 官方事件队列桩 + 按需注入脚本（仅 vercel 域名）
  window.va = window.va || function () { (window.va.q = window.va.q || []).push(arguments); };
  if (/\.vercel\.app$/.test(location.hostname)) {
    var s = document.createElement('script');
    s.defer = true;
    s.src = '/_vercel/insights/script.js';
    document.head.appendChild(s);
  }

  var counters = {};
  try { counters = JSON.parse(localStorage.getItem('mythos_stats') || '{}'); } catch (e) {}
  function save() { try { localStorage.setItem('mythos_stats', JSON.stringify(counters)); } catch (e) {} }

  /**
   * @param {string} name   事件名（短横线小写，如 quiz-complete）
   * @param {string} [detail] 细分（如 quiz id），仅用于 GoatCounter 路径
   */
  function event(name, detail) {
    counters[name] = (counters[name] || 0) + 1;
    save();
    try {
      window.va('event', { name: name });
    } catch (e) {}
    try {
      if (cfg.goatcounter && navigator.sendBeacon) {
        var path = '/' + name + (detail ? '/' + detail : '');
        navigator.sendBeacon(cfg.goatcounter + '/count?p=' + encodeURIComponent(path) +
          '&t=' + encodeURIComponent(name) + '&rand=' + Math.random());
      }
    } catch (e) {}
  }

  window.MYTHOS_TRACK = { event: event, counters: counters };
})();
