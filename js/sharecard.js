/* ============================================================
 * MYTHOS · 结果分享卡生成器（Canvas，1080×1440，3:4 适配小红书）
 * 无运行时依赖（二维码用本地 vendor 的 MIT 库）。
 *
 * API:
 *   MYTHOS_CARD.draw(quiz, persona, match)        → canvas（同步，符印版）
 *   MYTHOS_CARD.drawAsync(quiz, persona, match)   → Promise<dataURL>
 *       persona.art 存在时优先绘制主视觉图（2.5s 加载超时回退符印）
 *   MYTHOS_CARD.drawDaily(rune, dateLabel, streak) → Promise<dataURL>
 *
 * 二维码：window.MYTHOS_QR_URL（未设置时自动用当前部署地址）
 * ============================================================ */
(function () {
  'use strict';

  var W = 1080, H = 1440;
  var SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif';

  var THEMES = {
    olympus:   { bg1: '#1b2a5e', bg2: '#0b1128', glow: 'rgba(120,150,255,0.20)', gold: '#e9c877', goldDim: 'rgba(233,200,119,0.45)', ink: '#f4ead2' },
    runes:     { bg1: '#152033', bg2: '#070b14', glow: 'rgba(150,200,255,0.16)', gold: '#cfe0ef', goldDim: 'rgba(207,224,239,0.40)', ink: '#eef4fa' },
    paintings: { bg1: '#3a1420', bg2: '#17060c', glow: 'rgba(255,170,120,0.14)', gold: '#ecc078', goldDim: 'rgba(236,192,120,0.45)', ink: '#f7ecdc' }
  };

  var HANDLE = (typeof window !== 'undefined' && window.MYTHOS_HANDLE) || '@你的小红书账号';

  function qrText() {
    if (typeof window !== 'undefined' && window.MYTHOS_QR_URL) return window.MYTHOS_QR_URL;
    if (location.protocol.indexOf('http') === 0) {
      return location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/');
    }
    return 'https://mythos-amber.vercel.app';
  }

  /** 同步把二维码矩阵画成方块（避免 Image 异步加载画空） */
  function drawQR(ctx, text, x, y, size) {
    try {
      if (typeof window.qrcode !== 'function') return false;
      var qr = window.qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      var n = qr.getModuleCount();
      var cell = size / n;
      ctx.save();
      ctx.fillStyle = '#241a05';
      for (var r = 0; r < n; r++) {
        for (var c = 0; c < n; c++) {
          if (qr.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell + 0.5, cell + 0.5);
        }
      }
      ctx.restore();
      return true;
    } catch (e) { return false; }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function centerText(ctx, text, y, font, color, alpha, letterSpacing) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (letterSpacing != null && 'letterSpacing' in ctx) ctx.letterSpacing = letterSpacing + 'px';
    ctx.fillText(text, W / 2, y);
    ctx.restore();
  }

  function divider(ctx, y, gold) {
    ctx.save();
    ctx.strokeStyle = gold; ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2 - 150, y); ctx.lineTo(W / 2 - 18, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 18, y); ctx.lineTo(W / 2 + 150, y); ctx.stroke();
    ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }

  function drawBackdrop(ctx, t) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, t.bg1); bg.addColorStop(1, t.bg2);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(W / 2, 440, 60, W / 2, 440, 560);
    glow.addColorStop(0, t.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = t.goldDim; ctx.lineWidth = 3;
    ctx.strokeRect(34, 34, W - 68, H - 68);
    ctx.strokeStyle = t.gold; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.5;
    ctx.strokeRect(52, 52, W - 104, H - 104);
    ctx.globalAlpha = 1;
    [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(function (c) {
      ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = t.gold; ctx.fillRect(-7, -7, 14, 14); ctx.restore();
    });
  }

  function drawSigil(ctx, pathStr, cx, cy, size, color, glowColor) {
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 100, size / 100);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4 * (100 / size);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = glowColor; ctx.shadowBlur = 18;
    ctx.stroke(new Path2D(pathStr));
    ctx.restore();
  }

  function drawArt(ctx, img, cx, cy, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    var scale = Math.max(size / img.width, size / img.height);
    var w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      if (ctx.measureText(line + text[i]).width > maxWidth) { lines.push(line); line = text[i]; }
      else line += text[i];
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * 底部页脚：左侧二维码 + 右侧账号名/引导
   * dividerY: 分隔线位置；QR 盒 150×150，整体位于内框（1388）之上
   */
  function drawFooter(ctx, t, dividerY) {
    divider(ctx, dividerY, t.gold);
    var box = 150, cx = 225, cy = dividerY + 55 + box / 2;
    cy = Math.min(cy, 1388 - box / 2 - 4);

    ctx.save();
    ctx.fillStyle = 'rgba(252, 248, 238, 0.96)';
    roundRect(ctx, cx - box / 2, cy - box / 2, box, box, 14);
    ctx.fill();
    ctx.strokeStyle = t.goldDim; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();

    var url = qrText();
    if (url) drawQR(ctx, url, cx - box / 2 + 10, cy - box / 2 + 10, box - 20);

    var tx = 360;
    ctx.save();
    ctx.font = '700 36px ' + SERIF;
    ctx.fillStyle = t.gold;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.95;
    ctx.fillText(HANDLE, tx, cy - 30);
    ctx.font = '400 24px ' + SERIF;
    ctx.globalAlpha = 0.66;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillStyle = t.ink;
    ctx.fillText('扫码直接开测 · 或长按识别', tx, cy + 14);
    ctx.fillText('每天一枚今日符文 · 全网同款', tx, cy + 48);
    ctx.restore();
  }

  /** 同步绘制（符印版） */
  function draw(quiz, persona, match) {
    var t = THEMES[quiz.theme] || THEMES.olympus;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    drawBackdrop(ctx, t);
    centerText(ctx, 'MYTHOS · 神话人格研究所', 118, '500 30px ' + SERIF, t.gold, 0.9, 6);
    divider(ctx, 164, t.gold);
    centerText(ctx, quiz.title, 210, '500 40px ' + SERIF, t.ink, 0.92, 2);

    var ringY = 440;
    ctx.save();
    ctx.strokeStyle = t.goldDim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, ringY, 185, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 8]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, ringY, 205, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    if (draw._artImg) {
      drawArt(ctx, draw._artImg, W / 2, ringY, 330);
    } else {
      drawSigil(ctx, persona.sigil, W / 2, ringY, 220, t.gold, t.goldDim);
    }

    centerText(ctx, '—— 你的神话人格 ——', 705, '400 28px ' + SERIF, t.ink, 0.55, 4);

    var nameGrad = ctx.createLinearGradient(W / 2 - 240, 0, W / 2 + 240, 0);
    nameGrad.addColorStop(0, '#f7e6ae'); nameGrad.addColorStop(0.5, t.gold); nameGrad.addColorStop(1, '#c99b3f');
    centerText(ctx, persona.name, 778, '700 92px ' + SERIF, nameGrad, 1, 4);
    centerText(ctx, persona.en, 842, '400 26px ' + SERIF, t.ink, 0.5, 6);
    centerText(ctx, '「' + persona.epithet + '」', 896, '500 42px ' + SERIF, t.ink, 0.9, 3);

    divider(ctx, 950, t.gold);
    centerText(ctx, '神格契合度 ' + match + '%', 1004, '700 46px ' + SERIF, t.gold, 1, 2);
    centerText(ctx, '全网约 ' + persona.rarity + ' 的人与你共享此人格', 1058, '400 30px ' + SERIF, t.ink, 0.62, 2);

    ctx.font = '400 30px ' + SERIF;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    var widths = persona.tags.map(function (tg) { return ctx.measureText(tg).width + 44; });
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + (persona.tags.length - 1) * 18;
    var x = W / 2 - total / 2;
    persona.tags.forEach(function (tg, i) {
      roundRect(ctx, x, 1108, widths[i], 54, 27);
      ctx.strokeStyle = t.goldDim; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.font = '400 30px ' + SERIF; ctx.fillStyle = t.ink; ctx.globalAlpha = 0.85;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tg, x + widths[i] / 2, 1108 + 28);
      ctx.restore();
      x += widths[i] + 18;
    });

    centerText(ctx, '「 ' + persona.quote + ' 」', 1224, '400 32px ' + SERIF, t.ink, 0.8, 2);

    drawFooter(ctx, t, 1272);
    return canvas;
  }

  /** 预加载 persona.art 后异步绘制；无 art / 加载失败回退符印 */
  function drawAsync(quiz, persona, match) {
    if (!persona.art) {
      return Promise.resolve(draw(quiz, persona, match).toDataURL('image/png'));
    }
    return new Promise(function (resolve) {
      var img = new Image();
      var settled = false;
      var timer = setTimeout(function () { if (!settled) { settled = true; resolve(fallback()); } }, 2500);
      img.onload = function () {
        if (settled) return;
        settled = true; clearTimeout(timer);
        draw._artImg = img;
        var url = draw(quiz, persona, match).toDataURL('image/png');
        draw._artImg = null;
        resolve(url);
      };
      img.onerror = function () {
        if (settled) return;
        settled = true; clearTimeout(timer);
        resolve(fallback());
      };
      function fallback() { return draw(quiz, persona, match).toDataURL('image/png'); }
      img.src = persona.art;
    });
  }

  /** 今日符文专用卡 */
  function drawDaily(rune, dateLabel, streak) {
    var t = THEMES.runes;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    drawBackdrop(ctx, t);
    centerText(ctx, 'MYTHOS · 神话人格研究所', 118, '500 30px ' + SERIF, t.gold, 0.9, 6);
    divider(ctx, 164, t.gold);
    centerText(ctx, '今日符文 · ' + dateLabel, 210, '500 44px ' + SERIF, t.ink, 0.92, 3);

    var ringY = 420;
    ctx.save();
    ctx.strokeStyle = t.goldDim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, ringY, 175, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 8]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, ringY, 195, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    drawSigil(ctx, rune.sigil, W / 2, ringY, 200, t.gold, t.goldDim);

    centerText(ctx, '—— 今日全人类共同抽中 ——', 660, '400 28px ' + SERIF, t.ink, 0.55, 4);
    var nameGrad = ctx.createLinearGradient(W / 2 - 240, 0, W / 2 + 240, 0);
    nameGrad.addColorStop(0, '#f7e6ae'); nameGrad.addColorStop(0.5, t.gold); nameGrad.addColorStop(1, '#c99b3f');
    centerText(ctx, rune.name + ' ' + rune.en, 736, '700 82px ' + SERIF, nameGrad, 1, 3);
    centerText(ctx, '「' + rune.epithet + '」', 802, '500 42px ' + SERIF, t.ink, 0.9, 3);

    divider(ctx, 856, t.gold);
    centerText(ctx, '今日神谕', 916, '500 34px ' + SERIF, t.gold, 0.95, 6);
    ctx.font = '400 34px ' + SERIF;
    var lines = wrapText(ctx, rune.advice || rune.quote, 800);
    lines.slice(0, 2).forEach(function (ln, i) {
      centerText(ctx, ln, 982 + i * 54, '400 34px ' + SERIF, t.ink, 0.88, 1);
    });

    if (streak > 1) centerText(ctx, '已连签 ' + streak + ' 天 · 命运正在累积', 1104, '400 28px ' + SERIF, t.gold, 0.8, 2);
    centerText(ctx, '「 ' + rune.quote + ' 」', 1178, '400 30px ' + SERIF, t.ink, 0.6, 2);

    drawFooter(ctx, t, 1236);
    return Promise.resolve(canvas.toDataURL('image/png'));
  }

  window.MYTHOS_CARD = { draw: draw, drawAsync: drawAsync, drawDaily: drawDaily };
})();
