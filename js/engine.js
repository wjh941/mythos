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

  /* ---------------- 影之人格（付费解锁） ---------------- */
  var SHADOW_KEY = 'mythos_shadow_unlocked';

  function shadowUnlocked() {
    try { return localStorage.getItem(SHADOW_KEY) === '1'; } catch (e) { return false; }
  }
  function setShadowUnlocked() {
    try { localStorage.setItem(SHADOW_KEY, '1'); } catch (e) {}
  }
  function demonFor(godId) {
    return (window.MYTHOS_SHADOW && window.MYTHOS_SHADOW.byGod[godId]) || null;
  }

  /* ---------------- 神谕档案：结果存档，回访直达 ---------------- */
  var ARCHIVE_KEY = 'mythos_archive_v1';

  function loadArchive() {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch (e) { return []; }
  }

  function saveToArchive(quiz, res) {
    var list = loadArchive().filter(function (e) {
      return !(e.quizId === quiz.id && e.personaId === res.winner.persona.id);
    });
    list.unshift({
      quizId: quiz.id,
      personaId: res.winner.persona.id,
      match: res.match,
      dims: res.dims,
      ts: Date.now()
    });
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list.slice(0, 12))); } catch (e) {}
  }

  function openArchiveEntry(ts) {
    var entry = null;
    loadArchive().forEach(function (e) { if (e.ts === ts) entry = e; });
    if (!entry) return;
    var quiz = window.MYTHOS_QUIZZES.find(function (q) { return q.id === entry.quizId; });
    var persona = quiz && quiz.personas.find(function (p) { return p.id === entry.personaId; });
    if (!quiz || !persona) return;
    state.quiz = quiz;
    state.result = { totals: {}, winner: { persona: persona }, match: entry.match, dims: entry.dims, ranked: [] };
    renderResult();
  }

  function renderShadowTeaser() {
    var box = $('#r-shadow');
    if (!box) return;
    var god = state.result.winner.persona;
    var d = demonFor(god.id);
    if (!d) { box.innerHTML = ''; return; }
    var on = shadowUnlocked();
    box.innerHTML =
      '<div class="panel shadow-teaser" data-theme="shadow">' +
        '<p class="st-label">—— 你的神格，还有另一个名字 ——</p>' +
        '<div class="st-sigil' + (on ? '' : ' blurred') + '">' + sigilSVG(d, 'sigil') + '</div>' +
        (on
          ? '<p class="st-quote">「' + d.name + ' · ' + d.epithet + '」已觉醒</p>' +
            '<button class="btn btn-gold st-btn" data-action="open-shadow">查看影之人格</button>'
          : '<p class="st-quote">「 ' + d.quote + ' 」</p>' +
            '<button class="btn btn-gold st-btn" data-action="open-shadow-unlock">✦ 解锁影之人格 · 完整魔格报告</button>' +
            '<p class="st-price">限时 6.6 元（原价 9.9）· 一次解锁 · 永久有效</p>'
        ) +
      '</div>';
  }

  /* 影面深度分析：基于四维得分的可视化（数据来自真实作答） */
  var SHADOW_DIM_COPY = {
    pow: '支配的暗面：你说服别人越多，越难说服自己停下来。',
    wis: '算计的暗面：赢下所有的局，输掉不设防的时刻。',
    hea: '感受的暗面：情绪浓度越高，影子越重。',
    act: '自由的暗面：跑得越快，身后跟得越紧。'
  };

  /* 个性化行为倾向：维度 × 等级 → 做事方式描述（每个用户看到的组合不同） */
  var SHADOW_BEHAVIOR = {
    pow: {
      hot: '处理事情时你倾向直接接管——分配、拍板、兜底一气呵成；你的影面也在这里进食：别人慢半拍，你的耐心就少一分。',
      mid: '你做事偏向定方向不定细节——大事你说了算，小事懒得管；影面偶尔借"负责"之名，插手你的关系。',
      cool: '你很少抢占主导，但影面在等你失控的那一次：被逼到墙角时，你可能比谁都强硬。'
    },
    wis: {
      hot: '你习惯先在脑内推演三步再落子，说你"想太多"的人多半没跟上你；影面借此提醒：赢面之外，还有感受。',
      mid: '你处理问题偏好抓关键路径，细节交给直觉；影面小声说：再算一步就万无一失——别全听它的。',
      cool: '你更信任经验和手感，而非纸面推演；影面藏在那些"你其实早有预感"的瞬间里。'
    },
    hea: {
      hot: '你做事由情绪浓度驱动——热爱的全力投入，无感的寸步难行；影面便借着这份浓度，索取更多关注。',
      mid: '你处理关系偏感受流：氛围对了什么都好说；影面在氛围崩塌时现身，放大那一点不对劲。',
      cool: '你倾向把感受调成静音再处理事情；影面藏在深夜——那些没消化的情绪，都记着账。'
    },
    act: {
      hot: '你处理事情讲究即时行动：先动起来再校准；影面随行，让你偶尔把"开始新事情"当成逃避旧事情。',
      mid: '你喜欢推进中的多线任务，讨厌原地等待；影面在你排队的时候低语：不如下一轮再说。',
      cool: '你更愿意谋定后动，但影面会积攒冲动——某次突然的"说走就走"，就是它在敲门。'
    }
  };

  function renderShadowAnalysis() {
    var box = $('#sh-analysis');
    if (!box) return;
    var god = state.result.winner.persona;
    var d = demonFor(god.id);
    if (!d || !state.result) { box.innerHTML = ''; return; }
    var dims = (state.quiz.dims || []).map(function (dm) {
      return { key: dm.key, label: dm.label, v: state.result.dims[dm.key] || 0 };
    });
    var total = dims.reduce(function (a, b) { return a + b.v; }, 0) || 1;
    var top = dims.reduce(function (a, b) { return b.v > a.v ? b : a; }, dims[0]);
    var low = dims.reduce(function (a, b) { return b.v < a.v ? b : a; }, dims[0]);
    /* 神影分化模型：影面在最强处进食（×1.2），在最弱处藏身（补足差的八成），其余游走（×0.6） */
    dims.forEach(function (dm) {
      var s;
      if (dm.key === top.key) s = Math.min(16, Math.round(dm.v * 1.2));
      else if (dm.key === low.key) s = Math.round((16 - dm.v) * 0.8);
      else s = Math.round(dm.v * 0.6);
      dm.godV = dm.v;
      dm.shadowV = Math.max(1, s);
    });
    var intensity = Math.min(92, Math.max(35, Math.round(top.shadowV / 16 * 100)));
    function lvl(v) { return v >= 11 ? '主导' : (v >= 6 ? '活跃' : '潜伏'); }
    function lvlKey(v) { return v >= 11 ? 'hot' : (v >= 6 ? 'mid' : 'cool'); }
    function lvlCls(v) { return v >= 11 ? 'hot' : (v >= 6 ? '' : 'cool'); }
    var rows = dims.map(function (dm) {
      var godPct = Math.round(dm.godV / 16 * 100);
      var shPct = Math.round(dm.shadowV / 16 * 100);
      var behavior = (SHADOW_BEHAVIOR[dm.key] && SHADOW_BEHAVIOR[dm.key][lvlKey(dm.godV)]) || '';
      return '<div class="dim-vs">' +
        '<div class="dim-vs-head"><span class="dvl">' + dm.label + '</span>' +
        '<span class="lvl ' + lvlCls(dm.godV) + '">' + lvl(dm.godV) + '</span></div>' +
        '<div class="vb-row"><span class="vb-tag gold">神</span><div class="vb"><i class="god" style="width:' + godPct + '%"></i><em class="vb-val">' + godPct + '</em></div></div>' +
        '<div class="vb-row"><span class="vb-tag demon">影</span><div class="vb"><i class="demon" style="width:' + shPct + '%"></i><em class="vb-val">' + shPct + '</em></div></div>' +
        '<p class="dim-copy">' + behavior + '</p>' +
        '<p class="dim-flavor">' + (SHADOW_DIM_COPY[dm.key] || '') + '</p>' +
        '</div>';
    }).join('');
    var iCopy = intensity >= 70
      ? '影面浓度极高——它几乎浮在表层，低谷期要格外留意。'
      : (intensity >= 50
        ? '中等偏高——它正在暗处持续进食。'
        : '潜伏型——它很安静，在等你的低谷期。');
    /* 个性化：影面的入口——引用你在主导维度的真实选择 */
    var trace = state.answers.map(function (optIdx, q) {
      var qd = state.quiz.questions[q];
      if (!qd) return null;
      var opt = qd.options[optIdx];
      if (!opt || opt.d !== top.key) return null;
      return '<div class="trace-item"><b>第 ' + ROMAN[q + 1] + ' 问 · ' + qd.q + '</b><span>你选了「' + opt.t + '」</span></div>';
    }).filter(Boolean);
    var traceHtml = '';
    if (trace.length) {
      traceHtml =
        '<h3 class="an-title">✦ 影面的入口 ✦</h3>' +
        '<div class="choice-trace">' + trace.slice(0, 2).join('') + '</div>' +
        '<p class="dim-copy" style="text-align:center">这些瞬间，都在给影面喂食。</p>';
    }
    state.shadowIntensity = intensity;
    box.innerHTML =
      '<div class="panel analysis-panel">' +
        '<p class="an-note">影面在你最长的维度里进食，在最短的维度里藏身——这是它对你的了解。</p>' +
        traceHtml +
        '<div class="dual-sigil">' +
          '<div class="ds-item">' + sigilSVG(god, 'sigil') + '<b>神格 · ' + god.name + '</b></div>' +
          '<div class="ds-link"></div>' +
          '<div class="ds-item demon">' + sigilSVG(d, 'sigil') + '<b>影面 · ' + d.name + '</b></div>' +
        '</div>' +
        '<h3 class="an-title">✦ 影面浓度 ✦</h3>' +
        '<div class="intensity">' +
          '<div class="intensity-bar"><i style="width:' + intensity + '%"></i></div><b>' + intensity + '%</b>' +
        '</div>' +
        '<p class="an-copy">' + iCopy + '</p>' +
        '<h3 class="an-title">✦ 四维神魔对照 ✦</h3>' + rows +
        '<p class="an-foot">分析基于你的 8 次选择 · 娱乐向内容</p>' +
      '</div>';
  }

  /* 翻面英雄卡：正面神格 / 背面影面 */
  function renderShadowFlip() {
    var box = $('#sh-flip');
    if (!box) return;
    var god = state.result.winner.persona;
    var d = demonFor(god.id);
    if (!d) { box.innerHTML = ''; return; }
    box.innerHTML =
      '<div class="flip-inner">' +
        '<div class="flip-face front">' + sigilSVG(god, 'sigil') +
          '<b>神格面 · ' + god.name + '</b>' +
          '<span class="flip-hint">轻触翻面 · 看见另一面</span>' +
        '</div>' +
        '<div class="flip-face back">' + sigilSVG(d, 'sigil') +
          '<b>影面 · ' + d.name + '</b>' +
          '<span class="flip-hint">再点一次 · 翻回光面</span>' +
        '</div>' +
      '</div>';
  }

  function renderShadow() {
    var god = state.result.winner.persona;
    var d = demonFor(god.id);
    if (!d || !shadowUnlocked()) { show('result'); return; }
    track('shadow-view');
    $('#shadow-body').dataset.theme = 'shadow';
    $('#sh-god').textContent = god.name;
    $('#sh-sigil').innerHTML = sigilSVG(d, 'sigil sigil-big');
    $('#sh-name').textContent = d.name;
    $('#sh-en').textContent = d.en;
    $('#sh-epithet').textContent = '「' + d.epithet + '」';
    $('#sh-tags').innerHTML = d.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    $('#sh-desc').textContent = d.desc;
    $('#sh-god-side').textContent = '神格面 · ' + god.name;
    $('#sh-god-tags').innerHTML = god.tags.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    $('#sh-demon-side').textContent = '影面 · ' + d.name;
    $('#sh-demon-tags').innerHTML = d.tags.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    $('#sh-trait').textContent = d.shadowTrait;
    $('#sh-taming').textContent = d.taming;
    $('#sh-quote').textContent = '「 ' + d.quote + ' 」';
    show('shadow');
    var card = $('#shadow-card');
    card.classList.remove('reveal');
    void card.offsetWidth;
    card.classList.add('reveal');
    if (juice()) juice().reveal(true);
    renderShadowAnalysis();
    renderShadowFlip();
  }

  function openShadowUnlock() {
    track('shadow-pay-click');
    openModal(
      '<h3>解锁影之人格</h3>' +
      '<p class="modal-tip">与「' + state.result.winner.persona.name + '」共生的另一面</p>' +
      '<div class="pay-steps">' +
        '<div class="pay-step"><b>① 复制购买链接</b><span>浏览器打开，找到「影之人格解锁码」</span></div>' +
        '<div class="pay-step"><b>② 微信 / 支付宝付款</b><span>限时 6.6 元 · 商品详情内含解锁码</span></div>' +
        '<div class="pay-step"><b>③ 回到这里输入解锁码</b><span>一次解锁 · 永久有效 · 全部测试通用</span></div>' +
      '</div>' +
      '<button class="btn btn-gold pay-copy" data-action="copy-shop-link">✦ 复制购买链接</button>' +
      '<div class="code-row">' +
        '<input id="code-input" class="code-input" placeholder="输入解锁码" autocomplete="off" spellcheck="false">' +
        '<button class="btn btn-ghost" data-action="submit-code">解锁</button>' +
      '</div>' +
      '<p class="modal-tip" id="code-msg"></p>'
    );
  }

  function submitCode() {
    var input = $('#code-input');
    if (!input) return;
    var val = (input.value || '').trim().toUpperCase();
    var valid = String(window.MYTHOS_UNLOCK_CODE || '').toUpperCase().split(',').map(function (s) { return s.trim(); });
    var msg = $('#code-msg');
    if (!val) { msg.textContent = '先输入解锁码哦'; return; }
    if (valid.indexOf(val) === -1) {
      msg.textContent = '解锁码不对——检查一下，或回上一步重新复制购买链接';
      input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
      return;
    }
    setShadowUnlocked();
    track('shadow-unlocked');
    closeModal();
    renderShadowTeaser();
    renderShadow();
  }

  function copyShopLink() {
    var url = String(window.MYTHOS_SHOP_URL || '');
    if (!url) return;
    var b = $('[data-action="copy-shop-link"]');
    var done = function () { if (b) { b.textContent = '已复制 ✓ 去浏览器打开付款'; setTimeout(function () { b.textContent = '✦ 复制购买链接'; }, 2200); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done);
    else { var ta = document.createElement('textarea'); ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
  }

  function openShadowShare() {
    track('shadow-share');
    var god = state.result.winner.persona;
    var d = demonFor(god.id);
    if (!d) return;
    openModal('<h3>正在绘制影之人格卡…</h3><p class="modal-tip">请稍候</p>');
    window.MYTHOS_CARD.drawShadow(d, god.name).then(function (url) {
      setModal(
        '<h3>保存影之人格卡</h3>' +
        '<p class="modal-tip">手机长按图片保存 / 电脑右键另存为</p>' +
        '<img class="share-img" src="' + url + '" alt="影之人格卡">' +
        '<div class="modal-actions">' +
        '<a class="btn btn-gold" download="mythos-shadow-' + d.id + '.png" href="' + url + '">下载图片</a>' +
        '</div>'
      );
    });
  }

  function show(view) {
    ['home', 'quiz', 'result', 'daily', 'shadow'].forEach(function (v) {
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
    renderArchiveShelf();
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
  function renderArchiveShelf() {
    var slot = $('#archive-slot');
    if (!slot) return;
    var arch = loadArchive();
    if (!arch.length) { slot.innerHTML = ''; return; }
    slot.innerHTML =
      '<h3 class="arch-title">✦ 我 的 神 谕 档 案 ✦</h3>' +
      '<div class="arch-grid">' +
      arch.map(function (e) {
        var quiz = window.MYTHOS_QUIZZES.find(function (q) { return q.id === e.quizId; });
        var p = quiz && quiz.personas.find(function (x) { return x.id === e.personaId; });
        if (!quiz || !p) return '';
        var dt = new Date(e.ts);
        var label = (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
        return '<button class="arch-card theme-' + quiz.theme + '" data-action="open-archive" data-ts="' + e.ts + '">' +
          '<span class="arch-sigil">' + sigilSVG(p, 'sigil') + '</span>' +
          '<b>' + p.name + '</b>' +
          '<span class="arch-meta">' + quiz.short + ' · ' + label + '</span>' +
          '</button>';
      }).join('') +
      '</div>';
  }

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

    // 进度钻石节点
    $('#q-nodes').innerHTML = quiz.questions.map(function (_, i) {
      return '<i class="' + (i < n ? 'done' : i === n ? 'cur' : '') + '"></i>';
    }).join('');

    // 每题专属符印（轮换 + 描画入场）
    var deco = quiz.personas[n % quiz.personas.length];
    var qs = $('#q-sigil');
    qs.innerHTML = sigilSVG(deco, 'sigil');
    qs.classList.remove('draw');
    void qs.offsetWidth;
    qs.classList.add('draw');

    $('#q-options').innerHTML = quiz.questions[n].options.map(function (opt, i) {
      return '<button class="option" data-action="choose" data-idx="' + i + '" style="--oi:' + i + '">' +
        '<span class="opt-key">' + 'ABCD'[i] + '</span><span class="opt-text">' + opt.t + '</span></button>';
    }).join('');
    $('#q-prev').style.visibility = n > 0 ? 'visible' : 'hidden';

    var body = $('#question .q-body');
    body.classList.remove('q-fwd', 'q-back');
    void body.offsetWidth;
    body.classList.add(dir === 'back' ? 'q-back' : 'q-fwd');
    if (juice()) { dir === 'back' ? juice().back() : juice().advance(); }
  }

  /* ---------------- 章节过场 ---------------- */
  function chapterFor(idx) {
    var list = (state.quiz && state.quiz.chapters) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].start === idx) return list[i];
    }
    return null;
  }

  var chapterTimers = [];
  var pendingChapterEnd = null;

  function showChapter(ch, done) {
    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var el = $('#chapter');
    if (reduce || !el) { done(); return; }
    pendingChapterEnd = done;
    $('#ch-label').textContent = ch.label;
    el.classList.remove('open');
    void el.offsetWidth;
    el.classList.add('open');
    if (juice()) juice().chapter();
    chapterTimers.push(setTimeout(endChapter, 1500));
  }

  function endChapter() {
    chapterTimers.forEach(clearTimeout);
    chapterTimers = [];
    var el = $('#chapter');
    if (el) el.classList.remove('open');
    if (pendingChapterEnd) { var d = pendingChapterEnd; pendingChapterEnd = null; d(); }
  }

  function enterQuestion(dir) {
    var ch = chapterFor(state.qIndex);
    if (ch) showChapter(ch, function () { renderQuestion(dir); });
    else renderQuestion(dir);
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
        enterQuestion('fwd');
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
    saveToArchive(state.quiz, res);
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

    renderShadowTeaser();
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
      enterQuestion('fwd');
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
    'open-shadow': renderShadow,
    'open-archive': function (el) { openArchiveEntry(Number(el.dataset.ts)); },
    'open-shadow-unlock': openShadowUnlock,
    'submit-code': submitCode,
    'copy-shop-link': copyShopLink,
    'share-shadow': openShadowShare,
    'back-result': function () { show('result'); },
    'flip-hero': function (el) {
      el.classList.toggle('flipped');
      if (juice()) juice().select();
    },
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
    var chEl = $('#chapter');
    if (chEl) chEl.addEventListener('click', endChapter);
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
