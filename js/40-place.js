'use strict';

/* ── 동별 4분면 (실거래 기반) ── */
function runQuadDong() {
  var code = el('qdReg').value, mode = el('qdArea').value;
  var r = BY[code], st = el('qdStat'), btn = el('qdRun');
  if (!r) return;
  btn.disabled = true; st.textContent = r.name + ' 읍면동 실거래 불러오는 중…';
  show('pq');
  var months = ymList(12).slice().reverse();
  var tasks = [];
  months.forEach(function (ym) {
    tasks.push(function () { return getTr(code, ym, 'sale').then(function (d) { return { ym: ym, k: 's', d: d }; }); });
    tasks.push(function () { return getTr(code, ym, 'rent').then(function (d) { return { ym: ym, k: 'j', d: d }; }); });
  });
  pool(tasks, 8).then(function (res) {
    var recent = months.slice(-3), prior = months.slice(-9, -3);
    function inSet(ym, set) { return set.indexOf(ym) >= 0; }
    var G = {};
    res.forEach(function (x) {
      if (!x || !x.d || !x.d.items) return;
      x.d.items.forEach(function (t) {
        if (!areaPass(t.area, mode)) return;
        if (x.k === 's' && t.canceled) return;
        if (x.k === 'j' && !t.jeonse) return;
        var dn = t.dong || '기타';
        var g = G[dn] || (G[dn] = { s0: [], s1: [], j0: [], j1: [], n: 0 });
        var py = (x.k === 's' ? t.amount : t.deposit) / t.area * PY;
        if (inSet(x.ym, recent)) { if (x.k === 's') { g.s1.push(py); g.n++; } else g.j1.push(py); }
        else if (inSet(x.ym, prior)) { if (x.k === 's') g.s0.push(py); else g.j0.push(py); }
      });
    });
    var pts = Object.keys(G).map(function (dn) {
      var g = G[dn];
      if (g.s0.length < 3 || g.s1.length < 3) return null;
      var s0 = median(g.s0), s1 = median(g.s1);
      var j0 = median(g.j0), j1 = median(g.j1);
      var sc = (s0 && s1) ? (s1 / s0 - 1) * 100 : null;
      var jc = (j0 && j1) ? (j1 / j0 - 1) * 100 : null;
      return { dong: dn, s: sc, j: jc, py: s1, jr: (s1 && j1) ? j1 / s1 * 100 : null, n: g.n, q: quadOf(sc, jc) };
    }).filter(function (x) { return x && x.s != null; }).sort(function (u, v) { return v.s - u.s; });
    QDONG = { r: r, pts: pts };
    drawQuadDong();
    btn.disabled = false;
  });
}
function drawQuadDong() {
  if (!QDONG) return;
  var pts = QDONG.pts, r = QDONG.r;
  el('qdTitle').textContent = r.name + ' 읍면동 4분면';
  if (!pts.length) { el('qdStat').textContent = '거래가 충분한 읍면동이 없습니다. 평형을 전체로 바꿔보세요.'; return; }
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var inkC = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  var mxP = Math.max.apply(null, pts.map(function (p) { return p.py; })) || 1;
  var data = pts.map(function (p) {
    return { x: +p.s.toFixed(2), y: p.j == null ? 0 : +p.j.toFixed(2), r: 9 + Math.sqrt(p.py / mxP) * 16, nm: p.dong, q: p.q };
  });
  if (chartQD) chartQD.destroy();
  chartQD = new Chart(el('cQuadD').getContext('2d'), {
    type: 'bubble',
    data: { datasets: [{ data: data,
      backgroundColor: data.map(function (d) { return d.q.c + '55'; }),
      borderColor: data.map(function (d) { return d.q.c; }), borderWidth: 1.6 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: function (t) {
          var d = t.raw; return d.nm + ' · 매매 ' + (d.x > 0 ? '+' : '') + d.x + '% · 전세 ' + (d.y > 0 ? '+' : '') + d.y + '%'; } } } },
      scales: { x: { title: { display: true, text: '매매 평당가 변화율 (%)', font: { size: 12 } }, grid: { color: lineC } },
        y: { title: { display: true, text: '전세 평당가 변화율 (%)', font: { size: 12 } }, grid: { color: lineC } } } },
    plugins: [{
      id: 'zl2',
      beforeDatasetsDraw: function (c) {
        var x = c.scales.x, y = c.scales.y, ctx = c.ctx;
        ctx.save(); ctx.strokeStyle = lineC; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(x.getPixelForValue(0), y.top); ctx.lineTo(x.getPixelForValue(0), y.bottom);
        ctx.moveTo(x.left, y.getPixelForValue(0)); ctx.lineTo(x.right, y.getPixelForValue(0)); ctx.stroke(); ctx.restore();
      },
      afterDatasetsDraw: function (c) {
        var ctx = c.ctx, meta = c.getDatasetMeta(0);
        ctx.save(); ctx.font = "600 11px 'Pretendard Variable',Pretendard,sans-serif";
        ctx.fillStyle = inkC; ctx.textAlign = 'center';
        meta.data.forEach(function (pt, i) { ctx.fillText(data[i].nm, pt.x, pt.y + 4); });
        ctx.restore();
      }
    }]
  });
  var tb = el('tQuadD').tBodies[0]; tb.innerHTML = '';
  pts.forEach(function (p) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="nm">' + esc(p.dong) + '</td>' +
      '<td style="font-weight:700;color:' + (p.s > 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(p.s) + '</td>' +
      '<td style="color:' + (p.j == null ? 'var(--slate)' : p.j > 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(p.j) + '</td>' +
      '<td><span class="b" style="background:' + p.q.c + '22;color:' + p.q.c + '">' + p.q.t + '</span></td>' +
      '<td>' + n0(p.py) + '만</td><td>' + (p.jr ? n1(p.jr) + '%' : '—') + '</td><td>' + p.n + '건</td>';
    tb.appendChild(tr);
  });
  el('qdStat').textContent = pts.length + '개 읍면동 · 최근 3개월 vs 직전 6개월 평당가 비교';
  el('qdWrap').hidden = false;
}
function imgQuad() {
  if (!LASTQ.length) return;
  exportPNG({
    title: QSIDO + ' 매매·전세 4분면',
    sub: '실거래 평당 가격 ' + QMO + '개월 변화율 기준',
    headers: ['지역', '매매', '전세', '국면', '평당가', '전세가율'],
    weights: [2.3, 1.1, 1.1, 1.3, 1.15, 1.05],
    signed: [1, 2],
    rows: LASTQ.map(function (p) {
      return [p.r.name, fmtPct(p.s), fmtPct(p.j), p.q.t, n0(p.py) + '만', n1(p.jr) + '%'];
    }),
    max: 16,
    note: '매매↑전세↑ 동반 상승 · 매매↑전세↓ 매매 주도(갭 확대) · 매매↓전세↑ 전세 주도(갭 축소) · 매매↓전세↓ 동반 하락',
    file: 'quadrant'
  });
}

/* ══════════ 수급 (입주물량 · 수요 · 미분양) ══════════ */
var SUPOK = (typeof SUP !== 'undefined');
/** 미분양 시계열 — 최신값·12개월 전·추세 */
function unsSeriesOf(name) {
  if (!SUP.unsSeries) return null;
  var arr = SUP.unsSeries[name];
  if (!arr) return null;
  var ms = SUP.unsMonths, last = null, li = -1;
  for (var i = arr.length - 1; i >= 0; i--) { if (arr[i] != null) { last = arr[i]; li = i; break; } }
  if (last == null) return null;
  var prev = null;
  for (var j = li - 12; j >= 0 && j > li - 18; j--) { if (arr[j] != null) { prev = arr[j]; break; } }
  return { arr: arr, months: ms, last: last, at: ms[li], prev: prev,
    chg: prev ? (last / prev - 1) * 100 : null };
}
var SUP_SIDO = '전국', SUP_YEARS = 20, chartS1 = null, chartS2 = null, LASTS = null;
/** 전국 집계 (시도 합산) */
var chartU = null;
function drawUnsChart(sd) {
  var us;
  if (sd === '전국') {
    /* 전국은 시도 합산 */
    var sum = null, ms0 = SUP.unsMonths;
    Object.keys(SUP.unsSeries).forEach(function (k) {
      if (k.indexOf('SIDO:') !== 0) return;
      var ar = SUP.unsSeries[k];
      if (!sum) sum = ar.map(function () { return null; });
      ar.forEach(function (v, i) { if (v != null) sum[i] = (sum[i] || 0) + v; });
    });
    if (sum) {
      var li2 = -1;
      for (var q = sum.length - 1; q >= 0; q--) if (sum[q] != null) { li2 = q; break; }
      var pv = null;
      for (var w = li2 - 12; w >= 0 && w > li2 - 18; w--) if (sum[w] != null) { pv = sum[w]; break; }
      us = { arr: sum, months: ms0, last: sum[li2], at: ms0[li2], prev: pv,
        chg: pv ? (sum[li2] / pv - 1) * 100 : null };
    }
  } else us = unsSeriesOf('SIDO:' + sd);
  var box = el('unsBox');
  if (!us) { box.hidden = true; return; }
  box.hidden = false;
  var ms = us.months, arr = us.arr;
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var ember = getComputedStyle(document.documentElement).getPropertyValue('--ember').trim();
  var labels = ms.map(function (m) { return m.slice(0, 4) + '.' + m.slice(4); });
  if (chartU) chartU.destroy();
  chartU = new Chart(el('cUns').getContext('2d'), {
    type: 'line',
    data: { labels: labels, datasets: [{ label: '미분양 (호)', data: arr, borderColor: ember,
      backgroundColor: ember + '22', borderWidth: 2.4, pointRadius: 0, tension: .25, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 12 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 }, callback: function (v) { return n0(v); } } } } }
  });
  var mx = Math.max.apply(null, arr.filter(function (v) { return v != null; }));
  var mi = Math.min.apply(null, arr.filter(function (v) { return v != null; }));
  el('unsIns').innerHTML = '<h4>미분양 읽기</h4><ul>' +
    '<li>' + esc(sd) + ' 미분양은 ' + ymL(+us.at) + ' 기준 <span class="hl">' + n0(us.last) + '호</span>입니다. ' +
      (us.chg != null ? '1년 전 대비 <span class="' + (us.chg > 0 ? 'dn' : 'up') + '">' + fmtPct(us.chg) + '</span>.' : '') + '</li>' +
    '<li>최근 11년 최고 ' + n0(mx) + '호 · 최저 ' + n0(mi) + '호. 지금은 그 사이 ' +
      Math.round((us.last - mi) / (mx - mi) * 100) + '% 지점입니다.</li>' +
    '<li><b>미분양은 매매에 먼저 옵니다.</b> 시군구 92곳을 같은 달 안에서 비교하면, 미분양이 많을수록 이후 1년 매매가 눌리는 관계가 ' +
      '<b>10번 중 8번</b> 나타났습니다(급지를 통제해도 10번 중 7번). 입주물량이 전세를 먼저 누르는 것과 대비됩니다.</li>' +
    '<li>영향이 <b>2년 뒤까지 이어집니다</b>. 입주물량은 2년이면 사라지는데, 미분양은 24개월 뒤에도 관계가 남았습니다 — ' +
      '안 팔린 재고가 그만큼 오래 시장을 누른다는 뜻입니다.</li></ul>';
}
function supNation() {
  var mon = {}, pop = { p: 0, h: 0 }, uns = 0;
  Object.keys(SUP.sido).forEach(function (sd) {
    Object.keys(SUP.sido[sd]).forEach(function (k) { mon[k] = (mon[k] || 0) + SUP.sido[sd][k]; });
  });
  Object.keys(SUP.popSido).forEach(function (sd) {
    if (sd === '전국') return;
    pop.p += SUP.popSido[sd].p; pop.h += SUP.popSido[sd].h;
  });
  if (SUP.popSido['전국']) pop = SUP.popSido['전국'];
  Object.keys(SUP.unsoldSido).forEach(function (sd) {
    if (sd === '전국' || sd === '수도권' || sd === '지방') return;
    uns += SUP.unsoldSido[sd];
  });
  if (SUP.unsoldSido['전국'] != null) uns = SUP.unsoldSido['전국'];
  return { mon: mon, pop: pop, uns: uns };
}
/** 해당 시도의 KB 매매가격지수 (연말 기준) */
function priceIndexOf(sd) {
  var r = KIR.filter(function (x) { return x.name === sd; })[0];
  return r ? r.s : null;
}
var DEMAND_RATE = 0.005;  /* 연간 주택 수요 = 인구 × 0.5% (업계 관행 가정) */
function supYms(n) {
  var o = [], d = new Date();
  for (var i = 0; i < n; i++) {
    var y = d.getFullYear(), m = d.getMonth() + 1 + i;
    while (m > 12) { m -= 12; y++; }
    o.push(String(y) + String(m).padStart(2, '0'));
  }
  return o;
}
function supSum(map, yms) {
  if (!map) return 0;
  return yms.reduce(function (a, k) { return a + (map[k] || 0); }, 0);
}
function renderSup() {
  if (!SUPOK) { el('supKpi').innerHTML = '<div class="empty">supply-data.js를 불러오지 못했습니다.</div>'; return; }
  var sd = SUP_SIDO;
  var nat = sd === '전국' ? supNation() : null;
  var pop = nat ? nat.pop : SUP.popSido[sd], unsold = nat ? nat.uns : SUP.unsoldSido[sd];
  var demand = pop ? pop.p * DEMAND_RATE : null;   /* 연간 수요 세대 */
  var mon = nat ? nat.mon : (SUP.sido[sd] || {});
  var yms = Object.keys(mon).sort();
  var y12 = supSum(mon, supYms(12)), y24 = supSum(mon, supYms(24));

  /* 연도별 집계 */
  var byYear = {};
  yms.forEach(function (k) { var y = k.slice(0, 4); byYear[y] = (byYear[y] || 0) + mon[k]; });
  var years = Object.keys(byYear).sort();

  el('supKpi').innerHTML =
    '<div class="kpi hero"><span class="lb">' + esc(sd) + ' 향후 12개월 입주물량</span><span class="vl">' +
      n0(y12) + '세대</span><span class="sb">24개월 누적 ' + n0(y24) + '세대</span></div>' +
    kpi('연간 추정 수요', demand == null ? '—' : n0(demand) + '세대',
        pop ? '인구 ' + n0(pop.p) + '명 × 0.5% 가정' : '', '') +
    kpi('시도 수급 배율', (demand && y12) ? (y12 / demand).toFixed(2) + '배' : '—',
        '입주물량 ÷ 추정 수요 · 1.0 초과면 공급 우위',
        (demand && y12 / demand > 1.2) ? 'sig' : 'good') +
    kpi('준공후 미분양 (' + (SUP.unsoldMonth || '') + ')', unsold == null ? '—' : n0(unsold) + '호',
        pop ? '세대수 대비 ' + (unsold / pop.h * 100).toFixed(3) + '%' : '', unsold > 3000 ? 'sig' : '');

  /* 차트 1 — 연도별 입주물량 vs 수요 */
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var ice = getComputedStyle(document.documentElement).getPropertyValue('--m4').trim();
  var ember = getComputedStyle(document.documentElement).getPropertyValue('--ember').trim();
  /* x축 — 가격 지수가 있는 과거 + 입주물량이 있는 미래 */
  var supMaxY = years.length ? +years[years.length - 1] : new Date().getFullYear();
  var endY = supMaxY;
  var startY = endY - SUP_YEARS + 1;
  var xs = [];
  for (var yy = startY; yy <= endY; yy++) xs.push(String(yy));
  var doneY = (SUP.done && SUP.done[sd]) ? SUP.done[sd] : null;
  var partialY = SUP.donePartial || null;
  var pIdx = priceIndexOf(sd);
  var priceLine = xs.map(function (y) {
    if (!pIdx) return null;
    var i = KIY.indexOf(+y);
    return i >= 0 && pIdx[i] != null ? +pIdx[i].toFixed(1) : null;
  });
  var ink2 = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  if (chartS1) chartS1.destroy();
  chartS1 = new Chart(el('cSup1').getContext('2d'), {
    type: 'bar',
    data: { labels: xs, datasets: [
      { label: '준공 실적 (아파트, 호)', data: xs.map(function (y) { return doneY && doneY[y] ? doneY[y] : null; }),
        backgroundColor: xs.map(function (y) { return y === partialY ? ice + '66' : ice; }),
        borderRadius: 4, order: 4, yAxisID: 'y' },
      { label: '입주 예정 (세대)', data: xs.map(function (y) { return byYear[y] || null; }),
        backgroundColor: ember, borderRadius: 4, order: 3, yAxisID: 'y' },
      { label: '연간 추정 수요', data: xs.map(function () { return demand ? Math.round(demand) : null; }),
        type: 'line', borderColor: '#B24A32', borderWidth: 2.2, pointRadius: 0, borderDash: [6, 4],
        tension: 0, order: 2, yAxisID: 'y' },
      { label: '매매가격지수 (우축)', data: priceLine, type: 'line', borderColor: ink2, borderWidth: 2.6,
        pointRadius: 0, tension: .2, order: 1, yAxisID: 'y2' } ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 14, usePointStyle: true, font: { size: 12.5 } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 22 } },
        y: { position: 'left', grid: { color: lineC }, title: { display: true, text: '공급 (호·세대)', font: { size: 11 } },
          ticks: { font: { size: 11 }, callback: function (v) { return n0(v); } } },
        y2: { position: 'right', grid: { display: false }, title: { display: true, text: '매매가격지수', font: { size: 11 } },
          ticks: { font: { size: 11 } } } } }
  });

  /* 차트 2 — 월별 */
  if (chartS2) chartS2.destroy();
  chartS2 = new Chart(el('cSup2').getContext('2d'), {
    type: 'bar',
    data: { labels: yms.map(function (k) { return k.slice(2, 4) + '.' + k.slice(4); }),
      datasets: [{ label: '월별 입주물량', data: yms.map(function (k) { return mon[k]; }),
        backgroundColor: ice, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 14 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 } } } } }
  });

  /* 시군구 표 */
  var tb = el('tSup').tBodies[0]; tb.innerHTML = '';
  var y12k = supYms(12), y24k = supYms(24);
  var list = allRegions().filter(function (r) { return sd === '전국' ? !!SUP.sgg[r.code] : r.sido === sd; })
    .map(function (r) {
      var m = SUP.sgg[r.code], pp = SUP.pop[r.code], un = SUP.unsold[r.code];
      var a = supSum(m, y12k), b = supSum(m, y24k);
      var dem = pp ? pp.p * DEMAND_RATE : null;
      var sa = supArea(r.code);
      return { r: r, m: m, a: a, b: b, pop: pp, dem: dem, sa: sa,
        ratio: (dem && dem > 0) ? a / dem : null,
        aratio: sa ? sa.ratio : null, un: un == null ? null : un,
        unr: (un != null && pp && pp.h) ? un / pp.h * 100 : null };
    }).sort(function (u, v) { return (v.aratio == null ? -1 : v.aratio) - (u.aratio == null ? -1 : u.aratio); });
  LASTS = { sd: sd, list: list, y12: y12, y24: y24, demand: demand, unsold: unsold, pop: pop };
  if (!list.length) { tb.innerHTML = '<tr><td colspan="9" class="empty">해당 시·도의 시·군·구 데이터가 없습니다.</td></tr>'; }
  list.forEach(function (x) {
    var tr = document.createElement('tr');
    if (x.b > 0) { tr.className = 'clickable'; tr.dataset.sc = x.r.code; }
    if (x.aratio != null && x.aratio > 1.5) tr.className += ' self';
    var rc = x.aratio == null ? 'var(--slate)' : (x.aratio > 1.3 ? '#B24A32' : (x.aratio < 0.7 ? 'var(--good)' : 'var(--ink)'));
    tr.innerHTML = '<td class="nm">' + esc(x.r.name) + (x.b > 0 ? '<span class="exp-ind">▾ 단지</span>' : '') + '</td>' +
      '<td style="font-weight:700">' + (x.a ? n0(x.a) : '—') + '</td>' +
      '<td>' + (x.b ? n0(x.b) : '—') + '</td>' +
      '<td>' + (x.pop ? n0(x.pop.p) : '—') + '</td>' +
      '<td>' + (x.dem ? n0(x.dem) : '—') + '</td>' +
      '<td>' + (x.ratio == null ? '—' : x.ratio.toFixed(2) + '배') + '</td>' +
      '<td style="font-weight:700;color:' + rc + '">' + (x.aratio == null ? '—' :
        x.aratio.toFixed(2) + '배<div style="font-size:11px;color:var(--slate)">' + (x.sa ? x.sa.n + '곳' : '') + '</div>') + '</td>' +
      '<td>' + (x.un == null ? '—' : n0(x.un) + (x.unr != null ? '<div style="font-size:11px;color:var(--slate)">' + x.unr.toFixed(2) + '%</div>' : '')) + '</td>' +
      '<td>' + (RANK[x.r.code] ? decile(x.r.code) + '분위' : '—') + '</td>';
    tb.appendChild(tr);
    var dr = document.createElement('tr');
    dr.className = 'txrow'; dr.hidden = true;
    dr.innerHTML = '<td colspan="9"><div class="txbox"></div></td>';
    tb.appendChild(dr);
    if (x.b > 0) tr.addEventListener('click', function () {
      dr.hidden = !dr.hidden;
      if (!dr.hidden && !dr.dataset.done) { dr.querySelector('.txbox').innerHTML = supDetail(x.r); dr.dataset.done = '1'; }
    });
  });

  /* 해석 */
  var L = [];
  var ratio = (demand && y12) ? y12 / demand : null;
  if (ratio != null) L.push('<span class="hl">' + esc(sd) + '</span> 향후 12개월 입주물량은 <span class="hl">' +
    n0(y12) + '세대</span>, 연간 추정 수요 ' + n0(demand) + '세대 대비 <span class="hl">' + ratio.toFixed(2) + '배</span>. ' +
    (ratio > 1.3 ? '<span class="dn">공급이 수요를 크게 웃돕니다</span> — 전세·매매 모두 하방 압력이 생기기 쉽습니다.'
      : ratio > 1.0 ? '공급이 수요를 다소 웃돕니다.'
      : ratio < 0.7 ? '<span class="up">공급이 수요에 크게 못 미칩니다</span> — 물량 부족 국면입니다.'
      : '수요와 공급이 대체로 균형입니다.'));
  if (unsold != null && pop) L.push('<b>준공후 미분양</b>은 ' + n0(unsold) + '호로 세대수의 <span class="hl">' +
    (unsold / pop.h * 100).toFixed(3) + '%</span>입니다. 다 지어놓고 못 판 물량이라 <b>가장 악성인 재고</b>이고, ' +
    (unsold / pop.h * 100 > 0.2 ? '<span class="dn">적체가 뚜렷합니다.</span>' : '부담이 크지 않은 수준입니다.'));
  var hi = list.filter(function (x) { return x.aratio != null && x.aratio > 1.3; }).slice(0, 4);
  if (hi.length) L.push('생활권 배율이 높은 곳(공급 과다) — ' + hi.map(function (x) {
    return esc(x.r.name) + ' ' + x.aratio.toFixed(2) + '배'; }).join(' · ') +
    '. <span class="dn">전세 하방 압력이 큰 지역</span>입니다.');
  var lo = list.filter(function (x) { return x.aratio != null && x.aratio < 0.5; }).slice(0, 4);
  if (lo.length) L.push('생활권 배율이 낮은 곳(공급 부족) — ' + lo.map(function (x) {
    return esc(x.r.name) + ' ' + x.aratio.toFixed(2) + '배'; }).join(' · ') +
    '. <span class="up">물량 부담이 적은 지역</span>입니다.');
  var gapEx = list.filter(function (x) { return x.ratio != null && x.aratio != null && Math.abs(x.aratio - x.ratio) > 0.5; })
    .sort(function (u, v) { return Math.abs(v.aratio - v.ratio) - Math.abs(u.aratio - u.ratio); })[0];
  if (gapEx) L.push('<b>자체와 생활권이 크게 갈리는 예</b> — ' + esc(gapEx.r.name) + '는 자체 배율 ' +
    gapEx.ratio.toFixed(2) + '배지만 반경 ' + SUP_R + 'km로 넓히면 ' + gapEx.aratio.toFixed(2) + '배입니다. ' +
    (gapEx.aratio > gapEx.ratio ? '<span class="dn">옆 동네 물량이 이 지역 전세를 누릅니다.</span>'
      : '<span class="up">자기 물량은 많지만 주변이 비어 있어 부담이 분산됩니다.</span>'));
  var top3 = list.slice().sort(function (u, v) { return v.b - u.b; }).slice(0, 3).filter(function (x) { return x.b > 0; });
  if (top3.length) L.push('물량이 몰리는 곳은 ' + top3.map(function (x) {
    return esc(x.r.name) + '(' + n0(x.b) + '세대)'; }).join(' · ') + ' 입니다. ' +
    '<b>입주 직전 6개월은 전세가 밀리는 구간</b>이라 갭투자 진입 시점으로는 유리하지만, 역전세 위험도 같이 커집니다.');
  if (doneY) {
    var ys = Object.keys(doneY).filter(function (y) { return y !== partialY; }).sort();
    if (ys.length >= 5) {
      var vals = ys.map(function (y) { return doneY[y]; });
      var mxI = vals.indexOf(Math.max.apply(null, vals)), mnI = vals.indexOf(Math.min.apply(null, vals));
      var avgD = vals.reduce(function (u, v) { return u + v; }, 0) / vals.length;
      L.push('<b>준공 사이클</b> — ' + ys[0] + '~' + ys[ys.length - 1] + ' 아파트 준공 실적은 연평균 ' +
        n0(avgD) + '호입니다. 가장 많았던 해는 <span class="hl">' + ys[mxI] + '년 ' + n0(vals[mxI]) +
        '호</span>, 가장 적었던 해는 <span class="hl">' + ys[mnI] + '년 ' + n0(vals[mnI]) + '호</span>.' +
        (demand ? ' 연간 추정 수요 ' + n0(demand) + '세대 대비 평균 ' + (avgD / demand).toFixed(2) + '배로 공급돼 왔습니다.' : ''));
      var last3 = ys.slice(-3).map(function (y) { return doneY[y]; });
      var l3 = last3.reduce(function (u, v) { return u + v; }, 0) / last3.length;
      L.push('최근 3년 평균은 ' + n0(l3) + '호로 장기 평균 대비 <span class="' + (l3 > avgD ? 'dn' : 'up') + '">' +
        fmtPct((l3 / avgD - 1) * 100) + '</span>입니다. ' +
        (l3 < avgD ? '공급이 줄어드는 국면이라 2~3년 뒤 물량 부족이 나타날 수 있습니다.'
          : '공급이 늘어난 국면이라 입주 시기 전세 압박을 함께 봐야 합니다.'));
    }
  }
  if (pIdx) {
    var li = KIY.length - 1, p5 = KIY.indexOf(KIY[li] - 5);
    if (p5 >= 0 && pIdx[li] && pIdx[p5]) L.push('같은 화면의 <b>검은 선이 매매가격지수</b>입니다. ' +
      esc(sd) + ' 최근 5년 <span class="hl">' + fmtPct((pIdx[li] / pIdx[p5] - 1) * 100) + '</span> 움직였습니다. ' +
      '입주물량 막대와 겹쳐 보면 <b>물량이 쏟아진 시기와 가격이 눌린 시기가 맞물리는지</b> 확인할 수 있습니다.');
  }
  L.push('수요량은 <b>인구 × 0.5% 가정치</b>입니다. 공식 통계가 아니라 업계에서 쓰는 추정식이며, 세대분화 속도가 빠른 지역에서는 과소 추정됩니다.');
  drawUnsChart(sd);
  el('supIns').innerHTML = '<h4>수급 읽기</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}
function supDetail(r) {
  var d = (SUP.detail[r.code] || []).slice().sort(function (u, v) { return u.ym < v.ym ? -1 : 1; });
  if (!d.length) return '<div style="color:var(--slate)">등록된 입주예정 단지가 없습니다.</div>';
  var h = '<div style="font-weight:700;margin-bottom:10px">' + esc(r.name) + ' 입주예정 단지 ' + d.length + '곳</div>' +
    '<div style="overflow-x:auto"><table><thead><tr><th>입주예정</th><th>단지명</th><th>구분</th><th>위치</th><th>세대수</th></tr></thead><tbody>';
  d.forEach(function (x) {
    h += '<tr><td>' + x.ym.slice(0, 4) + '.' + x.ym.slice(4) + '</td><td class="nm">' + esc(x.nm) + '</td>' +
      '<td><span class="b no">' + esc(x.t) + '</span></td><td>' + esc(x.a) + '</td>' +
      '<td style="font-weight:700">' + n0(x.n) + '세대</td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}
function imgSup() {
  if (!LASTS) return;
  var m = LASTS;
  exportPNG({
    title: m.sd + ' 입주물량 · 수급',
    sub: '한국부동산원 입주예정물량(2025.12 기준) · 향후 24개월',
    stats: [
      { label: '12개월 입주물량', value: n0(m.y12) + '세대' },
      { label: '연간 추정 수요', value: m.demand == null ? '—' : n0(m.demand) + '세대' },
      { label: '수급 배율', value: (m.demand && m.y12) ? (m.y12 / m.demand).toFixed(2) + '배' : '—',
        color: (m.demand && m.y12 / m.demand > 1.2) ? 'bad' : 'good' },
      { label: '준공후 미분양', value: m.unsold == null ? '—' : n0(m.unsold) + '호', color: 'bad' }
    ],
    headers: ['시·군·구', '12개월 물량', '연간 수요', '수급 배율', '준공후 미분양'],
    weights: [2.2, 1.25, 1.15, 1.1, 1.25],
    bold: [1],
    rows: m.list.filter(function (x) { return x.b > 0 || x.un; }).map(function (x) {
      return [x.r.name, x.a ? n0(x.a) + '세대' : '—', x.dem ? n0(x.dem) + '세대' : '—',
        x.ratio == null ? '—' : x.ratio.toFixed(2) + '배', x.un == null ? '—' : n0(x.un) + '호'];
    }),
    max: 16,
    note: '수급 배율 = 12개월 입주물량 ÷ 연간 추정 수요(인구×0.5% 가정) · 1.0 초과면 공급 우위 · 준공후 미분양은 가장 악성인 재고',
    file: 'supply'
  });
}

/* ══════════ 투자 결과보고서 ══════════ */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
var SUP_R = 15;   /* 생활권 반경 km — 기본 15km */
var SUPCACHE = {};
/** 반경 내 시군구를 묶어 수급을 계산 (행정구역 경계 대신 생활권 기준) */
function supArea(code, R) {
  R = R == null ? SUP_R : R;
  var key = code + '|' + R;
  if (SUPCACHE[key]) return SUPCACHE[key];
  if (!SUPOK) return null;
  var c0 = CO[code];
  var y12 = supYms(12);
  var sup = 0, dem = 0, uns = 0, hh = 0, list = [];
  var pool = SGG.concat(EXT);
  pool.forEach(function (r) {
    var d = (R <= 0) ? (r.code === code ? 0 : null) : distKm(c0, CO[r.code]);
    if (d == null || d > R) return;
    var m = SUP.sgg[r.code], pp = SUP.pop[r.code];
    var us0 = unsSeriesOf(r.name), u = us0 ? us0.last : SUP.unsold[r.code];
    if (!pp || !pp.p) return;
    sup += supSum(m, y12);
    dem += pp.p * DEMAND_RATE;
    hh += pp.h || 0;
    if (u != null) uns += u;
    list.push({ name: r.name, d: d, sup: supSum(m, y12), pop: pp.p });
  });
  if (!dem) return null;
  list.sort(function (u2, v) { return v.sup - u2.sup; });
  var out = { ratio: sup / dem, sup: sup, dem: dem, uns: uns, hh: hh,
    unsR: hh ? uns / hh * 100 : null, n: list.length, list: list, R: R };
  SUPCACHE[key] = out;
  return out;
}
function supRatioOf(code) {
  if (!SUPOK) return null;
  var m = SUP.sgg[code], pp = SUP.pop[code];
  if (!m || !pp || !pp.p) return null;
  var a = supSum(m, supYms(12));
  var dem = pp.p * DEMAND_RATE;
  return dem > 0 ? a / dem : null;
}
function unsoldRatioOf(code) {
  if (!SUPOK) return null;
  var u = SUP.unsold[code], pp = SUP.pop[code];
  return (u != null && pp && pp.h) ? u / pp.h * 100 : null;
}
/** 6축 점수 — 각 0~100 */
function scoreItem(it, c) {
  var r = BY[it.code] || {};
  var ax = [];

  /* 1. 급지 — 시장이 매긴 서열 */
  var d = RANK[it.code] ? decile(it.code) : null;
  var s1 = d == null ? 50 : clamp((11 - d) * 10, 5, 100);
  ax.push({ k: '급지', w: .45, s: s1,
    d: d == null ? '분위 정보 없음' : '전국 ' + RANK[it.code] + '위 · ' + d + '분위' });

  /* 2. 장기 성과 — 10년 상승률 */
  var g10 = chg10(r);
  var s2 = g10 == null ? 55
    : (g10 >= 100 ? 100 : (g10 >= 70 ? 55 + (g10 - 70) / 30 * 45 : clamp(15 + g10 / 70 * 40, 10, 55)));
  ax.push({ k: '장기 성과 (참고)', w: 0, s: s2,
    d: g10 == null ? '10년 데이터 없음' : '10년 ' + fmtPct(g10) + ' · 연복리 ' +
      n1((Math.pow(1 + g10 / 100, .1) - 1) * 100) + '% · ' + (g10 >= 100 ? '통과' : g10 >= 70 ? '경계' : '미달') });

  /* 3. 진입 타이밍 — 전세가율 밴드 */
  var jb = r.s ? band(jrS(r), 10) : null;
  var jrItem = it.jeon && it.med ? it.jeon / it.med * 100 : (jb ? jb.cur : null);
  var sLv2 = jrItem == null ? 55 : clamp(20 + (jrItem - 40) / 40 * 80, 10, 100);
  var sBd2 = jb ? clamp(40 + jb.pct * 60, 40, 100) : 55;
  ax.push({ k: '전세 뒷받침', w: .30, s: sLv2 * .65 + sBd2 * .35,
    d: (jrItem == null ? '전세 정보 없음' : '이 단지 전세가율 ' + n1(jrItem) + '%') +
      (jb ? ' · 지역 10년 밴드 ' + Math.round(jb.pct * 100) + '%' : '') });

  /* 4. 수급 — 입주물량 + 준공후 미분양 */
  var saI = supArea(it.code);
  var sr = saI ? saI.ratio : null, ur = saI ? saI.unsR : null;
  var s4 = sr == null ? 55 : clamp(40 + (1.2 - sr) * 45, 20, 100);
  if (sr != null && ur != null) s4 = clamp(s4 - ur * 45, 20, 100);
  ax.push({ k: '수급 (참고)', w: 0, s: s4,
    d: sr == null ? '수급 데이터 없음'
      : '생활권 ' + SUP_R + 'km 배율 ' + sr.toFixed(2) + '배 (' + saI.n + '곳)' +
        (ur != null ? ' · 준공후 미분양 ' + ur.toFixed(2) + '%' : '') });

  /* 5. 단지 경쟁력 — 연식·역세권·세대수
     v43.7 확정: 단지명 매칭을 59% → 77% 로 올린 뒤 재검증
       (전국 116곳 · 단지 14,352곳 · 이름+준공년도+거래규모 3중 대조 · 반기 진입)

     ★ v43.4~v43.6 에서 '연식은 값을 못 한다'고 판단해 배점에서 뺐던 것은 오판이었다.
       매칭률이 59%일 때 빠진 41%가 이름이 짧고 흔한 옛 구축(현대·대우, 상계주공 등)에
       몰려 있어 연식 효과가 통째로 가려져 있었다. 매칭을 77%로 올리자 정반대 결과가 나왔다.

     연차 구간별 초과수익(같은 지역 평균 대비, 10년):
       10년 미만 -4.9%p · 10~19년 +0.6 · 20~24년 +4.0 · 25~34년 +19.5 · 35년 이상 +23.4
       → 기존 곡선은 10년 미만에 70점을 주고 있었으나 실제로는 가장 나쁜 구간이다.
         35년 이상과 25~34년을 100점으로 묶던 것도 실제 차이를 반영해 분리했다.

     축별 단독 IC(10년): 연식(신곡선) 조합 시 최대 · 역세권 +0.122 · 세대수 +0.118 · 전세가율 +0.086
     배점 비교(10년 Top3 초과): 연0 +5.9 / 연20 +7.5 / 연35 +9.1 / 연50 +9.4
       → 연50 이 근소 우위지만 역세권·세대수를 과도하게 눌러 연35 를 택했다(차이 0.3%p, 오차 범위).
     연식 단독(100%)은 초과수익이 +13.1%p 로 가장 높으나 순위상관은 +0.143 으로 조합보다 낮다.
       상위 몇 곳만 맞히고 전체 순서는 못 맞춘다는 뜻이라 채택하지 않았다. */
  var hh = it.hh || null, walk = it.walk == null ? null : it.walk, age = it.byr ? (new Date().getFullYear() - it.byr) : null;
  var pHh = hh == null ? 55 : (hh >= 2000 ? 100 : hh >= 500 ? 65 : hh >= 300 ? 48 : 42);
  var pWk = walk == null ? 55 : (walk <= 5 ? 100 : walk <= 10 ? 62 : walk <= 15 ? 52 : 45);
  var pAg = age == null ? 55 : (age >= 35 ? 100 : age >= 25 ? 88 : age >= 20 ? 55 : age >= 10 ? 52 : 30);
  var s5 = pAg * .35 + pWk * .35 + pHh * .30;
  ax.push({ k: '단지 경쟁력', w: .15, s: s5,
    d: (age == null ? '연식 미상' : age + '년차' +
         (age >= 35 ? ' (재건축 유력)' : age >= 25 ? ' (재건축권)' : age < 10 ? ' (신축 프리미엄 소멸 구간)' : '')) + ' · ' +
       (walk == null ? '역 정보 없음' : '도보 ' + walk + '분' + (walk <= 5 ? ' (초역세권)' : '')) + ' · ' +
       (hh ? n0(hh) + '세대' + (hh >= 2000 ? ' (초대형)' : hh >= 500 ? '' : ' (소규모)') : '세대수 미상') });

  /* 6. 자금 적합성 */
  var L = loanOf(it.med, r, c);
  var tax = acqTax(it.med, it.area || c.area, c.taxOwn, r.reg);
  var need = it.med - L.loan + tax + broker(it.med) + c.etc;
  var pay = monthlyPay(L.loan, num('pfRate'), num('pfYears'));
  var s6 = !c.cash ? 55 : (need <= c.cash ? 100 : clamp(60 - (need / c.cash - 1) * 90, 0, 60));
  ax.push({ k: '실행 가능성', w: .10, s: s6,
    d: '필요현금 ' + won(need) + ' / 보유 ' + won(c.cash) + ' · 월 ' + won(pay) +
      (need <= c.cash ? '' : ' · ' + won(need - c.cash) + ' 부족') });

  var total = ax.reduce(function (a, x) { return a + x.s * x.w; }, 0);
  return { ax: ax, total: total, need: need, pay: pay, loan: L, tax: tax, r: r, sr: sr, ur: ur, jb: jb, g10: g10, d: d };
}
function gradeOf(t) {
  if (t >= 80) return { g: 'A', t: '적극 검토', c: 'var(--good)' };
  if (t >= 68) return { g: 'B', t: '검토 가치 있음', c: 'var(--m4)' };
  if (t >= 56) return { g: 'C', t: '조건부', c: 'var(--ember)' };
  if (t >= 44) return { g: 'D', t: '보완 필요', c: '#B24A32' };
  return { g: 'E', t: '재검토 권장', c: '#B24A32' };
}
/** 약한 축에 대한 대안 지역 추천 */
function altFor(axKey, it, c) {
  var r = BY[it.code] || {};
  var pool = SGG.filter(function (x) { return x.code !== it.code && last(x.s); });
  var scored = [];
  if (axKey === '급지') {
    var need0 = it.med - loanOf(it.med, r, c).loan + acqTax(it.med, c.area, c.taxOwn, r.reg) + broker(it.med) + c.etc;
    pool.forEach(function (x) {
      if (!RANK[x.code] || decile(x.code) >= (decile(it.code) || 10)) return;
      var p = priceOf(x, c.area), nc = needCash(p, x, c);
      if (nc.need > need0 * 1.15) return;
      scored.push({ x: x, v: -decile(x.code), m: decile(x.code) + '분위 · 필요 ' + won(nc.need) });
    });
    scored.sort(function (a, b) { return a.v - b.v; });
  } else if (axKey === '장기 성과') {
    pool.forEach(function (x) {
      var g = chg10(x); if (g == null || g < 100) return;
      var p = priceOf(x, c.area), nc = needCash(p, x, c);
      if (c.cash && nc.need > c.cash * 1.1) return;
      scored.push({ x: x, v: -g, m: '10년 ' + fmtPct(g) + ' · 필요 ' + won(nc.need) });
    });
    scored.sort(function (a, b) { return a.v - b.v; });
  } else if (axKey === '갈아타기 타이밍') {
    var h2 = BY[el('home').value];
    pool.forEach(function (x) {
      if (!h2 || last(x.s) <= last(h2.s)) return;
      var b3 = band(ratioS(h2, x), 10); if (!b3 || b3.pct > .35) return;
      var p3 = priceOf(x, c.area), nc3 = needCash(p3, x, c);
      scored.push({ x: x, v: b3.pct, m: '배율 밴드 ' + Math.round(b3.pct * 100) + '% · 필요 ' + won(nc3.need) });
    });
    scored.sort(function (a, b) { return a.v - b.v; });
  } else if (axKey === '진입 타이밍' || axKey === '전세 뒷받침') {
    pool.forEach(function (x) {
      var b = band(jrS(x), 10); if (!b || b.pct < .6) return;
      var p = priceOf(x, c.area), nc = needCash(p, x, c);
      if (c.cash && nc.need > c.cash * 1.1) return;
      scored.push({ x: x, v: -b.pct, m: '밴드 ' + Math.round(b.pct * 100) + '% · 전세가율 ' + n1(b.cur) + '%' });
    });
    scored.sort(function (a, b) { return a.v - b.v; });
  } else if (axKey === '수급') {
    pool.forEach(function (x) {
      var sa2 = supArea(x.code); var sr = sa2 ? sa2.ratio : null; if (sr == null || sr > 0.8) return;
      if (RANK[x.code] && decile(x.code) > (decile(it.code) || 10) + 1) return;
      var p = priceOf(x, c.area), nc = needCash(p, x, c);
      if (c.cash && nc.need > c.cash * 1.15) return;
      scored.push({ x: x, v: sr, m: '생활권 배율 ' + sr.toFixed(2) + '배 · 필요 ' + won(nc.need) });
    });
    scored.sort(function (a, b) { return a.v - b.v; });
  } else if (axKey === '자금 적합성' || axKey === '실행 가능성') {
    pool.forEach(function (x) {
      var p = priceOf(x, c.area), nc = needCash(p, x, c);
      if (!c.cash || nc.need > c.cash) return;
      scored.push({ x: x, v: -(RANK[x.code] ? 200 - RANK[x.code] : 0), m: '필요 ' + won(nc.need) + ' · ' + decile(x.code) + '분위' });
    });
    scored.sort(function (a, b) { return a.v - b.v; });
  } else if (axKey === '단지 경쟁력') {
    return { text: '같은 지역 안에서 <b>세대수 500 이상 · 지하철 도보 15분 이내</b> 조건으로 단지 솔팅을 다시 돌려보세요. ' +
      '지역을 바꾸지 않고도 단지만 바꿔 이 축을 올릴 수 있습니다.', list: [] };
  }
  return { text: null, list: scored.slice(0, 3) };
}
function renderReport() {
  var box = el('pfReport');
  if (!CART.length) { box.innerHTML = ''; return; }
  var c = CFG();
  var items = CART.map(function (it) { return { it: it, sc: scoreItem(it, c) }; })
    .sort(function (a, b) { return b.sc.total - a.sc.total; });

  var h = '';
  items.forEach(function (o, i) {
    var s = o.sc, g = gradeOf(s.total), it = o.it;
    h += '<div class="rep">';
    h += '<div class="rephead"><div><span class="eb">' + (i + 1) + '순위</span>' +
      '<h3>' + esc(it.apt) + '</h3>' +
      '<div class="repsub">' + esc(it.region) + ' · ' + esc(it.bucket) + ' · 매매 ' + won(it.med) +
      ' · 평당 ' + n0(it.py) + '만</div></div>' +
      '<div class="repscore" style="background:' + g.c + '"><b>' + g.g + '</b><span>' + Math.round(s.total) + '점</span></div></div>';
    h += '<div class="repverdict" style="border-left-color:' + g.c + '"><b>' + g.t + '</b> — ' + repSummary(s, it) + '</div>';
    h += '<div class="bars">';
    s.ax.forEach(function (a) {
      var col = a.s >= 70 ? 'var(--good)' : a.s >= 50 ? 'var(--m4)' : a.s >= 35 ? 'var(--ember)' : '#B24A32';
      h += '<div class="bar"><div class="barh"><span>' + a.k + '</span><em>' + Math.round(a.s) + '</em></div>' +
        '<div class="bart"><i style="width:' + a.s.toFixed(0) + '%;background:' + col + '"></i></div>' +
        '<div class="bard">' + a.d + '</div></div>';
    });
    h += '</div>';

    /* 약한 축 → 대안 */
    var weak = s.ax.slice().sort(function (u, v) { return u.s - v.s; })[0];
    if (weak.s < 60) {
      var alt = altFor(weak.k, it, c);
      h += '<div class="repalt"><h4>보완 — <b>' + weak.k + '</b>이(가) ' + Math.round(weak.s) + '점으로 가장 약합니다</h4>';
      if (alt.text) h += '<p>' + alt.text + '</p>';
      if (alt.list && alt.list.length) {
        h += '<p>' + altWhy(weak.k) + '</p><div class="altlist">';
        alt.list.forEach(function (a) {
          h += '<button class="altbtn" data-alt="' + a.x.code + '"><b>' + esc(a.x.name) + '</b><span>' + a.m + '</span></button>';
        });
        h += '</div>';
      } else if (!alt.text) {
        h += '<p>같은 조건에서 이 축이 더 나은 대안을 찾지 못했습니다. 예산이나 평형 조건을 바꿔야 개선됩니다.</p>';
      }
      h += '</div>';
    }
    h += '</div>';
  });
  box.innerHTML = h;
  box.querySelectorAll('[data-alt]').forEach(function (b) {
    b.addEventListener('click', function () { el('rg5').value = b.dataset.alt; show('p7'); });
  });
}
function altWhy(k) {
  if (k === '급지') return '비슷한 자금으로 <b>더 높은 분위</b>에 들어갈 수 있는 지역입니다.';
  if (k === '장기 성과') return '10년 상승률 <b>100% 기준을 통과</b>하면서 예산 안에 들어오는 지역입니다.';
  if (k === '진입 타이밍' || k === '전세 뒷받침') return '전세가율이 높아 매매가가 <b>실사용 가치에 가깝고</b>, 갭이 작아 진입 부담이 낮은 지역입니다.';
  if (k === '실행 가능성') return '보유 현금으로 <b>실행 가능한</b> 지역 중 서열이 높은 곳입니다.';
  if (k === '갈아타기 타이밍') return '지금 사는 곳과의 <b>가격 배율이 10년 밴드 하단</b>이라, 역대 대비 적은 추가금으로 올라갈 수 있는 지역입니다.';
  if (k === '수급') return '향후 12개월 <b>입주물량 부담이 적은</b> 지역입니다.';
  if (k === '자금 적합성') return '보유 현금으로 <b>실행 가능한</b> 지역 중 서열이 높은 곳입니다.';
  return '';
}
