/* ============================================================
 * MYTHOS · 结果分享卡生成器（Canvas，1080×1440，3:4 适配小红书）
 * 无依赖。用 Path2D 复用人格符印 SVG path。
 *
 * API:
 *   MYTHOS_CARD.draw(quiz, persona, match)        → canvas（同步，符印版）
 *   MYTHOS_CARD.drawAsync(quiz, persona, match)   → Promise<dataURL>
 *       persona.art 存在时优先绘制主视觉图（2.5s 加载超时回退符印）
 *   MYTHOS_CARD.drawDaily(rune, dateLabel, streak) → Promise<dataURL>
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

  // 账号名占位：上线前在 index.html 覆盖 window.MYTHOS_HANDLE
  var HANDLE = (typeof window !== 'undefined' && window.MYTHOS_HANDLE) || '@你的小红书账号';

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
    var glow = ctx.createRadialGradient(W / 2, 470, 60, W / 2, 470, 560);
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

  /** 圆形裁剪绘制主视觉图 */
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
    ctx.save();
    ctx.strokeStyle = ctx.strokeStyle || '#fff';
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

  /** 同步绘制（符印版） */
  function draw(quiz, persona, match) {
    var t = THEMES[quiz.theme] || THEMES.olympus;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');

    drawBackdrop(ctx, t);
    centerText(ctx, 'MYTHOS · 神话人格研究所', 122, '500 30px ' + SERIF, t.gold, 0.9, 6);
    divider(ctx, 168, t.gold);
    centerText(ctx, quiz.title, 214, '500 40px ' + SERIF, t.ink, 0.92, 2);

    var ringY = 470;
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

    centerText(ctx, '—— 你的神话人格 ——', 730, '400 28px ' + SERIF, t.ink, 0.55, 4);

    var nameGrad = ctx.createLinearGradient(W / 2 - 240, 0, W / 2 + 240, 0);
    nameGrad.addColorStop(0, '#f7e6ae'); nameGrad.addColorStop(0.5, t.gold); nameGrad.addColorStop(1, '#c99b3f');
    centerText(ctx, persona.name, 812, '700 96px ' + SERIF, nameGrad, 1, 4);
    centerText(ctx, persona.en, 878, '400 26px ' + SERIF, t.ink, 0.5, 6);
    centerText(ctx, '「' + persona.epithet + '」', 934, '500 42px ' + SERIF, t.ink, 0.9, 3);

    divider(ctx, 990, t.gold);
    centerText(ctx, '神格契合度 ' + match + '%', 1050, '700 46px ' + SERIF, t.gold, 1, 2);
    centerText(ctx, '全网约 ' + persona.rarity + ' 的人与你共享此人格', 1110, '400 30px ' + SERIF, t.ink, 0.62, 2);

    ctx.font = '400 30px ' + SERIF;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    var widths = persona.tags.map(function (tg) { return ctx.measureText(tg).width + 44; });
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + (persona.tags.length - 1) * 18;
    var x = W / 2 - total / 2;
    persona.tags.forEach(function (tg, i) {
      roundRect(ctx, x, 1156, widths[i], 56, 28);
      ctx.strokeStyle = t.goldDim; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.font = '400 30px ' + SERIF; ctx.fillStyle = t.ink; ctx.globalAlpha = 0.85;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tg, x + widths[i] / 2, 1156 + 30);
      ctx.restore();
      x += widths[i] + 18;
    });

    centerText(ctx, '「 ' + persona.quote + ' 」', 1282, '400 34px ' + SERIF, t.ink, 0.8, 2);
    divider(ctx, 1332, t.gold);
    centerText(ctx, HANDLE, 1380, '500 32px ' + SERIF, t.gold, 0.95, 3);
    centerText(ctx, '长按保存结果卡 · 完整人格报告持续更新', 1420, '400 24px ' + SERIF, t.ink, 0.45, 2);

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
    centerText(ctx, 'MYTHOS · 神话人格研究所', 122, '500 30px ' + SERIF, t.gold, 0.9, 6);
    divider(ctx, 168, t.gold);
    centerText(ctx, '今日符文 · ' + dateLabel, 214, '500 44px ' + SERIF, t.ink, 0.92, 3);

    var ringY = 430;
    ctx.save();
    ctx.strokeStyle = t.goldDim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, ringY, 175, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([2, 8]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W / 2, ringY, 195, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    drawSigil(ctx, rune.sigil, W / 2, ringY, 200, t.gold, t.goldDim);

    centerText(ctx, '—— 今日全人类共同抽中 ——', 668, '400 28px ' + SERIF, t.ink, 0.55, 4);
    var nameGrad = ctx.createLinearGradient(W / 2 - 240, 0, W / 2 + 240, 0);
    nameGrad.addColorStop(0, '#f7e6ae'); nameGrad.addColorStop(0.5, t.gold); nameGrad.addColorStop(1, '#c99b3f');
    centerText(ctx, rune.name + ' ' + rune.en, 748, '700 84px ' + SERIF, nameGrad, 1, 3);
    centerText(ctx, '「' + rune.epithet + '」', 816, '500 42px ' + SERIF, t.ink, 0.9, 3);

    divider(ctx, 876, t.gold);
    centerText(ctx, '今日神谕', 936, '500 34px ' + SERIF, t.gold, 0.95, 6);
    ctx.font = '400 34px ' + SERIF;
    var lines = wrapText(ctx, rune.advice || rune.quote, 780);
    lines.forEach(function (ln, i) {
      centerText(ctx, ln, 1000 + i * 54, '400 34px ' + SERIF, t.ink, 0.88, 1);
    });

    var bottom = 1000 + lines.length * 54 + 40;
    if (streak > 1) {
      centerText(ctx, '已连签 ' + streak + ' 天 · 命运正在累积', bottom, '400 28px ' + SERIF, t.gold, 0.8, 2);
      bottom += 56;
    }
    centerText(ctx, '「 ' + rune.quote + ' 」', bottom + 30, '400 30px ' + SERIF, t.ink, 0.6, 2);

    divider(ctx, 1332, t.gold);
    centerText(ctx, HANDLE, 1380, '500 32px ' + SERIF, t.gold, 0.95, 3);
    centerText(ctx, '每天一枚 · 明天再来', 1420, '400 24px ' + SERIF, t.ink, 0.45, 2);

    return Promise.resolve(canvas.toDataURL('image/png'));
  }

  window.MYTHOS_CARD = { draw: draw, drawAsync: drawAsync, drawDaily: drawDaily };
})();
