'use strict';
function img4() {
  var c = CFG();
  exportPNG({
    title: '내 위치와 위아래 급지',
    sub: BY[el('home').value].name + ' 기준 · 전용 ' + c.area + '㎡',
    headers: ['지역', '구분', '평당가', '추정가', '배율', '10년평균', '추가 필요금'],
    weights: [2.2, .9, 1.1, 1.2, .9, 1, 1.3],
    bold: [6],
    rows: LAST4.map(function (x) {
      return [x.r.name, x.kind, n0(pyPrice(last(x.r.s))) + '만', won(x.pt),
        x.b ? x.b.cur.toFixed(2) : '—', x.b ? x.b.avg.toFixed(2) : '—', x.kind === '지금 여기' ? '—' : won(x.extra)];
    }),
    note: '추가 필요금 = 목표가 − 보유 추정가 + 취득세 + 양쪽 중개보수 + 이사비',
    file: 'topdown_switch'
  });
}

/* ══════════ 05 순환매 ══════════ */
var LAST5 = [];
function render5() {
  var base = BY[el('base4').value], tol = +el('tol4').value, dir = el('dir4').value;
  var tb = el('t5').tBodies[0]; tb.innerHTML = ''; if (!base) return;
  var rows = [];
  SGG.forEach(function (r) {
    if (r.code === base.code) return;
    var rs = ratioS(base, r), b = band(rs, 10); if (!b) return;
    var li = lastIdx(rs), f = Math.max(0, li - 119), v = [];
    for (var i = f; i <= li; i++) if (rs[i] != null) v.push(rs[i]);
    var m = v.reduce(function (a, x) { return a + x; }, 0) / v.length;
    var sd = Math.sqrt(v.reduce(function (a, x) { return a + (x - m) * (x - m); }, 0) / v.length);
    var cv = sd / m; if (cv > tol) return;
    var behind = b.cur < b.avg;
    if (dir === 'behind' && !behind) return;
    if (dir === 'ahead' && behind) return;
    rows.push({ r: r, b: b, cv: cv, up: (b.avg / b.cur - 1) * 100, d3: (chg(r.s, 36) || 0) - (chg(base.s, 36) || 0) });
  });
  rows.sort(function (a, b2) { return dir === 'behind' ? a.b.pct - b2.b.pct : b2.b.pct - a.b.pct; });
  LAST5 = rows;
  if (!rows.length) { tb.innerHTML = '<tr><td colspan="8" class="empty">동행성 기준을 만족하는 짝이 없습니다. 기준을 느슨하게 바꿔보세요.</td></tr>'; return; }
  rows.slice(0, 25).forEach(function (x) {
    var tr = document.createElement('tr');
    if (Math.abs(x.up) >= 8 && x.b.pct <= .15) tr.className = 'pick';
    tr.innerHTML = '<td class="nm">' + esc(x.r.name) + '</td><td>' + n0(pyPrice(last(x.r.s))) + '</td>' +
      '<td>' + x.b.cur.toFixed(3) + '</td><td>' + x.b.avg.toFixed(3) + '</td><td>' + n1(x.cv * 100) + '%</td>' +
      '<td>' + gaugeHTML(x.b.pct, x.b) + '</td>' +
      '<td' + (x.up > 0 ? ' style="color:var(--good);font-weight:700"' : '') + '>' + (x.up > 0 ? '+' : '') + n1(x.up) + '%</td>' +
      '<td>' + (x.d3 > 0 ? '+' : '') + n1(x.d3) + '%p</td>';
    tb.appendChild(tr);
  });
}
function img5() {
  exportPNG({
    title: '순환매 후보 · ' + BY[el('base4').value].name + ' 기준',
    sub: '10년간 같이 움직였는데 지금 격차가 벌어진 지역',
    headers: ['짝 지역', '평당가', '현재 배율', '10년평균', '변동계수', '회귀 여력'],
    weights: [2.4, 1.2, 1.1, 1.1, 1.1, 1.2],
    bold: [5],
    rows: LAST5.map(function (x) {
      return [x.r.name, n0(pyPrice(last(x.r.s))) + '만', x.b.cur.toFixed(3), x.b.avg.toFixed(3),
        n1(x.cv * 100) + '%', (x.up > 0 ? '+' : '') + n1(x.up) + '%'];
    }),
    note: '회귀 여력은 가설입니다 — 격차가 신규 노선·재건축 등 구조 변화 때문이면 회귀하지 않습니다',
    file: 'topdown_rotation'
  });
}

/* ══════════ API 공통 ══════════ */
var MEM = {};
function jget(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }); }
function getTr(lawd, ym, kind) {
  var k = lawd + ':' + ym + ':' + kind;
  if (MEM[k]) return Promise.resolve(MEM[k]);
  return jget(API + '/trades?lawd=' + lawd + '&ym=' + ym + '&kind=' + kind)
    .then(function (d) { MEM[k] = d; return d; }, function () { return { items: [] }; });
}
function pool(tasks, limit) {
  return new Promise(function (res) {
    var i = 0, act = 0, out = new Array(tasks.length);
    function step() {
      if (i >= tasks.length && act === 0) return res(out);
      while (act < limit && i < tasks.length) {
        (function (k) { act++; i++;
          tasks[k]().then(function (v) { out[k] = v; }, function () { out[k] = null; })
            .then(function () { act--; step(); }); })(i);
      }
    }
    step();
  });
}
function ymList(n) {
  var o = [], d = new Date();
  for (var i = 0; i < n; i++) { var y = d.getFullYear(), m = d.getMonth() + 1 - i; while (m <= 0) { m += 12; y--; } o.push(y * 100 + m); }
  return o;
}
/** back 개월 전부터 n 개월치 — 과거 시세 비교용 */
function ymListBack(n, back) {
  var o = [], d = new Date();
  for (var i = 0; i < n; i++) {
    var y = d.getFullYear(), m = d.getMonth() + 1 - back - i;
    while (m <= 0) { m += 12; y--; }
    o.push(y * 100 + m);
  }
  return o;
}
function normName(s) {
  return String(s || '').replace(/\(.*?\)/g, '').replace(/[\s\-·、,]/g, '')
    .replace(/아파트$/, '').replace(/(제?\d+)?단지$/, '').toLowerCase();
}
function dice(a, b) {
  if (a === b) return 1; if (a.length < 2 || b.length < 2) return 0;
  var m = {}, h = 0, i;
  for (i = 0; i < a.length - 1; i++) { var g = a.substr(i, 2); m[g] = (m[g] || 0) + 1; }
  for (i = 0; i < b.length - 1; i++) { var q = b.substr(i, 2); if (m[q] > 0) { m[q]--; h++; } }
  return 2 * h / (a.length + b.length - 2);
}
function areaPass(a, mode) {
  if (mode === 'all') return true;
  if (mode === '36') return a >= 20 && a < 45;
  if (mode === '46') return a >= 45 && a < 55;
  if (mode === '59') return a >= 55 && a < 70;
  if (mode === '84') return a >= 70 && a < 95;
  return a >= 95 && a < 120;
}
function bucketOf(a) {
  if (a < 45) return '36㎡대'; if (a < 55) return '46㎡대'; if (a < 70) return '59㎡대';
  if (a < 95) return '84㎡대'; if (a < 120) return '100㎡대'; return '120㎡+';
}
function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); var h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }

/* ══════════ 06 대장 아파트 ══════════ */
var LAST6 = [];
function pastYm(nYears, n) {
  var o = [], d = new Date();
  for (var i = 0; i < n; i++) {
    var y = d.getFullYear() - nYears, m = d.getMonth() + 1 - i;
    while (m <= 0) { m += 12; y--; }
    o.push(y * 100 + m);
  }
  return o;
}
function pastPy(code, mode) {
  var ms = pastYm(10, 3);
  var tasks = ms.map(function (ym) { return function () { return getTr(code, ym, 'sale'); }; });
  return pool(tasks, 3).then(function (res) {
    var G = {};
    res.forEach(function (d) {
      if (!d || !d.items) return;
      d.items.forEach(function (t) {
        if (t.canceled || !areaPass(t.area, mode)) return;
        var k = normName(t.apt);
        (G[k] = G[k] || []).push(t.amount / t.area * PY);
      });
    });
    var out = {};
    Object.keys(G).forEach(function (k) { out[k] = median(G[k]); });
    return out;
  });
}
function run6() {
  var mode = el('area6').value, lim = +el('lim6').value, regs;
  if (el('scope6').value === 'one') {
    var one = BY[el('rg6').value];
    regs = one ? [one] : [];
  } else {
    var sido = el('sido6').value;
    regs = SORTED.filter(function (r) { return r.sido === sido; });
    if (lim < 99) regs = regs.slice(0, lim);
  }
  if (!regs.length) { el('s6').textContent = '지역을 선택하세요.'; return; }
  var months = ymList(6), st = el('s6'), btn = el('run6');
  btn.disabled = true;
  var done = 0, total = regs.length * months.length * 2;
  var tasks = [];
  regs.forEach(function (rg) {
    months.forEach(function (ym) {
      tasks.push(function () { return getTr(rg.code, ym, 'sale').then(function (d) { done++; st.textContent = '불러오는 중 ' + done + '/' + total; return { rg: rg, d: d, kind: 'sale' }; }); });
      tasks.push(function () { return getTr(rg.code, ym, 'rent').then(function (d) { done++; st.textContent = '불러오는 중 ' + done + '/' + total; return { rg: rg, d: d, kind: 'rent' }; }); });
    });
  });
  pool(tasks, 8).then(function (res) {
    var byReg = {};
    res.forEach(function (x) {
      if (!x || !x.d || !x.d.items) return;
      var G = byReg[x.rg.code] || (byReg[x.rg.code] = { rg: x.rg, g: {} });
      x.d.items.forEach(function (t) {
        if (!areaPass(t.area, mode)) return;
        var k = normName(t.apt);
        var g = G.g[k] || (G.g[k] = { apt: deent(t.apt), sale: [], rent: [], ar: [], mx: 0, tx: [], mo: {} });
        var mm = g.mo[t.ym] || (g.mo[t.ym] = { s: [], j: [] });
        if (x.kind === 'sale') {
          if (t.canceled) return;
          g.sale.push(t.amount); g.ar.push(t.area); mm.s.push(t.amount);
          g.tx.push({ ym: t.ym, day: t.day, area: t.area, floor: t.floor, amt: t.amount });
          if (t.amount > g.mx) g.mx = t.amount;
        } else if (t.jeonse) { g.rent.push(t.deposit); mm.j.push(t.deposit); }
      });
    });
    var TOPN = +el('top6').value;
    var out = [], RG_TOP = {};
    Object.keys(byReg).forEach(function (code) {
      var G = byReg[code], cands = [];
      Object.keys(G.g).forEach(function (k) {
        var g = G.g[k]; if (g.sale.length < 2) return;
        var med = median(g.sale), ar = median(g.ar), py = med / ar * PY;
        cands.push({ apt: g.apt, med: med, mx: g.mx, ar: ar, py: py, jeon: median(g.rent),
                     n: g.sale.length, tx: g.tx, mo: g.mo });
      });
      cands.sort(function (x, y) { return y.py - x.py; });
      if (cands.length) RG_TOP[G.rg.code] = cands[0].py;
      cands.slice(0, TOPN).forEach(function (b, i) { out.push({ rg: G.rg, b: b, rk: i + 1 }); });
    });
    out.sort(function (u, v) {
      var pu = u.rk === 1 ? u.b.py : 0, pv = v.rk === 1 ? v.b.py : 0;
      if (u.rg.code !== v.rg.code) return (RG_TOP[v.rg.code] || 0) - (RG_TOP[u.rg.code] || 0);
      return u.rk - v.rk;
    });
    st.textContent = '10년 전 시세 비교 중…';
    pool(out.map(function (x) {
      return function () {
        return pastPy(x.rg.code, mode).then(function (m) {
          var p = m[normName(x.b.apt)];
          x.b.past = p || null;
          x.b.g10 = p ? (x.b.py / p - 1) * 100 : null;
        });
      };
    }), 4).then(function () {
      LAST6 = out; draw6(out, mode);
      st.textContent = out.length + '곳 (최근 6개월 · ' + mode + '㎡대 · 10년 전 대비 포함)';
      btn.disabled = false;
    });
  });
}
function draw6(out, mode) {
  var tb = el('t6').tBodies[0]; tb.innerHTML = '';
  if (!out.length) { tb.innerHTML = '<tr><td colspan="12" class="empty">해당 조건의 실거래가 없습니다.</td></tr>'; return; }
  out.forEach(function (x, i6) {
    var b = x.b, jr = b.jeon ? b.jeon / b.med * 100 : null;
    var tr = document.createElement('tr');
    tr.className = 'clickable' + (x.rk === 1 ? ' grp' : '');
    tr.innerHTML = '<td class="nm">' + (x.rk === 1 ? '<b>' + esc(x.rg.name) + '</b> <span class="b no">' +
      (RANK[x.rg.code] ? decile(x.rg.code) + '분위' : '지방') + '</span>' : '<span style="color:var(--taupe)">└</span>') +
      ' <span class="b ' + (x.rk === 1 ? 'd1' : 'no') + '">' + x.rk + '위</span></td>' +
      '<td class="nm">' + esc(deent(b.apt)) + '<span class="exp-ind">▾ 상세</span></td><td>' + bucketOf(b.ar) + '</td>' +
      '<td style="font-weight:700">' + won(b.med) + '</td><td>' + won(b.mx) + '</td>' +
      '<td>' + (b.jeon ? won(b.jeon) : '—') + '</td><td>' + (jr ? n1(jr) + '%' : '—') + '</td>' +
      '<td>' + n0(b.py) + '</td><td>' + (b.jeon ? won(b.med - b.jeon) : '—') + '</td>' +
      '<td>' + pct10Cell(b.g10) + '</td><td>' + (x.rg.kind === 'ext' ? '—' : pct10Cell(chg10(x.rg))) + '</td>' +
      '<td>' + b.n + '건</td>' +
      '<td><button class="btn ghost sm" data-cart6="' + i6 + '">담기</button></td>';
    tb.appendChild(tr);
    var dr = document.createElement('tr');
    dr.className = 'txrow'; dr.hidden = true;
    dr.innerHTML = '<td colspan="13"><div class="txbox"></div></td>';
    tb.appendChild(dr);
    tr.addEventListener('click', function (e) {
      if (e.target.closest('[data-cart6]')) return;
      dr.hidden = !dr.hidden;
      if (!dr.hidden && !dr.dataset.done) { dr.querySelector('.txbox').innerHTML = flagDetail(x); dr.dataset.done = '1'; }
    });
    tr.querySelector('[data-cart6]').addEventListener('click', function (e) {
      e.stopPropagation();
      var okAdd = cartAdd({ key: x.rg.code + ':' + b.apt + ':' + bucketOf(b.ar), code: x.rg.code, region: x.rg.name,
        apt: deent(b.apt), bucket: bucketOf(b.ar), med: b.med, jeon: b.jeon || null, py: b.py, area: b.ar,
        hh: null, walk: null, byr: null, g10: b.g10 == null ? null : b.g10 });
      e.target.textContent = okAdd ? '담김 ✓' : '이미 담김';
      e.target.disabled = true;
    });
  });
}
/** 대장 단지 상세: 실거래 히스토리 + 월별 전세가율 */
function flagDetail(x) {
  var b = x.b;
  var h = '<div style="font-weight:700;font-size:16px;margin-bottom:4px">' + esc(b.apt) + '</div>' +
    '<div style="color:var(--slate);font-size:13.5px;margin-bottom:14px">' + esc(x.rg.name) + ' · ' +
    bucketOf(b.ar) + ' · 최근 6개월 매매 ' + b.n + '건 · 중위 ' + won(b.med) + ' · 최고 ' + won(b.mx) +
    ' · 평당 ' + n0(b.py) + '만' + (b.g10 != null ? ' · 10년 ' + (b.g10 > 0 ? '+' : '') + n1(b.g10) + '%' : '') + '</div>';
  var ms = Object.keys(b.mo || {}).sort();
  if (ms.length) {
    h += '<div style="font-weight:700;font-size:14px;margin:14px 0 6px">월별 매매·전세·전세가율</div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>월</th><th>매매 중위</th><th>전세 중위</th><th>전세가율</th><th>매매 건수</th></tr></thead><tbody>';
    ms.forEach(function (m) {
      var mm = b.mo[m], s = median(mm.s), j = median(mm.j);
      h += '<tr><td>' + ymL(+m) + '</td><td>' + (s ? won(s) : '—') + '</td><td>' + (j ? won(j) : '—') + '</td>' +
        '<td>' + (s && j ? n1(j / s * 100) + '%' : '—') + '</td><td>' + mm.s.length + '건</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  var tx = (b.tx || []).slice().sort(function (u, v) { return (v.ym * 100 + v.day) - (u.ym * 100 + u.day); });
  if (tx.length) {
    h += '<div style="font-weight:700;font-size:14px;margin:18px 0 6px">실거래 내역 (최신순)</div>' +
      '<div style="overflow-x:auto"><table><thead><tr><th>계약월</th><th>전용</th><th>층</th><th>거래금액</th><th>평당가</th></tr></thead><tbody>';
    tx.slice(0, 20).forEach(function (t) {
      h += '<tr><td>' + ymL(t.ym) + '.' + String(t.day).padStart(2, '0') + '</td><td>' + t.area.toFixed(1) + '㎡</td>' +
        '<td>' + t.floor + '층</td><td style="font-weight:700">' + won(t.amt) + '</td><td>' + n0(t.amt / t.area * PY) + '만</td></tr>';
    });
    h += '</tbody></table></div>';
  }
  return h;
}
function img6() {
  if (!LAST6.length) return;
  exportPNG({
    title: el('sido6').value + ' 대장 아파트 · ' + el('area6').value + '㎡대',
    sub: '국토부 실거래 최근 6개월 · 시군구별 전용 평당가 1위 단지',
    headers: ['지역', '대장 단지', '매매', '전세', '평당가', '단지 10년', '지역 10년'],
    weights: [1.5, 2.15, 1.15, 1.1, 1.05, 1.1, 1.05],
    bold: [2], grade: [5, 6],
    rows: LAST6.map(function (x) {
      var b = x.b;
      return [x.rg.name, b.apt, won(b.med), b.jeon ? won(b.jeon) : '—', n0(b.py) + '만',
        b.g10 == null ? '—' : (b.g10 > 0 ? '+' : '') + n1(b.g10) + '%',
        chg10(x.rg) == null ? '—' : '+' + n1(chg10(x.rg)) + '%'];
    }),
    max: 16,
    note: '10년 상승률 100% 이상이 초록 · 매매·전세는 최근 6개월 실거래 중위값 · 평당가는 전용 기준',
    file: 'topdown_flagship'
  });
}

/* ══════════ 07 단지 솔팅 ══════════ */
var LAST7 = [];
function run5() {
  var c = CFG(), code = el('rg5').value, r = BY[code]; if (!r) return;
  var months = ymList(+el('mo5').value), minHH = +el('hh5').value, maxWalk = +el('sub5').value,
      maxAge = +el('yr5').value, aMode = el('ar5').value;
  var st = el('s5'), btn = el('run5'); btn.disabled = true;
  var done = 0, total = months.length * 2;
  var tasks = [];
  months.forEach(function (ym) {
    tasks.push(function () { return getTr(code, ym, 'sale').then(function (d) { done++; st.textContent = '실거래 ' + done + '/' + total; return d; }); });
    tasks.push(function () { return getTr(code, ym, 'rent').then(function (d) { done++; st.textContent = '실거래 ' + done + '/' + total; return d; }); });
  });
  pool(tasks, 6).then(function (res) {
    var sales = [], rents = [];
    res.forEach(function (d) { if (!d || !d.items) return; if (d.kind === 'rent') rents = rents.concat(d.items); else sales = sales.concat(d.items); });
    if (!sales.length) { st.textContent = '해당 기간 매매 실거래가 없습니다. 기간을 늘려보세요.'; btn.disabled = false; return; }
    var G = {};
    sales.forEach(function (t) {
      if (t.canceled || !areaPass(t.area, aMode)) return;
      var k = normName(t.apt) + '|' + bucketOf(t.area);
      var g = G[k] || (G[k] = { apt: t.apt, bucket: bucketOf(t.area), sale: [], rent: [], areas: [], tx: [], byr: t.buildYear, last: 0, lastAmt: 0 });
      g.sale.push(t.amount); g.areas.push(t.area);
      g.tx.push({ ym: t.ym, day: t.day, area: t.area, floor: t.floor, amt: t.amount });
      if (t.buildYear) g.byr = Math.max(g.byr || 0, t.buildYear);
      var s = t.ym * 100 + t.day; if (s > g.last) { g.last = s; g.lastAmt = t.amount; }
    });
    rents.forEach(function (t) {
      if (!t.jeonse || !areaPass(t.area, aMode)) return;
      var k = normName(t.apt) + '|' + bucketOf(t.area); if (G[k]) G[k].rent.push(t.deposit);
    });
    var list = Object.keys(G).map(function (k) {
      var g = G[k], med = median(g.sale), ar = median(g.areas);
      g.med = med; g.area = ar; g.py = med / ar * PY; g.jeon = median(g.rent);
      g.age = g.byr ? (new Date().getFullYear() - g.byr) : null; return g;
    }).filter(function (g) { return g.py && (!maxAge || (g.age != null && g.age <= maxAge)); })
      .sort(function (a, b) { return b.py - a.py; });
    if (!list.length) { st.textContent = '조건에 맞는 거래가 없습니다.'; btn.disabled = false; return; }
    st.textContent = '10년 전 시세 · 단지 정보 확인 중…';
    var target = list.slice(0, 40);
    Promise.all([enrich(code, target), pastPy(code, aMode)]).then(function (rr) {
      var pm = rr[1] || {};
      target.forEach(function (g) {
        var p = pm[normName(g.apt)];
        g.past = p || null; g.g10 = p ? (g.py / p - 1) * 100 : null;
      });
      var out = target.filter(function (g) {
        if (minHH && (!g.hh || g.hh < minHH)) return false;
        if (maxWalk && g.walk != null && g.walk > maxWalk) return false;
        return true;
      });
      LAST7 = out; draw7(out);
      st.textContent = out.length + '곳 (매매 ' + sales.length + '건 · 전세 ' + rents.length + '건 · 10년 전 대비 포함)';
      btn.disabled = false;
    });
  });
}
/* ══════════════════════════════════════════════════════════════
   v55.0 — K-apt multi-signal identity matcher v6
   변경 대상은 «실거래 단지 → K-apt 단지 identity matching» 뿐이다.
   추천 점수 공식·가중치·PFLOOR·percentile·정렬은 건드리지 않는다.

   판정 순서
     동일 시군구 → 동일 법정동 → strict 지번(main/sub/산)
     → buildYear/useYear → 브랜드 token → semantic number token → 이름
   CONFIRMED_MATCH 일 때만 hh·walk·byr 를 K-apt 값으로 덮어쓴다.
   ══════════════════════════════════════════════════════════════ */
function kmDongOf(addr) {
  var t = String(addr || '').trim().split(/\s+/);
  for (var i = t.length - 1; i >= 0; i--) {
    if (/[동리가]$/.test(t[i]) && !/시$|구$|도$|군$/.test(t[i])) return t[i];
  }
  return null;
}
function kmJibunStr(addr) {
  var m = String(addr || '').match(/[가-힣]+[동리가]\s+(산\s*)?(\d+(?:-\d+)?)/);
  return m ? ((m[1] ? '산' : '') + m[2]) : null;
}
function kmParseJibun(v0) {
  if (v0 == null || v0 === '') return { ok: false, san: false, main: null, sub: null, raw: null };
  var v = String(v0).trim(), san = /^산\s*/.test(v);
  v = v.replace(/^산\s*/, '').replace(/\s/g, '').replace(/-+$/, '');
  var m = v.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return { ok: false, san: san, main: null, sub: null, raw: String(v0) };
  return { ok: true, san: san, main: +m[1], sub: m[2] == null ? 0 : +m[2], raw: String(v0) };
}
function kmJibunCmp(a, b) {
  var A = kmParseJibun(a), B = kmParseJibun(b);
  if (!A.ok || !B.ok) return 'unknown';
  if (A.san !== B.san) return 'different';
  return (A.main === B.main && A.sub === B.sub) ? 'exact' : 'different';
}
function kmJibunHint(name) {
  var m = String(name || '').match(/\((\d+(?:-\d+)?)\)/);
  return m ? m[1] : null;
}
var KM_BRAND = ['부영','라이프','동아','건영','선경','현대','한라','대우','삼성','한신','우성','럭키',
  '신동아','삼익','금호','대림','쌍용','동문','청구','유원','태영','두산','롯데','효성','벽산','한양',
  '극동','미성','성원','풍림','대원','한국','동성','신성','경남','코오롱','포스코','호반','계룡','동원',
  '우방','진흥','서희','반도','제일','남광','삼호','삼환','한일','고려','신일','대방','중흥','모아','한화',
  '일신건영','뜨란채','아이파크','자이','래미안','푸르지오','더샵','센트리움','휴먼빌'];
function kmParenBrand(name) {
  var out = [];
  (String(name || '').match(/\(([^)]+)\)/g) || []).forEach(function (p2) {
    var inner = p2.replace(/[()]/g, '');
    if (/^\d+[-\d]*$/.test(inner)) return;
    KM_BRAND.forEach(function (b) { if (inner.indexOf(b) >= 0 && out.indexOf(b) < 0) out.push(b); });
  });
  return out;
}
function kmAnyBrand(name) {
  var v = String(name || ''), out = [];
  KM_BRAND.forEach(function (b) { if (v.indexOf(b) >= 0 && out.indexOf(b) < 0) out.push(b); });
  return out;
}
/** semantic token — 타입이 다르면 비교하지 않는다 (106동 vs 2차) */
function kmTokens(name) {
  var v = String(name || '');
  var t = { buildingNo: null, complexNo: null, phaseNo: null, nameNumbers: [], baseName: null };
  var b = v.match(/(\d+)\s*동(?![가-힣])/); if (b) t.buildingNo = +b[1];
  var c = v.match(/(\d+(?:-\d+)?)\s*단지/); if (c) t.complexNo = c[1];
  var p2 = v.match(/(\d+)\s*차/); if (p2) t.phaseNo = +p2[1];
  var rest = v.replace(/\([^)]*\)/g, '')
    .replace(/\d+\s*동(?![가-힣])/g, '').replace(/\d+(?:-\d+)?\s*단지/g, '').replace(/\d+\s*차/g, '');
  t.nameNumbers = (rest.match(/\d+/g) || []).map(Number);
  /* 괄호 안 «주공3»·«주공2» 처럼 단지번호가 들어간 경우도 인식한다.
     순수 숫자 괄호(지번 힌트)는 제외한다. */
  (v.match(/\(([^)]+)\)/g) || []).forEach(function (p3) {
    var inner = p3.replace(/[()]/g, '');
    if (/^\d+[-\d]*$/.test(inner)) return;                  /* 지번 */
    var mm = inner.match(/[가-힣]+\s*(\d+)$/);
    if (mm && t.nameNumbers.indexOf(+mm[1]) < 0) t.nameNumbers.push(+mm[1]);
  });
  t.baseName = rest.replace(/\d+/g, '').replace(/[\s\-·,]/g, '');
  return t;
}
function kmCmpTokens(a, b) {
  var match = [], conflict = [];
  function pair(k, va, vb) {
    if (va == null || vb == null) return;
    (String(va) === String(vb) ? match : conflict).push(k + ':' + va + '↔' + vb);
  }
  pair('단지', a.complexNo, b.complexNo);
  pair('차', a.phaseNo, b.phaseNo);
  pair('동', a.buildingNo, b.buildingNo);
  /* 단지번호는 «13단지» 로도 «옥빛13» 로도 쓰인다. 같은 의미이므로 교차 비교한다.
     단, «동»·«차» 와는 여전히 비교하지 않는다(106동 vs 2차). */
  function complexLike(t) {
    var v = [];
    if (t.complexNo != null && String(t.complexNo).indexOf('-') < 0) v.push(+t.complexNo);
    t.nameNumbers.forEach(function (n) { if (v.indexOf(n) < 0) v.push(n); });
    return v;
  }
  var ca = complexLike(a), cb = complexLike(b);
  if (ca.length && cb.length) {
    var inter = ca.filter(function (x) { return cb.indexOf(x) >= 0; });
    if (inter.length) match.push('단지번호:' + inter.join(','));
    else conflict.push('단지번호:' + ca.join(',') + '↔' + cb.join(','));
  }
  return { match: match, conflict: conflict,
           tokenMatch: match.length > 0 && conflict.length === 0,
           tokenConflict: conflict.length > 0 };
}
var KM_REGION_PREFIX = ['군포','안양','부천','고양','산본','평촌','일산','덕양','만안','동안','소사','원미',
  '금정','당동','당정','부곡','대야미','도마교','송정','화정','성사','중동','상동','역곡','괴안','춘의','석수'];
function kmStrongNorm(s0) {
  var v = String(s0 || '');
  v = v.replace(/엘에이치/g, 'lh').replace(/LH/gi, 'lh');
  v = v.replace(/\(.*?\)/g, '').replace(/[\s\-·、,]/g, '').replace(/아파트/g, '').toLowerCase();
  for (var i = 0; i < KM_REGION_PREFIX.length; i++) {
    var pfx = KM_REGION_PREFIX[i];
    if (v.indexOf(pfx) === 0 && v.length - pfx.length >= 2) { v = v.slice(pfx.length); break; }
  }
  return v;
}
function kmContain(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.indexOf(b) >= 0 || b.indexOf(a) >= 0) {
    var sm = Math.min(a.length, b.length), lg = Math.max(a.length, b.length);
    return 0.6 + 0.4 * (sm / lg);
  }
  return 0;
}

function enrich(code, list) {
  var LK = 'td_kl:' + code, cache = null;
  try { cache = JSON.parse(localStorage.getItem(LK) || 'null'); } catch (e) { }
  var p = (cache && cache.t > Date.now() - 30 * 864e5) ? Promise.resolve(cache.v)
    : jget(API + '/apt?kind=list&lawd=' + code).then(function (d) {
        var v = (d && d.items) || [];
        try { localStorage.setItem(LK, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { } return v;
      }, function () { return []; });

  function infoOf(kapt) {
    var CK = 'td_ka:' + kapt, c0 = null;
    try { c0 = JSON.parse(localStorage.getItem(CK) || 'null'); } catch (e) { }
    if (c0 && c0.t > Date.now() - 60 * 864e5) return Promise.resolve(c0.v);
    return jget(API + '/apt?kind=info&kapt=' + kapt).then(function (d) {
      if (d && d.info) { try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), v: d.info })); } catch (e) { } return d.info; }
      return null;
    }, function () { return null; });
  }

  return p.then(function (items) {
    var idx = items.map(function (it) {
      return { name: it.name, kaptCode: it.kaptCode, bjd: it.bjdCode || null,
               addr: it.addr || null, dong: kmDongOf(it.addr) };
    });

    /* ── 1단계: 같은 법정동 후보를 추리고, 그 후보의 detail 을 받는다 ── */
    var need = {};
    list.forEach(function (g) {
      g._dongCands = g.dong ? idx.filter(function (c) { return c.dong === g.dong; }) : [];
      g._dongCands.forEach(function (c) { need[c.kaptCode] = 1; });
    });
    var codes = Object.keys(need);
    var INFO = {};
    var tasks = codes.map(function (kc) {
      return function () { return infoOf(kc).then(function (inf) { if (inf) INFO[kc] = inf; }); };
    });

    return pool(tasks, 5).then(function () {
      /* ── 2단계: v6 판정 ── */
      list.forEach(function (g) {
        var tradeJibun = g.jibun || kmJibunHint(g.apt) || null;
        var cj = kmParseJibun(tradeJibun);
        var tradeByr = g.byr || null;                    /* enrich 전이므로 실거래 값 */
        var qtok = kmTokens(g.apt), qs = kmStrongNorm(g.apt), qn = normName(g.apt);

        var D = { decision: 'NO_KAPT_MATCH', method: 'none', reason: null,
                  kaptCode: null, matchedName: null,
                  tradeDong: g.dong || null, kaptDong: null,
                  tradeJibun: tradeJibun, kaptJibun: null,
                  tradeBuildYear: tradeByr, useYear: null,
                  households: null, walk: null,
                  tradeTokens: qtok, kaptTokens: null,
                  tokenMatch: null, tokenConflict: null,
                  sameParcelCount: 0, sameParcelCodes: [], parcelGroupType: null,
                  poolSize: idx.length, dongPoolSize: g._dongCands.length };

        if (!idx.length) { D.reason = 'K-apt 목록 없음'; g._m6 = D; return; }
        if (!g.dong) { D.decision = 'DETAIL_MISSING'; D.reason = '실거래 법정동 없음'; g._m6 = D; return; }
        var inDong = g._dongCands;
        if (!inDong.length) { D.reason = '같은 동(' + g.dong + ') 후보 0'; g._m6 = D; return; }

        var withInfo = inDong.map(function (c) {
          var inf = INFO[c.kaptCode] || null;
          var js = inf ? kmJibunStr(inf.addr) : null;
          return { c: c, info: inf, jibunRaw: js,
                   useYear: (inf && inf.useDate && /^\d{4}/.test(inf.useDate)) ? +String(inf.useDate).slice(0, 4) : null,
                   households: inf ? (inf.households || null) : null };
        });
        var noInfo = withInfo.filter(function (x) { return !x.info; }).length;

        function scoreOne(x) {
          var cs = kmStrongNorm(x.c.name), cn = normName(x.c.name);
          var nameScore = Math.max(dice(qn, cn), dice(qs, cs), kmContain(qs, cs));
          var nameExact = (qs === cs) || (qn === cn);
          var tk = kmCmpTokens(qtok, kmTokens(x.c.name));
          var jm = kmJibunCmp(tradeJibun, x.jibunRaw);
          var yd = (tradeByr && x.useYear) ? Math.abs(tradeByr - x.useYear) : null;
          var v = nameScore + 0.15;
          if (jm === 'exact') v += 0.30; else if (jm === 'different') v -= 0.25;
          if (tk.tokenMatch) v += 0.08; else if (tk.tokenConflict) v -= 0.20;
          if (yd != null) { if (yd === 0) v += 0.05; else if (yd > 2) v -= 0.30; }
          var v2 = nameScore;
          if (tk.tokenMatch) v2 += 0.25; else if (tk.tokenConflict) v2 -= 0.35;
          if (yd === 0) v2 += 0.15; else if (yd != null && yd > 2) v2 -= 0.35;
          return { x: x, nameScore: nameScore, nameExact: nameExact, tk: tk,
                   jibunMatch: jm, yearDiff: yd,
                   conf: Math.max(0, Math.min(1, v)), conf2: Math.max(0, Math.min(1, v2)) };
        }
        function put(sc) {
          D.kaptCode = sc.x.c.kaptCode; D.matchedName = sc.x.c.name;
          D.kaptDong = sc.x.c.dong; D.kaptJibun = sc.x.jibunRaw;
          D.useYear = sc.x.useYear; D.households = sc.x.households;
          D.kaptTokens = kmTokens(sc.x.c.name);
          D.tokenMatch = sc.tk.match; D.tokenConflict = sc.tk.conflict;
          if (sc.x.info) { var w = String(sc.x.info.subwayWay || '').match(/\d+/); D.walk = w ? +w[0] : null; }
        }

        var sameParcel = cj.ok ? withInfo.filter(function (x) { return kmJibunCmp(tradeJibun, x.jibunRaw) === 'exact'; }) : [];
        D.sameParcelCount = sameParcel.length;
        D.sameParcelCodes = sameParcel.map(function (x) { return x.c.kaptCode; });

        /* ① unique parcel */
        if (sameParcel.length === 1) {
          var s1 = scoreOne(sameParcel[0]); put(s1);
          if (s1.tk.tokenConflict) { D.decision = 'DEFINITE_MISMATCH'; D.reason = '지번 일치하나 토큰 충돌: ' + s1.tk.conflict.join(','); g._m6 = D; return; }
          if (s1.yearDiff != null && s1.yearDiff > 2) { D.decision = 'UNRESOLVED_CONFLICT'; D.reason = '지번 일치하나 준공연도 차 ' + s1.yearDiff + '년'; g._m6 = D; return; }
          D.decision = 'CONFIRMED_MATCH'; D.method = 'jibun-unique'; g._m6 = D; return;
        }

        /* ② same parcel 복수 — 자동 합산 금지, 토큰으로만 좁힌다 */
        if (sameParcel.length >= 2) {
          var hhs = sameParcel.map(function (x) { return x.households; });
          var dcs = sameParcel.map(function (x) { return x.info ? x.info.dongCnt : null; });
          var ras = sameParcel.map(function (x) { return x.info ? x.info.roadAddr : null; });
          function uq(arr) { var o = []; arr.forEach(function (v) { if (o.indexOf(String(v)) < 0) o.push(String(v)); }); return o; }
          D.parcelGroupType = (uq(hhs).length === 1 && uq(dcs).length === 1 && uq(ras).length === 1)
            ? 'POSSIBLE_DUPLICATE_KAPT' : 'MULTI_COMPLEX_SAME_PARCEL';

          var cand = sameParcel.slice(), steps = [];
          if (tradeByr) {
            var byY = cand.filter(function (x) { return x.useYear != null && Math.abs(x.useYear - tradeByr) <= 1; });
            if (byY.length && byY.length < cand.length) { cand = byY; steps.push('year'); }
          }
          var pb = kmParenBrand(g.apt), tb = pb.length ? pb : kmAnyBrand(g.apt);
          if (tb.length && cand.length > 1) {
            var byB = cand.filter(function (x) { return tb.some(function (b) { return String(x.c.name).indexOf(b) >= 0; }); });
            if (byB.length && byB.length < cand.length) { cand = byB; steps.push('brand'); }
          }
          if (cand.length > 1) {
            var cmp = cand.map(function (x) { return { x: x, r: kmCmpTokens(qtok, kmTokens(x.c.name)) }; });
            var exact = cmp.filter(function (o) { return o.r.tokenMatch; });
            if (exact.length === 1) { cand = [exact[0].x]; steps.push('number'); }
          }
          var sp = cand.map(scoreOne).sort(function (a2, b2) { return b2.conf2 - a2.conf2; });
          put(sp[0]);
          if (cand.length === 1) {
            D.decision = 'CONFIRMED_MATCH'; D.method = 'parcel+' + (steps.join('+') || 'unique');
            D.reason = '동일 지번 ' + sameParcel.length + '개 중 ' + steps.join('+') + ' 으로 특정';
          } else {
            D.decision = 'AMBIGUOUS_SAME_PARCEL';
            D.reason = '같은 지번 K-apt ' + sameParcel.length + '개 · 구분 불가 · ' + D.parcelGroupType;
          }
          g._m6 = D; return;
        }

        /* ③ 지번으로 못 가림 */
        var scored = withInfo.map(scoreOne).sort(function (a2, b2) { return b2.conf - a2.conf || b2.nameScore - a2.nameScore; });
        var top = scored[0];
        put(top);
        if (!cj.ok) { D.decision = 'DETAIL_MISSING'; D.reason = '실거래 지번 없음'; g._m6 = D; return; }
        if (noInfo > 0 && top.jibunMatch === 'unknown') { D.decision = 'DETAIL_MISSING'; D.reason = '동 내 detail 미확보 ' + noInfo + '건'; g._m6 = D; return; }
        if (top.tk.tokenConflict) { D.decision = 'DEFINITE_MISMATCH'; D.reason = '토큰 충돌: ' + top.tk.conflict.join(','); g._m6 = D; return; }
        if (top.nameExact && top.yearDiff != null && top.yearDiff <= 1) {
          D.decision = 'PROBABLE_MATCH'; D.method = 'name-exact+dong';
          D.reason = 'parcel discrepancy (이름 exact · 동 일치 · 연식 ±' + top.yearDiff + ')'; g._m6 = D; return;
        }
        if (top.nameExact && top.yearDiff == null) {
          D.decision = 'PROBABLE_MATCH'; D.method = 'name-exact+dong';
          D.reason = 'parcel discrepancy (이름 exact · 동 일치 · 연식 미상)'; g._m6 = D; return;
        }
        if (top.yearDiff != null && top.yearDiff > 2 && top.nameScore < 0.60) {
          D.decision = 'DEFINITE_MISMATCH'; D.reason = '이름·지번·연식 모두 불일치'; g._m6 = D; return;
        }
        if (top.nameScore < 0.45) { D.decision = 'DEFINITE_MISMATCH'; D.reason = '이름 불일치 + 지번 불일치'; g._m6 = D; return; }
        D.decision = 'UNRESOLVED_CONFLICT';
        D.reason = '신호 충돌 · nameScore ' + top.nameScore.toFixed(2) + ' · 지번 ' + top.jibunMatch;
        g._m6 = D;
      });

      /* ── 3단계: CONFIRMED_MATCH 만 enrichment ── */
      list.forEach(function (g) {
        var D = g._m6;
        if (!D) return;
        g._match = { matchedName: D.matchedName, matchScore: null, runnerUp: null,
                     matched: D.decision === 'CONFIRMED_MATCH', method: D.method,
                     decision: D.decision, failReason: D.reason,
                     kaptListSize: D.poolSize, source: 'K-apt multi-signal v6' };
        if (D.decision !== 'CONFIRMED_MATCH') {
          /* hh·walk 는 그대로 null → aptScore 에서 중립값 55 · byr 는 실거래 값 유지 */
          g._raw = { kaptCode: null, decision: D.decision, reason: D.reason };
          return;
        }
        g.kapt = D.kaptCode;
        var inf = INFO[D.kaptCode];
        if (inf) apply(g, inf);
      });
      return list;
    });
  });
}
function apply(g, info) {
  g.hh = info.households || null;
  var w = String(info.subwayWay || '').match(/\d+/);
  g.walk = w ? +w[0] : null; g.station = info.subwayStation || '';
  if (info.useDate && /^\d{4}/.test(info.useDate)) { g.byr = +info.useDate.slice(0, 4); g.age = new Date().getFullYear() - g.byr; }
  /* K-apt 원본 응답을 진단용으로 남긴다 */
  g._raw = { households: info.households, subwayWay: info.subwayWay,
             subwayStation: info.subwayStation, useDate: info.useDate, kaptCode: g.kapt,
             addr: info.addr || null, roadAddr: info.roadAddr || null, kaptName: info.name || null,
             decision: 'CONFIRMED_MATCH' };
}
var SORT7 = { k: 'py', dir: -1 };
function sortList7(list) {
  var k = SORT7.k, d = SORT7.dir;
  return list.slice().sort(function (u, v) {
    function val(o) {
      if (k === 'apt') return o.apt;
      if (k === 'age') return o.byr || 0;
      if (k === 'gap') return (o.jeon && o.med) ? o.med - o.jeon : Infinity;
      if (k === 'jr') return (o.jeon && o.med) ? o.jeon / o.med * 100 : -Infinity;
      return o[k] == null ? -Infinity : o[k];
    }
    var a1 = val(u), b1 = val(v);
    if (typeof a1 === 'string') return a1.localeCompare(b1) * d;
    return (a1 - b1) * d;
  });
}
function bindSort7() {
  el('t7').querySelectorAll('th[data-s]').forEach(function (th) {
    th.classList.toggle('sorted', SORT7.k === th.dataset.s);
    th.setAttribute('data-dir', SORT7.k === th.dataset.s ? (SORT7.dir < 0 ? 'desc' : 'asc') : '');
    if (th.dataset.bound) return;
    th.dataset.bound = '1';
    th.addEventListener('click', function () {
      if (SORT7.k === th.dataset.s) SORT7.dir *= -1; else { SORT7.k = th.dataset.s; SORT7.dir = -1; }
      draw7(LAST7);
    });
  });
}
function draw7(list) {
  var tb = el('t7').tBodies[0]; tb.innerHTML = '';
  bindSort7();
  if (!list.length) { tb.innerHTML = '<tr><td colspan="13" class="empty">조건을 만족하는 단지가 없습니다.</td></tr>'; return; }
  sortList7(list).forEach(function (g, gi) {
    var gap = g.jeon ? g.med - g.jeon : null, tr = document.createElement('tr');
    tr.className = 'clickable'; tr.dataset.gi = gi;
    tr.innerHTML = '<td class="nm">' + esc(deent(g.apt)) + (g.hh >= 1000 ? ' <span class="b ok">대단지</span>' : '') +
      '<span class="exp-ind">▾ 실거래</span></td>' +
      '<td>' + g.bucket + '</td><td>' + won(g.lastAmt) + '</td><td style="font-weight:700">' + n0(g.py) + '</td>' +
      '<td>' + (g.hh ? n0(g.hh) : '—') + '</td><td>' + (g.byr ? g.byr + ' (' + g.age + '년)' : '—') + '</td>' +
      '<td>' + (g.walk != null ? '도보 ' + g.walk + '분' : (g.station ? esc(g.station) : '—')) + '</td>' +
      '<td>' + (g.jeon ? won(g.jeon) : '—') + '</td>' +
      '<td>' + (g.jeon ? n1(g.jeon / g.med * 100) + '%' : '—') + '</td>' +
      '<td>' + (gap != null ? won(gap) : '—') + '</td>' +
      '<td>' + pct10Cell(g.g10) + '</td>' +
      '<td>' + g.sale.length + '건</td>' +
      '<td><button class="btn ghost sm" data-cart="' + gi + '">담기</button></td>';
    tb.appendChild(tr);
    var dr = document.createElement('tr');
    dr.className = 'txrow'; dr.hidden = true;
    dr.innerHTML = '<td colspan="13"><div class="txbox" data-box="' + gi + '"></div></td>';
    tb.appendChild(dr);
    tr.addEventListener('click', function (e) {
      if (e.target.closest('[data-cart]')) return;
      dr.hidden = !dr.hidden;
      if (!dr.hidden && !dr.dataset.done) { dr.querySelector('.txbox').innerHTML = txTable(g); dr.dataset.done = '1'; }
    });
    tr.querySelector('[data-cart]').addEventListener('click', function (e) {
      e.stopPropagation();
      var rg = BY[el('rg5').value];
      var okAdd = cartAdd({ key: rg.code + ':' + g.apt + ':' + g.bucket, code: rg.code, region: rg.name,
        apt: deent(g.apt), bucket: g.bucket, med: g.med, jeon: g.jeon || null, py: g.py, area: g.area,
        hh: g.hh || null, walk: g.walk == null ? null : g.walk, byr: g.byr || null, g10: g.g10 == null ? null : g.g10 });
      e.target.textContent = okAdd ? '담김 ✓' : '이미 담김';
      e.target.disabled = true;
    });
  });
}
function txTable(g) {
  var tx = g.tx.slice().sort(function (a, b) { return (b.ym * 100 + b.day) - (a.ym * 100 + a.day); });
  var asc = tx.slice().reverse(), hi = 0, flag = {};
  asc.forEach(function (t, i) { if (i > 0 && t.amt > hi) flag[t.ym + '_' + t.day + '_' + t.amt + '_' + t.floor] = 1; if (t.amt > hi) hi = t.amt; });
  var h = '<div style="font-weight:700;margin-bottom:10px">' + esc(g.apt) + ' · ' + g.bucket +
    ' 실거래 ' + tx.length + '건 <span style="color:var(--slate);font-weight:450">(최신순)</span></div>' +
    '<div style="overflow-x:auto"><table><thead><tr><th>계약월</th><th>전용</th><th>층</th><th>거래금액</th><th>평당가</th></tr></thead><tbody>';
  tx.slice(0, 24).forEach(function (t) {
    var k = t.ym + '_' + t.day + '_' + t.amt + '_' + t.floor;
    h += '<tr><td>' + ymL(t.ym) + '.' + String(t.day).padStart(2, '0') + '</td>' +
      '<td>' + t.area.toFixed(1) + '㎡</td><td>' + t.floor + '층</td>' +
      '<td style="font-weight:700">' + won(t.amt) + (flag[k] ? ' <span class="b warn">신고가</span>' : '') + '</td>' +
      '<td>' + n0(t.amt / t.area * PY) + '만</td></tr>';
  });
  h += '</tbody></table></div>';
  if (g.past) h += '<div style="font-size:13.5px;margin-top:10px">10년 전(' + ymL(pastYm(10, 1)[0]) +
    ' 전후) 평당 <b>' + n0(g.past) + '만</b> → 현재 <b>' + n0(g.py) + '만</b> · 10년 상승률 <b>' +
    (g.g10 > 0 ? '+' : '') + n1(g.g10) + '%</b> ' +
    (g.g10 >= 100 ? '<span class="b ok">합격</span>' : '<span class="b no">미달</span>') + '</div>';
  if (tx.length > 24) h += '<div style="font-size:12px;color:var(--slate);margin-top:8px">최근 24건만 표시</div>';
  return h;
}
function img7() {
  if (!LAST7.length) return;
  var r = BY[el('rg5').value];
  exportPNG({
    title: r.name + ' 투자 가능 단지',
    sub: '국토부 실거래 · ' + el('mo5').value + '개월 · ' + el('ar5').value + (el('ar5').value === 'all' ? '' : '㎡대') +
      ' · 세대수 ' + el('hh5').value + '↑',
    headers: ['단지', '평형', '실거래', '평당가', '전세', '갭', '10년'],
    weights: [2.5, .85, 1.15, 1.05, 1.15, 1.15, 1.05],
    bold: [3], grade: [6],
    rows: LAST7.map(function (g) {
      return [g.apt, g.bucket, won(g.med), n0(g.py) + '만', g.jeon ? won(g.jeon) : '—',
        g.jeon ? won(g.med - g.jeon) : '—', g.g10 == null ? '—' : (g.g10 > 0 ? '+' : '') + n1(g.g10) + '%'];
    }),
    max: 16,
    note: '10년 상승률 100% 이상이 초록 · 실거래 중위값 기준 · 평당가는 전용면적 기준',
    file: 'topdown_complex'
  });
}

/* ══════════ 시장 현황 (국토부 실거래 연도별 지수) ══════════ */
var KIY = (typeof KBI !== 'undefined') ? KBI.years : [];
var KIR = (typeof KBI !== 'undefined') ? KBI.regions.map(function (r) {
  return { name: r.n, sido: r.sd, kind: r.k,
    s: r.s.split(',').map(function (v) { return v === '' ? null : +v; }),
    j: r.j.split(',').map(function (v) { return v === '' ? null : +v; }) };
}) : [];
var MK_KIND = 'sale', MK_SPAN = 'all', chartMk1 = null, chartMk2 = null, LASTMK = null;

function firstIdx(a) { for (var i = 0; i < a.length; i++) if (a[i] != null) return i; return -1; }
function cagrIdx(a, i0, i1) {
  var v0 = a[i0], v1 = a[i1]; if (!v0 || !v1 || i1 <= i0) return null;
  return (Math.pow(v1 / v0, 1 / (KIY[i1] - KIY[i0])) - 1) * 100;
}
function yearlyChg(a) {
  var o = [];
  for (var i = 1; i < a.length; i++) o.push((a[i] != null && a[i - 1]) ? (a[i] / a[i - 1] - 1) * 100 : null);
  return o;
}
function mkRegion() {
  var v = el('mkReg').value;
  return KIR[+v] || KIR[0];
}
function renderMarket() {
  if (!KIR.length) { el('mkKpi').innerHTML = '<div class="empty">지수 데이터를 불러오지 못했습니다. market-data.js를 확인하세요.</div>'; return; }
  var r = mkRegion();
  var S = r.s, J = r.j;
  var f = firstIdx(S), lastI = S.length - 1;
  var span = MK_SPAN === 'all' ? f : Math.max(f, lastI - (+MK_SPAN));
  var yEnd = KIY[lastI];

  var cAll = cagrIdx(S, f, lastI), c10 = cagrIdx(S, Math.max(f, lastI - 10), lastI);
  var c20 = cagrIdx(S, Math.max(f, lastI - 20), lastI);
  var jAll = cagrIdx(J, firstIdx(J), lastI);
  var mult = (S[f] && S[lastI]) ? S[lastI] / S[f] : null;
  var yc = yearlyChg(S);
  var best = null, worst = null;
  yc.forEach(function (v, i) {
    if (v == null) return;
    if (!best || v > best[1]) best = [KIY[i + 1], v];
    if (!worst || v < worst[1]) worst = [KIY[i + 1], v];
  });

  el('mkKpi').innerHTML =
    '<div class="kpi hero big"><span class="lb">' + esc(r.name) + ' 매매 · 장기 연복리</span>' +
      '<span class="vl">' + (cAll == null ? '—' : n1(cAll) + '%') + '</span>' +
      '<span class="sb">' + KIY[f] + '~' + yEnd + ' (' + (yEnd - KIY[f]) + '년) · 누적 ' +
      (mult ? n1(mult) + '배' : '—') + '</span></div>' +
    '<div class="kpi good big"><span class="lb">최근 10년 연복리</span><span class="vl">' +
      (c10 == null ? '—' : n1(c10) + '%') + '</span><span class="sb">' + (yEnd - 10) + '~' + yEnd + ' · 누적 ' +
      (S[lastI - 10] ? '+' + n1((S[lastI] / S[lastI - 10] - 1) * 100) + '%' : '—') + '</span></div>' +
    '<div class="kpi sig big"><span class="lb">전세 장기 연복리</span><span class="vl">' +
      (jAll == null ? '—' : n1(jAll) + '%') + '</span><span class="sb">같은 기간 전세지수 기준</span></div>';

  /* 차트 1 — 연도별 상승률 */
  var labels = [], barS = [], barJ = [];
  for (var i = Math.max(1, span); i <= lastI; i++) {
    labels.push(String(KIY[i]).slice(2));
    barS.push((S[i] != null && S[i - 1]) ? +((S[i] / S[i - 1] - 1) * 100).toFixed(2) : null);
    barJ.push((J[i] != null && J[i - 1]) ? +((J[i] / J[i - 1] - 1) * 100).toFixed(2) : null);
  }
  var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var ember = getComputedStyle(document.documentElement).getPropertyValue('--ember').trim();
  var ice = getComputedStyle(document.documentElement).getPropertyValue('--m4').trim();
  if (chartMk1) chartMk1.destroy();
  chartMk1 = new Chart(el('cMk1').getContext('2d'), {
    type: 'bar',
    data: { labels: labels, datasets: [
      { label: '매매 (막대)', data: barS, order: 2,
        backgroundColor: barS.map(function (v) { return v >= 0 ? ice : '#C24A2E'; }), borderRadius: 4 },
      { label: '전세 (선)', data: barJ, type: 'line', order: 1, borderColor: ember, borderWidth: 2.6,
        pointRadius: 2.5, pointBackgroundColor: ember, pointBorderColor: '#fff', pointBorderWidth: 1,
        tension: .25, fill: false } ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 14, usePointStyle: true, font: { size: 13 } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 20 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 }, callback: function (v) { return v + '%'; } } } } }
  });

  /* 차트 2 — 지수 추이 */
  var l2 = [], d2 = [], d2j = [];
  for (var k = Math.max(0, span); k <= lastI; k++) {
    l2.push(String(KIY[k]).slice(2)); d2.push(S[k]); d2j.push(J[k]);
  }
  if (chartMk2) chartMk2.destroy();
  chartMk2 = new Chart(el('cMk2').getContext('2d'), {
    type: 'line',
    data: { labels: l2, datasets: [
      { label: '매매지수', data: d2, borderColor: ink, borderWidth: 2.2, pointRadius: 0, tension: .15 },
      { label: '전세지수', data: d2j, borderColor: ice, borderWidth: 2, pointRadius: 0, tension: .15, borderDash: [5, 4] } ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 12, font: { size: 12 } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 16 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 } } } } }
  });

  /* 연도별 표 */
  var tb = el('tMkY').tBodies[0]; tb.innerHTML = '';
  var rowsY = [];
  for (var q = lastI; q >= Math.max(1, span); q--) {
    var sc = (S[q] != null && S[q - 1]) ? (S[q] / S[q - 1] - 1) * 100 : null;
    var jc = (J[q] != null && J[q - 1]) ? (J[q] / J[q - 1] - 1) * 100 : null;
    var jr = (S[q] && J[q]) ? J[q] / S[q] : null;
    rowsY.push({ y: KIY[q], sc: sc, jc: jc, idx: S[q], jidx: J[q] });
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="nm">' + KIY[q] + (q === lastI ? ' <span class="b no">' + ymL(KBI.dates[KBI.dates.length - 1]) + '까지</span>' : '') + '</td>' +
      '<td style="font-weight:700;color:' + (sc == null ? 'var(--slate)' : sc >= 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(sc) + '</td>' +
      '<td style="color:' + (jc == null ? 'var(--slate)' : jc >= 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(jc) + '</td>' +
      '<td>' + (S[q] == null ? '—' : n1(S[q])) + '</td><td>' + (J[q] == null ? '—' : n1(J[q])) + '</td>';
    tb.appendChild(tr);
  }

  /* 2년 단위 표 */
  var tb2 = el('tMk2').tBodies[0]; tb2.innerHTML = '';
  var rows2 = [], cumList = [], jcumList = [];
  for (var z = lastI; z - 2 >= Math.max(f, span - 1); z -= 2) {
    var a0 = S[z - 2], a1 = S[z], b0 = J[z - 2], b1 = J[z];
    if (!a0 || !a1) continue;
    var cum = (a1 / a0 - 1) * 100;
    var y1 = (S[z - 1] && a0) ? (S[z - 1] / a0 - 1) * 100 : null;
    var y2 = (S[z - 1] && a1) ? (a1 / S[z - 1] - 1) * 100 : null;
    var arith = (y1 != null && y2 != null) ? y1 + y2 : null;
    var ann = (Math.pow(a1 / a0, 1 / 2) - 1) * 100;
    var jcum = (b0 && b1) ? (b1 / b0 - 1) * 100 : null;
    var jann = (b0 && b1) ? (Math.pow(b1 / b0, 1 / 2) - 1) * 100 : null;
    rows2.push({ p: KIY[z - 2] + '~' + KIY[z], cum: cum, arith: arith, ann: ann, jcum: jcum, jann: jann });
    cumList.push(cum); if (jcum != null) jcumList.push(jcum);
    var tr2 = document.createElement('tr');
    if (cum >= 20) tr2.className = 'pick';
    tr2.innerHTML = '<td class="nm">' + KIY[z - 2] + '~' + KIY[z] + '</td>' +
      '<td style="font-weight:700;color:' + (cum >= 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(cum) + '</td>' +
      '<td>' + fmtPct(arith) + '</td>' +
      '<td>' + fmtPct(jcum) + '</td>' +
      '<td>' + (jcum == null || cum == null ? '—' : '<span style="color:' + (cum - jcum >= 0 ? 'var(--good)' : '#B24A32') + '">' +
        ((cum - jcum) >= 0 ? '+' : '') + n1(cum - jcum) + '%p</span>') + '</td>';
    tb2.appendChild(tr2);
  }
  var avg2 = cumList.length ? cumList.reduce(function (u, v) { return u + v; }, 0) / cumList.length : null;
  var med2 = median(cumList);
  var javg2 = jcumList.length ? jcumList.reduce(function (u, v) { return u + v; }, 0) / jcumList.length : null;
  var pos2 = cumList.filter(function (v) { return v > 0; }).length;
  el('mk2sum').innerHTML =
    kpi('2년 수익률 평균 (매매)', avg2 == null ? '—' : fmtPct(avg2), cumList.length + '개 구간 평균', 'good') +
    kpi('2년 수익률 중위 (매매)', med2 == null ? '—' : fmtPct(med2), '극단값 영향 제거', '') +
    kpi('2년 수익률 평균 (전세)', javg2 == null ? '—' : fmtPct(javg2), jcumList.length + '개 구간 평균', 'sig') +
    kpi('플러스 구간', pos2 + ' / ' + cumList.length, '2년 보유 시 수익 난 비율 ' +
      (cumList.length ? Math.round(pos2 / cumList.length * 100) : 0) + '%', '');

  LASTMK = { r: r, rowsY: rowsY, rows2: rows2, cAll: cAll, c10: c10, c20: c20, mult: mult,
    best: best, worst: worst, f: f, lastI: lastI, avg2: avg2, med2: med2, javg2: javg2,
    pos2: pos2, nSeg: cumList.length };

  /* 해석 */
  var L = [];
  if (cAll != null) L.push('<span class="hl">' + esc(r.name) + '</span> 아파트 매매지수는 ' + KIY[f] + '년 이후 ' +
    (yEnd - KIY[f]) + '년간 <span class="hl">' + n1(mult) + '배</span>, 연복리 <span class="hl">' + n1(cAll) + '%</span>입니다.');
  if (best && worst) L.push('가장 크게 오른 해는 <span class="up">' + best[0] + '년 ' + fmtPct(best[1]) +
    '</span>, 가장 크게 빠진 해는 <span class="dn">' + worst[0] + '년 ' + fmtPct(worst[1]) + '</span>입니다.');
  if (c10 != null && cAll != null) L.push('최근 10년 연복리는 <span class="hl">' + n1(c10) + '%</span>로 장기 평균 대비 ' +
    (c10 >= cAll ? '<span class="up">높습니다</span>' : '<span class="dn">낮습니다</span>') + ' (' +
    (c10 - cAll >= 0 ? '+' : '') + n1(c10 - cAll) + '%p).');
  var neg = yc.filter(function (v) { return v != null && v < 0; }).length;
  var tot = yc.filter(function (v) { return v != null; }).length;
  if (tot) L.push('전체 ' + tot + '개 연도 중 하락한 해는 <span class="hl">' + neg + '번</span>(' +
    Math.round(neg / tot * 100) + '%)입니다. 나머지 ' + (tot - neg) + '년은 상승했습니다.');
  if (jAll != null && cAll != null) L.push('같은 기간 전세는 연복리 ' + n1(jAll) + '% — 매매보다 ' +
    (cAll > jAll ? n1(cAll - jAll) + '%p 낮습니다. 그 차이가 곧 <b>기대가 값에 실린 정도</b>입니다.'
      : n1(jAll - cAll) + '%p 높습니다. 실사용 가치가 더 빠르게 오른 구간입니다.'));
  el('mkIns').innerHTML = '<h4>이 시장 읽기</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}
