'use strict';
/** 세대수 기준 3분류 */
function hhSplit(list) {
  var ok = list.filter(function (g) { return g.hh; });
  return {
    solo: ok.filter(function (g) { return g.hh < 300; }),
    mid: ok.filter(function (g) { return g.hh >= 300 && g.hh < 1000; }),
    big: ok.filter(function (g) { return g.hh >= 1000; }),
    known: ok.length, total: list.length
  };
}
function avgHH(a2) { return a2.length ? a2.reduce(function (s, x) { return s + (x.hh || 0); }, 0) / a2.length : null; }
/** 노후도 3분류 — 반드시 '검증 시작 시점' 연차로 나눈다 (현재 연차로 나누면 결과를 보고 고르는 셈) */
function ageSplit(list, base) {
  var ok = list.filter(function (g) { return g.byr && (base - g.byr) >= 0; });
  ok.forEach(function (g) { g.a0 = base - g.byr; });
  return {
    nw: ok.filter(function (g) { return g.a0 < 10; }),
    md: ok.filter(function (g) { return g.a0 >= 10 && g.a0 < 25; }),
    od: ok.filter(function (g) { return g.a0 >= 25; }),
    known: ok.length, total: list.length
  };
}
function avgAge(a2) { var v = a2.filter(function (x) { return x.a0 != null; });
  return v.length ? v.reduce(function (s, x) { return s + x.a0; }, 0) / v.length : null; }
function tierSplit(list) {
  var n = list.length;
  return {
    top: list.slice(0, Math.max(1, Math.round(n * 0.2))),
    mid: list.slice(Math.floor(n * 0.4), Math.max(Math.floor(n * 0.4) + 1, Math.ceil(n * 0.6))),
    low: list.slice(Math.floor(n * 0.8))
  };
}
function avgGr(a) { return a.length ? a.reduce(function (s, x) { return s + x.gr; }, 0) / a.length : null; }
function medGr(a) { return a.length ? median(a.map(function (x) { return x.gr; })) : null; }
function avgP0(a) { return a.length ? a.reduce(function (s, x) { return s + x.p0; }, 0) / a.length : null; }
function runBT() {
  var A = el('btA').value, B = el('btB').value, yr = +el('btYr').value, mode = el('btArea').value;
  var st = el('btStat'), btn = el('btRun');
  if (A === B) { st.textContent = '서로 다른 두 지역을 골라주세요.'; return; }
  btn.disabled = true; st.textContent = '실거래 불러오는 중… (' + yr + '년 전과 현재 비교)';
  Promise.all([btFetch(A, yr, mode), btFetch(B, yr, mode)]).then(function (r) {
    BT = { A: BY[A], B: BY[B], la: r[0], lb: r[1], yr: yr, mode: mode };
    drawBT();
    btn.disabled = false;
  });
}
function drawBT() {
  if (!BT) return;
  var A = BT.A, B = BT.B, la = BT.la, lb = BT.lb, yr = BT.yr;
  if (la.length < 5 || lb.length < 5) {
    el('btStat').textContent = '양쪽 모두 ' + yr + '년 전과 현재에 거래가 있는 단지가 5곳 이상이어야 합니다. (현재 ' +
      A.name + ' ' + la.length + '곳 / ' + B.name + ' ' + lb.length + '곳) 평형을 전체로 바꾸거나 기간을 줄여보세요.';
    return;
  }
  var cases, ta, tb2, ha, hb, za, zb, aa, ab, base = new Date().getFullYear() - yr;
  if (BTMODE === 'ag') {
    aa = ageSplit(la, base); ab = ageSplit(lb, base);
    if (aa.known < 4 || ab.known < 4) {
      el('btStat').textContent = '준공연도를 확인한 단지가 부족합니다 (' + A.name + ' ' + aa.known + '/' + aa.total +
        ', ' + B.name + ' ' + ab.known + '/' + ab.total + '). 평형을 전체로 바꾸거나 다른 지역을 골라보세요.';
      return;
    }
    cases = [
      { k: A.name + ' 신축(10년↓)', g: aa.nw, c: 'var(--m1)' },
      { k: A.name + ' 준구축(10~24년)', g: aa.md, c: 'var(--m3)' },
      { k: A.name + ' 구축(25년↑)', g: aa.od, c: 'var(--m4)' },
      { k: B.name + ' 신축(10년↓)', g: ab.nw, c: 'var(--ember)' },
      { k: B.name + ' 준구축(10~24년)', g: ab.md, c: 'var(--frost)' },
      { k: B.name + ' 구축(25년↑)', g: ab.od, c: 'var(--taupe)' }
    ];
  } else if (BTMODE === 'sz') {
    za = sizeSplit(la); zb = sizeSplit(lb);
    cases = [
      { k: A.name + ' 소형', g: za.sm, c: 'var(--m1)' },
      { k: A.name + ' 중형', g: za.md, c: 'var(--m3)' },
      { k: A.name + ' 대형', g: za.lg, c: 'var(--m4)' },
      { k: B.name + ' 소형', g: zb.sm, c: 'var(--ember)' },
      { k: B.name + ' 중형', g: zb.md, c: 'var(--frost)' },
      { k: B.name + ' 대형', g: zb.lg, c: 'var(--taupe)' }
    ];
  } else if (BTMODE === 'hh') {
    ha = hhSplit(la); hb = hhSplit(lb);
    if (ha.known < 4 || hb.known < 4) {
      el('btStat').textContent = '세대수를 확인한 단지가 부족합니다 (' + A.name + ' ' + ha.known + '/' + ha.total +
        ', ' + B.name + ' ' + hb.known + '/' + hb.total + '). 평형을 전체로 바꾸거나 다른 지역을 골라보세요.';
      return;
    }
    cases = [
      { k: A.name + ' 나홀로(300↓)', g: ha.solo, c: 'var(--m1)' },
      { k: A.name + ' 중형(300~999)', g: ha.mid, c: 'var(--m3)' },
      { k: A.name + ' 대단지(1000↑)', g: ha.big, c: 'var(--m4)' },
      { k: B.name + ' 나홀로(300↓)', g: hb.solo, c: 'var(--ember)' },
      { k: B.name + ' 중형(300~999)', g: hb.mid, c: 'var(--frost)' },
      { k: B.name + ' 대단지(1000↑)', g: hb.big, c: 'var(--taupe)' }
    ];
  } else {
    ta = tierSplit(la); tb2 = tierSplit(lb);
    cases = [
      { k: A.name + ' 대장(상위 20%)', g: ta.top, c: 'var(--m1)' },
      { k: A.name + ' 중간(40~60%)', g: ta.mid, c: 'var(--m4)' },
      { k: B.name + ' 대장(상위 20%)', g: tb2.top, c: 'var(--ember)' },
      { k: B.name + ' 중간(40~60%)', g: tb2.mid, c: 'var(--taupe)' }
    ];
  }
  var tbl = el('tBT').tBodies[0]; tbl.innerHTML = '';
  cases.forEach(function (x) {
    var a = avgGr(x.g), m = medGr(x.g), p0 = avgP0(x.g);
    var p1 = x.g.length ? x.g.reduce(function (s, y) { return s + y.p1; }, 0) / x.g.length : null;
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="nm"><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:' +
      x.c + ';margin-right:8px;vertical-align:-1px"></span>' + esc(x.k) + '</td>' +
      '<td>' + x.g.length + '곳' +
        (BTMODE === 'hh' && avgHH(x.g) ? '<div style="font-size:11px;color:var(--slate)">평균 ' + n0(avgHH(x.g)) + '세대</div>' : '') +
        (BTMODE === 'sz' && avgAr(x.g) ? '<div style="font-size:11px;color:var(--slate)">평균 ' + n1(avgAr(x.g)) + '㎡</div>' : '') +
        (BTMODE === 'ag' && avgAge(x.g) != null ? '<div style="font-size:11px;color:var(--slate)">평균 ' + n1(avgAge(x.g)) + '년차</div>' : '') + '</td>' +
      '<td>' + (p0 == null ? '—' : n0(p0) + '만') + '</td>' +
      '<td>' + (p1 == null ? '—' : n0(p1) + '만') + '</td>' +
      '<td style="font-weight:700;color:' + (a >= 100 ? 'var(--good)' : a >= 70 ? 'var(--ember)' : 'var(--slate)') + '">' +
        (a == null ? '—' : fmtPct(a)) + '</td>' +
      '<td>' + (m == null ? '—' : fmtPct(m)) + '</td>' +
      '<td>' + (a == null ? '—' : n1((Math.pow(1 + a / 100, 1 / yr) - 1) * 100) + '%') + '</td>';
    tbl.appendChild(tr);
  });

  /* 예산 매칭 비교 — 과거 가격이 비슷했던 쌍 */
  var midA = BTMODE === 'ag' ? aa.od : (BTMODE === 'sz' ? za.sm : (BTMODE === 'hh' ? ha.solo : ta.mid));
  var topB = BTMODE === 'ag' ? ab.nw : (BTMODE === 'sz' ? zb.md : (BTMODE === 'hh' ? hb.big : tb2.top));
  var pa = avgP0(midA), pb = avgP0(topB);
  var ga = avgGr(midA), gb = avgGr(topB);
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  if (chartBT) chartBT.destroy();
  chartBT = new Chart(el('cBT').getContext('2d'), {
    type: 'bar',
    data: { labels: cases.map(function (x) { return x.k; }),
      datasets: [{ label: yr + '년 상승률', data: cases.map(function (x) { return avgGr(x.g) == null ? null : +avgGr(x.g).toFixed(1); }),
        backgroundColor: cases.map(function (x) { return x.c; }), borderRadius: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: lineC }, ticks: { callback: function (v) { return v + '%'; }, font: { size: 11 } } },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } } } }
  });

  var L = [];
  if (BTMODE === 'ag') {
    [{ n: A.name, s: aa }, { n: B.name, s: ab }].forEach(function (o) {
      var g1 = avgGr(o.s.nw), g2 = avgGr(o.s.md), g3 = avgGr(o.s.od), p = [];
      if (g1 != null) p.push('신축 ' + fmtPct(g1));
      if (g2 != null) p.push('준구축 ' + fmtPct(g2));
      if (g3 != null) p.push('구축 ' + fmtPct(g3));
      var shape = '';
      if (g1 != null && g2 != null && g3 != null) {
        if (g3 > g1 && g3 > g2) shape = ' &mdash; <b>구축이 가장 높습니다</b>(재건축 기대가 값에 반영된 형태)';
        else if (g1 > g2 && g3 > g2) shape = ' &mdash; <b>U자입니다</b>(신축과 구축이 가운데보다 높음)';
        else if (g1 > g2 && g2 > g3) shape = ' &mdash; <b>새 것일수록 좋았습니다</b>';
        else if (g3 > g2 && g2 > g1) shape = ' &mdash; <b>오래될수록 좋았습니다</b>';
      }
      L.push('<span class="hl">' + esc(o.n) + '</span> 연차별(' + base + '년 기준) &mdash; ' + p.join(' · ') + shape +
        ' (준공연도 확인 ' + o.s.known + '/' + o.s.total + '곳)');
    });
  } else if (BTMODE === 'sz') {
    L.push('<span class="hl">' + esc(A.name) + '</span>(' + (RANK[A.code] ? decile(A.code) + '분위' : '—') + ') 소형 ' +
      fmtPct(avgGr(za.sm)) + ' / 중형 ' + fmtPct(avgGr(za.md)) + ' / 대형 ' + fmtPct(avgGr(za.lg)) + ' · ' +
      '<span class="hl">' + esc(B.name) + '</span>(' + (RANK[B.code] ? decile(B.code) + '분위' : '—') + ') 소형 ' +
      fmtPct(avgGr(zb.sm)) + ' / 중형 ' + fmtPct(avgGr(zb.md)) + ' / 대형 ' + fmtPct(avgGr(zb.lg)) + '.');
    [[A.name, za], [B.name, zb]].forEach(function (pair) {
      var z = pair[1];
      if (avgGr(z.sm) == null || avgGr(z.md) == null) return;
      var d1 = avgGr(z.md) - avgGr(z.sm), d2 = (avgGr(z.lg) != null) ? avgGr(z.lg) - avgGr(z.md) : null;
      L.push('<b>' + esc(pair[0]) + ' 평형별 계단</b> — 소형 ' + fmtPct(avgGr(z.sm)) + ' → 중형 ' + fmtPct(avgGr(z.md)) +
        (avgGr(z.lg) != null ? ' → 대형 ' + fmtPct(avgGr(z.lg)) : '') + '. ' +
        (d1 > 0 ? '중형이 소형보다 <span class="up">' + n1(d1) + '%p</span> 앞섰고, ' : '소형이 중형보다 <span class="up">' + n1(-d1) + '%p</span> 앞섰고, ') +
        (d2 == null ? '대형은 표본이 없습니다.'
          : (d2 > 0 ? '대형은 중형보다 <span class="up">' + n1(d2) + '%p</span> 더 올랐습니다.'
            : '대형은 중형보다 <span class="dn">' + n1(-d2) + '%p</span> 뒤졌습니다.')));
    });
  } else if (BTMODE === 'hh') {
    L.push('<span class="hl">' + esc(A.name) + '</span>(' + (RANK[A.code] ? decile(A.code) + '분위' : '—') + ') 나홀로 ' +
      fmtPct(avgGr(ha.solo)) + ' / 대단지 ' + fmtPct(avgGr(ha.big)) + ' · ' +
      '<span class="hl">' + esc(B.name) + '</span>(' + (RANK[B.code] ? decile(B.code) + '분위' : '—') + ') 나홀로 ' +
      fmtPct(avgGr(hb.solo)) + ' / 대단지 ' + fmtPct(avgGr(hb.big)) + '.');
    var stepA = (avgGr(ha.solo) != null && avgGr(ha.mid) != null && avgGr(ha.big) != null)
      ? { s: avgGr(ha.solo), m: avgGr(ha.mid), b: avgGr(ha.big) } : null;
    if (stepA) L.push('<b>' + esc(A.name) + ' 규모별 계단</b> — 나홀로 ' + fmtPct(stepA.s) + ' → 중형 ' + fmtPct(stepA.m) +
      ' → 대단지 ' + fmtPct(stepA.b) + '. ' +
      (stepA.m - stepA.s > (stepA.b - stepA.m) * 1.5
        ? '<b>300세대만 넘어도 대부분의 이득이 생겼습니다</b> — 문턱값에 가깝습니다.'
        : (stepA.b - stepA.m > (stepA.m - stepA.s) * 1.5
          ? '<b>1000세대를 넘어야 이득이 커집니다</b> — 규모가 클수록 계속 좋아집니다.'
          : '규모가 커질수록 고르게 좋아졌습니다.')));
    L.push('세대수를 확인한 단지는 ' + esc(A.name) + ' ' + ha.known + '/' + ha.total + '곳, ' +
      esc(B.name) + ' ' + hb.known + '/' + hb.total + '곳입니다. ' +
      '<b>K-apt에 등록되지 않았거나 단지명이 매칭되지 않은 곳은 빠집니다</b> — 소규모 단지일수록 누락되기 쉬워 ' +
      '나홀로 표본이 실제보다 적게 잡힐 수 있습니다.');
  } else {
    L.push('<span class="hl">' + esc(A.name) + '</span>(' + (RANK[A.code] ? decile(A.code) + '분위' : '—') + ') 대장 ' +
      fmtPct(avgGr(ta.top)) + ' / 중간 ' + fmtPct(avgGr(ta.mid)) + ' · ' +
      '<span class="hl">' + esc(B.name) + '</span>(' + (RANK[B.code] ? decile(B.code) + '분위' : '—') + ') 대장 ' +
      fmtPct(avgGr(tb2.top)) + ' / 중간 ' + fmtPct(avgGr(tb2.mid)) + '.');
  }
  if (pa != null && pb != null && ga != null && gb != null) {
    L.push('<b>핵심 비교</b> — ' + esc(A.name) + (BTMODE === 'ag' ? ' 구축은 ' : BTMODE === 'sz' ? ' 소형은 ' : BTMODE === 'hh' ? ' 나홀로는 ' : ' 중간 물건은 ') + yr + '년 전 평당 ' + n0(pa) + '만, ' +
      esc(B.name) + (BTMODE === 'ag' ? ' 신축은 ' : BTMODE === 'sz' ? ' 중형은 ' : BTMODE === 'hh' ? ' 대단지는 ' : ' 대장은 ') + n0(pb) + '만이었습니다. ' +
      (Math.abs(pa - pb) / Math.max(pa, pb) < 0.25
        ? '<span class="hl">당시 가격대가 비슷해 직접 비교가 가능합니다.</span>'
        : '<span class="dn">당시 가격 차이가 ' + n0(Math.abs(pa - pb)) + '만(' +
          Math.round(Math.abs(pa - pb) / Math.max(pa, pb) * 100) + '%)이라 같은 예산 비교로 보기 어렵습니다.</span>'));
    L.push('이후 ' + yr + '년 성과는 <b>' + esc(A.name) + (BTMODE === 'ag' ? ' 구축 ' : BTMODE === 'sz' ? ' 소형 ' : BTMODE === 'hh' ? ' 나홀로 ' : ' 중간 ') + fmtPct(ga) + '</b> vs <b>' +
      esc(B.name) + (BTMODE === 'ag' ? ' 신축 ' : BTMODE === 'sz' ? ' 중형 ' : BTMODE === 'hh' ? ' 대단지 ' : ' 대장 ') + fmtPct(gb) + '</b> — ' +
      (ga > gb ? '<span class="up">' + (BTMODE === 'ag' ? '상급지 구축이' : BTMODE === 'sz' ? '상급지 소형이' : BTMODE === 'hh' ? '최상급지 나홀로가' : '상급지 중간 물건이') + ' 앞섰습니다</span>' :
       gb > ga ? '<span class="up">' + (BTMODE === 'ag' ? '중급지 신축이' : BTMODE === 'sz' ? '중급지 중형이' : BTMODE === 'hh' ? '상급지 대단지가' : '중급지 대장이') + ' 앞섰습니다</span>' : '차이가 없었습니다') +
      ' (' + n1(Math.abs(ga - gb)) + '%p).');
  }
  if (BTMODE === 'ag') {
    var ka = (avgGr(aa.od) != null && avgGr(aa.md) != null) ? avgGr(aa.od) - avgGr(aa.md) : null;
    var kb = (avgGr(ab.od) != null && avgGr(ab.md) != null) ? avgGr(ab.od) - avgGr(ab.md) : null;
    if (ka != null || kb != null) L.push('같은 지역 안에서 <b>구축 &minus; 준구축</b> 차이는 ' +
      (ka != null ? esc(A.name) + ' ' + (ka > 0 ? '+' : '') + n1(ka) + '%p' : '') +
      (kb != null ? (ka != null ? ', ' : '') + esc(B.name) + ' ' + (kb > 0 ? '+' : '') + n1(kb) + '%p' : '') +
      '입니다. 양수면 <b>재건축 기대가 값에 반영됐다</b>는 뜻이고, 음수면 <b>낡은 것이 그냥 낡은 것</b>이었다는 뜻입니다.');
    L.push('<b>이 검증이 답할 수 없는 것</b> &mdash; ' + yr + '년 전에도 거래가 있어야 하므로 ' +
      '<b>' + base + '년 이후 준공된 아파트는 통째로 빠집니다.</b> 여기서 말하는 "신축"은 ' +
      '<b>' + base + '년 시점에 10년 미만</b>이었던 단지이지 지금의 신축이 아닙니다.');
    L.push('<b>구축 성적은 실제보다 낮게 나옵니다</b> &mdash; 재건축이 끝나 이름이 바뀐 단지는 표본에서 사라집니다. ' +
      '가장 크게 오른 사례가 빠지므로, 구축이 이겼다면 실제 격차는 더 컸다고 봐야 합니다.');
  } else if (BTMODE === 'sz') {
    var sa = (avgGr(za.md) != null && avgGr(za.sm) != null) ? avgGr(za.md) - avgGr(za.sm) : null;
    var sb = (avgGr(zb.md) != null && avgGr(zb.sm) != null) ? avgGr(zb.md) - avgGr(zb.sm) : null;
    if (sa != null || sb != null) L.push('같은 지역 안에서 <b>중형 − 소형</b> 차이는 ' +
      (sa != null ? esc(A.name) + ' ' + (sa > 0 ? '+' : '') + n1(sa) + '%p' : '') +
      (sb != null ? (sa != null ? ', ' : '') + esc(B.name) + ' ' + (sb > 0 ? '+' : '') + n1(sb) + '%p' : '') +
      '입니다. 양수면 <b>같은 동네에서도 큰 평형이 더 올랐다</b>는 뜻입니다.');
    L.push('<b>표본 주의</b> — 같은 단지의 다른 평형이 각각 한 줄로 잡히므로 단지 수가 평형 모드에서 더 많이 나옵니다. ' +
      '대형은 거래가 드물어 표본이 적은 경우가 흔합니다.');
  } else if (BTMODE === 'hh') {
    var da = (avgGr(ha.big) != null && avgGr(ha.solo) != null) ? avgGr(ha.big) - avgGr(ha.solo) : null;
    var db = (avgGr(hb.big) != null && avgGr(hb.solo) != null) ? avgGr(hb.big) - avgGr(hb.solo) : null;
    if (da != null || db != null) L.push('같은 지역 안에서 <b>대단지 − 나홀로</b> 차이는 ' +
      (da != null ? esc(A.name) + ' ' + (da > 0 ? '+' : '') + n1(da) + '%p' : '') +
      (db != null ? (da != null ? ', ' : '') + esc(B.name) + ' ' + (db > 0 ? '+' : '') + n1(db) + '%p' : '') +
      '입니다. 양수면 <b>같은 동네에서도 대단지가 더 올랐다</b>는 뜻입니다 — 환금성과 커뮤니티 프리미엄이 값에 반영됐다는 해석이 가능합니다.');
  } else {
    var aTopVsMid = (avgGr(ta.top) != null && avgGr(ta.mid) != null) ? avgGr(ta.top) - avgGr(ta.mid) : null;
    var bTopVsMid = (avgGr(tb2.top) != null && avgGr(tb2.mid) != null) ? avgGr(tb2.top) - avgGr(tb2.mid) : null;
    if (aTopVsMid != null) L.push('같은 지역 안에서 대장과 중간의 차이는 ' + esc(A.name) + ' ' +
      (aTopVsMid > 0 ? '+' : '') + n1(aTopVsMid) + '%p' +
      (bTopVsMid != null ? ', ' + esc(B.name) + ' ' + (bTopVsMid > 0 ? '+' : '') + n1(bTopVsMid) + '%p' : '') +
      '입니다. 이 값이 양수면 <b>지역 안에서도 비싼 단지가 더 올랐다</b>는 뜻입니다.');
  }
  L.push('<b>표본 주의</b> — ' + yr + '년 전과 현재 모두 거래가 있는 단지만 비교합니다. ' +
    '그 사이 준공된 신축은 빠지고, 재건축으로 이름이 바뀐 단지도 빠집니다. ' +
    '표본이 적은 구간(10곳 미만)은 한두 단지가 평균을 흔들 수 있습니다.');
  el('btIns').innerHTML = '<h4>검증 결과</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';

  /* 단지별 상세 */
  var det = el('btDetail');
  function tblOf(nm, list) {
    var h = '<div style="font-weight:700;margin:16px 0 8px">' + esc(nm) + ' · 단지별 (' + list.length + '곳, 과거 평당가 순)</div>' +
      '<div class="tblwrap"><table><thead><tr><th>단지</th><th>등급</th><th>' + yr + '년 전 평당</th><th>현재 평당</th><th>상승률</th></tr></thead><tbody>';
    var t = tierSplit(list);
    list.forEach(function (x) {
      var tag = BTMODE === 'ag'
        ? (x.a0 == null ? '미상' : x.a0 >= 25 ? '구축' : x.a0 < 10 ? '신축' : '준구축')
        : BTMODE === 'sz'
        ? (x.sz === 'sm' ? '소형' : x.sz === 'md' ? '중형' : '대형')
        : (BTMODE === 'hh'
          ? (!x.hh ? '미상' : x.hh >= 1000 ? '대단지' : x.hh < 300 ? '나홀로' : '중형')
          : (t.top.indexOf(x) >= 0 ? '대장' : (t.mid.indexOf(x) >= 0 ? '중간' : (t.low.indexOf(x) >= 0 ? '하위' : '—'))));
      h += '<tr><td class="nm">' + esc(x.apt) +
        (BTMODE === 'hh' && x.hh ? ' <span style="font-size:11px;color:var(--slate)">' + n0(x.hh) + '세대</span>' : '') +
        (BTMODE === 'sz' && x.ar ? ' <span style="font-size:11px;color:var(--slate)">' + n1(x.ar) + '㎡</span>' : '') +
        (BTMODE === 'ag' && x.byr ? ' <span style="font-size:11px;color:var(--slate)">' + x.byr + '년 준공 · ' + (x.a0 != null ? x.a0 + '년차' : '') + '</span>' : '') +
        '</td><td><span class="b ' + (tag === '대장' || tag === '대단지' || tag === '대형' || tag === '구축' ? 'd1' : 'no') + '">' + tag + '</span></td>' +
        '<td>' + n0(x.p0) + '만</td><td>' + n0(x.p1) + '만</td>' +
        '<td style="font-weight:700;color:' + (x.gr >= 100 ? 'var(--good)' : '#16202B') + '">' + fmtPct(x.gr) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  det.innerHTML = tblOf(A.name, la) + tblOf(B.name, lb);
  el('btStat').textContent = A.name + ' ' + la.length + '곳 · ' + B.name + ' ' + lb.length + '곳 비교 완료';
}
function imgBT() {
  if (!BT) return;
  var A = BT.A, B = BT.B, yr = BT.yr, cases, gbase = new Date().getFullYear() - yr;
  if (BTMODE === 'ag') {
    var g1 = ageSplit(BT.la, gbase), g2 = ageSplit(BT.lb, gbase);
    cases = [[A.name + ' 신축', g1.nw], [A.name + ' 준구축', g1.md], [A.name + ' 구축', g1.od],
             [B.name + ' 신축', g2.nw], [B.name + ' 준구축', g2.md], [B.name + ' 구축', g2.od]];
  } else if (BTMODE === 'sz') {
    var z1 = sizeSplit(BT.la), z2 = sizeSplit(BT.lb);
    cases = [[A.name + ' 소형', z1.sm], [A.name + ' 중형', z1.md], [A.name + ' 대형', z1.lg],
             [B.name + ' 소형', z2.sm], [B.name + ' 중형', z2.md], [B.name + ' 대형', z2.lg]];
  } else if (BTMODE === 'hh') {
    var ha2 = hhSplit(BT.la), hb2 = hhSplit(BT.lb);
    cases = [[A.name + ' 나홀로', ha2.solo], [A.name + ' 중형', ha2.mid], [A.name + ' 대단지', ha2.big],
             [B.name + ' 나홀로', hb2.solo], [B.name + ' 중형', hb2.mid], [B.name + ' 대단지', hb2.big]];
  } else {
    var ta2 = tierSplit(BT.la), tb3 = tierSplit(BT.lb);
    cases = [[A.name + ' 대장', ta2.top], [A.name + ' 중간', ta2.mid],
             [B.name + ' 대장', tb3.top], [B.name + ' 중간', tb3.mid]];
  }
  exportPNG({
    title: BTMODE === 'ag' ? '신축 vs 구축' : BTMODE === 'sz' ? '평형별 비교' : BTMODE === 'hh' ? '나홀로 vs 대단지' : '상급지 중간 vs 중급지 대장',
    sub: A.name + ' ↔ ' + B.name + ' · 최근 ' + yr + '년 · ' + (BT.mode === 'all' ? '전체 평형' : BT.mode + '㎡대'),
    stats: cases.map(function (x) {
      var g = avgGr(x[1]);
      return { label: x[0], value: g == null ? '—' : fmtPct(g), color: g >= 100 ? 'good' : (g < 50 ? 'bad' : '') };
    }),
    headers: ['구분', '단지 수', yr + '년 전 평당', '현재 평당', '상승률', '연복리'],
    weights: [2.2, .9, 1.2, 1.2, 1.1, 1.0],
    signed: [4],
    rows: cases.map(function (x) {
      var g = avgGr(x[1]), p0 = avgP0(x[1]);
      var p1 = x[1].length ? x[1].reduce(function (s, y) { return s + y.p1; }, 0) / x[1].length : null;
      return [x[0], x[1].length + '곳', p0 == null ? '—' : n0(p0) + '만', p1 == null ? '—' : n0(p1) + '만',
        g == null ? '—' : fmtPct(g), g == null ? '—' : n1((Math.pow(1 + g / 100, 1 / yr) - 1) * 100) + '%'];
    }),
    note: '과거·현재 모두 거래가 있는 단지만 비교 · 신축과 재건축 개명 단지는 제외됨 · 표본이 적으면 평균이 흔들림',
    file: 'backtest'
  });
}

/* ══════════ 맞춤 추천 — 리포트 이미지 (인스타 규격 4장) ══════════ */
var RECAPTS = {};
function stripTag(s) { return String(s).replace(/<[^>]+>/g, ''); }
function radiusShort() {
  var m = el('radius').value;
  if (m === 'off') return '전국';
  if (m === 'auto') return '규제 60km';
  return m + 'km';
}
var RF = "'Pretendard Variable',Pretendard,-apple-system,sans-serif";
function repTheme() {
  var dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark
    ? { bg: '#0E161F', pane: '#19242F', ink: '#EAF1F4', sub: '#8B9AA6', line: '#26333F', good: '#4FC08D',
        bad: '#E0876B', chip: '#152029', zebra: '#131E27', moon: '#7FB4CE', ember: '#E0A94E',
        onink: '#0E161F', dim: 'rgba(234,241,244,.66)' }
    : { bg: '#F1F2F1', pane: '#FFFFFF', ink: '#16202B', sub: '#6B7683', line: '#DDE4E7', good: '#1B6B4A',
        bad: '#B24A32', chip: '#E8F0F3', zebra: '#F6F9FA', moon: '#2F6D8E', ember: '#C8862F',
        onink: '#FFFFFF', dim: 'rgba(255,255,255,.78)' };
}
function okAptsOf(code) {
  var all = RECAPTS[code] || [];
  return { ok: all.filter(function (a) { return a.ok; }).slice(0, 3),
    minNeed: all.length ? Math.min.apply(null, all.map(function (a) { return a.need; })) : null,
    total: all.length };
}
function imgRecFull() {
  if (!LASTREC.length) return;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawRecPages);
  else drawRecPages();
}
function drawRecPages() {
  var c = CFG(), top3 = LASTREC.slice(0, 3);
  var pages = [{ k: 'cover' }, { k: 'axes' }];
  if (top3.length >= 2) pages.push({ k: 'pick', idx: [0, 1] });
  else pages.push({ k: 'pick', idx: [0] });
  if (top3.length >= 3) pages.push({ k: 'pick', idx: [2], foot: true });
  else pages[pages.length - 1].foot = true;
  pages.forEach(function (pg, i) {
    setTimeout(function () { drawOne(pg, i + 1, pages.length, c, top3); }, i * 520);
  });
}
/* 한글용 문자 단위 줄바꿈 */
function wrapKo(x, text, maxW, font) {
  x.font = font;
  var out = [], line = '';
  for (var i = 0; i < text.length; i++) {
    var t = line + text[i];
    if (x.measureText(t).width > maxW && line) { out.push(line); line = text[i]; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}
function axisInfo(t0) {
  var a = t0.ax;
  return [
    { n: '급지', w: '40%', s: a[0].s, v: a[0].d,
      why: '가격 서열은 시장이 이미 매긴 평가입니다. 입지·학군·교통·희소성이 전부 값에 반영돼 있습니다.',
      ev: '예측력 IC +0.118 · 2016년 분위로 나눈 10년 검증 — 1~3분위 +177%, 4~6분위 +87%, 7~10분위 +60%' },
    { n: a[3].k === '갈아타기 타이밍' ? '갈아타기 타이밍' : '전세 뒷받침', w: '25%', s: a[3].s, v: a[3].d,
      why: a[3].k === '갈아타기 타이밍'
        ? '지금 사는 곳과의 가격 배율이 역대 어디쯤인지 봅니다. 배율이 낮을수록 같은 집을 팔아 더 적은 추가금으로 올라갑니다.'
        : '전세가율이 높다는 건 매매가가 실사용 가치에 가깝다는 뜻입니다. 기대가 덜 실린 만큼 하방이 두껍습니다.',
      ev: a[3].k === '갈아타기 타이밍'
        ? '백테스트 — 배율 하단을 고른 경우 3년 뒤 이득 22.1% vs 상단 13.9% (64개월 중 92% 우세)'
        : '전세가율 수준 IC +0.129 · 밴드(백분위) +0.028보다 4배 강해 수준 65% + 밴드 35%로 섞음' },
    { n: '수급', w: '25%', s: a[2].s, v: a[2].d,
      why: '입주물량이 수요를 넘으면 전세가 먼저 밀리고, 갭이 벌어지며 역전세 위험이 커집니다.',
      ev: '시도 16곳 검증 — 당해 공급이 많을수록 이듬해 전세 IC −0.325, 매매 −0.255 (급지 통제 후)' },
    { n: '장기 성과', w: '10%', s: a[1].s, v: a[1].d,
      why: '10년에 두 배(연복리 7.2%)를 넘었는지만 봅니다. 더 올랐다고 가점하지 않습니다.',
      ev: '급지를 통제하면 5년 상승률 IC −0.259 (89% 음수) — 최근 많이 오른 곳이 이후 덜 올랐기 때문' }
  ];
}
function drawOne(pg, no, total, c, top3) {
  var C = repTheme(), W = 1080, PAD = 64;
  var cv = el('expcv'), dpr = 2, home = BY[el('home').value];
  var t0 = top3[0], g0 = gradeOf(t0.total);
  var xm = document.createElement('canvas').getContext('2d');

  /* ── 높이 ── */
  var HEAD = 132, FOOT = pg.foot ? 176 : 92, H = HEAD + FOOT;
  var axes = axisInfo(t0), axH = [];
  if (pg.k === 'cover') H += 300 + 272 + 240;
  else if (pg.k === 'axes') {
    H += 150;
    axes.forEach(function (a) {
      var l1 = wrapKo(xm, a.why, W - PAD * 2 - 56, '450 25px ' + RF).length;
      var l2 = wrapKo(xm, a.ev, W - PAD * 2 - 56, '450 21px ' + RF).length;
      var hh = 118 + l1 * 34 + 10 + l2 * 29 + 26;
      axH.push(hh); H += hh + 18;
    });
    H += 20;
  } else {
    pg.idx.forEach(function (j) {
      var ap = okAptsOf(top3[j].r.code);
      H += 262 + (ap.ok.length ? 40 + ap.ok.length * 50 : 76) + 26;
    });
  }
  cv.width = W * dpr; cv.height = H * dpr;
  var x = cv.getContext('2d'); x.scale(dpr, dpr);
  function rr(a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  function fit(t, maxW, size, weight) {
    var s = size;
    while (s > 12) { x.font = (weight || '450 ') + s + 'px ' + RF; if (x.measureText(t).width <= maxW) break; s -= 1; }
    return s;
  }
  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);

  /* ── 헤더 ── */
  var y = 48;
  x.beginPath(); x.arc(PAD + 13, y + 8, 13, 0, 7); x.arc(PAD + 19, y + 8, 11.3, 0, 7, true);
  x.fillStyle = C.moon; x.fill('evenodd');
  x.beginPath(); x.arc(PAD + 33, y + 1, 4, 0, 7); x.fillStyle = C.ember; x.fill();
  x.textAlign = 'left'; x.fillStyle = C.sub; x.font = '700 19px ' + RF;
  x.fillText('TOP-DOWN APT RADAR', PAD + 52, y + 15);
  x.textAlign = 'right'; x.font = '700 19px ' + RF;
  x.fillText(no + ' / ' + total, W - PAD, y + 15);
  x.textAlign = 'left';
  y = HEAD;

  if (pg.k === 'cover') {
    /* ── 헤드라인 ── */
    x.fillStyle = C.ink; x.font = '600 62px ' + RF;
    x.fillText('내 조건만 넣으면', PAD, y + 62);
    x.fillText('갈 수 있는 최상단이 나옵니다', PAD, y + 138);
    x.fillStyle = C.sub; x.font = '450 27px ' + RF;
    x.fillText('전국 시·군·구를 5개 축으로 채점해 순위를 매깁니다', PAD, y + 196);
    y += 252;

    /* ── 내 조건 ── */
    rr(PAD, y, W - PAD * 2, 246, 28); x.fillStyle = C.pane; x.fill();
    x.fillStyle = C.ember; x.beginPath(); x.arc(PAD + 36, y + 40, 7, 0, 7); x.fill();
    x.fillStyle = C.sub; x.font = '700 21px ' + RF;
    x.fillText('MY CONDITION · 내 조건', PAD + 54, y + 47);
    var conds = [['동원 가능 현금', won(c.cash)], ['거주 지역', home ? home.name : '—'],
      ['기준 평형', c.area + '㎡'], ['보유 주택', OWNL[c.own]], ['이동 범위', radiusShort()]];
    var colW = (W - PAD * 2 - 72) / 3;
    conds.forEach(function (p, i) {
      var row = Math.floor(i / 3), col = i % 3;
      var cx = PAD + 36 + colW * col, cy = y + 104 + row * 82;
      x.fillStyle = C.sub; x.font = '450 20px ' + RF; x.fillText(p[0], cx, cy);
      var fs = fit(p[1], colW - 20, 32, '600 ');
      x.fillStyle = C.ink; x.font = '600 ' + fs + 'px ' + RF; x.fillText(p[1], cx, cy + 40);
    });
    y += 272;

    /* ── 결과 ── */
    rr(PAD, y, W - PAD * 2, 212, 28); x.fillStyle = C.ink; x.fill();
    x.fillStyle = C.dim; x.font = '700 20px ' + RF;
    x.fillText(RECSORT === 'rank' ? '예산으로 갈 수 있는 최상단' : RECSORT === 'need' ? '가장 적게 드는 곳' : '종합 1순위', PAD + 36, y + 48);
    var nfs = fit(t0.r.name, W - PAD * 2 - 250, 62, '600 ');
    x.fillStyle = C.onink; x.font = '600 ' + nfs + 'px ' + RF;
    x.fillText(t0.r.name, PAD + 36, y + 120);
    rr(W - PAD - 36 - 140, y + 42, 140, 96, 22);
    x.fillStyle = g0.g === 'A' ? C.good : (g0.g === 'D' || g0.g === 'E' ? C.bad : C.ember); x.fill();
    x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '700 44px ' + RF;
    x.fillText(g0.g, W - PAD - 36 - 70, y + 96);
    x.font = '600 18px ' + RF; x.fillText(Math.round(t0.total) + '점', W - PAD - 36 - 70, y + 124);
    x.textAlign = 'left';
    var line2 = (t0.d ? t0.d + '분위' : '') + ' · 10년 ' + (t0.g10 == null ? '—' : fmtPct(t0.g10)) +
      ' · ' + (t0.en.mode === 'gap' ? '전세 끼고 ' : '대출 매수 ') + won(t0.need);
    var lfs = fit(line2, W - PAD * 2 - 72, 25, '450 ');
    x.fillStyle = C.dim; x.font = '450 ' + lfs + 'px ' + RF;
    x.fillText(line2, PAD + 36, y + 168);
    y += 240;

  } else if (pg.k === 'axes') {
    x.fillStyle = C.ink; x.font = '600 50px ' + RF;
    x.fillText('무엇을 보고 골랐나', PAD, y + 50);
    x.fillStyle = C.sub; x.font = '450 25px ' + RF;
    x.fillText('네 개 축과 ' + t0.r.name + '의 점수', PAD, y + 96);
    y += 150;
    axes.forEach(function (a, i) {
      var hh = axH[i];
      rr(PAD, y, W - PAD * 2, hh, 24); x.fillStyle = C.pane; x.fill();
      var col = a.s >= 70 ? C.good : a.s >= 50 ? C.moon : a.s >= 35 ? C.ember : C.bad;
      x.fillStyle = C.ink; x.font = '600 30px ' + RF;
      x.fillText(a.n, PAD + 30, y + 48);
      x.fillStyle = C.sub; x.font = '600 19px ' + RF;
      x.fillText('가중치 ' + a.w, PAD + 30 + x.measureText(a.n).width + 60, y + 46);
      x.textAlign = 'right'; x.fillStyle = col; x.font = '700 34px ' + RF;
      x.fillText(Math.round(a.s) + '점', W - PAD - 30, y + 48);
      x.textAlign = 'left';
      rr(PAD + 30, y + 66, W - PAD * 2 - 60, 10, 5); x.fillStyle = C.line; x.fill();
      rr(PAD + 30, y + 66, (W - PAD * 2 - 60) * a.s / 100, 10, 5); x.fillStyle = col; x.fill();
      var yy = y + 112;
      wrapKo(x, a.why, W - PAD * 2 - 56, '450 25px ' + RF).forEach(function (t) {
        x.fillStyle = C.ink; x.font = '450 25px ' + RF; x.fillText(t, PAD + 30, yy); yy += 34;
      });
      yy += 10;
      wrapKo(x, a.ev, W - PAD * 2 - 56, '450 21px ' + RF).forEach(function (t) {
        x.fillStyle = C.sub; x.font = '450 21px ' + RF; x.fillText(t, PAD + 30, yy); yy += 29;
      });
      y += hh + 18;
    });
    y += 20;

  } else {
    pg.idx.forEach(function (j) {
      var t = top3[j], g = gradeOf(t.total), ap = okAptsOf(t.r.code);
      var hgt = 262 + (ap.ok.length ? 40 + ap.ok.length * 50 : 76);
      rr(PAD, y, W - PAD * 2, hgt, 26); x.fillStyle = C.pane; x.fill();
      x.beginPath(); x.arc(PAD + 54, y + 56, 26, 0, 7);
      x.fillStyle = j === 0 ? C.ink : C.chip; x.fill();
      x.textAlign = 'center'; x.fillStyle = j === 0 ? C.onink : C.ink; x.font = '700 26px ' + RF;
      x.fillText(String(j + 1), PAD + 54, y + 66);
      x.textAlign = 'left';
      var nf = fit(t.r.name, W - PAD * 2 - 260, 40, '600 ');
      x.fillStyle = C.ink; x.font = '600 ' + nf + 'px ' + RF;
      x.fillText(t.r.name, PAD + 98, y + 52);
      x.fillStyle = C.sub; x.font = '450 20px ' + RF;
      x.fillText((t.d ? t.d + '분위 · 전국 ' + RANK[t.r.code] + '위' : '') +
        (t.km != null ? ' · ' + n0(t.km) + 'km' : '') + (t.r.reg ? ' · 규제지역' : ''), PAD + 98, y + 82);
      x.textAlign = 'right';
      x.fillStyle = g.g === 'A' ? C.good : (g.g === 'D' || g.g === 'E' ? C.bad : C.ember);
      x.font = '700 34px ' + RF; x.fillText(g.g + ' ' + Math.round(t.total), W - PAD - 30, y + 60);
      x.textAlign = 'left';
      var kv = [[c.area + '㎡ 추정', won(t.price)], [t.en.mode === 'gap' ? '전세 끼고 필요' : '필요현금', won(t.need)],
        ['10년 상승률', t.g10 == null ? '—' : fmtPct(t.g10)], ['생활권 수급', t.sr == null ? '—' : t.sr.toFixed(2) + '배']];
      var kw = (W - PAD * 2 - 60) / kv.length;
      kv.forEach(function (p, k) {
        var cx = PAD + 30 + kw * k;
        x.fillStyle = C.sub; x.font = '450 18px ' + RF; x.fillText(p[0], cx, y + 132);
        var fs3 = fit(p[1], kw - 16, 30, '600 ');
        x.fillStyle = (k === 1 && t.need <= c.cash) ? C.good : C.ink;
        x.font = '600 ' + fs3 + 'px ' + RF; x.fillText(p[1], cx, y + 168);
      });
      var seg = (W - PAD * 2 - 60) / t.ax.length, bw = seg - 18;
      t.ax.forEach(function (aa, k) {
        var cx = PAD + 30 + seg * k;
        rr(cx, y + 196, bw, 9, 5); x.fillStyle = C.line; x.fill();
        var col = aa.s >= 70 ? C.good : aa.s >= 50 ? C.moon : aa.s >= 35 ? C.ember : C.bad;
        rr(cx, y + 196, bw * aa.s / 100, 9, 5); x.fillStyle = col; x.fill();
        x.fillStyle = C.sub; x.font = '450 16px ' + RF;
        x.fillText(aa.k, cx, y + 226);
        x.fillStyle = col; x.font = '700 16px ' + RF;
        x.fillText(String(Math.round(aa.s)), cx + x.measureText(aa.k).width + 26, y + 226);
      });
      var yy = y + 262;
      x.fillStyle = C.sub; x.font = '700 19px ' + RF;
      x.fillText('내 예산으로 살 수 있는 단지', PAD + 30, yy);
      if (ap.ok.length) {
        yy += 22;
        ap.ok.forEach(function (a2, k) {
          if (k % 2 === 1) { rr(PAD + 20, yy + 4, W - PAD * 2 - 40, 44, 12); x.fillStyle = C.zebra; x.fill(); }
          var nm2 = fit((k + 1) + '. ' + a2.apt, 380, 24, '600 ');
          x.fillStyle = C.ink; x.font = '600 ' + nm2 + 'px ' + RF;
          x.fillText((k + 1) + '. ' + a2.apt, PAD + 30, yy + 34);
          x.textAlign = 'right';
          x.fillStyle = C.sub; x.font = '450 19px ' + RF;
          x.fillText('평당 ' + n0(a2.py) + '만', W - PAD - 400, yy + 34);
          x.fillStyle = C.ink; x.font = '600 21px ' + RF;
          x.fillText('매매 ' + won(a2.med), W - PAD - 220, yy + 34);
          x.fillStyle = C.good; x.font = '700 21px ' + RF;
          x.fillText('필요 ' + won(a2.need), W - PAD - 30, yy + 34);
          x.textAlign = 'left';
          yy += 50;
        });
      } else {
        rr(PAD + 20, yy + 12, W - PAD * 2 - 40, 52, 14); x.fillStyle = C.chip; x.fill();
        var msg = ap.total
          ? '예산 내 단지 없음 · 최저 필요현금 ' + won(ap.minNeed) + ' (평형을 낮추거나 한 급 아래 검토)'
          : '단지 목록을 불러오지 않았습니다';
        var mf = fit(msg, W - PAD * 2 - 80, 20, '600 ');
        x.fillStyle = C.bad; x.font = '600 ' + mf + 'px ' + RF;
        x.fillText(msg, PAD + 40, yy + 44);
      }
      y += hgt + 26;
    });
  }

  /* ── 푸터 ── */
  var d = new Date();
  x.fillStyle = C.line; x.fillRect(PAD, H - FOOT + 10, W - PAD * 2, 1);
  if (pg.foot) {
    x.fillStyle = C.ink; x.font = '600 22px ' + RF;
    x.fillText('탑다운 — 전국 서열 → 내 자본이 닿는 구간 → 그 안의 최상단 → 조건 통과 단지', PAD, H - FOOT + 52);
    x.fillStyle = C.sub; x.font = '450 19px ' + RF;
    x.fillText('급지 60% · 전세 뒷받침 40% 가중 · 수급·장기성과 미반영', PAD, H - FOOT + 88);
    x.fillText('생성 ' + d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() +
      ' · KB ' + ymL(KB.asof) + ' · 국토부 실거래 기준', PAD, H - FOOT + 120);
    x.fillText('공개 통계를 계산한 정보 제공용이며 투자 자문이 아닙니다', PAD, H - FOOT + 152);
  } else {
    x.fillStyle = C.sub; x.font = '450 19px ' + RF;
    x.fillText('Top-Down APT Radar · ' + no + '/' + total + ' · 정보 제공용이며 투자 자문이 아닙니다', PAD, H - FOOT + 54);
  }

  cv.toBlob(function (b) {
    var u = URL.createObjectURL(b), a3 = document.createElement('a');
    a3.href = u;
    a3.download = 'topdown_report_' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '_' + no + 'of' + total + '.png';
    a3.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
  }, 'image/png');
}
function buildReasons(c, top3) {
  var L = [], t0 = top3[0], g = gradeOf(t0.total);
  L.push(t0.r.name + ' — ' + g.g + '등급 ' + Math.round(t0.total) + '점');
  var best = t0.ax.slice().sort(function (u, v) { return v.s - u.s; })[0];
  var worst = t0.ax.slice().sort(function (u, v) { return u.s - v.s; })[0];
  L.push('강점 · ' + best.k + ' ' + Math.round(best.s) + '점');
  L.push('약점 · ' + worst.k + ' ' + Math.round(worst.s) + '점');
  return L;
}

/* ══════════ 온보딩 · 용어 사전 ══════════ */
var OBSTEP = 0, OBDATA = {};
function obDone() { try { return localStorage.getItem('td2_ob') === '1'; } catch (e) { return false; } }
function obMark() { try { localStorage.setItem('td2_ob', '1'); } catch (e) { } }
function openOb() { OBSTEP = 0; OBDATA = {}; el('obWrap').hidden = false; renderOb(); }
function closeOb(skip) {
  el('obWrap').hidden = true; obMark();
  if (!skip) { saveCfg(); condSummary(); show('pr'); }
}
var OBQ = [
  { k: 'own', t: '지금 어떤 상황이신가요?', s: '대출 한도와 세금이 여기서 갈립니다',
    opt: [
      ['0', '집이 없어요', '처음 사는 경우 · 생애최초 혜택 대상'],
      ['1', '한 채 있고, 팔고 옮길 거예요', '갈아타기 · 기존 집을 처분하는 조건'],
      ['2', '한 채 있고, 그대로 두고 더 살 거예요', '추가 매수 · 취득세가 무겁게 붙습니다'],
      ['3', '두 채 이상 있어요', '규제지역 대출이 막힙니다']
    ] },
  { k: 'cash', t: '지금 쓸 수 있는 돈이 얼마인가요?', s: '집값이 아니라 통장에서 나갈 수 있는 현금입니다',
    opt: [
      ['10000', '1억 정도', ''], ['20000', '2억 정도', ''], ['30000', '3억 정도', ''],
      ['50000', '5억 정도', ''], ['80000', '8억 정도', ''], ['120000', '12억 이상', '']
    ], free: true },
  { k: 'area', t: '어느 정도 크기를 보세요?', s: '나중에 언제든 바꿀 수 있습니다',
    opt: [
      ['59', '작은 집 (59㎡ · 24평형)', '1~2인 · 적은 돈으로 좋은 동네 진입'],
      ['84', '보통 집 (84㎡ · 34평형)', '가장 흔한 국민평형'],
      ['46', '아주 작은 집 (46㎡ · 18평형)', '소액 투자 · 임대 목적'],
      ['101', '큰 집 (101㎡ · 40평형)', '']
    ] }
];
