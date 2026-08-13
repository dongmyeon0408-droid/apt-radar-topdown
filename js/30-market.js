'use strict';
function imgMk() {
  if (!LASTMK) return;
  var m = LASTMK;
  exportPNG({
    title: m.r.name + ' 아파트 연도별 상승률',
    sub: '국토부 실거래 연도별 지수 · ' + KIY[m.f] + '~' + KIY[m.lastI] + ' (' + (KIY[m.lastI] - KIY[m.f]) + '년)',
    stats: [
      { label: '장기 연복리 (매매)', value: m.cAll == null ? '—' : n1(m.cAll) + '%', color: 'good' },
      { label: '최근 10년 연복리', value: m.c10 == null ? '—' : n1(m.c10) + '%', color: 'good' },
      { label: '누적 상승', value: m.mult ? n1(m.mult) + '배' : '—' },
      { label: '하락한 해', value: m.rowsY.filter(function (q) { return q.sc != null && q.sc < 0; }).length + '번', color: 'bad' }
    ],
    headers: ['연도', '매매', '전세', '매매지수'],
    weights: [1.1, 1.25, 1.25, 1.15],
    signed: [1, 2], twoCol: true,
    rows: m.rowsY.map(function (x) {
      return [x.y, fmtPct(x.sc), fmtPct(x.jc), x.idx == null ? '—' : n1(x.idx)];
    }),
    max: 40,
    note: '지수 기준 ' + (KBI.base || '') + ' · 연말(12월) 값 기준, 마지막 해는 최신월 기준',
    file: 'market_yearly'
  });
}
function imgMk2() {
  if (!LASTMK) return;
  var m = LASTMK;
  exportPNG({
    title: m.r.name + ' 2년 단위 수익률',
    sub: '국토부 실거래 연도별 지수 · 2년 구간별 수익률 (' + m.nSeg + '개 구간)',
    stats: [
      { label: '2년 수익률 평균 (매매)', value: m.avg2 == null ? '—' : (m.avg2 > 0 ? '+' : '') + n1(m.avg2) + '%', color: 'good' },
      { label: '2년 수익률 중위', value: m.med2 == null ? '—' : (m.med2 > 0 ? '+' : '') + n1(m.med2) + '%' },
      { label: '2년 수익률 평균 (전세)', value: m.javg2 == null ? '—' : (m.javg2 > 0 ? '+' : '') + n1(m.javg2) + '%' },
      { label: '플러스 구간', value: m.pos2 + '/' + m.nSeg }
    ],
    headers: ['구간', '매매 2년 수익률', '산술합', '전세 2년 수익률', '매매−전세'],
    weights: [1.35, 1.45, 1.25, 1.4, 1.25],
    signed: [1, 2, 3, 4],
    rows: m.rows2.map(function (x) {
      return [x.p, fmtPct(x.cum), fmtPct(x.arith), fmtPct(x.ann), fmtPct(x.jcum)];
    }),
    max: 16,
    note: '2년 수익률은 (1+r1)(1+r2)−1, 산술합은 r1+r2 · 두 값의 차이가 복리 효과입니다',
    file: 'market_2yr'
  });
}

/* ══════════ 지방 시군구 확장 (KB ㎡당 데이터는 없고 실거래 API만 가능) ══════════ */
var EXTRA = [
 ['43111','청주 상당구','충북'],['43112','청주 서원구','충북'],['43113','청주 흥덕구','충북'],
 ['43114','청주 청원구','충북'],['43130','충주시','충북'],['43150','제천시','충북'],
 ['44131','천안 동남구','충남'],['44133','천안 서북구','충남'],['44150','공주시','충남'],
 ['44200','아산시','충남'],['44210','서산시','충남'],['44230','논산시','충남'],
 ['44250','계룡시','충남'],['44270','당진시','충남'],
 ['45111','전주 완산구','전북'],['45113','전주 덕진구','전북'],['45130','군산시','전북'],['45140','익산시','전북'],
 ['46110','목포시','전남'],['46130','여수시','전남'],['46150','순천시','전남'],['46230','광양시','전남'],
 ['47111','포항 남구','경북'],['47113','포항 북구','경북'],['47150','김천시','경북'],
 ['47170','안동시','경북'],['47190','구미시','경북'],['47290','경산시','경북'],
 ['48121','창원 의창구','경남'],['48123','창원 성산구','경남'],['48125','창원 마산합포구','경남'],
 ['48127','창원 마산회원구','경남'],['48129','창원 진해구','경남'],['48170','진주시','경남'],
 ['48220','통영시','경남'],['48250','김해시','경남'],['48310','거제시','경남'],['48330','양산시','경남'],
 ['51110','춘천시','강원'],['51130','원주시','강원'],
 ['50110','제주시','제주'],['50130','서귀포시','제주']
];
var EXT = EXTRA.map(function (x) { return { code: x[0], name: x[1], sido: x[2], kind: 'ext', reg: false, cap: false }; });
EXT.forEach(function (r) { if (!BY[r.code]) BY[r.code] = r; });
/** 실거래 조회가 가능한 전체 지역 (KB 시군구 + 지방 확장) */
function allRegions() { return SGG.concat(EXT); }

/* ══════════ 단지 비교 (슬롯별 독립 조회) ══════════ */
var SLOT = [{ list: [], mo: [] }, { list: [], mo: [] }, { list: [], mo: [] }];
var chartC1 = null, chartC2 = null, chartC3 = null;
function slotIds(i) { return { reg: 'cReg' + i, area: 'cArea' + i, apt: 'cApt' + i, st: 'cSt' + i, btn: 'cBtn' + i }; }
function slotLoad(i) {
  var d = slotIds(i), code = el(d.reg).value, mode = el(d.area).value, n = +el('cmpMo').value;
  var st = el(d.st), btn = el(d.btn);
  btn.disabled = true; st.textContent = '불러오는 중…';
  var months = ymList(n).slice().reverse();
  var tasks = [];
  months.forEach(function (ym) {
    tasks.push(function () { return getTr(code, ym, 'sale').then(function (r) { return { ym: ym, k: 's', d: r }; }); });
    tasks.push(function () { return getTr(code, ym, 'rent').then(function (r) { return { ym: ym, k: 'j', d: r }; }); });
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
        var g = G[k] || (G[k] = { apt: deent(t.apt), mo: {}, sN: 0, ar: [] });
        var m = g.mo[x.ym] || (g.mo[x.ym] = { s: [], j: [] });
        if (x.k === 's') { m.s.push(t.amount); g.sN++; g.ar.push(t.area); }
        else m.j.push(t.deposit);
      });
    });
    var list = Object.keys(G).map(function (k) {
      var g = G[k]; if (g.sN < 2) return null;
      var all = [];
      months.forEach(function (ym) { if (g.mo[ym]) all = all.concat(g.mo[ym].s); });
      var med = median(all), ar = median(g.ar);
      return { apt: g.apt, mo: g.mo, med: med, ar: ar, py: med / ar * PY, n: g.sN,
        label: g.apt + ' · ' + bucketOf(ar), code: code, mode: mode };
    }).filter(Boolean).sort(function (u, v) { return v.py - u.py; });
    SLOT[i] = { list: list, mo: months, code: code, mode: mode };
    var sel = el(d.apt);
    sel.innerHTML = '<option value="">— 단지 선택 —</option>';
    list.forEach(function (g, j) {
      var o = document.createElement('option'); o.value = j;
      o.textContent = g.apt + ' (평당 ' + n0(g.py) + '만)';
      sel.appendChild(o);
    });
    if (list.length) sel.value = '0';
    st.textContent = list.length + '곳 · ' + n + '개월';
    btn.disabled = false;
    drawCmp();
  });
}
function slotPick(i) {
  var v = el(slotIds(i).apt).value;
  if (v === '') return null;
  var g = SLOT[i].list[+v];
  if (!g) return null;
  return { g: g, mo: SLOT[i].mo, name: (BY[SLOT[i].code] ? BY[SLOT[i].code].name + ' ' : '') + g.apt + ' ' + bucketOf(g.ar) };
}
function unionMonths(picks) {
  var s = {};
  picks.forEach(function (p) { p.mo.forEach(function (m) { s[m] = 1; }); });
  return Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
}
function drawCmp() {
  var picks = [0, 1, 2].map(slotPick).filter(Boolean);
  var tb = el('tCmp').tBodies[0]; tb.innerHTML = '';
  if (!picks.length) { el('cmpIns').innerHTML = ''; return; }
  var MO = unionMonths(picks);
  var COLS = [getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    getComputedStyle(document.documentElement).getPropertyValue('--m4').trim(),
    getComputedStyle(document.documentElement).getPropertyValue('--ember').trim()];
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var labels = MO.map(function (m) { return ymL(m); });
  function ser(p, f) {
    return MO.map(function (m) {
      var mm = p.g.mo[m]; if (!mm) return null;
      var v = f === 's' ? median(mm.s) : median(mm.j);
      return v ? +(v / 10000).toFixed(2) : null;
    });
  }
  function gapSer(p) {
    return MO.map(function (m) {
      var mm = p.g.mo[m]; if (!mm) return null;
      var s = median(mm.s), j = median(mm.j);
      return (s && j) ? +((s - j) / 10000).toFixed(2) : null;
    });
  }
  if (chartC1) chartC1.destroy();
  chartC1 = new Chart(el('cCmp1').getContext('2d'), {
    type: 'line',
    data: { labels: labels, datasets: picks.map(function (p, i) {
      return { label: p.name, data: ser(p, 's'), borderColor: COLS[i], borderWidth: 2.4,
        pointRadius: 2, spanGaps: true, tension: .2 }; }) },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: function (t) { return t.dataset.label + ' ' + t.formattedValue + '억'; } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 }, callback: function (v) { return v + '억'; } } } } }
  });
  if (chartC2) chartC2.destroy();
  chartC2 = new Chart(el('cCmp2').getContext('2d'), {
    type: 'line',
    data: { labels: labels, datasets: picks.map(function (p, i) {
      return { label: p.name + ' 갭', data: gapSer(p), borderColor: COLS[i], borderWidth: 2.2,
        pointRadius: 2, spanGaps: true, tension: .2, borderDash: [5, 3] }; }) },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: function (t) { return t.dataset.label + ' ' + t.formattedValue + '억'; } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 }, callback: function (v) { return v + '억'; } } } } }
  });

  var meta = picks.map(function (p) {
    var s = ser(p, 's').filter(function (v) { return v != null; });
    var j = ser(p, 'j').filter(function (v) { return v != null; });
    var gp = gapSer(p).filter(function (v) { return v != null; });
    var yrs = MO.length / 12;
    var ch = (s.length > 1 && s[0]) ? (s[s.length - 1] / s[0] - 1) * 100 : null;
    var cg = (ch != null && yrs >= .5) ? (Math.pow(1 + ch / 100, 1 / yrs) - 1) * 100 : null;
    return { p: p, first: s[0], last: s[s.length - 1], chg: ch, cagr: cg,
      je: j.length ? j[j.length - 1] : null, gap0: gp.length ? gp[0] : null, gap1: gp.length ? gp[gp.length - 1] : null };
  });
  meta.forEach(function (m, i) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="nm"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' +
      COLS[i] + ';margin-right:8px"></span>' + esc(m.p.name) + '</td>' +
      '<td>' + n0(m.p.g.py) + '만</td><td style="font-weight:700">' + won(m.p.g.med) + '</td>' +
      '<td>' + (m.je == null ? '—' : m.je.toFixed(2) + '억') + '</td>' +
      '<td>' + (m.gap1 == null ? '—' : m.gap1.toFixed(2) + '억') + '</td>' +
      '<td>' + (m.gap0 == null || m.gap1 == null ? '—' :
        '<span style="color:' + (m.gap1 < m.gap0 ? 'var(--good)' : '#B24A32') + ';font-weight:700">' +
        (m.gap1 - m.gap0 > 0 ? '+' : '') + (m.gap1 - m.gap0).toFixed(2) + '억</span>') + '</td>' +
      '<td>' + fmtPct(m.chg) + (m.cagr == null ? '' : '<div style="font-size:11px;color:var(--slate)">연 ' + n1(m.cagr) + '%</div>') + '</td>' +
      '<td>' + m.p.g.n + '건</td>';
    tb.appendChild(tr);
  });

  var L = [];
  if (picks.length >= 2) {
    var A = meta[0], B = meta[1];
    var r0 = (A.first && B.first) ? A.first / B.first : null;
    var r1 = (A.last && B.last) ? A.last / B.last : null;
    if (r0 && r1) L.push('<span class="hl">' + esc(A.p.name) + '</span>는 <span class="hl">' + esc(B.p.name) +
      '</span>의 ' + r1.toFixed(2) + '배. 기간 초 ' + r0.toFixed(2) + '배 → ' +
      (r1 > r0 ? '<span class="dn">격차 확대</span>' : '<span class="up">격차 축소</span>') + '.');
    if (A.last != null && B.last != null) {
      var d = A.last - B.last;
      var same = A.p.g.apt === B.p.g.apt;
      L.push((same ? '<span class="hl">같은 단지 평형 갈아타기</span> — ' : '') +
        '현재 매매가 차이는 <span class="hl">' + Math.abs(d).toFixed(2) + '억</span>' +
        (same ? '입니다. 이 금액이 평형을 올리는 데 드는 순수 차액이고, 여기에 취득세·중개보수가 더 붙습니다.' : '입니다.'));
    }
    if (A.chg != null && B.chg != null) L.push('기간 상승률 ' + fmtPct(A.chg) + ' vs ' + fmtPct(B.chg) +
      (A.cagr != null && B.cagr != null ? ' (연복리 ' + n1(A.cagr) + '% vs ' + n1(B.cagr) + '%)' : '') + '.');
  }
  meta.forEach(function (m) {
    if (m.gap0 != null && m.gap1 != null) {
      var dd = m.gap1 - m.gap0;
      L.push('<span class="hl">' + esc(m.p.name) + '</span> 갭 ' + m.gap0.toFixed(2) + '억 → ' + m.gap1.toFixed(2) + '억, ' +
        (dd < 0 ? '<span class="up">' + Math.abs(dd).toFixed(2) + '억 축소</span> — 진입 부담이 줄었습니다.'
          : '<span class="dn">' + dd.toFixed(2) + '억 확대</span> — 진입 부담이 커졌습니다.'));
    }
  });
  /* 배율 추이 (A ÷ B) */
  if (picks.length >= 2) {
    var sa = ser(picks[0], 's'), sb = ser(picks[1], 's');
    var rr = sa.map(function (v, i) { return (v != null && sb[i]) ? +(v / sb[i]).toFixed(3) : null; });
    var vals = rr.filter(function (v) { return v != null; });
    if (vals.length >= 4) {
      var cur = vals[vals.length - 1];
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      var avg = vals.reduce(function (u, v) { return u + v; }, 0) / vals.length;
      var below = vals.filter(function (v) { return v < cur; }).length;
      var pct = below / (vals.length - 1);
      el('cmpBand').innerHTML =
        '<div class="kpi hero"><span class="lb">현재 배율 (A ÷ B)</span><span class="vl">' + cur.toFixed(3) + '</span>' +
          '<span class="sb">' + esc(picks[0].name) + ' ÷ ' + esc(picks[1].name) + '</span></div>' +
        kpi('기간 평균 배율', avg.toFixed(3), '최저 ' + mn.toFixed(3) + ' · 최고 ' + mx.toFixed(3), '') +
        kpi('밴드 위치', Math.round(pct * 100) + '%', bandWord(pct) + ' · 낮을수록 A를 사기 유리', pct <= .3 ? 'good' : 'sig') +
        kpi('평균 회귀 시 A 가격', (avg * (sb[sb.length - 1] || 0)).toFixed(2) + '억',
            '지금 ' + (sa[sa.length - 1] || 0).toFixed(2) + '억 대비 ' +
            ((avg * (sb[sb.length - 1] || 0)) - (sa[sa.length - 1] || 0) >= 0 ? '+' : '') +
            ((avg * (sb[sb.length - 1] || 0)) - (sa[sa.length - 1] || 0)).toFixed(2) + '억', '');
      if (chartC3) chartC3.destroy();
      chartC3 = new Chart(el('cCmp3').getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: '배율 (A÷B)', data: rr, borderColor: COLS[0], borderWidth: 2.4, pointRadius: 2, spanGaps: true, tension: .2 },
          { label: '기간 평균', data: labels.map(function () { return +avg.toFixed(3); }),
            borderColor: COLS[2], borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0 } ] },
        options: { responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: true, labels: { boxWidth: 12, font: { size: 12 } } } },
          scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 12 } },
            y: { grid: { color: lineC }, ticks: { font: { size: 11 } } } } }
      });
      L.push('배율은 지금 <span class="hl">' + cur.toFixed(3) + '</span>, 조회 기간 평균 ' + avg.toFixed(3) +
        ' · 밴드 <span class="hl">' + Math.round(pct * 100) + '%</span>. ' +
        (pct <= .3 ? '<span class="up">A가 상대적으로 싼 구간</span>입니다.'
          : pct >= .7 ? '<span class="dn">A가 상대적으로 비싼 구간</span>입니다.' : '중립 구간입니다.'));
    }
  } else { el('cmpBand').innerHTML = ''; if (chartC3) { chartC3.destroy(); chartC3 = null; } }
  el('cmpIns').innerHTML = '<h4>비교 해석</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}
function imgCmp() {
  var picks = [0, 1, 2].map(slotPick).filter(Boolean);
  if (!picks.length) return;
  var MO = unionMonths(picks);
  exportPNG({
    title: '단지 비교',
    sub: '국토부 실거래 ' + MO.length + '개월 중위값 · ' + ymL(MO[0]) + '~' + ymL(MO[MO.length - 1]),
    headers: ['단지', '평당가', '매매', '전세', '갭', '기간 상승률', '연복리'],
    weights: [2.9, 1.0, 1.1, 1.1, 1.0, 1.15, 1.0],
    bold: [2], signed: [5, 6],
    rows: picks.map(function (p) {
      var ms = MO.map(function (m) { return p.g.mo[m] ? median(p.g.mo[m].s) : null; }).filter(Boolean);
      var mj = MO.map(function (m) { return p.g.mo[m] ? median(p.g.mo[m].j) : null; }).filter(Boolean);
      var l1 = ms[ms.length - 1], j1 = mj.length ? mj[mj.length - 1] : null;
      var ch = (ms.length > 1) ? (l1 / ms[0] - 1) * 100 : null;
      var yrs = MO.length / 12;
      var cg = (ch != null && yrs >= .5) ? (Math.pow(1 + ch / 100, 1 / yrs) - 1) * 100 : null;
      return [p.name, n0(p.g.py) + '만', won(p.g.med), j1 ? won(j1) : '—',
        (l1 && j1) ? won(l1 - j1) : '—', ch == null ? '—' : fmtPct(ch), cg == null ? '—' : n1(cg) + '%'];
    }),
    note: '매매·전세는 월별 중위값의 최근값 · 갭 = 매매 − 전세 · 연복리는 조회 기간 기준',
    file: 'apt_compare'
  });
}

/* ══════════ 최종 검토 (장바구니) ══════════ */
var CART = [];
function cartLoad() { try { CART = JSON.parse(localStorage.getItem('td2_cart') || '[]'); } catch (e) { CART = []; } }
function cartSave() { try { localStorage.setItem('td2_cart', JSON.stringify(CART)); } catch (e) { } cartBadge(); }
function cartBadge() {
  ['cartN', 'cartG'].forEach(function (id) {
    var b = el(id);
    if (b) { b.textContent = CART.length ? CART.length : ''; b.hidden = !CART.length; }
  });
}
function cartAdd(item) {
  if (CART.some(function (x) { return x.key === item.key; })) return false;
  if (CART.length >= 6) { alert('최대 6곳까지 담을 수 있습니다.'); return false; }
  CART.push(item); cartSave(); return true;
}
function cartDel(key) { CART = CART.filter(function (x) { return x.key !== key; }); cartSave(); renderFinal(); }
/** 월 원리금균등 상환액 (만원) */
function monthlyPay(loan, ratePct, years) {
  if (!loan) return 0;
  var r = ratePct / 1200, n = years * 12;
  if (r <= 0) return loan / n;
  return loan * r / (1 - Math.pow(1 + r, -n));
}
function renderFinal() {
  var c = CFG();
  var yrs = num('pfYears'), rate = num('pfRate');
  var box = el('pfWrap');
  if (!CART.length) {
    box.innerHTML = '<div class="empty">담긴 매물이 없습니다.<br><br>' +
      '<b>단지 솔팅</b>이나 <b>대장 아파트</b> 탭에서 <b>담기</b> 버튼을 누르면 여기에 모입니다. 최대 6곳까지 나란히 비교합니다.</div>';
    el('pfKpi').innerHTML = ''; el('pfIns').innerHTML = '';
    return;
  }
  var rows = CART.map(function (it) {
    var r = BY[it.code] || { reg: false, cap: false, name: it.region };
    var price = it.med;
    var L = loanOf(price, r, c);
    var tax = acqTax(price, it.area || c.area, c.taxOwn, r.reg);
    var fee = broker(price);
    var need = price - L.loan + tax + fee + c.etc;
    var gap = it.jeon ? price - it.jeon : null;
    var gapNeed = it.jeon ? (price - it.jeon) + acqTax(price, it.area || c.area, Math.max(1, c.taxOwn), r.reg) + fee + c.etc : null;
    var pay = monthlyPay(L.loan, rate, yrs);
    return { it: it, r: r, price: price, L: L, tax: tax, fee: fee, need: need,
      gap: gap, gapNeed: gapNeed, pay: pay, ok: need <= c.cash };
  }).sort(function (a, b) { return a.need - b.need; });

  var best = rows.filter(function (x) { return x.ok; })[0];
  var cheapest = rows[0];
  el('pfKpi').innerHTML =
    '<div class="kpi hero"><span class="lb">담긴 매물</span><span class="vl">' + CART.length + '곳</span>' +
      '<span class="sb">보유 현금 ' + won(c.cash) + ' 기준 · 실행 가능 ' +
      rows.filter(function (x) { return x.ok; }).length + '곳</span></div>' +
    kpi('현금으로 되는 최상단', best ? best.it.apt : '없음',
        best ? best.it.region + ' · 필요 ' + won(best.need) : '조건을 조정해 보세요', best ? 'good' : 'sig') +
    kpi('가장 적게 드는 곳', cheapest.it.apt, cheapest.it.region + ' · ' + won(cheapest.need), '') +
    kpi('월 상환액 범위', won(Math.min.apply(null, rows.map(function (x) { return x.pay; }))) + ' ~ ' +
        won(Math.max.apply(null, rows.map(function (x) { return x.pay; }))),
        rate + '% · ' + yrs + '년 원리금균등', 'sig');

  var h = '<div class="tblwrap"><table id="tPf"><thead><tr>' +
    '<th>매물</th><th>매매가</th><th>대출</th><th>제약</th><th>취득세 등</th><th>중개보수</th>' +
    '<th>등기·이사</th><th>총 필요현금</th><th>월 상환액</th><th>전세</th><th>갭 매수 필요현금</th><th></th>' +
    '</tr></thead><tbody>';
  rows.forEach(function (x) {
    h += '<tr' + (x.ok ? ' class="pick"' : '') + '>' +
      '<td class="nm"><b>' + esc(x.it.apt) + '</b><div style="font-size:11.5px;color:var(--slate)">' +
        esc(x.it.region) + ' · ' + esc(x.it.bucket) + (x.r.reg ? ' · <span style="color:#B24A32">규제</span>' : '') + '</div></td>' +
      '<td>' + won(x.price) + '</td>' +
      '<td>' + won(x.L.loan) + '</td>' +
      '<td><span class="b no">' + x.L.bind + '</span></td>' +
      '<td>' + won(x.tax) + '<div style="font-size:11px;color:var(--slate)">' + n1(x.tax / x.price * 100) + '%</div></td>' +
      '<td>' + won(x.fee) + '</td><td>' + won(c.etc) + '</td>' +
      '<td style="font-weight:700;color:' + (x.ok ? 'var(--good)' : 'var(--slate)') + '">' + won(x.need) + '</td>' +
      '<td style="font-weight:700">' + won(x.pay) + '</td>' +
      '<td>' + (x.it.jeon ? won(x.it.jeon) : '—') + '</td>' +
      '<td>' + (x.gapNeed == null ? '—' : won(x.gapNeed)) + '</td>' +
      '<td><button class="btn ghost sm" data-del="' + esc(x.it.key) + '">빼기</button></td></tr>';
  });
  h += '</tbody></table></div>';
  box.innerHTML = h;
  box.querySelectorAll('[data-del]').forEach(function (b) {
    b.addEventListener('click', function () { cartDel(b.dataset.del); });
  });

  var L = [];
  if (best) L.push('보유 현금 <span class="hl">' + won(c.cash) + '</span>으로 실행 가능한 곳 중 가장 비싼 매물은 ' +
    '<span class="hl">' + esc(best.it.apt) + '</span>(' + esc(best.it.region) + ')이며, 필요 현금 <span class="hl">' +
    won(best.need) + '</span>, 월 상환액 <span class="hl">' + won(best.pay) + '</span>입니다.');
  else L.push('<span class="dn">담긴 매물 중 현재 현금으로 실행 가능한 곳이 없습니다.</span> 대출 조건이나 평형을 조정해 보세요.');
  if (rows.length >= 2) {
    var a0 = rows[0], a1 = rows[rows.length - 1];
    L.push('필요 현금 차이는 <span class="hl">' + won(a1.need - a0.need) + '</span>(' + esc(a0.it.apt) + ' ↔ ' +
      esc(a1.it.apt) + '), 월 상환액 차이는 <span class="hl">' + won(Math.abs(a1.pay - a0.pay)) + '</span>입니다.');
    var gaps = rows.filter(function (x) { return x.gapNeed != null; });
    if (gaps.length) {
      var mg = gaps.slice().sort(function (u, v) { return u.gapNeed - v.gapNeed; })[0];
      L.push('전세를 끼고 들어간다면 <span class="hl">' + esc(mg.it.apt) + '</span>이 가장 적게 듭니다 — ' +
        won(mg.gapNeed) + ' (대출 없이, 취득세·중개보수 포함).');
    }
  }
  L.push('월 상환액은 <b>원리금균등 ' + yrs + '년, 금리 ' + rate + '%</b> 가정입니다. 실제 금리·기간·중도상환 조건은 은행마다 다릅니다.');
  el('pfIns').innerHTML = '<h4>최종 검토</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
  renderReport();
}
function imgPf() {
  if (!CART.length) return;
  var c = CFG(), yrs = num('pfYears'), rate = num('pfRate');
  var rows = CART.map(function (it) {
    var r = BY[it.code] || { reg: false, cap: false };
    var L = loanOf(it.med, r, c);
    var tax = acqTax(it.med, it.area || c.area, c.taxOwn, r.reg);
    var need = it.med - L.loan + tax + broker(it.med) + c.etc;
    return [it.apt + ' (' + it.region + ')', won(it.med), won(L.loan), won(tax), won(need),
      won(monthlyPay(L.loan, rate, yrs)), it.jeon ? won(it.med - it.jeon) : '—'];
  });
  exportPNG({
    title: '최종 검토 매물 비교',
    sub: '보유 현금 ' + won(c.cash) + ' · 대출 ' + rate + '% ' + yrs + '년 원리금균등 기준',
    headers: ['매물', '매매가', '대출', '취득세 등', '총 필요현금', '월 상환액', '갭'],
    weights: [2.8, 1.1, 1.0, 1.05, 1.2, 1.1, 1.0],
    bold: [4],
    rows: rows,
    note: '총 필요현금 = 매매가 − 대출 + 취득세 + 중개보수 + 등기·이사비 · 실제 조건은 은행·세무 상담 필요',
    file: 'final_review'
  });
}

/* ══════════ 거래량 ══════════ */
var VOL = null, chartV1 = null;
function runVol() {
  var code = el('volReg').value, n = +el('volMo').value, mode = el('volArea').value;
  var st = el('volStat'), btn = el('volRun');
  btn.disabled = true;
  var months = ymList(n).slice().reverse();
  var done = 0;
  var tasks = months.map(function (ym) {
    return function () {
      return getTr(code, ym, 'sale').then(function (d) {
        done++; st.textContent = '불러오는 중 ' + done + '/' + months.length;
        return { ym: ym, d: d };
      });
    };
  });
  pool(tasks, 8).then(function (res) {
    var series = months.map(function (ym) {
      var hit = res.filter(function (x) { return x && x.ym === ym; })[0];
      if (!hit || !hit.d || !hit.d.items) return { ym: ym, n: null, amt: null };
      var items = hit.d.items.filter(function (t) {
        return !t.canceled && (mode === 'all' || areaPass(t.area, mode));
      });
      var py = items.map(function (t) { return t.amount / t.area * PY; });
      return { ym: ym, n: items.length, py: median(py) };
    });
    VOL = { code: code, months: months, series: series, mode: mode };
    drawVol();
    btn.disabled = false;
  });
}
function drawVol() {
  if (!VOL) return;
  var r = BY[VOL.code], S = VOL.series;
  var valid = S.filter(function (x) { return x.n != null; });
  if (!valid.length) { el('volStat').textContent = '거래 데이터가 없습니다.'; return; }

  /* 최근 3개월 / 12개월 평균 */
  var last3 = S.slice(-3).filter(function (x) { return x.n != null; });
  var last12 = S.slice(-12).filter(function (x) { return x.n != null; });
  var avg3 = last3.length ? last3.reduce(function (a, x) { return a + x.n; }, 0) / last3.length : null;
  var avg12 = last12.length ? last12.reduce(function (a, x) { return a + x.n; }, 0) / last12.length : null;
  var ratio = (avg3 != null && avg12) ? avg3 / avg12 : null;

  /* 조회 기간 내 백분위 (12개월 이동평균 기준) */
  var ma = S.map(function (x, i) {
    var w = S.slice(Math.max(0, i - 11), i + 1).filter(function (y) { return y.n != null; });
    return w.length >= 6 ? w.reduce(function (a, y) { return a + y.n; }, 0) / w.length : null;
  });
  var mv = ma.filter(function (v) { return v != null; });
  var curMa = mv.length ? mv[mv.length - 1] : null;
  var pctile = (curMa != null && mv.length > 1)
    ? mv.filter(function (v) { return v < curMa; }).length / (mv.length - 1) : null;

  /* 가격 방향 — KB ㎡당가 (지방 확장 지역은 실거래 평당가로 대체) */
  var pDir = null, pLabel = '';
  if (r && r.s) { pDir = chg(r.s, 3); pLabel = '실거래 평당가 3개월'; }
  else {
    var pys = S.filter(function (x) { return x.py; });
    if (pys.length >= 6) {
      var a0 = median(pys.slice(-6, -3).map(function (x) { return x.py; }));
      var a1 = median(pys.slice(-3).map(function (x) { return x.py; }));
      if (a0 && a1) { pDir = (a1 / a0 - 1) * 100; pLabel = '실거래 평당가 3개월'; }
    }
  }
  var vUp = ratio != null && ratio >= 1.1, vDn = ratio != null && ratio <= 0.9;
  var pUp = pDir != null && pDir > 0.3, pDn = pDir != null && pDir < -0.3;
  var quad, qtxt, qcls;
  if (pUp && vUp) { quad = '강한 상승'; qtxt = '가격과 거래량이 함께 오릅니다. 매수세가 실제로 붙은 국면입니다.'; qcls = 'good'; }
  else if (pUp && vDn) { quad = '상승 동력 둔화'; qtxt = '가격은 오르는데 거래가 줄었습니다. 호가만 오르고 손바뀜은 없는 상태일 수 있습니다.'; qcls = 'sig'; }
  else if (pDn && vUp) { quad = '손바뀜 · 바닥 탐색'; qtxt = '가격은 빠지는데 거래가 늘었습니다. 매도·매수가 맞춰지며 바닥을 찾는 국면일 수 있습니다.'; qcls = 'good'; }
  else if (pDn && vDn) { quad = '침체 지속'; qtxt = '가격도 거래도 줄었습니다. 관망이 길어지는 구간입니다.'; qcls = ''; }
  else { quad = '중립'; qtxt = '뚜렷한 방향이 잡히지 않았습니다.'; qcls = ''; }

  el('volKpi').innerHTML =
    '<div class="kpi hero"><span class="lb">거래량 배율 (3개월 ÷ 12개월)</span><span class="vl">' +
      (ratio == null ? '—' : ratio.toFixed(2) + '배') + '</span><span class="sb">' +
      (avg3 == null ? '' : '최근 3개월 월평균 ' + n1(avg3) + '건 · 12개월 ' + n1(avg12) + '건') + '</span></div>' +
    kpi('거래량 백분위', pctile == null ? '—' : Math.round(pctile * 100) + '%',
        '조회 ' + VOL.months.length + '개월 내 12개월 이동평균 기준', pctile != null && pctile >= .7 ? 'good' : '') +
    kpi('가격 방향', pDir == null ? '—' : fmtPct(pDir), pLabel, pDir != null && pDir > 0 ? 'good' : 'sig') +
    kpi('국면 판정', quad, '가격 × 거래량 조합', qcls);

  /* 차트 */
  var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var ice = getComputedStyle(document.documentElement).getPropertyValue('--m4').trim();
  var ember = getComputedStyle(document.documentElement).getPropertyValue('--ember').trim();
  var labels = S.map(function (x) { return ymL(x.ym); });
  if (chartV1) chartV1.destroy();
  chartV1 = new Chart(el('cVol').getContext('2d'), {
    type: 'bar',
    data: { labels: labels, datasets: [
      { label: '월 거래건수', data: S.map(function (x) { return x.n; }), backgroundColor: ice, borderRadius: 4, order: 2 },
      { label: '12개월 이동평균', data: ma, type: 'line', borderColor: ember, borderWidth: 2.6,
        pointRadius: 0, tension: .25, order: 1 } ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 14, usePointStyle: true, font: { size: 13 } } } },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxTicksLimit: 14 } },
        y: { grid: { color: lineC }, ticks: { font: { size: 11 }, callback: function (v) { return v + '건'; } } } } }
  });

  /* 표 */
  var tb = el('tVol').tBodies[0]; tb.innerHTML = '';
  S.slice().reverse().forEach(function (x, i) {
    var idx = S.length - 1 - i;
    var prev = idx > 0 ? S[idx - 1].n : null;
    var d = (x.n != null && prev) ? (x.n / prev - 1) * 100 : null;
    var tr = document.createElement('tr');
    tr.innerHTML = '<td class="nm">' + ymL(x.ym) + '</td>' +
      '<td style="font-weight:700">' + (x.n == null ? '—' : n0(x.n) + '건') + '</td>' +
      '<td>' + (d == null ? '—' : '<span style="color:' + (d >= 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(d) + '</span>') + '</td>' +
      '<td>' + (ma[idx] == null ? '—' : n1(ma[idx]) + '건') + '</td>' +
      '<td>' + (x.py ? n0(x.py) + '만' : '—') + '</td>';
    tb.appendChild(tr);
  });

  /* 해석 */
  var L = [];
  L.push('<span class="hl">' + esc(r ? r.name : '') + '</span> 최근 3개월 월평균 거래는 <span class="hl">' +
    (avg3 == null ? '—' : n1(avg3) + '건</span>, 12개월 평균 ' + n1(avg12) + '건 — 배율 <span class="hl">' +
    ratio.toFixed(2) + '배</span>') + '.');
  if (ratio != null) L.push(ratio >= 1.3 ? '<span class="up">거래가 뚜렷하게 늘었습니다</span> (배율 1.3 이상). 매수세 유입 신호로 봅니다.'
    : ratio >= 1.1 ? '거래가 조금 늘었습니다.'
    : ratio <= 0.7 ? '<span class="dn">거래가 크게 줄었습니다</span> (배율 0.7 이하). 관망 국면입니다.'
    : ratio <= 0.9 ? '거래가 다소 줄었습니다.' : '거래량은 평소 수준입니다.');
  if (pctile != null) L.push('조회 기간 안에서 현재 거래량은 <span class="hl">' + Math.round(pctile * 100) +
    '% 지점</span>입니다 (12개월 이동평균 기준).');
  L.push('<b>국면: ' + quad + '</b> — ' + qtxt);
  if (r && r.s) {
    var jb = band(jrS(r), 10);
    if (jb) L.push('전세가율 밴드는 <span class="hl">' + Math.round(jb.pct * 100) + '%</span>입니다. ' +
      (jb.pct >= .7 && vUp ? '<span class="up">진입 부담이 낮은데 거래도 늘고 있습니다 — 소외가 아니라 저평가일 가능성.</span>'
        : jb.pct >= .7 && vDn ? '<span class="dn">진입 부담은 낮지만 거래가 없습니다 — 저평가보다 소외에 가깝습니다.</span>'
        : jb.pct <= .3 && vUp ? '매매가가 역사적으로 비싼데 거래까지 늘고 있어 과열을 살펴야 합니다.'
        : '밴드와 거래량이 뚜렷한 조합을 만들지는 않습니다.'));
  }
  el('volIns').innerHTML = '<h4>거래량 읽기</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
  el('volStat').textContent = valid.length + '개월 · 총 ' +
    n0(valid.reduce(function (a, x) { return a + x.n; }, 0)) + '건' +
    (VOL.mode === 'all' ? '' : ' · ' + VOL.mode + '㎡대');
}
function imgVol() {
  if (!VOL) return;
  var r = BY[VOL.code], S = VOL.series;
  var last3 = S.slice(-3).filter(function (x) { return x.n != null; });
  var last12 = S.slice(-12).filter(function (x) { return x.n != null; });
  var avg3 = last3.length ? last3.reduce(function (a, x) { return a + x.n; }, 0) / last3.length : null;
  var avg12 = last12.length ? last12.reduce(function (a, x) { return a + x.n; }, 0) / last12.length : null;
  exportPNG({
    title: (r ? r.name : '') + ' 아파트 거래량',
    sub: '국토부 실거래 · ' + VOL.months.length + '개월 · ' + (VOL.mode === 'all' ? '전체 평형' : VOL.mode + '㎡대'),
    stats: [
      { label: '최근 3개월 월평균', value: avg3 == null ? '—' : n1(avg3) + '건' },
      { label: '12개월 월평균', value: avg12 == null ? '—' : n1(avg12) + '건' },
      { label: '거래량 배율', value: (avg3 != null && avg12) ? (avg3 / avg12).toFixed(2) + '배' : '—',
        color: (avg3 != null && avg12 && avg3 / avg12 >= 1.1) ? 'good' : (avg3 / avg12 <= 0.9 ? 'bad' : '') }
    ],
    headers: ['월', '거래건수', '전월 대비', '평당가'],
    weights: [1.2, 1.3, 1.25, 1.25],
    signed: [2], twoCol: true,
    rows: S.slice().reverse().map(function (x, i) {
      var idx = S.length - 1 - i, prev = idx > 0 ? S[idx - 1].n : null;
      var d = (x.n != null && prev) ? (x.n / prev - 1) * 100 : null;
      return [ymL(x.ym), x.n == null ? '—' : n0(x.n) + '건', d == null ? '—' : fmtPct(d),
        x.py ? n0(x.py) + '만' : '—'];
    }),
    max: 36,
    note: '해제(취소) 거래 제외 · 평당가는 전용면적 기준 월별 중위값 · 최근 1~2개월은 신고 지연으로 과소 집계될 수 있음',
    file: 'volume'
  });
}

/* ══════════ 매매·전세 4분면 시장강도 ══════════ */
var QSIDO = '수도권', QMO = 12, chartQ = null, LASTQ = [], QDONG = null, chartQD = null;
function qChg(series, m) {
  var li = lastIdx(series); if (li < m) return null;
  var a = series[li - m], b = series[li];
  return (a && b) ? (b / a - 1) * 100 : null;
}
function quadOf(s, j) {
  if (s == null || j == null) return { k: 0, t: '—', c: 'var(--slate)' };
  if (s > 0 && j > 0) return { k: 1, t: '동반 상승', c: '#1B6B4A' };
  if (s > 0 && j <= 0) return { k: 2, t: '매매 주도', c: '#C8862F' };
  if (s <= 0 && j > 0) return { k: 3, t: '전세 주도', c: '#2F6D8E' };
  return { k: 4, t: '동반 하락', c: '#B24A32' };
}
function renderQuad() {
  var list;
  if (QSIDO === '수도권') list = SGG.filter(function (r) { return r.cap; });
  else if (QSIDO === '전체') list = SGG.slice();
  else if (QSIDO === '시도') list = R.filter(function (r) { return r.kind === 'agg' && last(r.s); });
  else list = SGG.filter(function (r) { return r.sido === QSIDO; });

  var pts = list.map(function (r) {
    var s = qChg(r.s, QMO), j = qChg(r.j, QMO);
    if (s == null || j == null) return null;
    var q = quadOf(s, j);
    return { r: r, s: s, j: j, q: q, jr: last(r.j) / last(r.s) * 100, py: pyPrice(last(r.s)) };
  }).filter(Boolean).sort(function (u, v) { return v.s - u.s; });
  LASTQ = pts;

  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  var inkC = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  var mxP = Math.max.apply(null, pts.map(function (p) { return p.py; })) || 1;
  var data = pts.map(function (p) {
    return { x: +p.s.toFixed(2), y: +p.j.toFixed(2), r: 8 + Math.sqrt(p.py / mxP) * 16, nm: p.r.name, q: p.q };
  });
  if (chartQ) chartQ.destroy();
  chartQ = new Chart(el('cQuad').getContext('2d'), {
    type: 'bubble',
    data: { datasets: [{ data: data,
      backgroundColor: data.map(function (d) { return d.q.c + '55'; }),
      borderColor: data.map(function (d) { return d.q.c; }), borderWidth: 1.6 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: function (t) {
          var d = t.raw; return d.nm + ' · 매매 ' + (d.x > 0 ? '+' : '') + d.x + '% · 전세 ' + (d.y > 0 ? '+' : '') + d.y + '% · ' + d.q.t; } } } },
      scales: {
        x: { title: { display: true, text: '매매 변화율 (%)', font: { size: 12 } },
             grid: { color: lineC }, ticks: { font: { size: 11 } } },
        y: { title: { display: true, text: '전세 변화율 (%)', font: { size: 12 } },
             grid: { color: lineC }, ticks: { font: { size: 11 } } } },
      onClick: function (e, els) {
        if (!els.length) return;
        var p = pts[els[0].index];
        if (p && p.r.kind === 'sgg') { el('qdReg').value = p.r.code; runQuadDong(); }
      } },
    plugins: [{
      id: 'zeroline',
      beforeDatasetsDraw: function (c) {
        var x = c.scales.x, y = c.scales.y, ctx = c.ctx;
        ctx.save(); ctx.strokeStyle = lineC; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(x.getPixelForValue(0), y.top); ctx.lineTo(x.getPixelForValue(0), y.bottom);
        ctx.moveTo(x.left, y.getPixelForValue(0)); ctx.lineTo(x.right, y.getPixelForValue(0)); ctx.stroke();
        ctx.restore();
      },
      afterDatasetsDraw: function (c) {
        var ctx = c.ctx, meta = c.getDatasetMeta(0);
        ctx.save();
        ctx.font = "600 11px 'Pretendard Variable',Pretendard,sans-serif";
        ctx.fillStyle = inkC; ctx.textAlign = 'center';
        meta.data.forEach(function (pt, i) {
          var nm = data[i].nm.replace(/^(서울|인천|부산|대구|광주|대전|울산) /, '');
          if (data[i].r < 11) return;
          ctx.fillText(nm, pt.x, pt.y + 4);
        });
        ctx.restore();
      }
    }]
  });

  var tb = el('tQuad').tBodies[0]; tb.innerHTML = '';
  pts.forEach(function (p) {
    var tr = document.createElement('tr');
    tr.className = p.r.kind === 'sgg' ? 'clickable' : '';
    if (p.r.kind === 'sgg') tr.dataset.qc = p.r.code;
    tr.innerHTML = '<td class="nm">' + esc(p.r.name) + '</td>' +
      '<td style="font-weight:700;color:' + (p.s > 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(p.s) + '</td>' +
      '<td style="color:' + (p.j > 0 ? 'var(--good)' : '#B24A32') + '">' + fmtPct(p.j) + '</td>' +
      '<td><span class="b" style="background:' + p.q.c + '22;color:' + p.q.c + '">' + p.q.t + '</span></td>' +
      '<td>' + n0(p.py) + '만</td><td>' + n1(p.jr) + '%</td>' +
      '<td>' + (p.r.kind === 'sgg' ? (RANK[p.r.code] ? decile(p.r.code) + '분위' : '—') : '—') + '</td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-qc]').forEach(function (tr) {
    tr.addEventListener('click', function () { el('qdReg').value = tr.dataset.qc; runQuadDong(); });
  });

  var cnt = [0, 0, 0, 0, 0];
  pts.forEach(function (p) { cnt[p.q.k]++; });
  el('qKpi').innerHTML =
    kpi('동반 상승', cnt[1] + '곳', '매매↑ 전세↑ · 실수요와 기대가 함께', 'good') +
    kpi('매매 주도', cnt[2] + '곳', '매매↑ 전세↓ · 기대 선반영, 갭 확대', 'sig') +
    kpi('전세 주도', cnt[3] + '곳', '매매↓ 전세↑ · 사용가치 견조, 갭 축소', '') +
    kpi('동반 하락', cnt[4] + '곳', '매매↓ 전세↓ · 수요 이탈', '');
  var L = [];
  var top = pts.filter(function (p) { return p.q.k === 3; }).slice(0, 3);
  if (top.length) L.push('<span class="hl">전세 주도</span> 구간(매매↓ 전세↑)은 ' +
    top.map(function (p) { return esc(p.r.name); }).join(' · ') + ' 입니다. ' +
    '갭이 줄어드는 방향이라 <b>같은 돈으로 들어가기 쉬워지는 국면</b>입니다.');
  var hot = pts.filter(function (p) { return p.q.k === 2; }).slice(0, 3);
  if (hot.length) L.push('<span class="hl">매매 주도</span> 구간(매매↑ 전세↓)은 ' +
    hot.map(function (p) { return esc(p.r.name); }).join(' · ') + ' 입니다. ' +
    '기대가 값에 먼저 실린 상태라 <b>갭이 커지고 하방이 얇아집니다</b>.');
  L.push('가로축이 매매, 세로축이 전세 변화율입니다. 원 크기는 평당가 — <b>클수록 상급지</b>입니다. ' +
    '원이나 표의 지역을 누르면 그 시·군·구의 <b>읍면동별</b> 4분면이 아래에 나옵니다.');
  el('qIns').innerHTML = '<h4>4분면 읽기</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}
