/* ============================================================
 * MYTHOS · 交互反馈层（音效 / 振动 / 主题粒子）
 * 全部合成，无音频素材；WebAudio 在首次手势后解锁。
 * 尊重 prefers-reduced-motion；页面隐藏时暂停粒子。
 * ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SOUND_KEY = 'mythos_sound';

  /* ---------------- 音效（WebAudio 合成） ---------------- */
  var ctx = null;

  function soundOn() {
    try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; }
  }

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  // 首次任意手势时预热音频上下文
  document.addEventListener('pointerdown', function warm() {
    ensureCtx();
    document.removeEventListener('pointerdown', warm);
  }, { once: true });

  /** 单音：type 波形，f0→f1 频率滑动，dur 时长，vol 音量，at 延迟 */
  function tone(type, f0, f1, dur, vol, at) {
    if (!soundOn()) return;
    var c = ensureCtx();
    if (!c) return;
    try {
      var t0 = c.currentTime + (at || 0);
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    } catch (e) {}
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  /* ---------------- 粒子背景 ---------------- */
  var PALETTES = {
    olympus:   { colors: ['#e9c877', '#f7e6ae', '#8fa8ff'], rise: true,  speed: 0.16 },
    runes:     { colors: ['#cfe0ef', '#9fc3e8', '#ffffff'], rise: false, speed: 0.22 },
    paintings: { colors: ['#ecc078', '#d98a4c', '#f7e6ae'], rise: true,  speed: 0.10 }
  };

  var canvas = null, pctx = null, particles = [], raf = 0, palette = PALETTES.olympus, W = 0, H = 0, dpr = 1;

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(p) {
    return {
      x: Math.random() * W,
      y: p ? Math.random() * H : (palette.rise ? H + 6 : -6),
      r: 0.6 + Math.random() * 1.7,
      vy: (palette.rise ? -1 : 1) * (0.14 + Math.random() * palette.speed),
      vx: (Math.random() - 0.5) * 0.1,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.25 + Math.random() * 0.5,
      color: palette.colors[Math.floor(Math.random() * palette.colors.length)]
    };
  }

  function tick() {
    pctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.phase += 0.008;
      p.x += p.vx + Math.sin(p.phase) * 0.18;
      p.y += p.vy;
      if (palette.rise ? p.y < -8 : p.y > H + 8) particles[i] = spawn(false);
      pctx.globalAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.phase * 2));
      pctx.fillStyle = p.color;
      pctx.beginPath();
      pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pctx.fill();
    }
    pctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }

  function startParticles() {
    if (REDUCED || !canvas || raf) return;
    resize();
    particles = [];
    for (var i = 0; i < 36; i++) particles.push(spawn(true));
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { raf = requestAnimationFrame(tick); }
    });
    window.addEventListener('resize', resize);
  }

  /* ---------------- 对外 API ---------------- */
  window.MYTHOS_JUICE = {
    init: function () {
      canvas = document.getElementById('fx');
      if (canvas) { pctx = canvas.getContext('2d'); startParticles(); }
    },
    setTheme: function (name) {
      palette = PALETTES[name] || PALETTES.olympus;
    },
    select: function () { tone('sine', 680, 920, 0.09, 0.06); vibrate(9); },
    advance: function () { tone('triangle', 300, 160, 0.12, 0.035); },
    back: function () { tone('triangle', 160, 300, 0.12, 0.035); },
    /** 揭晓琶音；rare 为真时追加高音闪光（稀有人格） */
    reveal: function (rare) {
      vibrate([15, 60, 25]);
      tone('sine', 523.25, null, 0.30, 0.07, 0);
      tone('sine', 659.25, null, 0.30, 0.07, 0.09);
      tone('sine', 783.99, null, 0.42, 0.07, 0.18);
      if (rare) tone('sine', 1046.5, null, 0.5, 0.05, 0.30);
    },
    soundOn: soundOn,
    toggleSound: function () {
      var next = soundOn() ? '0' : '1';
      try { localStorage.setItem(SOUND_KEY, next); } catch (e) {}
      if (next === '1') tone('sine', 680, 920, 0.09, 0.06);
      return next === '1';
    }
  };
})();
