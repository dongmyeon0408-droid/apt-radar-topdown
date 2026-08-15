'use strict';
var VERSION = 'v54.0';

/* ── 데이터 ───────────────────────────────────────────────── */
var DATES = KB.dates, NM = DATES.length;
var R = KB.regions.map(function (r) {
  return { code: r.c, name: r.n, sido: r.sd, kind: r.k, reg: !!r.reg, cap: !!r.cap,
    s: r.s.split(',').map(function (v) { return v === '' ? null : +v; }),
    j: r.j.split(',').map(function (v) { return v === '' ? null : +v; }) };
});
/* 2026-07-01 규제지역 신규 지정: 화성 동탄구·용인 기흥구·구리시 (조정+투기과열+토허) */
var REG_ADD = { '41597': 1, '41463': 1, '41310': 1 };
R.forEach(function (r) { if (REG_ADD[r.code]) r.reg = true; });
var BY = {}; R.forEach(function (r) { BY[r.code] = r; });
function last(a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }
function lastIdx(a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; }
var SGG = R.filter(function (r) { return r.kind === 'sgg' && last(r.s); });
var SORTED = SGG.slice().sort(function (a, b) { return last(b.s) - last(a.s); });
var RANK = {}; SORTED.forEach(function (r, i) { RANK[r.code] = i + 1; });
var NTOT = SORTED.length;
function decile(code) { return Math.min(10, Math.ceil(RANK[code] / NTOT * 10)); }

var API = (location.protocol === 'file:') ? 'https://apt-radar-topdown.vercel.app/api' : '/api';
var PY = 3.305785;
var SIDOS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종'];

/* ── 유틸 ─────────────────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function num(id) { var v = parseFloat(el(id).value); return isFinite(v) ? v : 0; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function n0(x) { return Math.round(x).toLocaleString('ko-KR'); }
function n1(x) { return (Math.round(x * 10) / 10).toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function ymL(ym) { return String(ym).slice(0, 4) + '.' + String(ym % 100).padStart(2, '0'); }
function won(x) {
  if (x == null || !isFinite(x)) return '—';
  var neg = x < 0; x = Math.abs(x);
  var s = x >= 10000 ? (Math.round(x / 100) / 100).toFixed(2).replace(/\.?0+$/, '') + '억' : n0(x) + '만';
  return (neg ? '−' : '') + s;
}
function pyPrice(sqm) { return sqm * PY; }   // ㎡당 → 평당

/* ── 밴드 ─────────────────────────────────────────────────── */
function band(series, months) {
  var li = lastIdx(series); if (li < 0) return null;
  var from = months >= 99 ? 0 : Math.max(0, li - months * 12 + 1);
  var v = [], ix = [];
  for (var i = from; i <= li; i++) if (series[i] != null) { v.push(series[i]); ix.push(i); }
  if (v.length < 12) return null;
  var cur = v[v.length - 1], mn = Infinity, mx = -Infinity, mnI = 0, mxI = 0, sum = 0, below = 0;
  for (var k = 0; k < v.length; k++) {
    sum += v[k];
    if (v[k] < mn) { mn = v[k]; mnI = ix[k]; }
    if (v[k] > mx) { mx = v[k]; mxI = ix[k]; }
    if (v[k] < cur) below++;
  }
  return { cur: cur, avg: sum / v.length, min: mn, max: mx, minAt: DATES[mnI], maxAt: DATES[mxI],
    pct: v.length > 1 ? below / (v.length - 1) : .5, n: v.length };
}
function bandWord(p) {
  if (p <= .10) return '역대 최저권'; if (p <= .30) return '하단';
  if (p < .70) return '중립'; if (p < .90) return '상단'; return '역대 최고권';
}
function gaugeHTML(p, b) {
  if (p == null) return '—';
  var pos = Math.max(0, Math.min(1, p)) * 100;
  var t = b ? ' title="표본 ' + b.n + '개월 (' + (b.n / 12).toFixed(0) + '년) · 최저 ' + n1(b.min) +
    ' ~ 최고 ' + n1(b.max) + '"' : '';
  return '<div class="gw"' + t + '><div class="gauge"><i style="left:calc(' + pos.toFixed(1) + '% - 1.5px)"></i></div><em>' + Math.round(pos) + '%</em></div>';
}
function jrS(r) { var o = new Array(NM); for (var i = 0; i < NM; i++) o[i] = (r.s[i] && r.j[i]) ? r.j[i] / r.s[i] * 100 : null; return o; }
function ratioS(a, b) { var o = new Array(NM); for (var i = 0; i < NM; i++) o[i] = (a.s[i] && b.s[i]) ? b.s[i] / a.s[i] : null; return o; }
function chg(s, m) { var li = lastIdx(s); if (li < m) return null; var a = s[li - m], b = s[li]; return (a && b) ? (b / a - 1) * 100 : null; }

/* ── 자금 ─────────────────────────────────────────────────── */
var LTV_OVERRIDE = 'auto';
/* own: 0 무주택 / 1 1주택·갈아타기(기존 처분) / 2 1주택·추가매수 / 3 2주택 이상 */
function taxOwnOf(own) { return own <= 1 ? 0 : (own === 2 ? 1 : 2); }
function CFG() {
  var own = +el('own').value;
  return { ltvReg: num('ltvReg'), ltvCap: num('ltvCap'), ltvLoc: num('ltvLoc'),
    ltvFirst: num('ltvFirst'), ltvFirstLoc: num('ltvFirstLoc'), capLoan: num('capLoan'),
    cap15: num('cap15'), cap25: num('cap25'), banOwner: el('banOwner').checked,
    dsr: num('dsr'), stress: num('stress'), etc: num('etc'), rate: num('rate'),
    income: num('income'), cash: num('cash'), area: num('area'), own: own,
    taxOwn: taxOwnOf(own), first: el('first').checked && own === 0 };
}
function acqTax(price, area, own, reg) {
  var rate, eok = price / 10000;
  var basic = eok <= 6 ? 1 : (eok <= 9 ? Math.min(3, Math.max(1, eok * 2 / 3 - 3)) : 3);
  if (own <= 0) rate = basic;
  else if (own === 1) rate = reg ? 8 : basic;
  else rate = reg ? 12 : 8;
  var heavy = rate >= 8;
  var edu = heavy ? .4 : rate * .1;
  var farm = area > 85 ? (heavy ? (rate === 8 ? .6 : 1.0) : .2) : 0;
  return price * (rate + edu + farm) / 100;
}
function broker(p) {
  if (p < 5000) return Math.min(p * .006, 25);
  if (p < 20000) return Math.min(p * .005, 80);
  if (p < 90000) return p * .004;
  if (p < 120000) return p * .005;
  if (p < 150000) return p * .006;
  return p * .007;
}
function capTier(price, c) {
  if (price > 250000) return { v: c.cap25, t: '25억↑ 한도' };
  if (price > 150000) return { v: c.cap15, t: '15억↑ 한도' };
  return { v: c.capLoan, t: '6억 한도' };
}
function loanOf(price, r, c) {
  var ltv;
  if (LTV_OVERRIDE !== 'auto') ltv = +LTV_OVERRIDE;
  else if (r.reg) ltv = c.first ? c.ltvFirst : c.ltvReg;
  else if (r.cap) ltv = c.first ? c.ltvFirst : c.ltvCap;
  else ltv = c.first ? c.ltvFirstLoc : c.ltvLoc;
  /* 규제지역: 2주택 이상·1주택 추가매수는 주담대 불가. 1주택 갈아타기는 처분조건부로 가능 */
  if (c.banOwner && r.reg && c.own >= 2) return { loan: 0, ltv: 0, bind: '다주택 불가' };
  var L = price * ltv / 100, bind = 'LTV';
  if (r.cap) { var ct = capTier(price, c); if (ct.v > 0 && L > ct.v) { L = ct.v; bind = ct.t; } }
  if (c.income > 0) {
    var mr = (c.rate + c.stress) / 1200, f = mr > 0 ? mr / (1 - Math.pow(1 + mr, -360)) : 1 / 360;
    var byD = (c.income * c.dsr / 100) / (f * 12);
    if (byD < L) { L = byD; bind = 'DSR'; }
  }
  return { loan: Math.max(0, L), ltv: ltv, bind: bind };
}
function needCash(price, r, c) {
  var L = loanOf(price, r, c), tax = acqTax(price, c.area, c.taxOwn, r.reg);
  return { need: price - L.loan + tax + broker(price) + c.etc, loan: L.loan, ltv: L.ltv, bind: L.bind };
}
function needGap(price, je, r, c) {
  var tax = acqTax(price, c.area, Math.max(1, c.taxOwn), r.reg);
  return { gap: price - je, need: price - je + tax + broker(price) + c.etc };
}
function maxBuy(cash, flags, c) {
  var fake = { reg: flags.reg, cap: flags.cap }, lo = 0, hi = 500000;
  for (var i = 0; i < 44; i++) { var m = (lo + hi) / 2; if (needCash(m, fake, c).need <= cash) lo = m; else hi = m; }
  return lo;
}
function priceOf(r, a) { var v = last(r.s); return v ? v * a : null; }
function jeonseOf(r, a) { var v = last(r.j); return v ? v * a : null; }

/* ── PNG 내보내기 ─────────────────────────────────────────── */
var CSVMODE = false;
function exportCSV(o) {
  var rows = [];
  if (o.title) rows.push([o.title]);
  if (o.sub) rows.push([o.sub]);
  if (o.stats && o.stats.length) rows.push(o.stats.map(function (s) { return s.label + ': ' + s.value; }));
  if (rows.length) rows.push([]);
  rows.push(o.headers);
  o.rows.forEach(function (r) { rows.push(r.map(function (c) { return deent(c); })); });
  if (o.note) { rows.push([]); rows.push([o.note]); }
  var d = new Date();
  rows.push(['생성 ' + d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() +
    ' · Top-Down APT Radar · 정보 제공용이며 투자 자문이 아닙니다']);
  var csv = rows.map(function (r) {
    return r.map(function (c) {
      var t = String(c == null ? '' : c).replace(/"/g, '""');
      return /[",\n]/.test(t) ? '"' + t + '"' : t;
    }).join(',');
  }).join('\r\n');
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  var u = URL.createObjectURL(blob), aEl = document.createElement('a');
  aEl.href = u;
  aEl.download = (o.file || 'apt-radar') + '_' + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.csv';
  aEl.click();
  setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
}
function exportPNG(o) {
  if (CSVMODE) { CSVMODE = false; return exportCSV(o); }
  var cv = el('expcv'), dpr = 2;
  var W = 1080, PADX = 52;
  var rowH = 62, footH = 128;
  var allRows = o.rows || [];
  var cap = o.max || 16;
  var rows = allRows.slice(0, cap);
  var two = !!o.twoCol && rows.length > 10;
  var half = two ? Math.ceil(rows.length / 2) : rows.length;
  if (two) { W = 1400; }
  var dark = document.documentElement.getAttribute('data-theme') === 'dark';
  var C = dark
    ? { bg: '#0E161F', pane: '#19242F', ink: '#EAF1F4', sub: '#8B9AA6', line: '#26333F', good: '#4FC08D',
        chip: '#1C2A36', zebra: '#141F2A', bad: '#E0876B', moon: '#7FB4CE', ember: '#E0A94E',
        frost: '#9CCBE0', onink: '#0E161F', hi: '#16242F' }
    : { bg: '#F1F2F1', pane: '#FFFFFF', ink: '#16202B', sub: '#6B7683', line: '#E3E9EC', good: '#1B6B4A',
        chip: '#EDF3F5', zebra: '#F7F9FA', bad: '#B24A32', moon: '#2F6D8E', ember: '#C8862F',
        frost: '#8FC4DA', onink: '#FFFFFF', hi: '#EAF2F6' };
  var F = "'Pretendard Variable',Pretendard,-apple-system,sans-serif";

  /* 헤더 높이 — 제목 줄 수에 맞춰 가변 */
  var probe = document.createElement('canvas').getContext('2d');
  function lines(t, maxW, size, weight) {
    probe.font = (weight || '600 ') + size + 'px ' + F;
    var out = [], cur = '';
    String(t).split(' ').forEach(function (wd) {
      var s = cur ? cur + ' ' + wd : wd;
      if (probe.measureText(s).width > maxW && cur) { out.push(cur); cur = wd; } else cur = s;
    });
    if (cur) out.push(cur);
    return out;
  }
  var titleLines = lines(o.title, W - PADX * 2 - 10, 46, '600 ');
  var subLines = lines(o.sub || '', W - PADX * 2 - 10, 19, '450 ');
  var headH = 96 + titleLines.length * 54 + (o.sub ? subLines.length * 28 + 6 : 0) + 26;
  if (o.stats && o.stats.length) headH += 104;

  var H = headH + 58 + half * rowH + footH;
  cv.width = W * dpr; cv.height = H * dpr;
  var x = cv.getContext('2d'); x.scale(dpr, dpr);
  function rr(a2, b, w2, h2, r) {
    x.beginPath(); x.moveTo(a2 + r, b); x.arcTo(a2 + w2, b, a2 + w2, b + h2, r);
    x.arcTo(a2 + w2, b + h2, a2, b + h2, r); x.arcTo(a2, b + h2, a2, b, r);
    x.arcTo(a2, b, a2 + w2, b, r); x.closePath();
  }
  function fit(t, maxW, size, weight) {
    var s = size;
    while (s > 11) { x.font = (weight || '450 ') + s + 'px ' + F; if (x.measureText(t).width <= maxW) break; s -= 1; }
    return s;
  }
  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  rr(18, 18, W - 36, H - 36, 32); x.fillStyle = C.pane; x.fill();

  /* ── 로고 ── */
  var y = 58;
  x.save();
  x.beginPath(); x.arc(PADX + 12, y, 12, 0, 7); x.arc(PADX + 17.5, y, 10.5, 0, 7, true);
  x.fillStyle = C.moon; x.fill('evenodd');
  x.beginPath(); x.arc(PADX + 29, y - 6, 3.8, 0, 7); x.fillStyle = C.ember; x.fill();
  x.restore();
  x.textAlign = 'left'; x.fillStyle = C.sub; x.font = '700 16px ' + F;
  x.fillText('TOP-DOWN APT RADAR', PADX + 48, y + 6);

  /* ── 제목 ── */
  var ty = y + 62;
  x.fillStyle = C.ink;
  titleLines.forEach(function (t) { x.font = '600 46px ' + F; x.fillText(t, PADX, ty); ty += 54; });
  if (o.sub) {
    x.fillStyle = C.sub; x.font = '450 19px ' + F;
    ty += 2;
    subLines.forEach(function (t) { x.fillText(t, PADX, ty); ty += 28; });
  }

  /* ── 상단 통계 ── */
  if (o.stats && o.stats.length) {
    var sw = (W - PADX * 2) / o.stats.length, sy = headH - 104 + 6;
    o.stats.forEach(function (st, si) {
      var sx = PADX + sw * si;
      rr(sx, sy, sw - 12, 84, 18); x.fillStyle = C.chip; x.fill();
      x.textAlign = 'left'; x.fillStyle = C.sub; x.font = '700 14px ' + F;
      x.fillText(st.label, sx + 18, sy + 28);
      x.fillStyle = st.color === 'bad' ? C.bad : (st.color === 'good' ? C.good : C.ink);
      var fs0 = fit(st.value, sw - 44, 30, '600 ');
      x.font = '600 ' + fs0 + 'px ' + F;
      x.fillText(st.value, sx + 18, sy + 66);
    });
  }

  /* ── 표 ── */
  var w = (two ? (W - PADX * 2 - 44) / 2 : W - PADX * 2), cw = [];
  var weights = o.weights || o.headers.map(function () { return 1; });
  var tot = weights.reduce(function (a2, b) { return a2 + b; }, 0);
  weights.forEach(function (g) { cw.push(w * g / tot); });
  var blocks = two ? [{ ox: PADX, rows: rows.slice(0, half), off: 0 },
                      { ox: PADX + w + 44, rows: rows.slice(half), off: half }]
                   : [{ ox: PADX, rows: rows, off: 0 }];
  var yEnd = headH;
  blocks.forEach(function (blk) {
    var ox = blk.ox, yy = headH;
    x.fillStyle = C.sub; x.font = '700 16px ' + F;
    var cx = ox;
    o.headers.forEach(function (hd, i) {
      var fs1 = fit(hd, cw[i] - 8, 16, '700 ');
      x.font = '700 ' + fs1 + 'px ' + F;
      if (i === 0) { x.textAlign = 'left'; x.fillText(hd, cx, yy + 22); }
      else { x.textAlign = 'right'; x.fillText(hd, cx + cw[i] - 4, yy + 22); }
      cx += cw[i];
    });
    x.strokeStyle = C.line; x.lineWidth = 2;
    x.beginPath(); x.moveTo(ox, yy + 38); x.lineTo(ox + w, yy + 38); x.stroke();
    yy += 58;
    blk.rows.forEach(function (row, ri) {
      var gi = blk.off + ri;
      var isTop = !o.noRank && gi < 3;
      if (o.hi && o.hi.indexOf(gi) >= 0) { rr(ox - 12, yy - 4, w + 24, rowH - 8, 14); x.fillStyle = C.hi; x.fill(); }
      else if (isTop) { rr(ox - 12, yy - 4, w + 24, rowH - 8, 14); x.fillStyle = C.chip; x.fill(); }
      else if (gi % 2 === 1) { rr(ox - 12, yy - 4, w + 24, rowH - 8, 14); x.fillStyle = C.zebra; x.fill(); }
      var cx2 = ox;
      row.forEach(function (cell, i) {
        var t = String(cell == null ? '' : cell);
        var strong = o.bold && o.bold.indexOf(i) >= 0;
        x.fillStyle = strong ? C.ink : (i === 0 ? C.ink : C.sub);
        var base = i === 0 ? 22 : 21;
        var wt = (strong || i === 0) ? '600 ' : '450 ';
        if (o.signed && o.signed.indexOf(i) >= 0) {
          var sv = parseFloat(t.replace(/[^0-9.\-−]/g, '').replace('−', '-'));
          if (isFinite(sv)) { x.fillStyle = sv < 0 ? C.bad : C.good; wt = '700 '; }
        }
        if (o.grade && o.grade.indexOf(i) >= 0) {
          var nv = parseFloat(t.replace(/[^0-9.\-]/g, ''));
          if (isFinite(nv)) { x.fillStyle = nv >= 100 ? C.good : (nv >= 70 ? C.ember : C.sub); wt = '700 '; }
          else x.fillStyle = C.sub;
        }
        var fs2 = fit(t, cw[i] - (i === 0 ? 44 : 10), base, wt);
        x.font = wt + fs2 + 'px ' + F;
        if (i === 0) {
          /* 순위 배지 */
          if (!o.noRank) {
            var bx = cx2 + 14, by = yy + rowH / 2 - 4;
            x.beginPath(); x.arc(bx, by - 6, 14, 0, 7);
            x.fillStyle = gi === 0 ? C.ink : (gi < 3 ? C.moon : C.line); x.fill();
            x.textAlign = 'center';
            x.fillStyle = gi < 3 ? C.onink : C.sub;
            x.font = '700 14px ' + F;
            x.fillText(String(gi + 1), bx, by - 1);
            x.textAlign = 'left';
            x.fillStyle = C.ink; x.font = wt + fs2 + 'px ' + F;
            x.fillText(t, cx2 + 36, yy + rowH / 2 + 2);
          } else {
            x.textAlign = 'left'; x.fillText(t, cx2, yy + rowH / 2 + 2);
          }
        } else {
          x.textAlign = 'right'; x.fillText(t, cx2 + cw[i] - 4, yy + rowH / 2 + 2);
        }
        cx2 += cw[i];
      });
      yy += rowH;
    });
    if (yy > yEnd) yEnd = yy;
  });

  /* ── 푸터 ── */
  y = yEnd;
  x.textAlign = 'left';
  x.strokeStyle = C.line; x.lineWidth = 1;
  x.beginPath(); x.moveTo(PADX, y + 10); x.lineTo(W - PADX, y + 10); x.stroke();
  var d = new Date();
  var more = allRows.length > rows.length
    ? '전체 ' + allRows.length + '곳 중 상위 ' + rows.length + '곳 · 나머지는 앱에서 확인'
    : '전체 ' + allRows.length + '곳';
  x.fillStyle = C.sub; x.font = '600 16px ' + F;
  x.fillText(more, PADX, y + 44);
  x.font = '450 15px ' + F;
  if (o.note) x.fillText(o.note, PADX, y + 72);
  x.fillText('생성 ' + d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() +
    ' · KB ' + ymL(KB.asof) + ' 기준 · 정보 제공용이며 투자 자문이 아닙니다', PADX, y + 100);

  cv.toBlob(function (b) {
    var u = URL.createObjectURL(b), a2 = document.createElement('a');
    a2.href = u; a2.download = (o.file || 'apt-radar') + '_' + d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.png';
    a2.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
  }, 'image/png');
}
function copyTSV(headers, rows) {
  var t = [headers.join('\t')].concat(rows.map(function (r) { return r.join('\t'); })).join('\n');
  if (navigator.clipboard) navigator.clipboard.writeText(t);
}

/* ── 선택 UI ──────────────────────────────────────────────── */
function fillSel(sel, list, selected) {
  sel.innerHTML = '';
  var g = {}; list.forEach(function (r) { (g[r.sido] = g[r.sido] || []).push(r); });
  Object.keys(g).forEach(function (k) {
    var og = document.createElement('optgroup'); og.label = k;
    g[k].forEach(function (r) {
      var o = document.createElement('option'); o.value = r.code; o.textContent = r.name;
      if (r.code === selected) o.selected = true; og.appendChild(o);
    });
    sel.appendChild(og);
  });
}
function pool0() { var p = SGG; if (el('capOnly').checked) p = p.filter(function (r) { return r.cap; }); return p; }

/* ══════════ 01 첫 집 서열 ══════════ */
var LAST1 = [], AREA1 = 0;
function render1() {
  var c = CFG();
  if (AREA1) c.area = AREA1;
  var list0 = pool0().slice().sort(function (a, b) { return last(b.s) - last(a.s); });
  if (el('regOnly1').checked) list0 = list0.filter(function (r) { return !r.reg; });
  var home = BY[el('home').value];

  var rows = list0.map(function (r) {
    var p = priceOf(r, c.area), nc = needCash(p, r, c);
    return { r: r, price: p, nc: nc, jb: band(jrS(r), 10), ok: nc.need <= c.cash, c3: chg(r.s, 36) };
  });
  var firstOk = rows.findIndex(function (x) { return x.ok; });
  LAST1 = rows;

  var best = firstOk >= 0 ? rows[firstOk] : null;
  el('k1').innerHTML =
    '<div class="kpi hero"><span class="lb">닿는 최상급지</span><span class="vl">' +
      (best ? esc(best.r.name) : '없음') + '</span><span class="sb">' +
      (best ? '전국 ' + RANK[best.r.code] + '위 · ' + decile(best.r.code) + '분위 · 필요 ' + won(best.nc.need) : '조건을 조정해 보세요') + '</span></div>' +
    maxKpi('규제지역 최대 매수가', { reg: true, cap: true }, c, 'sig') +
    maxKpi('수도권 비규제 최대', { reg: false, cap: true }, c, '') +
    maxKpi('지방 비규제 최대', { reg: false, cap: false }, c, 'good');

  el('th1a').textContent = c.area + '㎡ 추정';
  var onlyOk = el('onlyOk1').checked, sortBy = el('sort1').value;
  var view = rows.map(function (x, i) { x.rank = i + 1; return x; });
  if (sortBy === 'need') view = view.slice().sort(function (a, b) { return a.nc.need - b.nc.need; });
  else if (sortBy === 'c3') view = view.slice().sort(function (a, b) { return (b.c3 || -99) - (a.c3 || -99); });
  else if (sortBy === 'jr') view = view.slice().sort(function (a, b) { return (b.jb ? b.jb.pct : -1) - (a.jb ? a.jb.pct : -1); });

  var tb = el('t1').tBodies[0]; tb.innerHTML = '';
  view.forEach(function (x) {
    if (onlyOk && !x.ok) return;
    var tr = document.createElement('tr');
    if (x.rank - 1 === firstOk) tr.className = 'pick';
    tr.innerHTML =
      '<td class="nm">' + esc(x.r.name) + (x.r.code === (home && home.code) ? ' <span class="b no">거주</span>' : '') + '</td>' +
      '<td>' + x.rank + '</td><td>' + n0(pyPrice(last(x.r.s))) + '</td><td>' + won(x.price) + '</td>' +
      '<td>' + (x.r.reg ? '<span class="b reg">규제</span>' : '<span class="b free">비규제</span>') + '</td>' +
      '<td>' + x.nc.ltv + '%</td>' +
      '<td>' + won(x.nc.loan) + ' <span class="b no">' + x.nc.bind + '</span></td>' +
      '<td style="font-weight:700;color:' + (x.ok ? 'var(--good)' : 'var(--slate)') + '">' + won(x.nc.need) + '</td>' +
      '<td>' + (x.jb ? gaugeHTML(x.jb.pct, x.jb) : '—') + '</td>' +
      '<td>' + (x.c3 == null ? '—' : (x.c3 > 0 ? '+' : '') + n1(x.c3) + '%') + '</td>' +
      '<td>' + pct10Cell(chg10(x.r)) + '</td>' +
      '<td><button class="btn ghost sm" data-goto="' + x.r.code + '">단지</button></td>';
    tb.appendChild(tr);
  });
  bindGoto(tb);
  ladder(rows, firstOk, home, c);
}
/** 최대 매수가 KPI — 그 가격에서 실제로 무엇이 한도를 정했는지 표시 */
function maxKpi(label, flags, c, cls) {
  var P = maxBuy(c.cash, flags, c);
  var L = loanOf(P, { reg: flags.reg, cap: flags.cap }, c);
  var why = L.bind === 'DSR' ? '소득(DSR)이 한도' : (L.bind === 'LTV' ? 'LTV ' + L.ltv + '%가 한도'
    : (L.bind === '유주택 불가' || L.bind === '다주택 불가') ? '대출 불가 · 전액 현금'
    : '대출 총액 상한(' + L.bind.replace(' 한도', '') + ')'); 
  var sub = '대출 ' + won(L.loan) + ' · ' + why + (c.own === 1 && flags.reg && L.loan > 0 ? ' · 처분조건부' : '');
  return kpi(label, won(P), sub, cls);
}
function ltvNote(c, reg, cap) {
  if (c.banOwner && reg && c.own >= 2) return '규제지역 다주택 대출 불가 · 전액 현금';
  var l = ltvLabel(c, reg, cap);
  return 'LTV ' + l + '%' + (cap ? ' · 총액 상한 적용' : '') + (c.own === 1 && reg ? ' · 처분조건부' : '');
}
function ltvLabel(c, reg, cap) {
  if (LTV_OVERRIDE !== 'auto') return LTV_OVERRIDE;
  if (reg) return c.first ? c.ltvFirst : c.ltvReg;
  if (cap) return c.first ? c.ltvFirst : c.ltvCap;
  return c.first ? c.ltvFirstLoc : c.ltvLoc;
}
function kpi(lb, vl, sb, cls) {
  return '<div class="kpi ' + (cls || '') + '"><span class="lb">' + esc(lb) + '</span><span class="vl">' + vl +
    '</span><span class="sb">' + esc(sb || '') + '</span></div>';
}
function bindGoto(tb) {
  tb.querySelectorAll('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation(); el('rg5').value = b.dataset.goto; show('p7');
    });
  });
}
function ladder(rows, firstOk, home, c) {
  var box = el('lad1');
  var top = firstOk < 0 ? rows.length - 1 : firstOk;
  var span = el('ladAll').checked ? rows.length : 8;
  var from = Math.max(0, top - span), to = Math.min(rows.length - 1, top + span + 4);
  var homeIdx = rows.findIndex(function (x) { return home && x.r.code === home.code; });
  var win = [];
  for (var i = from; i <= to; i++) win.push(i);
  if (homeIdx >= 0 && win.indexOf(homeIdx) < 0) { win.push(homeIdx); win.sort(function (a, b) { return a - b; }); }
  var mx = c.cash * 1.9;
  win.forEach(function (i) { if (rows[i].nc.need > mx) mx = rows[i].nc.need; });
  var h = '';
  h += '<div class="cashline" style="left:calc(var(--bl) + (100% - var(--bl)) * ' + (c.cash / mx).toFixed(4) + ')">' +
       '<b>내 현금 ' + won(c.cash) + '</b></div>';
  win.forEach(function (i) {
    var x = rows[i];
    var cls = 'lrow' + (x.ok ? ' ok' : '') + (i === firstOk ? ' top' : '') + (i === homeIdx ? ' me' : '');
    var wpct = Math.min(100, x.nc.need / mx * 100);
    h += '<div class="' + cls + '"><span class="lr">' + (i + 1) + '</span>' +
      '<span class="ln">' + esc(x.r.name) + '</span>' +
      '<span class="lbar"><i style="width:' + wpct.toFixed(1) + '%"></i>' +
      '<em class="' + (wpct > 62 ? 'inb' : '') + '" style="' + (wpct > 62 ? 'right:8px' : 'left:calc(' + wpct.toFixed(1) + '% + 8px)') +
      '">' + won(x.nc.need) + '</em></span></div>';
  });
  box.innerHTML = h;
}
var OWNL = { 0: '무주택', 1: '1주택 갈아타기', 2: '1주택 추가매수', 3: '2주택 이상' };
function img1() {
  var c = CFG();
  if (AREA1) c.area = AREA1;
  var rows = LAST1.filter(function (x) { return el('onlyOk1').checked ? x.ok : true; }).slice(0, 22);
  exportPNG({
    title: '내 돈이 닿는 최상급지',
    sub: '현금 ' + won(c.cash) + ' · 전용 ' + c.area + '㎡ · ' + OWNL[c.own] + (c.first ? ' · 생애최초' : ''),
    headers: ['지역', '서열', '평당가', '추정가', '필요현금', '10년'],
    weights: [2.5, .8, 1.05, 1.15, 1.25, 1.05],
    bold: [4], grade: [5],
    hi: rows.map(function (x, i) { return x.ok ? i : -1; }).filter(function (i) { return i >= 0; }).slice(0, 1),
    rows: rows.map(function (x, i) {
      return [x.r.name, (i + 1) + '위', n0(pyPrice(last(x.r.s))) + '만', won(x.price), won(x.nc.need),
        chg10(x.r) == null ? '—' : '+' + n1(chg10(x.r)) + '%'];
    }),
    note: '필요현금 = 매수가 − 대출 + 취득세 + 중개보수 + 부대비용 · 평당가는 전용 기준',
    file: 'topdown_rank'
  });
}

/* ══════════ 장기 성과 지표 ══════════ */
function cagrOf(series, months) {
  var li = lastIdx(series); if (li < months) return null;
  var a = series[li - months], b = series[li];
  if (!a || !b) return null;
  return (Math.pow(b / a, 12 / months) - 1) * 100;
}
function chg10(r) { return chg(r.s, 120); }
function cagr10(r) { return cagrOf(r.s, 120); }
function cagrAll(r) { var li = lastIdx(r.s); return cagrOf(r.s, li); }
var BM = (function () {
  var s = BY['S11'], k = BY['ALL'];
  return { seoul10: s ? chg(s.s, 120) : null, seoulC: s ? cagrOf(s.s, 120) : null,
           all10: k ? chg(k.s, 120) : null, allC: k ? cagrOf(k.s, 120) : null };
})();
/** 10년 상승률 판정: 100% 이상이면 합격 */
function grade10(v) {
  if (v == null) return { c: 'no', t: '—' };
  if (v >= 100) return { c: 'ok', t: '합격' };
  if (v >= 70) return { c: 'warn', t: '경계' };
  return { c: 'no', t: '미달' };
}
function gradeHTML(v) {
  var g = grade10(v);
  return '<span class="b ' + g.c + '">' + g.t + '</span>';
}
/** 10년 상승률 + 연복리 2단 셀 */
function pct10Cell(v) {
  if (v == null) return '—';
  var c = (Math.pow(1 + v / 100, 0.1) - 1) * 100;
  var col = v >= 100 ? 'var(--good)' : (v >= 70 ? 'var(--ember)' : (v < 0 ? '#B24A32' : 'var(--slate)'));
  return '<span style="color:' + col + ';font-weight:700">' + (v > 0 ? '+' : '') + n1(v) + '%</span>' +
    '<div style="font-size:11px;color:var(--slate);line-height:1.2">연복리 ' + n1(c) + '%</div>';
}
function cagrOfChg(v, yrs) { return v == null ? null : (Math.pow(1 + v / 100, 1 / yrs) - 1) * 100; }
function pctCell(v) {
  if (v == null) return '—';
  var col = v >= 100 ? 'var(--good)' : (v >= 70 ? 'var(--ember)' : 'var(--slate)');
  return '<span style="color:' + col + ';font-weight:700">' + (v > 0 ? '+' : '') + n1(v) + '%</span>';
}
/** HTML 엔티티 복원 (국토부 단지명에 &amp; 등이 그대로 옴) */
function deent(s) {
  return String(s == null ? '' : s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

/* ══════════ 카카오 실제 지도 ══════════ */
var KKEY = null, KREADY = false, KMAP = null, KOVER = [], KAPTOVER = [], MAPMODE = 'real';
/* ───────────────────────────────────────────────────────────
   카카오맵 JavaScript 키.
   카카오 개발자 콘솔 > 플랫폼 키 > Default JS Key 값을 넣습니다.
   반드시 같은 콘솔의 [플랫폼 등록 > Web 사이트 도메인]에
   이 서비스 주소를 등록해야 지도가 표시됩니다.
   ─────────────────────────────────────────────────────────── */
var DEFAULT_KKEY = '002b76dd627958eaa41dc4791452932d';
function getKey() {
  try { return localStorage.getItem('td2_kakao') || DEFAULT_KKEY; } catch (e) { return DEFAULT_KKEY; }
}
function loadKakao() {
  if (KREADY) return Promise.resolve(true);
  if (!KKEY) return Promise.reject('nokey');
  return new Promise(function (res, rej) {
    var sc = document.createElement('script');
    sc.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' + encodeURIComponent(KKEY) + '&autoload=false&libraries=services';
    sc.onload = function () {
      try { kakao.maps.load(function () { KREADY = true; res(true); }); } catch (e) { rej('load'); }
    };
    sc.onerror = function () { rej('script'); };
    document.head.appendChild(sc);
  });
}
function clearOver(arr) { arr.forEach(function (o) { o.setMap(null); }); arr.length = 0; }
var MAP_AREA = 84, MAP_KIND = 'sale';
function mapVal(r) {
  var v = MAP_KIND === 'jeonse' ? last(r.j) : last(r.s);
  return v || 0;
}
function renderRealMap() {
  el('aptList').innerHTML = '';
  var v = VIEWS[MAPV];
  var list = SGG.filter(function (r) {
    var c = CO[r.code]; if (!c) return false;
    return c[0] >= v.lat[0] && c[0] <= v.lat[1] && c[1] >= v.lng[0] && c[1] <= v.lng[1];
  });
  var cLat = (v.lat[0] + v.lat[1]) / 2, cLng = (v.lng[0] + v.lng[1]) / 2;
  var lvl = MAPV === 'all' ? 13 : (MAPV === 'seoul' ? 8 : 11);
  if (!KMAP) {
    KMAP = new kakao.maps.Map(el('kmap'), { center: new kakao.maps.LatLng(cLat, cLng), level: lvl });
    KMAP.addControl(new kakao.maps.MapTypeControl(), kakao.maps.ControlPosition.TOPRIGHT);
    KMAP.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
  } else {
    KMAP.setCenter(new kakao.maps.LatLng(cLat, cLng)); KMAP.setLevel(lvl);
  }
  clearOver(KOVER); clearOver(KAPTOVER);
  el('kback').hidden = true;
  list.forEach(function (r) {
    var c = CO[r.code], d = decile(r.code);
    var div = document.createElement('div');
    div.className = 'kpin';
    div.style.background = tierColor(d);
    if (d >= 7) div.style.color = '#16202B';
    div.innerHTML = won(mapVal(r) * MAP_AREA) + '<small>' + esc(r.name.replace(/^(서울|인천|부산|대구|광주|대전|울산) /, '')) +
      ' · 평당 ' + n0(pyPrice(mapVal(r))) + '만</small>';
    div.addEventListener('click', function () { SELCODE = r.code; showDetail(r.code); loadAptPins(r); });
    var ov = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(c[0], c[1]), content: div, yAnchor: .5, xAnchor: .5, zIndex: 3
    });
    ov.setMap(KMAP); KOVER.push(ov);
  });
  el('kstat').textContent = v.t + ' ' + list.length + '곳 · 핀 = 전용 ' + MAP_AREA + '㎡ ' +
    (MAP_KIND === 'jeonse' ? '전세가' : '매매가') + ' 추정 · 핀을 누르면 그 지역 단지가 뜹니다';
}
function drawAptList(r, list) {
  var h = '<div class="card flat" style="margin-top:18px"><span class="eb">' + esc(r.name) + ' · ' + MAP_AREA + '㎡대</span>' +
    '<h2 style="font-size:22px;margin-bottom:6px">단지별 평당가 순위</h2>' +
    '<p class="hint" style="margin-bottom:14px">지도 핀 색과 같은 순서입니다 — <b>진할수록 상급</b>, 연할수록 하급.</p>' +
    '<div class="tblwrap"><table><thead><tr><th>순위</th><th>단지</th><th>평당가</th><th>매매</th><th>전세</th>' +
    '<th>전세가율</th><th>갭</th><th>지역 10년</th><th>거래</th></tr></thead><tbody>';
  list.forEach(function (g, i) {
    var tier = Math.min(10, Math.max(1, Math.ceil((i + 1) / list.length * 10)));
    h += '<tr class="clickable" data-tx="' + i + '"><td class="nm"><span style="display:inline-block;width:12px;height:12px;border-radius:4px;background:' +
      tierColor(tier) + ';margin-right:8px;vertical-align:-2px"></span>' + (i + 1) + '</td>' +
      '<td class="nm">' + esc(g.apt) + '<span class="exp-ind">▾ 실거래</span></td>' +
      '<td style="font-weight:700">' + n0(g.py) + '만</td><td>' + won(g.med) + '</td>' +
      '<td>' + (g.jeon ? won(g.jeon) : '—') + '</td>' +
      '<td>' + (g.jr ? n1(g.jr) + '%' : '—') + '</td>' +
      '<td>' + (g.jeon ? won(g.med - g.jeon) : '—') + '</td>' +
      '<td>' + (i === 0 ? pct10Cell(chg10(r)) : '') + '</td><td>' + g.n + '건</td></tr>' +
      '<tr class="txrow" hidden><td colspan="9"><div class="txbox"></div></td></tr>';
  });
  h += '</tbody></table></div></div>';
  el('aptList').innerHTML = h;
  el('aptList').querySelectorAll('[data-tx]').forEach(function (tr) {
    var i = +tr.dataset.tx, dr = tr.nextElementSibling;
    tr.addEventListener('click', function () {
      dr.hidden = !dr.hidden;
      if (!dr.hidden && !dr.dataset.done) {
        dr.querySelector('.txbox').innerHTML = mapTx(list[i]); dr.dataset.done = '1';
      }
    });
  });
}
function mapTx(g) {
  var tx = (g.tx || []).slice().sort(function (u, v) { return (v.ym * 100 + v.day) - (u.ym * 100 + u.day); });
  if (!tx.length) return '<div style="color:var(--slate)">실거래 내역이 없습니다.</div>';
  var asc = tx.slice().reverse(), hi = 0, flag = {};
  asc.forEach(function (t, i) {
    var k = t.ym + '_' + t.day + '_' + t.amt + '_' + t.floor;
    if (i > 0 && t.amt > hi) flag[k] = 1;
    if (t.amt > hi) hi = t.amt;
  });
  var h2 = '<div style="font-weight:700;margin-bottom:10px">' + esc(g.apt) + ' · 실거래 ' + tx.length +
    '건 <span style="color:var(--slate);font-weight:450">(최신순 · 최근 6개월)</span></div>' +
    '<div style="overflow-x:auto"><table><thead><tr><th>계약월</th><th>전용</th><th>층</th><th>거래금액</th><th>평당가</th></tr></thead><tbody>';
  tx.slice(0, 24).forEach(function (t) {
    var k = t.ym + '_' + t.day + '_' + t.amt + '_' + t.floor;
    h2 += '<tr><td>' + ymL(t.ym) + '.' + String(t.day).padStart(2, '0') + '</td><td>' + t.area.toFixed(1) + '㎡</td>' +
      '<td>' + t.floor + '층</td><td style="font-weight:700">' + won(t.amt) +
      (flag[k] ? ' <span class="b warn">신고가</span>' : '') + '</td><td>' + n0(t.amt / t.area * PY) + '만</td></tr>';
  });
  h2 += '</tbody></table></div>';
  return h2;
}
/** 선택 시군구의 단지별 평당가 핀 */
function loadAptPins(r) {
  if (!KMAP) return;
  var st = el('kstat');
  st.textContent = r.name + ' 단지 불러오는 중…';
  el('kback').hidden = false;
  var months = ymList(6), mode = String(MAP_AREA);
  var tasks = [];
  months.forEach(function (ym) {
    tasks.push(function () { return getTr(r.code, ym, 'sale').then(function (d) { return { k: 's', d: d }; }); });
    tasks.push(function () { return getTr(r.code, ym, 'rent').then(function (d) { return { k: 'j', d: d }; }); });
  });
  pool(tasks, 6).then(function (res) {
    var G = {};
    res.forEach(function (x) {
      if (!x || !x.d || !x.d.items) return;
      x.d.items.forEach(function (t) {
        if (!areaPass(t.area, mode)) return;
        if (x.k === 's' && t.canceled) return;
        if (x.k === 'j' && !t.jeonse) return;
        var k = normName(t.apt);
        var g = G[k] || (G[k] = { apt: deent(t.apt), sale: [], rent: [], ar: [], tx: [], addr: '' });
        if (x.k === 's') {
          g.sale.push(t.amount); g.ar.push(t.area);
          g.tx.push({ ym: t.ym, day: t.day, area: t.area, floor: t.floor, amt: t.amount });
          if (!g.addr && t.roadAddr) g.addr = (t.sggNm || '') + ' ' + t.roadAddr;
          if (!g.addr && t.jibun) g.jibun = (t.sggNm || '') + ' ' + (t.dong || '') + ' ' + t.jibun;
        } else g.rent.push(t.deposit);
      });
    });
    var list = Object.keys(G).map(function (k) {
      var g = G[k]; if (g.sale.length < 2) return null;
      var med = median(g.sale), ar = median(g.ar), je = median(g.rent);
      return { apt: g.apt, py: med / ar * PY, med: med, jeon: je, tx: g.tx,
        jr: je ? je / med * 100 : null, addr: g.addr || g.jibun || '', n: g.sale.length };
    }).filter(Boolean).sort(function (a, b) { return b.py - a.py; }).slice(0, 30);
    if (!list.length) { st.textContent = r.name + ' 최근 6개월 ' + MAP_AREA + '㎡대 거래가 없습니다. 평형을 바꿔보세요.'; el('aptList').innerHTML = ''; return; }
    drawAptList(r, list);
    clearOver(KOVER); clearOver(KAPTOVER);
    KMAP.setLevel(6);
    KMAP.setCenter(new kakao.maps.LatLng(CO[r.code][0], CO[r.code][1]));
    var geo = new kakao.maps.services.Geocoder();
    list.forEach(function (g) { g.n = g.n || 0; });
    var done = 0, placed = 0, bounds = new kakao.maps.LatLngBounds();
    list.forEach(function (g, i) {
      var CKk = 'td2_geo:' + normName(g.apt) + ':' + r.code, cc = null;
      try { cc = JSON.parse(localStorage.getItem(CKk) || 'null'); } catch (e) { }
      function place(lat, lng) {
        var div = document.createElement('div');
        var tier = Math.min(10, Math.max(1, Math.ceil((i + 1) / list.length * 10)));
        div.className = 'kpin apt t' + tier;
        div.style.background = tierColor(tier);
        div.style.color = tier >= 7 ? '#16202B' : '#fff';
        div.innerHTML = '<b>' + esc(g.apt.slice(0, 10)) + '</b>' +
          '<small>평당 ' + n0(g.py) + '만</small>' +
          '<small>매 ' + won(g.med) + (g.jeon ? ' · 전 ' + won(g.jeon) : '') + '</small>';
        div.title = g.apt + ' · 매매 ' + won(g.med) + (g.jeon ? ' · 전세 ' + won(g.jeon) +
          ' · 전세가율 ' + n1(g.jr) + '%' : '') + ' · ' + g.n + '건';
        var ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(lat, lng), content: div, yAnchor: .5, xAnchor: .5, zIndex: 4 });
        ov.setMap(KMAP); KAPTOVER.push(ov); bounds.extend(new kakao.maps.LatLng(lat, lng)); placed++;
      }
      function fin() {
        done++;
        if (done === list.length) {
          st.textContent = r.name + ' 단지 ' + placed + '곳 · 핀 = 전용 평당가(만원) · ' + MAP_AREA + '㎡대 ' +
            (MAP_KIND === 'jeonse' ? '전세' : '매매') + ' 최근 6개월 중위';
          if (placed > 1) KMAP.setBounds(bounds);
        }
      }
      if (cc && cc.lat) { place(cc.lat, cc.lng); fin(); return; }
      if (!g.addr) { fin(); return; }
      setTimeout(function () {
        geo.addressSearch(g.addr, function (result, status) {
          if (status === kakao.maps.services.Status.OK && result[0]) {
            var lat = +result[0].y, lng = +result[0].x;
            try { localStorage.setItem(CKk, JSON.stringify({ lat: lat, lng: lng })); } catch (e) { }
            place(lat, lng);
          }
          fin();
        });
      }, i * 60);
    });
  });
}
