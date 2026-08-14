'use strict';
function repSummary(s, it) {
  var L = [];
  if (s.d != null) L.push('전국 ' + s.d + '분위');
  if (s.g10 != null) L.push('10년 ' + fmtPct(s.g10));
  if (s.jb) L.push('전세가율 밴드 ' + Math.round(s.jb.pct * 100) + '%');
  if (s.sr != null) L.push('수급 ' + s.sr.toFixed(2) + '배');
  L.push('필요현금 ' + won(s.need));
  L.push('월 ' + won(s.pay));
  return L.join(' · ') + '.';
}
function imgReport() {
  if (!CART.length) return;
  var c = CFG();
  var items = CART.map(function (it) { return { it: it, sc: scoreItem(it, c) }; })
    .sort(function (a, b) { return b.sc.total - a.sc.total; });
  exportPNG({
    title: '투자 검토 결과',
    sub: '보유 현금 ' + won(c.cash) + ' · ' + OWNL[c.own] + ' · 6개 축 종합 평가',
    stats: items.slice(0, 4).map(function (o) {
      var g = gradeOf(o.sc.total);
      return { label: o.it.apt.slice(0, 12), value: g.g + ' ' + Math.round(o.sc.total) + '점',
        color: o.sc.total >= 68 ? 'good' : (o.sc.total < 50 ? 'bad' : '') };
    }),
    headers: ['매물', '등급', '급지', '장기', '타이밍', '수급', '필요현금'],
    weights: [2.4, .85, .85, .85, .95, .85, 1.25],
    bold: [1],
    rows: items.map(function (o) {
      var g = gradeOf(o.sc.total), a = o.sc.ax;
      return [o.it.apt + ' (' + o.it.region + ')', g.g + ' ' + Math.round(o.sc.total),
        Math.round(a[0].s), Math.round(a[1].s), Math.round(a[2].s), Math.round(a[3].s), won(o.sc.need)];
    }),
    note: '급지 45% · 전세 뒷받침 30% · 단지경쟁력 15% · 실행가능성 10% 가중 · 수급·장기성과 미반영 · 투자 자문 아님',
    file: 'report'
  });
}

/* ══════════ 거리 · 맞춤 추천 ══════════ */
function distKm(c1, c2) {
  if (!c1 || !c2) return null;
  var R = 6371, dLat = (c2[0] - c1[0]) * Math.PI / 180, dLng = (c2[1] - c1[1]) * Math.PI / 180;
  var a1 = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1[0] * Math.PI / 180) * Math.cos(c2[0] * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1 - a1));
}
function distFromHome(code) {
  var home = el('home').value;
  return distKm(CO[home], CO[code]);
}
/** 거리 제약 통과 여부 — '자동'은 규제지역(실거주 의무)만 반경 적용 */
function radiusOK(r) {
  var mode = el('radius').value;
  if (mode === 'off') return true;
  var d = distFromHome(r.code);
  if (d == null) return true;
  if (mode === 'auto') {
    if (!r.reg) return true;          /* 비규제 = 갭 매수 가능 = 거리 무관 */
    return d <= 60;                   /* 규제(토허) = 실거주 의무 = 생활권 안 */
  }
  return d <= +mode;
}
function radiusNote() {
  var mode = el('radius').value;
  if (mode === 'off') return '거리 제한 없음';
  if (mode === 'auto') return '규제지역만 60km 이내 (실거주 의무 반영)';
  return mode + 'km 이내';
}
/** 지역 단위 5축 점수 */
function scoreRegion(r, c) {
  var ax = [];
  /* 급지 60% — v43.0 Case 단위 백테스트(4,594건, 투자금 10구간 × 보유 3·5·7·10년).
     추천점수 10분위가 네 기간 모두 9/9 단조 정렬. 가장 강한 축 */
  var d = RANK[r.code] ? decile(r.code) : null;
  ax.push({ k: '급지', w: .60, s: d == null ? 50 : clamp((11 - d) * 10, 10, 100),
    d: '전국 ' + RANK[r.code] + '위 · ' + d + '분위' });
  /* 장기 성과 0% — v41.0 자체 백테스트: 단독 IC -0.37(양수 9%), 급지 통제 후에도 -0.26.
     통과선으로 완화해도 방향이 음수라 점수에서 빼고 참고 표시로만 남긴다 */
  var g10 = chg10(r);
  var s2 = g10 == null ? 55
    : (g10 >= 100 ? 100 : (g10 >= 70 ? 55 + (g10 - 70) / 30 * 45 : clamp(15 + g10 / 70 * 40, 10, 55)));
  ax.push({ k: '장기 성과 (참고)', w: 0, s: s2,
    d: g10 == null ? '데이터 없음' : '10년 ' + fmtPct(g10) + ' · 연복리 ' +
      n1((Math.pow(1 + g10 / 100, .1) - 1) * 100) + '% · ' + (g10 >= 100 ? '통과' : g10 >= 70 ? '경계' : '미달') +
      ' · 점수에는 넣지 않습니다' });
  /* 수급 0% — v43.0 Case 백테스트: 단독 IC +0.02~0.07. 빼는 쪽이 Out-of-Sample 초과수익이
     전 기간 더 높았다(3년 +3.4→+5.6, 5년 +13.7→+17.7, 7년 +43.2→+51.6%p).
     단 검증에 쓴 건 미분양뿐이고 생활권 입주물량은 과거 복원이 불가하므로
     점수에서만 빼고 화면 표시와 전세끼고사기 판단에는 계속 쓴다 */
  var sa = supArea(r.code);
  var sr = sa ? sa.ratio : null, ur = sa ? sa.unsR : null;
  var s4 = sr == null ? 55 : clamp(40 + (1.2 - sr) * 45, 20, 100);
  if (sr != null && ur != null) s4 = clamp(s4 - ur * 45, 20, 100);
  ax.push({ k: '수급 (참고)', w: 0, s: s4,
    d: sr == null ? '수급 데이터 없음' : '생활권 ' + SUP_R + 'km 배율 ' + sr.toFixed(2) + '배 (' + sa.n + '곳)' +
      (ur != null ? ' · 미분양 ' + ur.toFixed(2) + '%' : '') });
  /* 진입 타이밍 15% — 무주택은 전세가율 밴드, 유주택은 갈아타기 배율 밴드 */
  var home0 = BY[el('home').value];
  var swb = null;
  if (c.own >= 1 && home0 && home0.code !== r.code && last(r.s) > last(home0.s)) swb = band(ratioS(home0, r), 10);
  var jb = band(jrS(r), 10);
  if (swb) {
    ax.push({ k: '갈아타기 타이밍', w: .40, s: clamp(40 + (1 - swb.pct) * 60, 40, 100),
      d: '배율 ' + swb.cur.toFixed(2) + ' · 10년 밴드 ' + Math.round(swb.pct * 100) + '%' +
        (swb.pct <= .2 ? ' (격차 최소권)' : swb.pct >= .8 ? ' (격차 최대권)' : '') });
  } else {
    /* 전세 뒷받침 35% — 단독으로는 IC ≈ 0인데 급지를 통제하면 +0.15로 살아난다.
       즉 '같은 급지 안에서 어디를 고를까'의 기준이지 급지를 낮추면서 좇을 축이 아니다 */
    var jrNow = jb ? jb.cur : (last(r.j) / last(r.s) * 100);
    var sLv = jrNow == null ? 55 : clamp(20 + (jrNow - 40) / 40 * 80, 10, 100);
    var sBd = jb ? clamp(40 + jb.pct * 60, 40, 100) : 55;
    ax.push({ k: '전세 뒷받침', w: .40, s: sLv * .65 + sBd * .35,
      d: '전세가율 ' + n1(jrNow) + '% · 10년 밴드 ' + (jb ? Math.round(jb.pct * 100) + '%' : '—') +
        (jrNow >= 70 ? ' (실수요 견조)' : jrNow <= 50 ? ' (기대가 많이 실림)' : '') });
  }
  /* 자금 10% — 대출 매수와 전세 끼고 매수 중 유리한 쪽 기준 */
  var p = priceOf(r, c.area), en = entryOf(r, c);
  /* 자금은 점수 축이 아니라 필터 — 예산 내 지역끼리는 변별력이 없어 제외했다 */
  var mxAny = maxBuyAny(c, r), mx = mxAny.p;
  var total = ax.reduce(function (u, v) { return u + v.s * v.w; }, 0);
  return { r: r, ax: ax, total: total, need: en.need, price: p, en: en, jb: jb, sr: sr, g10: g10, d: d,
    maxP: mx, maxMode: mxAny.mode, maxCap: mxAny.capped, km: distFromHome(r.code) };
}
var LASTREC = [], RECSORT = 'rank', ENTRY = 'auto', GAPTOP = null;
/* v46.0 — 제외한 지역·단지 (사용자가 직접 뺀 것) */
var EXREG = {}, EXAPT = {};
/* v46.0 — 단지 목록 정렬 기준: 'py'(평당가) | 'sc'(점수) */
var APTSORT = 'py';
/** 단지 점수 — scoreItem 의 단지 경쟁력·전세 부분만 뽑아 목록 정렬에 쓴다 */
function aptScore(g, r) {
  var hh = g.hh || null, walk = g.walk == null ? null : g.walk;
  var age = g.byr ? (new Date().getFullYear() - g.byr) : null;
  var pHh = hh == null ? 55 : (hh >= 2000 ? 100 : hh >= 500 ? 65 : hh >= 300 ? 48 : 42);
  var pWk = walk == null ? 55 : (walk <= 5 ? 100 : walk <= 10 ? 62 : walk <= 15 ? 52 : 45);
  var pAg = age == null ? 55 : (age >= 35 ? 100 : age >= 25 ? 88 : age >= 20 ? 55 : age >= 10 ? 52 : 30);
  var comp = pAg * .35 + pWk * .35 + pHh * .30;
  var jr = (g.jeon && g.med) ? g.jeon / g.med * 100 : null;
  var pJe = jr == null ? 55 : clamp(20 + (jr - 40) / 40 * 80, 10, 100);
  /* 단지 6축 중 지역 안에서 변별력이 있는 부분만: 전세 30% + 단지 경쟁력 15% → 정규화 */
  return (pJe * .30 + comp * .15) / .45;
}
function exKeyApt(code, apt) { return code + '|' + apt; }
/** 전세 끼고 매수 시 필요현금 (비규제 지역만 — 규제지역은 실거주 의무) */
function gapNeedOf(r, c) {
  if (r.reg) return null;
  var price = priceOf(r, c.area), jp = last(r.j) * c.area;
  if (!jp || jp >= price) return null;
  var tOwn = c.own === 0 ? 0 : Math.max(1, c.taxOwn);
  return { need: (price - jp) + acqTax(price, c.area, tOwn, r.reg) + broker(price) + c.etc,
    price: price, jeon: jp, jr: jp / price * 100 };
}
/** 대출 매수와 전세 끼고 매수를 모두 고려한 최대 매수가 */
function maxBuyAny(c, r) {
  var jr = (last(r.j) && last(r.s)) ? last(r.j) / last(r.s) : null;
  /* 그 지역 해당 평형 평균가의 2.2배를 현실 상한으로 둔다 — 그 위로는 실제 매물이 없다 */
  var capP = priceOf(r, c.area) * 2.2;
  var lo = 2000, hi = Math.min(400000, capP), best = 0, mode = 'loan', capped = false;
  for (var i = 0; i < 44; i++) {
    var m = (lo + hi) / 2;
    var nl = needCash(m, r, c).need;
    var ng = (!r.reg && jr) ? (m - m * jr) + acqTax(m, c.area, c.own === 0 ? 0 : Math.max(1, c.taxOwn), r.reg) + broker(m) + c.etc : null;
    var nd = (ng != null && ng < nl) ? ng : nl;
    if (nd <= c.cash) { best = m; mode = (ng != null && ng < nl) ? 'gap' : 'loan'; lo = m; } else hi = m;
  }
  if (best >= capP * 0.995) capped = true;
  return { p: best, mode: mode, capped: capped };
}
/** 두 경로 중 실행 가능한 쪽 선택 */
function entryOf(r, c) {
  var lp = priceOf(r, c.area), ln = needCash(lp, r, c);
  var g = gapNeedOf(r, c);
  if (ENTRY === 'gap' && !g)
    return { mode: 'gap', need: Infinity, blocked: true, loan: 0, bind: r.reg ? '규제지역 불가' : '전세 데이터 없음', g: null, alt: ln.need };
  if (ENTRY === 'loan' || !g) return { mode: 'loan', need: ln.need, loan: ln.loan, bind: ln.bind, alt: g ? g.need : null, g: g };
  if (ENTRY === 'gap') return { mode: 'gap', need: g.need, alt: ln.need, g: g, loan: 0, bind: '전세 승계' };
  return g.need < ln.need
    ? { mode: 'gap', need: g.need, alt: ln.need, g: g, loan: 0, bind: '전세 승계' }
    : { mode: 'loan', need: ln.need, loan: ln.loan, bind: ln.bind, alt: g.need, g: g };
}
function recSort(list) {
  if (RECSORT === 'rank') return list.slice().sort(function (u, v) {
    return (RANK[u.r.code] || 999) - (RANK[v.r.code] || 999);
  });
  if (RECSORT === 'need') return list.slice().sort(function (u, v) { return u.need - v.need; });
  if (RECSORT === 'size') return list.slice().sort(function (u, v) { return v.maxP - u.maxP; });
  return list.slice().sort(function (u, v) { return v.total - u.total; });
}
function renderRec() {
  var c = CFG();
  var home = BY[el('home').value];
  var onlyOk = el('recOk').checked;
  var pool = SGG.filter(function (r) { return last(r.s) && radiusOK(r); });
  if (el('capOnly').checked) pool = pool.filter(function (r) { return r.cap; });
  pool = pool.filter(function (r) { return !EXREG[r.code]; });      /* v46.0 제외 반영 */
  var list = pool.map(function (r) { return scoreRegion(r, c); });
  list = list.filter(function (x) { return isFinite(x.need); });
  if (onlyOk) list = list.filter(function (x) { return x.need <= c.cash; });
  list = recSort(list);
  LASTREC = list;

  if (!list.length) {
    el('recKpi').innerHTML = '';
    el('recWrap').innerHTML = '<div class="empty">조건에 맞는 지역이 없습니다.<br><br>' +
      '<b>닿는 곳만 보기</b>를 끄거나, 이동 반경을 넓히거나, 평형을 낮춰보세요.</div>';
    el('recIns').innerHTML = '';
    return;
  }
  var top = list[0], g = gradeOf(top.total);
  var byScore = list.slice().sort(function (u, v) { return v.total - u.total; })[0];
  var byRank = list.slice().sort(function (u, v) { return (RANK[u.r.code] || 999) - (RANK[v.r.code] || 999); })[0];
  /* 전세를 끼면 갈 수 있는 최상단 (비규제 + 갭 필요현금이 예산 내) */
  GAPTOP = null;
  SGG.forEach(function (r0) {
    if (r0.reg || !last(r0.s) || !radiusOK(r0)) return;
    if (el('capOnly').checked && !r0.cap) return;
    var gg = gapNeedOf(r0, c);
    if (!gg || gg.need > c.cash) return;
    if (!GAPTOP || (RANK[r0.code] || 999) < (RANK[GAPTOP.r.code] || 999)) GAPTOP = { r: r0, g: gg };
  });
  el('recKpi').innerHTML =
    '<div class="kpi hero big"><span class="lb">' +
      (RECSORT === 'rank' ? '예산으로 되는 최상단' : RECSORT === 'need' ? '가장 적게 드는 곳' : '종합 점수 1위') +
      '</span><span class="vl" style="font-size:34px">' +
      esc(top.r.name) + '</span><span class="sb">' + g.g + ' ' + Math.round(top.total) + '점 · 전국 ' +
      RANK[top.r.code] + '위 · 필요현금 ' + won(top.need) + '</span></div>' +
    kpi('내 조건', won(c.cash) + ' · ' + c.area + '㎡', OWNL[c.own] + (c.first ? ' · 생애최초' : ''), '') +
    kpi('검토 대상', list.length + '곳',
        (onlyOk ? '예산 내 ' : '전체 ') + radiusNote() + ' · 전세 끼고 ' +
        list.filter(function (q) { return q.en.mode === 'gap'; }).length + '곳', 'good') +
    ((GAPTOP && byRank && (RANK[GAPTOP.r.code] || 999) < (RANK[byRank.r.code] || 999))
      ? kpi('전세 끼면 여기까지', GAPTOP.r.name,
          '전국 ' + RANK[GAPTOP.r.code] + '위 · ' + decile(GAPTOP.r.code) + '분위 · 필요 ' + won(GAPTOP.g.need) +
          ' (전세가율 ' + n1(GAPTOP.g.jr) + '%)', 'good')
      : kpi(RECSORT === 'rank' ? '종합 점수 1위' : '예산으로 되는 최상단',
          RECSORT === 'rank' ? byScore.r.name : byRank.r.name,
          RECSORT === 'rank' ? gradeOf(byScore.total).g + ' ' + Math.round(byScore.total) + '점 · ' + byScore.d + '분위'
            : '전국 ' + RANK[byRank.r.code] + '위 · ' + byRank.d + '분위', 'sig'));

  var h = '';
  /* 순위 해석 주의 배너 — v43.0 Case 백테스트 결과 반영 */
  h += '<div class="verdictbar warn"><span class="vi">읽는 법</span><span class="vt">' +
    '<b>1위와 5위의 차이는 크지 않습니다.</b> 과거 검증에서 추천 상위권 안의 미세한 순위는 ' +
    '실제 성과 순서와 거의 무관했습니다(3년 기준 1위 +37.6%, 5위 +34.9%, 10위 +33.0%). ' +
    '반면 <b>상위 그룹과 하위 그룹의 차이는 컸습니다</b>(상위 10% +35% vs 하위 10% +17%). ' +
    '<b>아래 5곳을 순위표가 아니라 "같은 등급의 후보 묶음"으로 보시고</b>, ' +
    '그중 실제로 갈 수 있고 살고 싶은 곳을 고르세요.</span></div>';
  /* 무주택 판정 배너 — Q7 기준(평당 3,200만 / 2,350만) v40.0 */
  if (c.own === 0 && byRank) {
    var pyTop = pyPrice(last(byRank.r.s));
    var vb, vi, vt;
    if (pyTop >= 3200) {
      vb = ''; vi = '지금';
      vt = '예산으로 <b>' + esc(byRank.r.name) + '(평당 ' + n0(pyTop) + '만)</b>까지 갈 수 있습니다. ' +
        '과거 검증에서 <b>평당 3,200만 이상</b>에 들어갈 수 있으면 지금 사는 쪽이 10번 중 7번 나았습니다. ' +
        '더 모으는 동안 오르는 폭이 저축보다 컸습니다.';
    } else if (pyTop < 2350) {
      vb = ' warn'; vi = '모으기';
      vt = '예산으로 갈 수 있는 최상단이 <b>' + esc(byRank.r.name) + '(평당 ' + n0(pyTop) + '만)</b>입니다. ' +
        '과거 검증에서 <b>평당 2,350만 아래</b>에서 급하게 사는 것보다 <b>1년 더 모아 한 급 올리는 쪽</b>이 나았습니다. ' +
        '단, 2년을 넘기면 이득이 줄었습니다 — <b>기다린다면 1년</b>입니다.';
    } else {
      vb = ' warn'; vi = '경계';
      vt = '예산으로 <b>' + esc(byRank.r.name) + '(평당 ' + n0(pyTop) + '만)</b>까지 갈 수 있습니다. ' +
        '<b>평당 2,350~3,200만</b>은 지금 사는 것과 더 모으는 것의 결과가 비슷했던 구간입니다. ' +
        '저축 여력이 크면 1년 더, 아니면 지금 &mdash; <b>투자 FAQ Q7</b>에서 기준을 확인하세요.';
    }
    h += '<div class="verdictbar' + vb + '"><span class="vi">' + vi + '</span><span class="vt">' + vt + '</span></div>';
  }
  /* 1주택 갈아타기 안내 — Q16 */
  if (c.own === 1 && byRank) {
    h += '<div class="verdictbar"><span class="vi">갈아타기</span><span class="vt">' +
      '갈아타기는 <b>조금씩 올라가면 손해</b>였습니다. 같은 추가금 2억으로 가장 가까운 곳을 고르면 3년 뒤 +0.94억, ' +
      '갈 수 있는 최상단을 고르면 <b>+1.70억</b>이었습니다 — 중간 아래에서 출발할수록 격차가 커집니다(FAQ Q16). ' +
      '<b>갈아타기 탭</b>에서 추가금을 밀어보면 몇 계단 올라가는지 바로 보입니다.' +
      '</span></div>';
  }
  list.slice(0, 5).forEach(function (x, i) {
    var gg = gradeOf(x.total);
    h += '<div class="rep">';
    h += '<div class="rephead"><div><span class="eb">' + (i + 1) + '순위</span>' +
      '<h3>' + esc(x.r.name) + '</h3>' +
      '<div class="repsub">' + (x.d ? x.d + '분위 · 전국 ' + RANK[x.r.code] + '위 · ' : '') +
      '평당 ' + n0(pyPrice(last(x.r.s))) + '만 · ' + c.area + '㎡ ' + won(x.price) +
      (x.km != null ? ' · 내 지역에서 ' + n0(x.km) + 'km' : '') +
      (x.r.reg ? ' · <b style="color:#B24A32">규제지역</b>'
        : x.en.mode === 'gap' ? ' · <b style="color:var(--good)">전세 끼고 매수</b>' : '') + '</div></div>' +
      '<div class="repscore" style="background:' + gg.c + '"><b>' + gg.g + '</b><span>' + Math.round(x.total) + '점</span></div></div>';
    h += '<div class="repverdict" style="border-left-color:' + gg.c + '">' + recWhy(x, c) + '</div>';
    h += '<div class="bars">';
    x.ax.forEach(function (aa) {
      var col = aa.s >= 70 ? 'var(--good)' : aa.s >= 50 ? 'var(--m4)' : aa.s >= 35 ? 'var(--ember)' : '#B24A32';
      h += '<div class="bar"><div class="barh"><span>' + aa.k + '</span><em>' + Math.round(aa.s) + '</em></div>' +
        '<div class="bart"><i style="width:' + aa.s.toFixed(0) + '%;background:' + col + '"></i></div>' +
        '<div class="bard">' + aa.d + '</div></div>';
    });
    h += '</div>';
    var lev = c.cash ? x.maxP / c.cash : null;
    h += '<div class="kvhead">지역 평균 기준 <span>— 이 지역 ' + c.area + '㎡ 평균 가격으로 계산한 값입니다</span></div>';
    h += '<div class="kvrow"><div><span>' + c.area + '㎡ 지역 평균가</span><b>' + won(x.price) + '</b></div>' +
      '<div><span>평균가로 살 때 필요현금</span><b>' + won(x.need) +
        '<i style="font-style:normal;font-size:11.5px;color:var(--slate);display:block">' +
        (x.en.mode === 'gap' ? '전세 끼고' : '대출 매수') + '</i></b></div>' +
      '<div><span>예산으로 최대</span><b>' + won(x.maxP) +
        '<i style="font-style:normal;font-size:11.5px;color:var(--slate);display:block">' +
        (x.maxCap ? '이 지역 상한' : (x.maxMode === 'gap' ? '전세 끼고' : '대출 매수') + (lev ? ' · ' + lev.toFixed(1) + '배' : '')) + '</i></b></div>' +
      '<div><span>10년 상승률</span><b>' + (x.g10 == null ? '—' : fmtPct(x.g10)) + '</b></div></div>';
    h += '<div class="aptbox" data-aptbox="' + x.r.code + '">' +
      (i < 3 || (GAPTOP && GAPTOP.r.code === x.r.code) ? '' :
        '<div style="font-size:12.5px;color:var(--slate)">단지 조회는 상위 3개 지역만 실행됩니다. ' +
        '이 지역 단지는 아래 <b>이 지역 단지 보기</b>로 확인하세요.</div>') + '</div>';
    h += '<div class="rowbtns" style="margin-top:14px">' +
      '<button class="btn sm" data-rgo="' + x.r.code + '">이 지역 단지 보기</button>' +
      '<button class="btn ghost sm" data-rmap="' + x.r.code + '">지도에서 보기</button>' +
      (home && home.code !== x.r.code ? '<button class="btn ghost sm" data-rsw="' + x.r.code + '">갈아타기 분석</button>' : '') +
      '<button class="btn ghost sm exbtn" data-exreg="' + x.r.code + '" title="이 지역 빼고 다음 순위 보기">✕ 이 지역 빼기</button>' +
      '</div>';
    h += '</div>';
  });
  el('recWrap').innerHTML = h;
  renderExBar();
  el('recWrap').querySelectorAll('[data-exreg]').forEach(function (b) {
    b.addEventListener('click', function () {
      var cd = b.dataset.exreg;
      EXREG[cd] = (BY[cd] && BY[cd].name) || cd;
      renderRec();
      var box = el('recAptWrap'); if (box) box.innerHTML = '';
      var st2 = el('recAptStat');
      if (st2) st2.textContent = '지역을 뺐습니다 — 단지를 다시 보려면 «예산으로 살 수 있는 단지 보기»를 눌러주세요';
    });
  });
  el('recWrap').querySelectorAll('[data-rgo]').forEach(function (b) {
    b.addEventListener('click', function () { el('rg5').value = b.dataset.rgo; show('p7'); });
  });
  el('recWrap').querySelectorAll('[data-rmap]').forEach(function (b) {
    b.addEventListener('click', function () { SELCODE = b.dataset.rmap; show('pm'); showDetail(b.dataset.rmap); });
  });
  el('recWrap').querySelectorAll('[data-rsw]').forEach(function (b) {
    b.addEventListener('click', function () {
      el('from3').value = el('home').value; el('to3').value = b.dataset.rsw;
      show('p4'); timing(); targets();
    });
  });

  var L = [];
  L.push('<span class="hl">' + esc(top.r.name) + '</span>가 ' + g.g + '등급 ' + Math.round(top.total) +
    '점으로 1순위입니다. ' + recWhy(top, c).replace(/<[^>]+>/g, ''));
  var best = top.ax.slice().sort(function (u, v) { return v.s - u.s; })[0];
  var worst = top.ax.slice().sort(function (u, v) { return u.s - v.s; })[0];
  L.push('가장 강한 축은 <span class="up">' + best.k + ' ' + Math.round(best.s) + '점</span>(' + best.d + '), ' +
    '가장 약한 축은 <span class="dn">' + worst.k + ' ' + Math.round(worst.s) + '점</span>(' + worst.d + ')입니다.');
  if (el('radius').value === 'auto') L.push('<b>거리 필터</b> — 규제지역은 실거주 의무가 있어 <b>60km 이내</b>만 후보로 봅니다. ' +
    '비규제지역은 전세를 끼고 살 수 있어 거리 제한을 두지 않습니다.');
  if (GAPTOP && byRank && (RANK[GAPTOP.r.code] || 999) < (RANK[byRank.r.code] || 999)) {
    L.push('<b>전세를 끼면 더 위로 갈 수 있습니다</b> — 대출 매수로는 <span class="hl">' + esc(byRank.r.name) +
      '</span>(전국 ' + RANK[byRank.r.code] + '위)까지지만, 전세를 승계하면 <span class="hl">' + esc(GAPTOP.r.name) +
      '</span>(전국 ' + RANK[GAPTOP.r.code] + '위 · ' + decile(GAPTOP.r.code) + '분위)까지 들어갑니다 — ' +
      '필요현금 ' + won(GAPTOP.g.need) + ', 전세가율 ' + n1(GAPTOP.g.jr) + '%. ' +
      '위 <b>전세 끼고만</b> 버튼을 누르면 이 기준으로 다시 정렬됩니다.');
  }
  var gapOnes = list.filter(function (q) {
    return q.en.mode === 'gap' && q.need <= c.cash &&
      (!byRank || (RANK[q.r.code] || 999) <= (RANK[byRank.r.code] || 999));
  }).slice(0, 4);
  if (gapOnes.length) L.push('<b>전세를 끼면 들어갈 수 있는 곳</b> — ' + gapOnes.map(function (q) {
    return esc(q.r.name) + ' ' + won(q.need); }).join(' · ') +
    '. 비규제지역이라 실거주 의무가 없어 <b>대출 없이 전세를 승계</b>하는 방식입니다. ' +
    '대출 매수보다 적게 들지만 <b>내가 살 수는 없고</b>, 전세가가 빠지면 차액을 메워야 합니다.');
  var bigOnes = list.filter(function (q) { return !q.maxCap; })
    .sort(function (u, v) { return v.maxP - u.maxP; }).slice(0, 3);
  if (bigOnes.length && byRank && bigOnes[0].maxP > (byRank.maxP || 0) * 1.15) {
    var dropRank = (RANK[bigOnes[0].r.code] || 999) - (RANK[byRank.r.code] || 999);
    L.push('<b>자산 규모로 보면</b> — ' + bigOnes.map(function (q) {
      return esc(q.r.name) + ' ' + won(q.maxP) + ' (' + (q.d || '—') + '분위'
        + (c.cash ? ' · ' + (q.maxP / c.cash).toFixed(1) + '배' : '') + ')'; }).join(' · ') +
      '까지 잡을 수 있습니다. 다만 ' + (dropRank > 0
        ? '급지가 <span class="dn">' + dropRank + '계단 내려갑니다</span>. 자산은 커지지만 상승률이 낮은 구간이라 ' +
          '<b>백테스트에서 손실 확률이 0% → 11%로 올라간 전략</b>입니다.'
        : '−20% 하락 시 손실도 그만큼 커집니다.') +
      ' 위 <b>투자 규모 큰 순</b>으로 정렬해 비교해 보세요.');
  }
  L.push('이 순위는 4개 축의 가중 합계입니다. <b>점수 자체보다 어느 축이 낮은지</b>를 보고, ' +
    '단지 단계로 내려가 세대수·역세권 조건까지 맞추면 <b>내 후보</b> 탭에서 6개 축 보고서를 받습니다.');
  el('recIns').innerHTML = '<h4>추천 근거</h4><ul><li>' + L.join('</li><li>') + '</li></ul>';
}
/** 추천 상위 지역의 대장 단지 2~3곳 */
function recTopApts() {
  var c = CFG(), n = Math.min(3, LASTREC.length);
  if (!n) return;
  var st = el('recAptStat'), btn = el('recApt');
  btn.disabled = true;
  var months = ymList(6), mode = String(c.area);
  var tasks = [];
  var targets = LASTREC.slice(0, n);
  if (GAPTOP && !targets.some(function (q) { return q.r.code === GAPTOP.r.code; })) {
    var extra = LASTREC.filter(function (q) { return q.r.code === GAPTOP.r.code; })[0];
    if (extra) targets.push(extra);
  }
  targets.forEach(function (x) {
    months.forEach(function (ym) {
      tasks.push(function () { return getTr(x.r.code, ym, 'sale').then(function (d) { return { code: x.r.code, k: 's', d: d }; }); });
      tasks.push(function () { return getTr(x.r.code, ym, 'rent').then(function (d) { return { code: x.r.code, k: 'j', d: d }; }); });
    });
  });
  st.textContent = '상위 ' + n + '개 지역의 단지를 불러오는 중…';
  pool(tasks, 8).then(function (res) {
    var G = {};
    res.forEach(function (x) {
      if (!x || !x.d || !x.d.items) return;
      x.d.items.forEach(function (t) {
        if (!areaPass(t.area, mode)) return;
        if (x.k === 's' && t.canceled) return;
        if (x.k === 'j' && !t.jeonse) return;
        var key = x.code + '|' + normName(t.apt);
        var g = G[key] || (G[key] = { code: x.code, apt: deent(t.apt), s: [], j: [], ar: [] });
        if (x.k === 's') { g.s.push(t.amount); g.ar.push(t.area); } else g.j.push(t.deposit);
      });
    });
    var byReg = {};
    Object.keys(G).forEach(function (k) {
      var g = G[k]; if (g.s.length < 2) return;
      var med = median(g.s), ar = median(g.ar);
      (byReg[g.code] = byReg[g.code] || []).push({ apt: g.apt, med: med, ar: ar, py: med / ar * PY,
        jeon: median(g.j), n: g.s.length });
    });
    targets.forEach(function (x) {
      var box = document.querySelector('[data-aptbox="' + x.r.code + '"]');
      if (!box) return;
      var all = (byReg[x.r.code] || []).map(function (g) {
        var nc2 = needCash(g.med, x.r, c);
        /* 전세 끼고 매수 — 비규제지역 + 전세 실거래가 있을 때만 */
        var tOwn = c.own === 0 ? 0 : Math.max(1, c.taxOwn);
        var gapNeed = (!x.r.reg && g.jeon && g.jeon < g.med)
          ? (g.med - g.jeon) + acqTax(g.med, g.ar, tOwn, x.r.reg) + broker(g.med) + c.etc : null;
        var use = nc2.need, mode = 'loan';
        if (ENTRY === 'gap') { use = gapNeed == null ? Infinity : gapNeed; mode = 'gap'; }
        else if (ENTRY === 'auto' && gapNeed != null && gapNeed < nc2.need) { use = gapNeed; mode = 'gap'; }
        return { g: g, need: use, loanNeed: nc2.need, gapNeed: gapNeed, mode: mode,
          loan: nc2.loan, bind: nc2.bind, ok: use <= c.cash,
          jr: g.jeon ? g.jeon / g.med * 100 : null };
      }).filter(function (y) { return !EXAPT[exKeyApt(x.r.code, y.g.apt)]; })      /* v46.0 제외 */
        .sort(function (u, v) {
          if (APTSORT === 'sc') { var d = aptScore(v.g, x.r) - aptScore(u.g, x.r); if (d) return d; }
          return v.g.py - u.g.py;
        });
      if (!all.length) {
        box.innerHTML = '<div class="aptwarn">최근 6개월 ' + c.area + '㎡대 거래가 없습니다. 평형을 바꿔보세요.</div>';
        return;
      }
      RECAPTS[x.r.code] = all.map(function (y) {
        return { apt: y.g.apt, py: y.g.py, med: y.g.med, jeon: y.g.jeon, need: y.need, ok: y.ok, mode: y.mode };
      });
      var okList = all.filter(function (y) { return y.ok; });
      var onlyOk = el('recAptOk').checked;
      var hh0 = '';
      var show3 = (onlyOk ? okList : all).slice(0, 3);
      var flagship = all[0];

      var best1 = okList[0];
      if (best1) {
        var left = c.cash - best1.need;
        hh0 = '<div class="kvhead real">실제 매물 기준 <span>— 아래 표에서 고른 매물로 계산한 값입니다</span></div>' +
          '<div class="kvrow real"><div><span>살 수 있는 최고 매물</span><b>' + won(best1.g.med) +
            '<i style="font-style:normal;font-size:11.5px;color:var(--slate);display:block">' + esc(best1.g.apt) + '</i></b></div>' +
          '<div><span>필요현금</span><b style="color:var(--good)">' + won(best1.need) +
            '<i style="font-style:normal;font-size:11.5px;color:var(--slate);display:block">' +
            (best1.mode === 'gap' ? '전세 끼고' : '대출 매수') + '</i></b></div>' +
          '<div><span>남는 돈</span><b>' + won(Math.max(0, left)) + '</b></div>' +
          '<div><span>−20% 시 손실</span><b style="color:#B24A32">−' + won(best1.g.med * 0.2) + '</b></div></div>';
      } else hh0 = '';
      var nGap = okList.filter(function (y) { return y.mode === 'gap'; }).length;
      var hh = hh0 + '<div class="aptheadline"><b>이 지역에서 살 수 있는 최상급 단지</b>' +
        '<span>예산 내 ' + okList.length + '곳 / 거래 ' + all.length + '곳' +
        (nGap ? ' · 전세 끼고 ' + nGap + '곳' : '') +
        (x.r.reg ? ' · 규제지역이라 전세 끼고 매수 불가' : '') + '</span></div>';

      if (onlyOk && !okList.length) {
        hh += '<div class="aptwarn"><b>이 지역은 평균으로는 닿지만, 실제 매물은 예산을 넘습니다.</b><br>' +
          '지역 평균 ' + c.area + '㎡ 추정 필요현금은 ' + won(x.need) + '인데, 실제 거래된 단지 중 가장 싼 곳도 ' +
          won(Math.min.apply(null, all.map(function (y) { return y.need; }))) + '이 필요합니다.<br>' +
          '<b>평형을 낮추거나</b>, 한 급 아래 지역을 보거나, 아래 <b>예산 초과 단지도 보기</b>로 전체를 확인하세요.</div>';
      }
      if (show3.length) {
        hh += '<div class="aptsortbar">' +
          '<span>정렬</span>' +
          '<button class="chip' + (APTSORT === 'py' ? ' on' : '') + '" data-aptsort="py">비싼 순</button>' +
          '<button class="chip' + (APTSORT === 'sc' ? ' on' : '') + '" data-aptsort="sc">점수 순</button>' +
          '<span class="hint" style="margin-left:8px">점수 = 연식 35 · 역세권 35 · 세대수 30 · 전세 뒷받침 (FAQ Q18)</span>' +
          '</div>';
        hh += '<div class="tblwrap"><table style="min-width:840px"><thead><tr><th>순위</th><th>단지</th><th>평당가</th>' +
          '<th>매매</th><th>진입 방식</th><th>필요현금</th><th>전세 · 전세가율</th><th>거래</th><th></th></tr></thead><tbody>';
        show3.forEach(function (y, i) {
          var g = y.g;
          hh += '<tr' + (y.ok ? ' class="pick"' : '') + '><td class="nm"><span class="b ' + (i === 0 ? 'd1' : 'no') + '">' + (i + 1) + '위</span></td>' +
            '<td class="nm">' + esc(g.apt) + '</td><td style="font-weight:700">' + n0(g.py) + '만</td>' +
            '<td>' + won(g.med) + '</td>' +
            '<td>' + (y.mode === 'gap' ? '<span class="b ok">전세 끼고</span>' : '<span class="b no">대출 매수</span>') +
              (y.mode === 'loan' && y.gapNeed != null ? '<div style="font-size:11px;color:var(--slate)">전세 끼면 ' + won(y.gapNeed) + '</div>' :
               y.mode === 'gap' ? '<div style="font-size:11px;color:var(--slate)">대출로는 ' + won(y.loanNeed) + '</div>' : '') + '</td>' +
            '<td style="font-weight:700;color:' + (y.ok ? 'var(--good)' : '#B24A32') + '">' + won(y.need) +
              (y.ok ? '' : '<div style="font-size:11px">' + won(y.need - c.cash) + ' 부족</div>') + '</td>' +
            '<td>' + (g.jeon ? won(g.jeon) + '<div style="font-size:11px;color:var(--slate)">' + n1(y.jr) + '%</div>' : '—') + '</td>' +
            '<td>' + g.n + '건</td>' +
            '<td class="aptacts">' +
              '<button class="btn ghost sm" data-rcart=\'' + JSON.stringify({ c: x.r.code, a: g.apt, b: bucketOf(g.ar), m: g.med, j: g.jeon || null, p: g.py, r: g.ar }).replace(/'/g, '&#39;') + '\'>담기</button>' +
              '<button class="btn ghost sm" data-aptmap="' + esc(g.apt) + '" data-aptrg="' + esc(x.r.name) + '" title="지도에서 위치 보기">지도</button>' +
              '<button class="btn ghost sm exbtn" data-exapt="' + esc(g.apt) + '" data-exrg="' + x.r.code + '" title="이 단지 빼고 다시 보기">✕</button>' +
            '</td></tr>';
        });
        hh += '</tbody></table></div>';
        var gapWin = all.filter(function (y) { return y.mode === 'gap' && y.ok && y.g.py > show3[0].g.py * 0.99; });
        var bestGap = all.filter(function (y) { return y.gapNeed != null && y.gapNeed <= c.cash; })
          .sort(function (u, v) { return v.g.py - u.g.py; })[0];
        var bestLoan = all.filter(function (y) { return y.loanNeed <= c.cash; })
          .sort(function (u, v) { return v.g.py - u.g.py; })[0];
        if (bestGap && (!bestLoan || bestGap.g.py > bestLoan.g.py * 1.05)) {
          hh += '<div class="aptref" style="border-left-color:var(--good)"><b>전세를 끼면 더 위로 갈 수 있습니다</b> — ' +
            '대출 매수로는 ' + (bestLoan ? esc(bestLoan.g.apt) + ' (평당 ' + n0(bestLoan.g.py) + '만)' : '가능한 단지 없음') +
            '까지지만, 전세를 끼면 <b>' + esc(bestGap.g.apt) + ' (평당 ' + n0(bestGap.g.py) + '만 · 매매 ' + won(bestGap.g.med) +
            ')</b>까지 들어갑니다 — 필요현금 ' + won(bestGap.gapNeed) + ' (전세가율 ' + n1(bestGap.jr) + '%).</div>';
        }
      }
      if (onlyOk && okList.length && flagship && !flagship.ok) {
        hh += '<div class="aptref"><b>참고 · 이 지역 대장은 ' + esc(flagship.g.apt) + '</b>' +
          ' — 평당 ' + n0(flagship.g.py) + '만 · 매매 ' + won(flagship.g.med) +
          ' · 최소 필요현금 ' + won(flagship.need) + ' (' + (flagship.mode === 'gap' ? '전세 끼고' : '대출 매수') +
          ', <b>' + won(flagship.need - c.cash) + ' 부족</b>). ' +
          '예산 내 1위(' + esc(show3[0].g.apt) + ')와 평당가 차이는 ' +
          n0(flagship.g.py - show3[0].g.py) + '만(' +
          Math.round((flagship.g.py / show3[0].g.py - 1) * 100) + '%)입니다.</div>';
      }
      hh += '<div style="font-size:12px;color:var(--slate);margin-top:8px">' +
        '<b>대출 매수</b> 필요현금 = 매매가 − 대출 + 취득세 + 중개보수 + 부대비용 · ' +
        '<b>전세 끼고</b> = (매매가 − 전세가) + 취득세 + 중개보수 + 부대비용 (대출 없음, 비규제지역만)<br>' +
        '최근 6개월 거래 2건 이상 단지만 · 전세가는 같은 평형대 실거래 중위값이라 해당 단지에 전세 매물이 실제로 있는지는 확인이 필요합니다</div>';
      box.innerHTML = hh;
      box.querySelectorAll('[data-rcart]').forEach(function (b) {
        b.addEventListener('click', function () {
          var o = JSON.parse(b.dataset.rcart);
          var rg = BY[o.c];
          var ok = cartAdd({ key: o.c + ':' + o.a + ':' + o.b, code: o.c, region: rg.name, apt: o.a,
            bucket: o.b, med: o.m, jeon: o.j, py: o.p, area: o.r, hh: null, walk: null, byr: null, g10: null });
          b.textContent = ok ? '담김 ✓' : '이미 담김'; b.disabled = true;
        });
      });
      /* v46.0 — 지도 */
      box.querySelectorAll('[data-aptmap]').forEach(function (b) {
        b.addEventListener('click', function () {
          var q = encodeURIComponent(b.dataset.aptrg + ' ' + b.dataset.aptmap);
          window.open('https://map.kakao.com/?q=' + q, '_blank', 'noopener');
        });
      });
      /* v46.0 — 이 단지 빼기 */
      box.querySelectorAll('[data-exapt]').forEach(function (b) {
        b.addEventListener('click', function () {
          EXAPT[exKeyApt(b.dataset.exrg, b.dataset.exapt)] = b.dataset.exapt;
          recTopApts();
          renderExBar();
        });
      });
      /* v46.0 — 정렬 전환 */
      box.querySelectorAll('[data-aptsort]').forEach(function (b) {
        b.addEventListener('click', function () {
          APTSORT = b.dataset.aptsort; recTopApts();
        });
      });
    });
    drawBestCompare(targets, c);
    st.textContent = targets.length + '개 지역 표시 완료 — 리포트 이미지에도 포함됩니다';
    btn.disabled = false;
  });
}
/** 조회한 지역들에서 '예산으로 실제 살 수 있는 최고 매물'을 나란히 비교 */
function drawBestCompare(targets, c) {
  var rows = targets.map(function (x) {
    var arr = (RECAPTS[x.r.code] || []).filter(function (y) { return y.ok; })
      .sort(function (u, v) { return v.med - u.med; });
    return { x: x, best: arr[0] || null, n: (RECAPTS[x.r.code] || []).length,
      nOk: (RECAPTS[x.r.code] || []).filter(function (y) { return y.ok; }).length };
  }).filter(function (r) { return r.n; });
  if (rows.length < 2) { el('recBest').innerHTML = ''; return; }
  var withBest = rows.filter(function (r) { return r.best; });
  withBest.sort(function (u, v) { return v.best.med - u.best.med; });
  var h = '<div class="card flat"><span class="eb">REALITY CHECK</span>' +
    '<h2 style="font-size:23px;margin-bottom:6px">예산으로 실제 살 수 있는 매물 비교</h2>' +
    '<p class="hint" style="margin-bottom:14px">지역 순위가 높아도 <b>그 지역에 내 예산으로 살 만한 매물이 실제로 있는지</b>는 다른 문제입니다. ' +
    '같은 돈이면 <b>더 비싼 자산</b>을 잡는 쪽이 절대 수익에서 유리합니다.</p>' +
    '<div class="tblwrap"><table style="min-width:660px"><thead><tr><th>지역</th><th>순위</th>' +
    '<th>살 수 있는 최고 매물</th><th>매매가</th><th>평당가</th><th>진입</th><th>−20% 손실</th><th>선택지</th></tr></thead><tbody>';
  rows.sort(function (u, v) { return (v.best ? v.best.med : -1) - (u.best ? u.best.med : -1); });
  rows.forEach(function (r, i) {
    h += '<tr' + (i === 0 && r.best ? ' class="pick"' : '') + '><td class="nm">' + esc(r.x.r.name) + '</td>' +
      '<td>' + (RANK[r.x.r.code] ? '전국 ' + RANK[r.x.r.code] + '위' : '—') + '</td>' +
      '<td class="nm">' + (r.best ? esc(r.best.apt) : '<span style="color:#B24A32">없음</span>') + '</td>' +
      '<td style="font-weight:700">' + (r.best ? won(r.best.med) : '—') + '</td>' +
      '<td>' + (r.best ? n0(r.best.py) + '만' : '—') + '</td>' +
      '<td>' + (r.best ? (r.best.mode === 'gap' ? '<span class="b ok">전세 끼고</span>' : '<span class="b no">대출</span>') : '—') + '</td>' +
      '<td style="color:#B24A32">' + (r.best ? '−' + won(r.best.med * 0.2) : '—') + '</td>' +
      '<td>' + r.nOk + ' / ' + r.n + '곳' + (r.n < 6 ? '<div style="font-size:11px;color:#B24A32">표본 부족</div>' : '') + '</td></tr>';
  });
  h += '</tbody></table></div>';
  var top = withBest[0], others = withBest.slice(1);
  if (top && others.length) {
    var gaps = others.map(function (o) {
      return esc(o.x.r.name) + ' ' + won(o.best.med) + ' (평당 ' + n0(o.best.py) + '만)';
    }).join(' · ');
    h += '<div class="ins"><h4>이 표를 읽는 법</h4><ul>' +
      '<li>같은 예산으로 가장 큰 자산을 잡을 수 있는 곳은 <span class="hl">' + esc(top.x.r.name) + ' ' +
        esc(top.best.apt) + ' ' + won(top.best.med) + '</span>(평당 ' + n0(top.best.py) + '만)입니다.</li>' +
      '<li>나머지는 ' + gaps + '입니다. <b>지역 서열이 높아도 실제 매물이 작으면 절대 수익은 작아집니다</b> — ' +
        '10% 올라도 4억짜리는 4천만, 2.4억짜리는 2,400만입니다.</li>' +
      '<li>선택지가 <b>6곳 미만</b>인 지역은 그 평형 실거래 표본이 적은 것입니다. 평형을 바꾸거나 ' +
        '<b>아파트 찾기</b> 탭에서 전체 평형으로 다시 보세요 — 진짜 없는 게 아니라 안 잡힌 것일 수 있습니다.</li>' +
      '<li><b>큰 자산은 하방도 큽니다.</b> 같은 −20%라도 ' + won(top.best.med * 0.2) + ' vs ' +
        won(others[others.length - 1].best.med * 0.2) + '입니다. 백테스트에서 자산 규모를 키우면 3년 평균 수익이 ' +
        '<b>1.69억 → 2.16억</b>으로 늘었지만, 손실 확률이 <b>0% → 11%</b>가 되고 최악의 경우 <b>−0.83억</b>이었습니다.</li>' +
      '</ul></div>';
  }
  h += '</div>';
  el('recBest').innerHTML = h;
}
function recWhy(x, c) {
  var L = [];
  if (x.d != null) L.push('전국 <b>' + x.d + '분위</b>');
  if (x.g10 != null) L.push('10년 <b>' + fmtPct(x.g10) + '</b>');
  if (x.jb) L.push('전세가율 밴드 <b>' + Math.round(x.jb.pct * 100) + '%</b>');
  if (x.sr != null) L.push('입주 배율 <b>' + x.sr.toFixed(2) + '배</b>');
  L.push((x.en.mode === 'gap' ? '전세 끼고 <b>' : '대출 매수 <b>') + won(x.need) + '</b>' +
    (x.need <= c.cash ? ' <span style="color:var(--good)">(실행 가능)</span>' :
    ' <span style="color:#B24A32">(' + won(x.need - c.cash) + ' 부족)</span>'));
  return L.join(' · ') + '.';
}
function imgRec() {
  if (!LASTREC.length) return;
  var c = CFG();
  exportPNG({
    title: '내 조건 맞춤 투자처',
    sub: '현금 ' + won(c.cash) + ' · 전용 ' + c.area + '㎡ · ' + OWNL[c.own] + ' · ' + radiusNote(),
    stats: LASTREC.slice(0, 3).map(function (x, i) {
      var g = gradeOf(x.total);
      return { label: (i + 1) + '순위', value: x.r.name + ' ' + g.g,
        color: x.total >= 68 ? 'good' : (x.total < 50 ? 'bad' : '') };
    }),
    headers: ['지역', '점수', '분위', '진입', '필요현금', '10년'],
    weights: [2.2, .9, .8, 1.1, 1.2, 1.05],
    bold: [4], grade: [5],
    rows: LASTREC.map(function (x) {
      return [x.r.name, gradeOf(x.total).g + ' ' + Math.round(x.total),
        (x.d || '—') + '분위', x.en.mode === 'gap' ? '전세 끼고' : '대출', won(x.need),
        x.g10 == null ? '—' : (x.g10 > 0 ? '+' : '') + n1(x.g10) + '%'];
    }),
    max: 16,
    note: '급지 60% · 전세 뒷받침 40% 가중 · 수급·장기성과 미반영 · 자금은 필터로만 적용 · 투자 자문 아님',
    file: 'recommend'
  });
}

/* ══════════ 백테스트 — 상급지 중간 vs 중급지 대장 ══════════ */
var BT = null, chartBT = null;
function btMonths(yearsAgo, n) {
  var o = [], d = new Date();
  for (var i = 0; i < n; i++) {
    var y = d.getFullYear() - yearsAgo, m = d.getMonth() + 1 - i;
    while (m <= 0) { m += 12; y--; }
    o.push(y * 100 + m);
  }
  return o;
}
var BTMODE = 'py';   /* py = 평당가 순위 · hh = 세대수 · sz = 평형 · ag = 노후도 */
function szClass(ar) { return ar < 55 ? 'sm' : (ar < 95 ? 'md' : 'lg'); }
function szLabel(k) { return k === 'sm' ? '소형(55㎡ 미만)' : k === 'md' ? '중형(59·84㎡)' : '대형(95㎡ 이상)'; }
function sizeSplit(list) {
  return { sm: list.filter(function (g) { return g.sz === 'sm'; }),
    md: list.filter(function (g) { return g.sz === 'md'; }),
    lg: list.filter(function (g) { return g.sz === 'lg'; }) };
}
function avgAr(a2) { return a2.length ? a2.reduce(function (s, x) { return s + (x.ar || 0); }, 0) / a2.length : null; }
function btFetch(code, yearsAgo, mode) {
  var now = btMonths(0, 4), past = btMonths(yearsAgo, 4);
  var tasks = [];
  now.forEach(function (ym) { tasks.push(function () { return getTr(code, ym, 'sale').then(function (d) { return { t: 'now', d: d }; }); }); });
  past.forEach(function (ym) { tasks.push(function () { return getTr(code, ym, 'sale').then(function (d) { return { t: 'past', d: d }; }); }); });
  return pool(tasks, 8).then(function (res) {
    var G = {};
    res.forEach(function (x) {
      if (!x || !x.d || !x.d.items) return;
      x.d.items.forEach(function (t) {
        if (t.canceled) return;
        if (BTMODE === 'sz') {
          if (t.area < 20 || t.area > 200) return;
          var kz = normName(t.apt) + '|' + szClass(t.area);
          var gz = G[kz] || (G[kz] = { apt: deent(t.apt), sz: szClass(t.area), ars: [], now: [], past: [] });
          gz.ars.push(t.area);
          gz[x.t].push(t.amount / t.area * PY);
          return;
        }
        if (!areaPass(t.area, mode)) return;
        var k = normName(t.apt);
        var g = G[k] || (G[k] = { apt: deent(t.apt), now: [], past: [] });
        g[x.t].push(t.amount / t.area * PY);
      });
    });
    var list = [];
    Object.keys(G).forEach(function (k) {
      var g = G[k];
      if (g.now.length < 2 || g.past.length < 2) return;
      var p0 = median(g.past), p1 = median(g.now);
      list.push({ apt: g.apt, p0: p0, p1: p1, gr: (p1 / p0 - 1) * 100, n0: g.past.length, n1: g.now.length,
        sz: g.sz || null, ar: g.ars ? median(g.ars) : null });
    });
    list.sort(function (u, v) { return v.p0 - u.p0; });   /* 과거 시점 평당가 기준 정렬 */
    if (BTMODE !== 'hh' && BTMODE !== 'ag') return list;
    return enrich(code, list).then(function () { return list; }, function () { return list; });
  });
}

/* ══ v46.0 — 뺀 지역·단지 목록 표시 ══ */
function renderExBar() {
  var host = el('exBar'); if (!host) return;
  var rk = Object.keys(EXREG), ak = Object.keys(EXAPT);
  if (!rk.length && !ak.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = '';
  var h = '<div class="exhead"><b>내가 뺀 것</b>' +
    '<button class="btn ghost sm" id="exClear">전부 되돌리기</button></div><div class="extags">';
  rk.forEach(function (c) {
    h += '<span class="extag" data-unreg="' + c + '">지역 · ' + esc(EXREG[c]) + ' <i>✕</i></span>';
  });
  ak.forEach(function (k) {
    var rg = BY[k.split('|')[0]];
    h += '<span class="extag" data-unapt="' + esc(k) + '">단지 · ' + esc(EXAPT[k]) +
      (rg ? ' <em>(' + esc(rg.name) + ')</em>' : '') + ' <i>✕</i></span>';
  });
  h += '</div><div class="hint">뺀 항목은 추천에서 제외되고 <b>다음 순위가 자동으로 올라옵니다.</b> ✕를 누르면 되돌립니다.</div>';
  host.innerHTML = h;
  host.querySelectorAll('[data-unreg]').forEach(function (t) {
    t.addEventListener('click', function () { delete EXREG[t.dataset.unreg]; renderRec(); });
  });
  host.querySelectorAll('[data-unapt]').forEach(function (t) {
    t.addEventListener('click', function () { delete EXAPT[t.dataset.unapt]; renderExBar(); recTopApts(); });
  });
  var cb = el('exClear');
  if (cb) cb.addEventListener('click', function () { EXREG = {}; EXAPT = {}; renderRec(); });
}
