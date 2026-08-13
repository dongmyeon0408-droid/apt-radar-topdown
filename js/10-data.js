'use strict';
function applyMapMode() {
  if (!KKEY) MAPMODE = MAPMODE === 'real' ? 'real' : MAPMODE;
  var real = MAPMODE === 'real';
  el('mapOpts').hidden = !real;
  el('mapbox').hidden = real;
  el('kmapwrap').hidden = !real;
  el('keybox').hidden = true;
  el('kkeyToggle').hidden = !real;
  if (!real) { renderMap(); return; }
  if (!KKEY) { el('kmapwrap').hidden = true; return; }
  loadKakao().then(function () { renderRealMap(); }, function (e) {
    el('kmapwrap').hidden = true; el('keybox').hidden = false;
    el('keybox').querySelector('p').textContent =
      '지도를 불러오지 못했습니다. 카카오 개발자 콘솔 > 플랫폼 키 > Web 사이트 도메인에 ' + location.origin +
      ' 이 등록돼 있는지 확인하세요. 다른 키를 쓰려면 아래에 입력하세요.';
  });
}

/* ══════════ 분위 지도 · 좌표 (시군구 대표점, 근사) ══════════ */
var CO = {
11110:[37.573,126.979],11140:[37.564,126.997],11170:[37.532,126.990],11200:[37.563,127.037],
11215:[37.538,127.082],11230:[37.574,127.040],11260:[37.606,127.093],11290:[37.589,127.017],
11305:[37.640,127.026],11320:[37.669,127.047],11350:[37.654,127.056],11380:[37.603,126.929],
11410:[37.579,126.937],11440:[37.566,126.902],11470:[37.517,126.867],11500:[37.551,126.850],
11530:[37.495,126.888],11545:[37.457,126.896],11560:[37.526,126.896],11590:[37.512,126.940],
11620:[37.478,126.952],11650:[37.484,127.033],11680:[37.518,127.048],11710:[37.515,127.106],
11740:[37.530,127.124],
41111:[37.304,126.983],41113:[37.258,126.972],41115:[37.279,127.014],41117:[37.259,127.046],
41131:[37.450,127.145],41133:[37.430,127.137],41135:[37.383,127.119],
41150:[37.738,127.034],41171:[37.386,126.926],41173:[37.392,126.957],41190:[37.503,126.766],
41210:[37.478,126.865],41220:[36.992,127.113],41250:[37.903,127.060],
41271:[37.301,126.847],41273:[37.319,126.812],
41281:[37.637,126.832],41285:[37.658,126.775],41287:[37.675,126.750],
41290:[37.429,126.988],41310:[37.594,127.130],41360:[37.636,127.216],41370:[37.150,127.077],
41390:[37.380,126.803],41410:[37.361,126.935],41430:[37.345,126.968],41450:[37.539,127.215],
41461:[37.234,127.201],41463:[37.280,127.115],41465:[37.322,127.098],
41480:[37.760,126.780],41500:[37.272,127.435],41550:[37.008,127.270],41570:[37.615,126.716],
41590:[37.199,126.831],41591:[37.196,126.895],41593:[37.228,126.940],41595:[37.208,127.047],
41597:[37.201,127.075],41610:[37.429,127.255],41630:[37.785,127.046],
28110:[37.474,126.622],28140:[37.474,126.643],28177:[37.464,126.650],28185:[37.410,126.678],
28200:[37.447,126.731],28237:[37.507,126.721],28245:[37.537,126.738],28260:[37.545,126.676],
26110:[35.106,129.032],26140:[35.098,129.024],26170:[35.129,129.045],26200:[35.091,129.068],
26230:[35.163,129.053],26260:[35.220,129.084],26290:[35.136,129.084],26320:[35.197,128.990],
26350:[35.163,129.164],26380:[35.105,128.975],26410:[35.243,129.092],26440:[35.212,128.960],
26470:[35.176,129.079],26500:[35.145,129.113],26530:[35.153,128.991],26710:[35.244,129.222],
27110:[35.869,128.606],27140:[35.887,128.645],27170:[35.872,128.559],27200:[35.846,128.598],
27230:[35.896,128.583],27260:[35.858,128.640],27290:[35.830,128.533],27710:[35.775,128.431],
29110:[35.146,126.923],29140:[35.152,126.880],29155:[35.126,126.902],29170:[35.184,126.912],
29200:[35.140,126.794],
30110:[36.312,127.455],30140:[36.325,127.421],30170:[36.355,127.384],30200:[36.372,127.356],
30230:[36.347,127.415],
31110:[35.569,129.333],31140:[35.534,129.330],31170:[35.505,129.417],31200:[35.583,129.361],
31710:[35.522,129.242],
36110:[36.480,127.289]
};
var MAPV = 'cap', SELCODE = null;
var VIEWS = {
  cap:  { lat: [36.85, 38.05], lng: [126.55, 127.55], t: '수도권' },
  all:  { lat: [34.90, 38.05], lng: [126.40, 129.50], t: '전국' },
  seoul:{ lat: [37.42, 37.71], lng: [126.80, 127.19], t: '서울' },
  metro:{ lat: [34.95, 36.55], lng: [126.70, 129.50], t: '지방 광역시' }
};
function tierColor(d) { return getComputedStyle(document.documentElement).getPropertyValue('--m' + d).trim(); }
function renderMap() {
  var v = VIEWS[MAPV], box = el('mapbox'), showLb = el('mapLabel').checked;
  var W = 900, H = MAPV === 'all' ? 780 : (MAPV === 'seoul' ? 560 : 700);
  var pad = 46;
  var list = SGG.filter(function (r) {
    var c = CO[r.code]; if (!c) return false;
    return c[0] >= v.lat[0] && c[0] <= v.lat[1] && c[1] >= v.lng[0] && c[1] <= v.lng[1];
  });
  function px(c) {
    var x = pad + (c[1] - v.lng[0]) / (v.lng[1] - v.lng[0]) * (W - pad * 2);
    var y = pad + (v.lat[1] - c[0]) / (v.lat[1] - v.lat[0]) * (H - pad * 2);
    return [x, y];
  }
  var mxP = Math.max.apply(null, list.map(function (r) { return last(r.s); }));
  var mnP = Math.min.apply(null, list.map(function (r) { return last(r.s); }));
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
  var pts = list.map(function (r) {
    var p = px(CO[r.code]);
    var t = (last(r.s) - mnP) / Math.max(1, mxP - mnP);
    var rad = (MAPV === 'all' ? 9 : 13) + Math.sqrt(t) * (MAPV === 'all' ? 15 : 22);
    return { r: r, x: p[0], y: p[1], rad: rad };
  }).sort(function (a, b) { return b.rad - a.rad; });
  pts.forEach(function (p) {
    var d = decile(p.r.code);
    svg += '<circle class="rg' + (p.r.code === SELCODE ? ' sel' : '') + '" data-c="' + p.r.code + '" cx="' +
      p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.rad.toFixed(1) + '" fill="' + tierColor(d) +
      '" fill-opacity="0.92" stroke="var(--panel)" stroke-width="1.4"><title>' + esc(p.r.name) +
      ' · ' + d + '분위 · 평당 ' + n0(pyPrice(last(p.r.s))) + '만</title></circle>';
  });
  if (showLb) pts.forEach(function (p) {
    if (p.rad < (MAPV === 'all' ? 11 : 0)) return;
    svg += '<text class="lb" x="' + p.x.toFixed(1) + '" y="' + (p.y + p.rad + 11).toFixed(1) +
      '" text-anchor="middle">' + esc(p.r.name.replace(/^(서울|인천|부산|대구|광주|대전|울산) /, '')) + '</text>';
  });
  svg += '</svg>';
  box.innerHTML = svg + '<div class="mtip" id="mtip"></div>';

  var lg = '<span style="margin-right:8px">비쌈</span>';
  for (var i = 1; i <= 10; i++) lg += '<i class="sw" style="background:' + tierColor(i) + '"></i>';
  lg += '<span style="margin-left:8px">쌈 · 1~10분위</span>' +
    '<span style="margin-left:auto">' + v.t + ' ' + list.length + '곳 · 원 크기 = 평당가</span>';
  el('mleg').innerHTML = lg;
  el('mleg').style.width = '100%';

  var tip = el('mtip');
  box.querySelectorAll('circle.rg').forEach(function (c) {
    c.addEventListener('click', function () { SELCODE = c.dataset.c; renderMap(); showDetail(c.dataset.c); });
    c.addEventListener('mousemove', function (e) {
      var r = BY[c.dataset.c], b = box.getBoundingClientRect();
      tip.innerHTML = '<b>' + esc(r.name) + '</b> · ' + decile(r.code) + '분위 (전국 ' + RANK[r.code] + '위)<br>' +
        '평당 ' + n0(pyPrice(last(r.s))) + '만 · 전세가율 ' + n1(last(r.j) / last(r.s) * 100) + '%';
      tip.style.opacity = 1;
      tip.style.left = Math.min(b.width - 210, e.clientX - b.left + 14) + 'px';
      tip.style.top = (e.clientY - b.top - 54) + 'px';
    });
    c.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
  });
  if (SELCODE && !BY[SELCODE]) SELCODE = null;
}
/* ── 급지 상세 + 인사이트 ── */
function showDetail(code) {
  var r = BY[code], c = CFG(); if (!r) return;
  el('dcard').hidden = false;
  var jb = band(jrS(r), 10), jr = last(r.j) / last(r.s) * 100, d = decile(code);
  var p84 = last(r.s) * 84, p59 = last(r.s) * 59;
  var nc = needCash(priceOf(r, c.area), r, c);
  var home = BY[el('home').value];
  var up = SORTED.filter(function (x) { return last(x.s) > last(r.s); }).slice(-3).reverse();
  var dn = SORTED.filter(function (x) { return last(x.s) < last(r.s); }).slice(0, 3);
  var c1 = chg(r.s, 12), c3 = chg(r.s, 36);

  var h = '<div class="dhead"><h3>' + esc(r.name) + '</h3>' +
    '<span class="b d1">' + d + '분위</span>' +
    '<span class="b no">전국 ' + RANK[code] + '위 / ' + NTOT + '</span>' +
    (r.reg ? '<span class="b reg">규제지역</span>' : '<span class="b free">비규제</span>') + '</div>';
  h += '<div class="dstat">' +
    '<div><span>평당가 (전용)</span><b>' + n0(pyPrice(last(r.s))) + '만</b></div>' +
    '<div><span>84㎡ / 59㎡ 매매</span><b>' + won(p84) + ' / ' + won(p59) + '</b></div>' +
    '<div><span>전세가율</span><b>' + n1(jr) + '%</b></div>' +
    '<div><span>내 조건 필요현금</span><b style="color:' + (nc.need <= c.cash ? 'var(--good)' : 'var(--slate)') + '">' +
      won(nc.need) + '</b></div></div>' +
    '<div class="dstat">' +
    '<div><span>10년 상승률</span><b>' + pctCell(chg10(r)) + ' ' + gradeHTML(chg10(r)) + '</b></div>' +
    '<div><span>10년 CAGR</span><b>' + (cagr10(r) == null ? '—' : n1(cagr10(r)) + '%') + '</b></div>' +
    '<div><span>전체 CAGR (2013.4~)</span><b>' + (cagrAll(r) == null ? '—' : n1(cagrAll(r)) + '%') + '</b></div>' +
    '<div><span>서울 평균 대비</span><b>' + (chg10(r) != null && BM.seoul10 != null
        ? (chg10(r) - BM.seoul10 >= 0 ? '+' : '') + n1(chg10(r) - BM.seoul10) + '%p' : '—') + '</b></div></div>';

  /* 인사이트 */
  var ins = [];
  ins.push('평당 <span class="hl">' + n0(pyPrice(last(r.s))) + '만원</span>으로 전국 <span class="hl">' + d +
    '분위</span>입니다. 상위 ' + Math.round(RANK[code] / NTOT * 100) + '% 지점.');
  if (c1 != null && c3 != null) {
    var acc = c1 > c3 / 3;
    ins.push('최근 1년 <span class="' + (c1 >= 0 ? 'up' : 'dn') + '">' + fmtPct(c1) + '</span>, 3년 <span class="' +
      (c3 >= 0 ? 'up' : 'dn') + '">' + fmtPct(c3) + '</span> — ' +
      (acc ? '최근 1년이 3년 평균보다 가팔라 <span class="hl">상승이 붙는 국면</span>입니다.'
           : '최근 1년이 3년 평균보다 완만해 <span class="hl">숨 고르는 국면</span>입니다.'));
  }
  var g10 = chg10(r), gc = cagr10(r);
  if (g10 != null) {
    ins.push('최근 10년 <span class="' + (g10 >= 100 ? 'up' : 'dn') + '">' + fmtPct(g10) + '</span> (CAGR ' +
      n1(gc) + '%) — ' + (g10 >= 100 ? '10년 100% 기준을 <span class="up">넘겼습니다</span>.'
        : '10년 100% 기준에 <span class="dn">미달</span>합니다.') +
      (BM.seoul10 != null ? ' 같은 기간 서울 평균 ' + fmtPct(BM.seoul10) + ' 대비 ' +
        (g10 - BM.seoul10 >= 0 ? '<span class="up">아웃퍼폼 +' : '<span class="dn">언더퍼폼 ') +
        n1(Math.abs(g10 - BM.seoul10)) + '%p</span>.' : ''));
  }
  if (jb) {
    ins.push('전세가율 ' + n1(jr) + '%는 10년 밴드의 <span class="hl">' + Math.round(jb.pct * 100) + '% 지점(' +
      bandWord(jb.pct) + ')</span>. ' + (jb.pct <= .3
        ? '전세 대비 매매가가 역사적으로 비싼 상태 — 갭이 커서 진입 부담이 크고 하방이 얇습니다.'
        : jb.pct >= .7 ? '전세 대비 매매가가 눌린 상태 — 갭이 작아 진입 부담이 낮습니다.'
        : '중립 구간입니다.'));
  }
  if (home && home.code !== code) {
    var b = band(ratioS(home, r), 10);
    if (b) {
      var pF = priceOf(home, c.area), pT = priceOf(r, c.area);
      var extra = pT - pF + acqTax(pT, c.area, 0, r.reg) + broker(pT) + broker(pF) + c.etc;
      var dir = last(r.s) > last(home.s) ? '상급지' : '하급지';
      ins.push('<span class="hl">' + esc(home.name) + '</span> 대비 배율 <span class="hl">' + b.cur.toFixed(2) +
        '</span> (' + dir + '), 10년 평균 ' + b.avg.toFixed(2) + ' · 밴드 ' + Math.round(b.pct * 100) + '%. ' +
        (b.pct <= .3 ? '역대 대비 격차가 좁아 <span class="up">지금이 올라타기 유리</span>합니다.'
          : b.pct >= .7 ? '역대 대비 격차가 벌어져 <span class="dn">지금은 비싸게 사는 구간</span>입니다.' : '중립 구간입니다.') +
        (dir === '상급지' ? ' 갈아타려면 추가로 약 <span class="hl">' + won(extra) + '</span> 필요.' : ''));
    }
  }
  if (up.length) ins.push('바로 위 급지: ' + up.map(function (x) {
    return esc(x.name) + '(' + (last(x.s) / last(r.s)).toFixed(2) + '배)'; }).join(' · '));
  if (dn.length) ins.push('바로 아래 급지: ' + dn.map(function (x) {
    return esc(x.name) + '(' + (last(x.s) / last(r.s)).toFixed(2) + '배)'; }).join(' · '));

  h += '<div class="ins"><h4>이 지역 읽기</h4><ul><li>' + ins.join('</li><li>') + '</li></ul></div>';
  h += '<div class="rowbtns">' +
    '<button class="btn ice" data-act="sw">이 지역으로 갈아타기 분석</button>' +
    '<button class="btn ghost" data-act="cx">이 지역 단지 보기</button>' +
    '<button class="btn ghost" data-act="rot">순환매 짝 찾기</button>' +
    '<button class="btn ghost" data-act="vol">거래량 보기</button></div>';
  el('detail').innerHTML = h;
  el('detail').querySelectorAll('[data-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var a = b.dataset.act;
      if (a === 'sw') { el('from3').value = el('home').value; el('to3').value = code; show('p4'); timing(); targets(); }
      else if (a === 'cx') { el('rg5').value = code; show('p7'); }
      else if (a === 'vol') { el('volReg').value = code; show('pv'); runVol(); }
      else { el('base4').value = code; show('p5'); }
    });
  });
  try { el('dcard').scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { }
}
/* ── 갈아타기 인사이트 ── */
function insight4(from, to, b, extra, c) {
  if (!b) { el('ins4').innerHTML = ''; return; }
  var L = [];
  var mult = last(to.s) / last(from.s);
  L.push('<span class="hl">' + esc(to.name) + '</span>은(는) <span class="hl">' + esc(from.name) +
    '</span>보다 ' + ((mult - 1) * 100).toFixed(0) + '% 비쌉니다. 전국 서열은 ' + RANK[from.code] + '위 → ' +
    RANK[to.code] + '위, 분위는 ' + decile(from.code) + '분위 → ' + decile(to.code) + '분위.');
  var gap0 = b.cur - b.avg;
  L.push('현재 배율 ' + b.cur.toFixed(3) + '은 10년 평균 ' + b.avg.toFixed(3) + '보다 ' +
    '<span class="' + (gap0 > 0 ? 'dn' : 'up') + '">' + (gap0 > 0 ? '+' : '') + (gap0 * 100 / b.avg).toFixed(1) +
    '%</span> ' + (gap0 > 0 ? '벌어진' : '좁은') + ' 상태입니다 (밴드 ' + Math.round(b.pct * 100) + '%).');
  var atAvg = last(from.s) * b.avg * c.area;
  var pF = priceOf(from, c.area);
  var exAvg = atAvg - pF + acqTax(atAvg, c.area, 0, to.reg) + broker(atAvg) + broker(pF) + c.etc;
  L.push('배율이 10년 평균으로 돌아가면 추가 필요금은 <span class="hl">' + won(exAvg) + '</span> — 지금(' +
    won(extra) + ') 대비 <span class="' + (extra > exAvg ? 'up' : 'dn') + '">' + won(Math.abs(extra - exAvg)) +
    '</span> ' + (extra > exAvg ? '적습니다' : '많습니다') + '.');
  var jf = band(jrS(from), 10), jt = band(jrS(to), 10);
  if (jf && jt) L.push('전세가율 밴드는 ' + esc(from.name) + ' ' + Math.round(jf.pct * 100) + '% · ' +
    esc(to.name) + ' ' + Math.round(jt.pct * 100) + '% — ' +
    (jt.pct > jf.pct ? '목표지가 상대적으로 덜 고평가된 상태입니다.' : '목표지가 상대적으로 더 고평가된 상태입니다.'));
  var t10f = chg10(from), t10t = chg10(to);
  if (t10f != null && t10t != null) L.push('10년 상승률은 ' + esc(from.name) + ' ' + fmtPct(t10f) +
    ' vs ' + esc(to.name) + ' ' + fmtPct(t10t) + ' — ' +
    (t10t >= 100 ? '목표지는 10년 100% 기준을 <span class="up">충족</span>' : '목표지는 10년 100% 기준 <span class="dn">미달</span>') +
    (t10f >= 100 ? (t10t >= 100 ? ', 내 지역도 충족.' : ', 내 지역은 충족.')
                 : (t10t >= 100 ? ', 내 지역은 미달.' : ', 내 지역도 미달.')));
  var c3f = chg(from.s, 36), c3t = chg(to.s, 36);
  if (c3f != null && c3t != null) L.push('3년 상승률은 ' + esc(from.name) + ' ' + fmtPct(c3f) + ' vs ' +
    esc(to.name) + ' ' + fmtPct(c3t) + ' — ' + (c3t > c3f ? '목표지가 더 빨리 달아나는 중이라 기다릴수록 격차가 커질 수 있습니다.'
      : '내 지역이 더 빨리 올라 격차가 좁혀지는 중입니다.'));
  L.push(extra <= c.cash ? '<span class="up">지금 보유 현금 ' + won(c.cash) + '으로 실행 가능한 범위입니다.</span>'
    : '지금 실행하려면 <span class="dn">' + won(extra - c.cash) + '</span>이 더 필요합니다.');
  el('ins4').innerHTML = '<h4>이 갈아타기 읽기</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}

/* ══════════ 02 전국 급지표 ══════════ */
var AREA2 = 84, SIDO2 = '전체', LAST2 = [];
var AGG = R.filter(function (r) { return r.kind === 'agg' && last(r.s); });
function render2() {
  var a = AREA2;
  var pass = SORTED.filter(function (r) { var v = chg10(r); return v != null && v >= 100; }).length;
  var withV = SORTED.filter(function (r) { return chg10(r) != null; }).length;
  el('bm2').innerHTML =
    '<div class="kpi hero"><span class="lb">10년 100% 통과</span><span class="vl">' + pass + ' / ' + withV +
      '</span><span class="sb">시군구 중 10년간 두 배 이상 오른 곳</span></div>' +
    kpi('서울 평균 10년', BM.seoul10 == null ? '—' : '+' + n1(BM.seoul10) + '%',
        'CAGR ' + (BM.seoulC == null ? '—' : n1(BM.seoulC) + '%'), 'good') +
    kpi('전국 평균 10년', BM.all10 == null ? '—' : '+' + n1(BM.all10) + '%',
        'CAGR ' + (BM.allC == null ? '—' : n1(BM.allC) + '%'), '') +
    kpi('통과 기준', '100%', '10년 2배 = CAGR 7.2%', 'sig');
  var isAgg = SIDO2 === '시도';
  var list = isAgg ? AGG.slice().sort(function (x, y) { return last(y.s) - last(x.s); })
    : SORTED.filter(function (r) { return SIDO2 === '전체' || r.sido === SIDO2; });
  if (!isAgg && el('dec1').checked) list = list.filter(function (r) { return decile(r.code) <= 3; });
  LAST2 = list;
  el('th2a').textContent = a + '㎡ 매매';
  var tb = el('t2').tBodies[0]; tb.innerHTML = '';
  if (!list.length) { tb.innerHTML = '<tr><td colspan="11" class="empty">해당 조건의 지역이 없습니다.</td></tr>'; return; }
  var home = el('home').value;
  list.forEach(function (r) {
    var jb = band(jrS(r), 10), jr = last(r.j) / last(r.s) * 100, d = RANK[r.code] ? decile(r.code) : 0;
    var tr = document.createElement('tr');
    if (r.code === home) tr.className = 'self';
    tr.className += ' clickable'; tr.dataset.rc = r.code;
    tr.innerHTML =
      '<td class="nm">' + esc(r.name) + (r.code === home ? ' <span class="b warn">지금 여기</span>' : '') + '</td>' +
      '<td>' + (RANK[r.code] || '—') + '</td>' +
      '<td>' + (RANK[r.code] ? '<span class="b ' + (d <= 3 ? 'd1' : 'no') + '">' + d + '분위</span>' : '<span class="b no">시도</span>') + '</td>' +
      '<td>' + n0(pyPrice(last(r.s))) + '</td><td>' + won(last(r.s) * a) + '</td><td>' + won(last(r.j) * a) + '</td>' +
      '<td>' + n1(jr) + '%</td><td>' + (jb ? gaugeHTML(jb.pct, jb) : '—') + '</td>' +
      '<td>' + fmtPct(chg(r.s, 36)) + '</td>' +
      '<td>' + pct10Cell(chg10(r)) + '</td>' +
      '<td>' + (cagr10(r) == null ? '—' : n1(cagr10(r)) + '%') + '</td>' +
      '<td>' + (cagrAll(r) == null ? '—' : n1(cagrAll(r)) + '%') + '</td>' +
      '<td>' + gradeHTML(chg10(r)) + '</td>' +
      '<td>' + (RANK[r.code] ? (r.reg ? '<span class="b reg">규제</span>' : '<span class="b free">비규제</span>') : '—') + '</td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-rc]').forEach(function (tr) {
    tr.addEventListener('click', function () {
      if (tr.dataset.rc.indexOf('S') === 0 || !RANK[tr.dataset.rc]) return;
      SELCODE = tr.dataset.rc; show('pm'); showDetail(tr.dataset.rc);
    });
  });
  if (isAgg) {
    tb.querySelectorAll('tr').forEach(function (tr, i) {
      var nm = list[i] && list[i].name;
      tr.addEventListener('click', function () { drillSido(nm); });
    });
  }
  el('drill2').innerHTML = '';
}
/** 시도 클릭 → 그 시도의 시군구 (KB 지수 기반) */
function drillSido(name) {
  var subs = KIR.filter(function (r) { return r.sido === name && r.kind === 'sgg'; });
  if (!subs.length) { el('drill2').innerHTML = '<div class="card flat" style="margin-top:18px"><div class="empty">' +
    esc(name) + '의 시·군·구 지수는 KB 시계열에 없습니다.</div></div>'; return; }
  var lastI = KIY.length - 1;
  var rows = subs.map(function (r) {
    var f = firstIdx(r.s);
    return { r: r, f: f, cAll: cagrIdx(r.s, f, lastI), c10: cagrIdx(r.s, Math.max(f, lastI - 10), lastI),
      g10: (r.s[lastI] && r.s[lastI - 10]) ? (r.s[lastI] / r.s[lastI - 10] - 1) * 100 : null,
      idx: r.s[lastI] };
  }).sort(function (u, v) { return (v.idx || 0) - (u.idx || 0); });
  var h = '<div class="card flat" style="margin-top:18px"><span class="eb">' + esc(name) + ' 하위 지역</span>' +
    '<h2 style="font-size:22px;margin-bottom:6px">' + esc(name) + ' 시·군·구 (' + rows.length + '곳)</h2>' +
    '<p class="hint" style="margin-bottom:14px">KB는 수도권·광역시만 평당 가격을 조사합니다. 그 외 지역은 <b>가격지수</b>로 비교합니다.</p>' +
    '<div class="tblwrap"><table><thead><tr><th>지역</th><th>지수</th><th>10년 상승률</th><th>10년 연복리</th>' +
    '<th>장기 연복리</th><th>조사 시작</th><th></th></tr></thead><tbody>';
  rows.forEach(function (x) {
    var code = null;
    EXT.concat(SGG).forEach(function (e) { if (e.name === x.r.name) code = e.code; });
    h += '<tr><td class="nm">' + esc(x.r.name) + '</td><td>' + (x.idx == null ? '—' : n1(x.idx)) + '</td>' +
      '<td>' + pctCell(x.g10) + '</td><td>' + (x.c10 == null ? '—' : n1(x.c10) + '%') + '</td>' +
      '<td>' + (x.cAll == null ? '—' : n1(x.cAll) + '%') + '</td><td>' + KIY[x.f] + '</td>' +
      '<td>' + (code ? '<button class="btn ghost sm" data-goto="' + code + '">단지</button>' : '') + '</td></tr>';
  });
  h += '</tbody></table></div></div>';
  el('drill2').innerHTML = h;
  bindGoto(el('drill2'));
  try { el('drill2').scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { }
}
function fmtPct(v) { return v == null ? '—' : (v > 0 ? '+' : '') + n1(v) + '%'; }
function img2() {
  exportPNG({
    title: '전국 급지표 · ' + SIDO2 + ' (' + AREA2 + '㎡ 기준)',
    sub: 'KB 평당 매매가 기준 서열 · 시군구 ' + NTOT + '곳을 10분위로',
    headers: ['지역', '분위', '평당가', AREA2 + '㎡ 매매', '10년 상승률'],
    weights: [2.6, .9, 1.15, 1.35, 1.25],
    bold: [3], grade: [4],
    rows: LAST2.map(function (r) {
      return [r.name, decile(r.code) + '분위', n0(pyPrice(last(r.s))) + '만',
        won(last(r.s) * AREA2), chg10(r) == null ? '—' : '+' + n1(chg10(r)) + '%'];
    }),
    max: 16,
    note: '10년 상승률 100% 이상이 초록 · 평당가는 전용 기준 · KB 표본조사 평균',
    file: 'topdown_tiers'
  });
}

/* ══════════ 03 갭투자 ══════════ */
var LAST3 = [];
var AREA_GAP = 0;
function render3() {
  var c = CFG(), incReg = el('gapIncReg').checked, hi = el('gapJeonseOK').checked, onlyOk = el('gapOnlyOk').checked;
  if (AREA_GAP) c.area = AREA_GAP;
  var list = pool0().filter(function (r) { return incReg || !r.reg; }).sort(function (a, b) { return last(b.s) - last(a.s); });
  var rows = [];
  list.forEach(function (r) {
    var p = priceOf(r, c.area), je = jeonseOf(r, c.area); if (!p || !je) return;
    var g = needGap(p, je, r, c), jb = band(jrS(r), 10);
    if (hi && jb && jb.pct < .5) return;
    if (onlyOk && g.need > c.cash) return;
    rows.push({ r: r, p: p, je: je, g: g, jb: jb, jr: je / p * 100, ok: g.need <= c.cash });
  });
  LAST3 = rows;
  var ok = rows.filter(function (x) { return x.ok; }), best = ok[0];
  el('k3').innerHTML =
    '<div class="kpi hero"><span class="lb">갭으로 닿는 최상급지</span><span class="vl">' +
      (best ? esc(best.r.name) : '없음') + '</span><span class="sb">' +
      (best ? '전국 ' + RANK[best.r.code] + '위 · 필요 ' + won(best.g.need) : '조건 완화 필요') + '</span></div>' +
    kpi('가능 지역', ok.length + '곳', '전체 ' + rows.length + '곳 중', 'good') +
    kpi('최소 필요현금', ok.length ? won(Math.min.apply(null, ok.map(function (x) { return x.g.need; }))) : '—', '조건 충족 지역', '') +
    kpi('내 현금', won(c.cash), '전용 ' + c.area + '㎡ 기준', 'sig');

  el('th3a').textContent = '매매(' + c.area + '㎡)';
  var tb = el('t3').tBodies[0]; tb.innerHTML = '';
  if (!rows.length) { tb.innerHTML = '<tr><td colspan="11" class="empty">조건에 맞는 지역이 없습니다.</td></tr>'; return; }
  rows.forEach(function (x) {
    var tr = document.createElement('tr');
    if (x.ok) tr.className = 'pick';
    tr.innerHTML = '<td class="nm">' + esc(x.r.name) + (x.r.reg ? ' <span class="b reg">규제</span>' : '') + '</td>' +
      '<td>' + RANK[x.r.code] + '</td><td>' + n0(pyPrice(last(x.r.s))) + '</td><td>' + n0(pyPrice(last(x.r.j))) + '</td>' +
      '<td>' + won(x.p) + '</td><td>' + won(x.je) + '</td><td>' + won(x.g.gap) + '</td>' +
      '<td style="font-weight:700;color:' + (x.ok ? 'var(--good)' : 'var(--slate)') + '">' + won(x.g.need) + '</td>' +
      '<td>' + n1(x.jr) + '%</td><td>' + (x.jb ? gaugeHTML(x.jb.pct, x.jb) : '—') + '</td>' +
      '<td>' + pct10Cell(chg10(x.r)) + '</td>' +
      '<td><button class="btn ghost sm" data-goto="' + x.r.code + '">단지</button></td>';
    tb.appendChild(tr);
  });
  bindGoto(tb);
}
function img3() {
  var c = CFG();
  exportPNG({
    title: '갭투자 가능 지역',
    sub: '현금 ' + won(c.cash) + ' · 전용 ' + c.area + '㎡ · 전세 승계 기준',
    headers: ['지역', '서열', '매매', '전세', '순수 갭', '총 필요현금', '전세가율'],
    weights: [2.4, .8, 1.1, 1.1, 1.1, 1.3, 1],
    bold: [5],
    rows: LAST3.map(function (x) {
      return [x.r.name + (x.r.reg ? ' (규제)' : ''), RANK[x.r.code] + '위', won(x.p), won(x.je),
        won(x.g.gap), won(x.g.need), n1(x.jr) + '%'];
    }),
    max: 16,
    note: '총 필요현금 = 순수 갭 + 취득세 + 중개보수 + 부대비용 · 규제지역은 실거주 의무로 갭 매수 제한',
    file: 'topdown_gap'
  });
}

/* ══════════ 04 갈아타기 ══════════ */
var chart4 = null, LAST4 = [];
function render4() {
  var c = CFG(), home = BY[el('home').value];
  if (!home) return;
  var pHome = last(home.s);
  var up = SORTED.filter(function (r) { return last(r.s) > pHome; }).slice(-5);
  var down = SORTED.filter(function (r) { return last(r.s) < pHome; }).slice(0, 5);
  var seq = up.concat([home], down);
  var pFrom = priceOf(home, c.area);
  el('th4a').textContent = c.area + '㎡ 추정';
  var tb = el('t4map').tBodies[0]; tb.innerHTML = '';
  LAST4 = [];
  seq.forEach(function (r) {
    var self = r.code === home.code;
    var pt = priceOf(r, c.area);
    var b = self ? null : band(ratioS(home, r), 10);
    var extra = self ? 0 : pt - pFrom + acqTax(pt, c.area, 0, r.reg) + broker(pt) + broker(pFrom) + c.etc;
    var kind = self ? '지금 여기' : (last(r.s) > pHome ? '상급지' : '하급지');
    LAST4.push({ r: r, b: b, extra: extra, kind: kind, pt: pt });
    var tr = document.createElement('tr');
    tr.className = self ? 'self' : 'clickable';
    if (!self) tr.dataset.to = r.code;
    tr.innerHTML = '<td class="nm">' + esc(r.name) + '</td>' +
      '<td><span class="b ' + (self ? 'warn' : (kind === '상급지' ? 'd1' : 'no')) + '">' + kind + '</span></td>' +
      '<td>' + n0(pyPrice(last(r.s))) + '</td><td>' + won(pt) + '</td>' +
      '<td>' + (b ? b.cur.toFixed(3) : '—') + '</td><td>' + (b ? b.avg.toFixed(3) : '—') + '</td>' +
      '<td>' + (b ? gaugeHTML(b.pct, b) : '—') + '</td>' +
      '<td style="font-weight:700;color:' + (extra <= c.cash && !self ? 'var(--good)' : 'var(--ink)') + '">' +
        (self ? '—' : won(extra)) + '</td>' +
      '<td>' + (b ? '<span class="b ' + (b.pct <= .3 ? 'ok' : b.pct >= .7 ? 'warn' : 'no') + '">' + bandWord(b.pct) + '</span>' : '—') + '</td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-to]').forEach(function (tr) {
    tr.addEventListener('click', function () {
      el('from3').value = home.code; el('to3').value = tr.dataset.to; timing();
      el('v4').scrollIntoView({ block: 'center' });
    });
  });
  timing(); targets(); ladder();
}
/* ── 사다리: 추가금별로 갈 수 있는 최상단 (v40.0) ── */
function ladBest(home, pFrom, budget, c) {
  var pHome = last(home.s), top = null, near = null;
  SGG.forEach(function (r) {
    if (r.code === home.code || !last(r.s) || last(r.s) <= pHome) return;
    if (!radiusOK(r)) return;
    var pt = priceOf(r, c.area);
    if (!isFinite(pt)) return;
    var extra = pt - pFrom + acqTax(pt, c.area, 0, r.reg) + broker(pt) + broker(pFrom) + c.etc;
    if (extra > budget) return;
    if (!top || (RANK[r.code] || 999) < (RANK[top.r.code] || 999)) top = { r: r, pt: pt, extra: extra };
    if (!near || pt < near.pt) near = { r: r, pt: pt, extra: extra };
  });
  return { top: top, near: near };
}
function stepsUp(home, r) {
  var a = RANK[home.code] || 999, b = RANK[r.code] || 999;
  return a - b;
}
function ladder() {
  var c = CFG(), home = BY[el('home').value];
  if (!home || !el('ladR')) return;
  var budget = +el('ladR').value;
  el('ladV').textContent = n1(budget) + '억';
  var pFrom = priceOf(home, c.area);
  var B = ladBest(home, pFrom, budget * 1e8, c);
  var hk = '';
  if (!B.top) {
    hk = kpi('갈 수 있는 최상단', '없음', '추가금을 늘리거나 이동 반경을 넓혀보세요', '') +
      kpi('지금 내 위치', home.name, '전국 ' + (RANK[home.code] || '—') + '위 · 평당 ' + n0(pyPrice(last(home.s))) + '만', '');
  } else {
    var st = stepsUp(home, B.top), stN = B.near ? stepsUp(home, B.near) : null;
    hk = '<div class="kpi hero big"><span class="lb">갈 수 있는 최상단</span>' +
      '<span class="vl" style="font-size:32px">' + esc(B.top.r.name) + '</span>' +
      '<span class="sb">전국 ' + RANK[B.top.r.code] + '위 · ' + decile(B.top.r.code) + '분위 · ' +
      c.area + '㎡ ' + won(B.top.pt) + ' · 추가 ' + won(B.top.extra) + '</span></div>' +
      kpi('올라가는 계단', st + '계단', '전국 ' + (RANK[home.code] || '—') + '위 → ' + RANK[B.top.r.code] + '위', 'good') +
      kpi('가까운 곳만 골랐다면', (B.near ? esc(B.near.r.name) : '—'),
          (stN != null ? stN + '계단 (' + (st - stN) + '계단 손해)' : '—'), 'sig');
  }
  el('ladKpi').innerHTML = hk;

  var STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10];
  var tb = el('tLad').tBodies[0]; tb.innerHTML = '';
  STEPS.forEach(function (v) {
    var q = ladBest(home, pFrom, v * 1e8, c);
    var tr = document.createElement('tr');
    if (Math.abs(v - budget) < 0.26) tr.className = 'pick';
    if (!q.top) {
      tr.innerHTML = '<td class="nm">' + n1(v) + '억</td><td colspan="4" style="color:var(--slate)">아직 못 올라갑니다</td>';
    } else {
      var st2 = stepsUp(home, q.top), sn = q.near ? stepsUp(home, q.near) : null;
      tr.innerHTML = '<td class="nm">' + n1(v) + '억</td>' +
        '<td class="nm">' + esc(q.top.r.name) + '</td>' +
        '<td style="font-weight:700;color:var(--good)">' + st2 + '계단</td>' +
        '<td>' + n0(pyPrice(last(q.top.r.s))) + '만</td>' +
        '<td style="color:var(--slate)">' + (sn != null ? esc(q.near.r.name) + ' · ' + sn + '계단' : '—') + '</td>';
    }
    tb.appendChild(tr);
  });

  var L = [];
  if (B.top) {
    var st3 = stepsUp(home, B.top), sn3 = B.near ? stepsUp(home, B.near) : null;
    L.push('<span class="hl">' + esc(home.name) + '</span>(전국 ' + (RANK[home.code] || '—') + '위)에서 추가 <b>' +
      n1(budget) + '억</b>이면 <span class="hl">' + esc(B.top.r.name) + '</span>(전국 ' + RANK[B.top.r.code] +
      '위)까지 <b>' + st3 + '계단</b> 올라갑니다.');
    if (sn3 != null && st3 - sn3 > 0)
      L.push('같은 돈으로 <b>가장 가까운 상급지</b>를 고르면 ' + esc(B.near.r.name) + ' <b>' + sn3 +
        '계단</b>에 그칩니다 — <b>' + (st3 - sn3) + '계단</b>을 그냥 버리는 셈입니다.');
    var q1 = ladBest(home, pFrom, (budget + 1) * 1e8, c);
    if (q1.top && q1.top.r.code !== B.top.r.code)
      L.push('여기서 <b>1억을 더</b> 쓰면 ' + esc(q1.top.r.name) + '(전국 ' + RANK[q1.top.r.code] + '위)까지 가서 <b>' +
        (stepsUp(home, q1.top) - st3) + '계단</b>이 더 올라갑니다.');
    else L.push('추가로 1억을 더 써도 갈 수 있는 최상단은 바뀌지 않습니다 — 지금 구간이 <b>가성비 지점</b>입니다.');
    L.push('계단은 <b>전국 시·군·구 평당가 순위</b> 기준입니다. 실제 매도 가능 금액이 지역 평균과 다르면 결과도 달라집니다.');
  } else {
    L.push('현재 추가금으로는 지금 사는 곳보다 비싼 지역에 닿지 않습니다. 슬라이더를 올려보세요.');
  }
  el('ladIns').innerHTML = '<h4>이 사다리 읽기</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}
function timing() {
  var c = CFG(), from = BY[el('from3').value], to = BY[el('to3').value], yrs = +el('yrs3').value;
  if (!from || !to || from.code === to.code) { el('v4').innerHTML = '<div class="empty">서로 다른 두 지역을 골라주세요.</div>'; return; }
  var rs = ratioS(from, to), b = band(rs, yrs);
  var pF = priceOf(from, c.area), pT = priceOf(to, c.area);
  var extra = pT - pF + acqTax(pT, c.area, 0, to.reg) + broker(pT) + broker(pF) + c.etc;
  var atMin = b ? pF * b.min : null;
  var extraMin = atMin == null ? null : atMin - pF + acqTax(atMin, c.area, 0, to.reg) + broker(atMin) + broker(pF) + c.etc;
  el('k4').innerHTML =
    '<div class="kpi hero"><span class="lb">현재 배율</span><span class="vl">' + (b ? b.cur.toFixed(3) : '—') +
      '</span><span class="sb">' + esc(to.name) + ' ÷ ' + esc(from.name) + '</span></div>' +
    kpi('밴드 위치', b ? Math.round(b.pct * 100) + '%' : '—', b ? bandWord(b.pct) : '', b && b.pct >= .7 ? 'sig' : 'good') +
    kpi('지금 추가 필요금', won(extra), '집 팔고 세금·비용까지', '') +
    kpi('역대 최저 배율이면', extraMin == null ? '—' : won(extraMin), b ? ymL(b.minAt) + ' 수준' : '', 'good');
  if (b) {
    var d = extra - extraMin;
    var j = b.pct >= .9 ? ['hot', '역대급으로 비싸게 갈아타는 구간']
      : b.pct >= .7 ? ['hot', '평소보다 격차가 벌어진 구간']
      : b.pct <= .3 ? ['cool', '평소보다 격차가 좁은 구간 — 갈아타기 유리'] : ['mid', '중립 구간'];
    el('v4').innerHTML = '<div class="verdict ' + j[0] + '"><b style="font-size:19px">' +
      esc(from.name) + ' → ' + esc(to.name) + ' · ' + j[1] + '</b><br><br>' +
      '배율 <b>' + b.cur.toFixed(3) + '</b> · ' + (yrs >= 99 ? '전체' : yrs + '년') + ' 평균 ' + b.avg.toFixed(3) +
      ' · 최저 ' + b.min.toFixed(3) + '(' + ymL(b.minAt) + ') · 최고 ' + b.max.toFixed(3) + '(' + ymL(b.maxAt) + ')' +
      ' · 백분위 <b>' + Math.round(b.pct * 100) + '%</b><br>' +
      '역대 최저 배율이었다면 지금보다 <b>' + won(Math.abs(d)) + '</b> ' + (d > 0 ? '덜' : '더') + ' 들었을 금액입니다.</div>';
  } else el('v4').innerHTML = '';
  insight4(from, to, b, extra, c);
  var labels = [], data = [], li = lastIdx(rs), f0 = yrs >= 99 ? 0 : Math.max(0, li - yrs * 12 + 1);
  for (var i = f0; i <= li; i++) { labels.push(ymL(DATES[i])); data.push(rs[i] == null ? null : +rs[i].toFixed(4)); }
  if (chart4) chart4.destroy();
  var ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  var lineC = getComputedStyle(document.documentElement).getPropertyValue('--line').trim();
  chart4 = new Chart(el('c4').getContext('2d'), {
    type: 'line',
    data: { labels: labels, datasets: [
      { label: '배율', data: data, borderColor: ink, borderWidth: 2, pointRadius: 0, tension: .15 },
      { label: '평균', data: labels.map(function () { return b ? +b.avg.toFixed(4) : null; }),
        borderColor: '#F37338', borderWidth: 1.5, borderDash: [5, 5], pointRadius: 0 } ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 8, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { font: { size: 11 } }, grid: { color: lineC } } } }
  });
}
function targets() {
  var c = CFG(), from = BY[el('from3').value]; if (!from) return;
  var yrs = +el('yrs3').value, pF = priceOf(from, c.area), pf = last(from.s);
  var all = el('all3').checked;
  var tb = el('t4').tBodies[0]; tb.innerHTML = '';
  var cands = SGG.filter(function (r) { return r.code !== from.code && (all || last(r.s) > pf); })
    .map(function (r) {
      var b = band(ratioS(from, r), yrs); if (!b) return null;
      var pt = priceOf(r, c.area);
      return { r: r, b: b, extra: pt - pF + acqTax(pt, c.area, 0, r.reg) + broker(pt) + broker(pF) + c.etc };
    }).filter(Boolean)
    .filter(function (x) { return !el('reach3').checked || x.extra <= c.cash; })
    .filter(function (x) { return !el('rad3').checked || radiusOK(x.r); })
    .sort(function (a, b2) { return a.b.pct - b2.b.pct; });
  if (!cands.length) { tb.innerHTML = '<tr><td colspan="8" class="empty">조건에 맞는 지역이 없습니다.</td></tr>'; return; }
  cands.slice(0, 25).forEach(function (x) {
    var reach = x.extra <= c.cash, tr = document.createElement('tr');
    tr.className = 'clickable' + (reach && x.b.pct <= .3 ? ' pick' : '');
    tr.dataset.to = x.r.code;
    tr.innerHTML = '<td class="nm">' + esc(x.r.name) + (x.r.reg ? ' <span class="b reg">규제</span>' : '') + '</td>' +
      '<td>' + n0(pyPrice(last(x.r.s))) + '</td><td>' + x.b.cur.toFixed(3) + '</td><td>' + x.b.avg.toFixed(3) + '</td>' +
      '<td>' + gaugeHTML(x.b.pct, x.b) + '</td>' +
      '<td' + (reach ? ' style="color:var(--good);font-weight:700"' : '') + '>' + won(x.extra) + '</td>' +
      '<td>' + (distFromHome(x.r.code) == null ? '—' : n0(distFromHome(x.r.code)) + 'km') + '</td>' +
      '<td>' + ymL(x.b.minAt) + '</td>' +
      '<td><span class="b ' + (x.b.pct <= .3 ? 'ok' : x.b.pct >= .7 ? 'warn' : 'no') + '">' + bandWord(x.b.pct) + '</span></td>';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-to]').forEach(function (tr) {
    tr.addEventListener('click', function () { el('to3').value = tr.dataset.to; timing(); el('v4').scrollIntoView({ block: 'center' }); });
  });
}
