/* ============================================================
 * MYTHOS · 页面引擎
 * 视图：home / quiz(intro+questions) / result
 * 事件模型：document 级事件委托（单一 click 监听器 + data-action）。
 * 所有按钮——静态或动态生成——都通过 data-action 分发，
 * 不存在"元素替换后监听器丢失"的失效模式。
 * 依赖：scoring.js（MYTHOS_SCORING）、sharecard.js（MYTHOS_CARD）、
 *       quiz-*.js（MYTHOS_QUIZZES）
 * ============================================================ */
(function () {
  'use strict';

  var ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ'];
  var STORE_KEY = 'mythos_unlocked_v1';

  var state = { quiz: null, qIndex: 0, answers: [], result: null };

  function $(sel) { return document.querySelector(sel); }
  function store() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function unlock(quizId, personaId) {
    var data = store();
    (data[quizId] = data[quizId] || {})[personaId] = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function isUnlocked(quizId, personaId) {
    return !!(store()[quizId] || {})[personaId];
  }

  /* ---------------- 每日符文 ---------------- */
  var DAILY_KEY = 'mythos_daily_v1';

  function todayStr(offsetDays) {
    var d = new Date(Date.now() + (offsetDays || 0) * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function dailyInfo() {
    var runes = window.MYTHOS_QUIZZES.find(function (q) { return q.id === 'runes'; });
    var today = todayStr();
    var h = 5381;
    for (var i = 0; i < today.length; i++) h = ((h << 5) + h + today.charCodeAt(i)) >>> 0;
    var rune = runes.personas[h % runes.personas.length];
    var d = new Date();
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    var label = (d.getMonth() + 1) + '月' + d.getDate() + '日 · 周' + week;

    var streak = 1;
    try {
      var rec = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
      if (rec.last === today) streak = rec.streak || 1;
      else if (rec.last === todayStr(-1)) streak = (rec.streak || 0) + 1;
      localStorage.setItem(DAILY_KEY, JSON.stringify({ last: today, streak: streak }));
    } catch (e) {}
    return { rune: rune, label: label, streak: streak };
  }

  function sigilSVG(persona, cls) {
    return '<svg class="' + (cls || 'sigil') + '" viewBox="0 0 100 100" fill="none" aria-hidden="true">' +
      '<path d="' + persona.sigil + '" pathLength="1" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function juice() { return window.MYTHOS_JUICE || null; }
  function track(name, detail) {
    if (window.MYTHOS_TRACK) window.MYTHOS_TRACK.event(name, detail);
  }

  function show(view) {
    ['home', 'quiz', 'result', 'daily'].forEach(function (v) {
      $('#view-' + v).classList.toggle('active', v === view);
    });
    window.scrollTo(0, 0);
  }

  /** 人格主视觉：有 art 用图，无图回退符印 */
  function personaVisual(p, cls) {
    if (p.art) return '<img class="persona-art" src="' + p.art + '" alt="' + p.name + '">';
    return sigilSVG(p, cls);
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    $('#quiz-list').innerHTML = window.MYTHOS_QUIZZES.map(function (quiz, i) {
      return '<article class="quiz-card theme-' + quiz.theme + '" style="--i:' + i + '">' +
        '<div class="qc-watermark">' + sigilSVG(quiz.personas[0], '') + '</div>' +
        '<div class="qc-badge">' + quiz.badge + '</div>' +
        '<h2 class="qc-title">' + quiz.title + '</h2>' +
        '<p class="qc-tagline">' + quiz.tagline + '</p>' +
        '<div class="qc-meta"><span>' + quiz.meta + '</span></div>' +
        '<button class="btn btn-gold" data-action="open-quiz" data-quiz="' + quiz.id + '">开始测试</button>' +
        '</article>';
    }).join('');

    var info = dailyInfo();
    $('#daily-slot').innerHTML =
      '<article class="quiz-card daily-card theme-runes">' +
      '<div class="qc-watermark">' + sigilSVG(info.rune, '') + '</div>' +
      '<div class="qc-badge">每日限定 · 全网同款</div>' +
      '<h2 class="qc-title">今日符文 · ' + info.label + '</h2>' +
      '<p class="qc-tagline">今天全人类抽到的是同一枚</p>' +
      '<div class="qc-meta"><span>' + (info.streak > 1 ? '已连签 ' + info.streak + ' 天 · 别断了' : '今天还没抽 · 免费一签') + '</span></div>' +
      '<button class="btn btn-gold" data-action="open-daily">查看今日符文</button>' +
      '</article>';

    show('home');
    if (juice()) juice().setTheme(window.MYTHOS_QUIZZES[0] && window.MYTHOS_QUIZZES[0].theme);
  }

  /* ---------------- 每日符文页 ---------------- */
  function renderDaily() {
    track('daily-open');
    var info = dailyInfo();
    var r = info.rune;
    $('#d-body').dataset.theme = 'runes';
    $('#d-date').textContent = info.label;
    $('#d-sigil').innerHTML = sigilSVG(r, 'sigil sigil-big');
    $('#d-name').textContent = r.name;
    $('#d-en').textContent = r.en;
    $('#d-epithet').textContent = '「' + r.epithet + '」';
    $('#d-advice').textContent = r.advice || r.quote;
    $('#d-streak').textContent = info.streak > 1 ? '已连签 ' + info.streak + ' 天 · 命运正在累积' : '今日已签 · 明天再来';

    var runes = window.MYTHOS_QUIZZES.find(function (q) { return q.id === 'runes'; });
    $('#d-next').innerHTML = '<button class="next-quiz" data-action="open-quiz" data-quiz="' + runes.id + '"><b>' + runes.title + '</b><span>' + runes.tagline + ' →</span></button>';
    show('daily');

    var card = document.querySelector('.daily-panel');
    card.classList.remove('reveal');
    void card.offsetWidth;
    card.classList.add('reveal');
    if (juice()) juice().reveal(parseInt(r.rarity, 10) <= 2);
  }

  function openDailyShare() {
    track('daily-share');
    var info = dailyInfo();
    openModal('<h3>正在绘制今日符文卡…</h3><p class="modal-tip">请稍候</p>');
    window.MYTHOS_CARD.drawDaily(info.rune, info.label, info.streak).then(function (url) {
      setModal(
        '<h3>保存今日符文卡</h3>' +
        '<p class="modal-tip">手机长按图片保存 / 电脑右键另存为</p>' +
        '<img class="share-img" src="' + url + '" alt="今日符文卡">' +
        '<div class="modal-actions">' +
        '<a class="btn btn-gold" download="mythos-daily.png" href="' + url + '">下载图片</a>' +
        '<button class="btn btn-ghost" data-action="copy-daily-text">复制分享文案</button>' +
        '</div>'
      );
    });
  }

  function copyDailyText() {
    track('daily-copy');
    var info = dailyInfo();
    var r = info.rune;
    var text = '今日符文是【' + r.name + '】· ' + r.epithet + '❄️ ' + (r.advice || r.quote) + ' 你的今日符文是什么？每天一抽，全网同款！';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        var b = $('[data-action="copy-daily-text"]');
        if (b) { b.textContent = '已复制 ✓'; setTimeout(function () { b.textContent = '复制分享文案'; }, 1600); }
      });
    }
  }

  /* ---------------- 测试页 ---------------- */
  function startIntro(quiz) {
    state.quiz = quiz;
    state.qIndex = 0;
    state.answers = [];
    state.result = null;
    $('#quiz-body').dataset.theme = quiz.theme;
    $('#qi-title').textContent = quiz.title;
    $('#qi-intro').textContent = quiz.intro;
    $('#qi-meta').textContent = quiz.meta;
    $('#qi-gallery-count').textContent = quiz.personas.length + ' 位人格图鉴';
    show('quiz');
    if (juice()) juice().setTheme(quiz.theme);
    $('#intro').classList.remove('hidden');
    $('#question').classList.add('hidden');
  }

  function renderQuestion(dir) {
    var quiz = state.quiz;
    var n = state.qIndex;
    $('#intro').classList.add('hidden');
    $('#question').classList.remove('hidden');

    $('#q-theme').textContent = quiz.short;
    $('#q-num').textContent = '第 ' + ROMAN[n + 1] + ' 问';
    $('#q-text').textContent = quiz.questions[n].q;
    $('#q-progress').style.width = (n / quiz.questions.length * 100) + '%';

    $('#q-options').innerHTML = quiz.questions[n].options.map(function (opt, i) {
      return '<button class="option" data-action="choose" data-idx="' + i + '">' +
        '<span class="opt-key">' + 'ABCD'[i] + '</span><span class="opt-text">' + opt.t + '</span></button>';
    }).join('');
    $('#q-prev').style.visibility = n > 0 ? 'visible' : 'hidden';

    var body = $('#question .q-body');
    body.classList.remove('q-fwd', 'q-back');
    void body.offsetWidth;
    body.classList.add(dir === 'back' ? 'q-back' : 'q-fwd');
    if (juice()) { dir === 'back' ? juice().back() : juice().advance(); }
  }

  function choose(i) {
    var box = $('#q-options');
    if (box.classList.contains('locking')) return;
    box.classList.add('locking');
    if (juice()) juice().select();
    var btns = box.querySelectorAll('.option');
    btns.forEach(function (b, bi) {
      b.classList.toggle('selected', bi === i);
      if (bi !== i) b.classList.add('dimmed');
    });
    state.answers[state.qIndex] = i;
    setTimeout(function () {
      box.classList.remove('locking');
      if (state.qIndex < state.quiz.questions.length - 1) {
        state.qIndex++;
        renderQuestion('fwd');
      } else {
        finish();
      }
    }, 380);
  }

  function goPrev() {
    if (state.qIndex > 0) { state.qIndex--; renderQuestion('back'); }
  }

  function finish() {
    track('quiz-complete', state.quiz.id);
    var res = window.MYTHOS_SCORING.score(state.quiz, state.answers);
    state.result = res;
    unlock(state.quiz.id, res.winner.persona.id);
    runSuspense(renderResult);
  }

  /* ---------------- 结果页 ---------------- */
  function renderResult() {
    var quiz = state.quiz, res = state.result, p = res.winner.persona;
    $('#result-body').dataset.theme = quiz.theme;

    $('#r-sigil').innerHTML = personaVisual(p, 'sigil sigil-big');
    $('#r-name').textContent = p.name;
    $('#r-en').textContent = p.en;
    $('#r-epithet').textContent = '「' + p.epithet + '」';
    $('#r-match').textContent = '神格契合度 ' + res.match + '%';
    $('#r-rarity').textContent = '全网约 ' + p.rarity + ' 的人觉醒此人格';
    $('#r-desc').textContent = p.desc;
    $('#r-quote').textContent = '「 ' + p.quote + ' 」';
    $('#r-artist').textContent = p.artist ? '· ' + p.artist + ' ·' : '';

    $('#r-tags').innerHTML = p.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    $('#r-glint').innerHTML = p.glint.map(function (g) { return '<li>' + g + '</li>'; }).join('');

    var dims = quiz.dims.map(function (d) { return { label: d.label, v: res.dims[d.key] || 0 }; });
    var max = Math.max(2, Math.max.apply(null, dims.map(function (d) { return d.v; })));
    $('#r-dims').innerHTML = dims.map(function (d) {
      var pct = Math.max(12, Math.round(d.v / max * 100));
      return '<div class="dim"><span class="dim-label">' + d.label + '</span>' +
        '<span class="dim-bar"><i style="width:' + pct + '%"></i></span></div>';
    }).join('');

    var others = window.MYTHOS_QUIZZES.filter(function (q) { return q.id !== quiz.id; });
    $('#r-next').innerHTML = others.map(function (q) {
      return '<button class="next-quiz" data-action="open-quiz" data-quiz="' + q.id + '"><b>' + q.title + '</b><span>' + q.tagline + ' →</span></button>';
    }).join('');

    show('result');

    var card = document.querySelector('.result-card');
    card.classList.remove('reveal');
    void card.offsetWidth;
    card.classList.add('reveal');
    var rareNum = parseInt(p.rarity, 10);
    if (juice()) juice().reveal(rareNum > 0 && rareNum <= 2);
  }

  /* ---------------- 揭晓过场 ---------------- */
  var suspenseTimers = [];
  var suspenseDone = null;

  function runSuspense(done) {
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !$('#suspense')) { done(); return; }
    suspenseDone = done;
    var lines = ['✦ 星轨校准中 ✦', '✦ 命运之线交织中 ✦', '✧ 神谕显现 ✧'];
    $('#suspense-text').textContent = lines[0];
    $('#suspense').classList.add('open');
    [700, 1400, 2250].forEach(function (t, i) {
      suspenseTimers.push(setTimeout(function () {
        if (i < lines.length - 1) $('#suspense-text').textContent = lines[i + 1];
        else endSuspense();
      }, t));
    });
  }

  function endSuspense() {
    suspenseTimers.forEach(clearTimeout);
    suspenseTimers = [];
    $('#suspense').classList.remove('open');
    if (suspenseDone) { var d = suspenseDone; suspenseDone = null; d(); }
  }

  /* ---------------- 分享卡 & 文案 ---------------- */
  function openShareModal() {
    var quiz = state.quiz, p = state.result.winner.persona;
    track('share-card', quiz.id);
    openModal('<h3>正在绘制结果卡…</h3><p class="modal-tip">请稍候</p>');
    window.MYTHOS_CARD.drawAsync(quiz, p, state.result.match).then(function (url) {
      setModal(
        '<h3>保存你的结果卡</h3>' +
        '<p class="modal-tip">手机长按图片保存 / 电脑右键另存为</p>' +
        '<img class="share-img" src="' + url + '" alt="结果卡">' +
        '<div class="modal-actions">' +
        '<a class="btn btn-gold" download="mythos-' + p.id + '.png" href="' + url + '">下载图片</a>' +
        '<button class="btn btn-ghost" data-action="copy-text">复制晒图文案</button>' +
        '</div>'
      );
    });
  }

  function shareText(quiz, p) {
    return quiz.shareTemplate
      .replace('{name}', p.name)
      .replace('{epithet}', p.epithet)
      .replace('{rarity}', p.rarity);
  }

  function copyShareText() {
    track('share-copy', state.quiz.id);
    var text = shareText(state.quiz, state.result.winner.persona);
    var done = function () {
      var b = $('[data-action="copy-text"]');
      if (b) { b.textContent = '已复制 ✓'; setTimeout(function () { b.textContent = '复制晒图文案'; }, 1600); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove(); done();
    }
  }

  /* ---------------- 图鉴 ---------------- */
  function openGallery() {
    track('gallery-open');
    var quiz = state.quiz;
    var cells = quiz.personas.map(function (p) {
      var on = isUnlocked(quiz.id, p.id);
      return on
        ? '<div class="cell on">' + sigilSVG(p) + '<b>' + p.name + '</b><span>' + p.epithet + '</span></div>'
        : '<div class="cell"><span class="lock">?</span><b>？？？</b><span>尚未觉醒</span></div>';
    }).join('');
    openModal('<h3>' + quiz.short + ' · 图鉴</h3>' +
      '<p class="modal-tip">完成测试即可点亮对应人格</p>' +
      '<div class="gallery">' + cells + '</div>');
  }

  /* ---------------- 弹层 ---------------- */
  function openModal(html) {
    $('#modal-content').innerHTML = html + '<button class="modal-close" data-action="close-modal" aria-label="关闭">✕</button>';
    $('#modal').classList.add('open');
  }
  function setModal(html) { openModal(html); }
  function closeModal() { $('#modal').classList.remove('open'); }

  /* ---------------- 事件委托 ---------------- */
  var ACTIONS = {
    'open-quiz': function (el) {
      startIntro(window.MYTHOS_QUIZZES.find(function (q) { return q.id === el.dataset.quiz; }));
    },
    'start': function () {
      track('quiz-start', state.quiz && state.quiz.id);
      $('#intro').classList.add('hidden');
      state.qIndex = 0; state.answers = [];
      renderQuestion('fwd');
    },
    'choose': function (el) { choose(Number(el.dataset.idx)); },
    'prev': goPrev,
    'gallery': openGallery,
    'back-home': renderHome,
    'save-card': openShareModal,
    'retest': function () { track('retest'); startIntro(state.quiz); },
    'copy-text': copyShareText,
    'close-modal': closeModal,
    'open-daily': renderDaily,
    'share-daily': openDailyShare,
    'copy-daily-text': copyDailyText,
    'skip-suspense': endSuspense,
    'toggle-sound': function () {
      if (!juice()) return;
      var on = juice().toggleSound();
      var b = $('#btn-sound');
      if (b) b.classList.toggle('off', !on);
    }
  };

  function initEvents() {
    document.addEventListener('click', function (e) {
      // 点击遮罩空白处关闭弹层
      if (e.target && e.target.id === 'modal') { closeModal(); return; }
      var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!el) return;
      var fn = ACTIONS[el.dataset.action];
      if (fn) fn(el);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    if (window.__MYTHOS_INITED) return;
    window.__MYTHOS_INITED = true;
    track('visit');
    if (juice()) {
      juice().init();
      var b = $('#btn-sound');
      if (b && !juice().soundOn()) b.classList.add('off');
    }
    renderHome();
    initEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
