'use strict';
function renderOb() {
  var box = el('obBody');
  if (OBSTEP >= OBQ.length + 1) { closeOb(false); return; }
  var pctBar = Math.round((OBSTEP) / (OBQ.length + 1) * 100);
  el('obBar').style.width = pctBar + '%';
  el('obStep').textContent = (OBSTEP + 1) + ' / ' + (OBQ.length + 1);

  if (OBSTEP === OBQ.length) {
    /* 마지막 — 지역 */
    var h = '<h3>어디 사세요?</h3><p class="obsub">지금 사는 곳을 기준으로 거리와 갈아타기를 계산합니다</p>' +
      '<div class="field" style="margin-top:18px"><label>시·군·구</label><select id="obHome"></select></div>' +
      '<div class="obhint">1주택 이상이면 <b>규제지역은 60km 이내</b>만 후보로 봅니다 — 실거주 의무가 있어서입니다. ' +
      '비규제지역은 전세를 끼고 살 수 있어 거리를 따지지 않습니다.</div>' +
      '<button class="btn big obnext" data-fin="1">결과 보기</button>';
    box.innerHTML = h;
    fillSel(el('obHome'), SGG, OBDATA.home || el('home').value || '41410');
    box.querySelector('[data-fin]').addEventListener('click', function () {
      OBDATA.home = el('obHome').value;
      applyOb(); OBSTEP++; renderOb();
    });
    return;
  }
  var q = OBQ[OBSTEP];
  var h2 = '<h3>' + q.t + '</h3><p class="obsub">' + q.s + '</p><div class="obopts">';
  q.opt.forEach(function (o) {
    h2 += '<button class="obopt" data-v="' + o[0] + '"><b>' + o[1] + '</b>' +
      (o[2] ? '<span>' + o[2] + '</span>' : '') + '</button>';
  });
  h2 += '</div>';
  if (q.free) h2 += '<div class="field" style="margin-top:14px"><label>직접 입력 (만원)</label>' +
    '<input type="number" id="obFree" placeholder="예: 35000" step="1000"></div>' +
    '<button class="btn obnext" id="obFreeGo">이 금액으로</button>';
  box.innerHTML = h2;
  box.querySelectorAll('.obopt').forEach(function (b) {
    b.addEventListener('click', function () { OBDATA[q.k] = b.dataset.v; OBSTEP++; renderOb(); });
  });
  if (q.free) el('obFreeGo').addEventListener('click', function () {
    var v = parseFloat(el('obFree').value);
    if (!isFinite(v) || v <= 0) return;
    OBDATA[q.k] = String(v); OBSTEP++; renderOb();
  });
}
function applyOb() {
  if (OBDATA.own != null) el('own').value = OBDATA.own;
  if (OBDATA.cash != null) el('cash').value = OBDATA.cash;
  if (OBDATA.area != null) el('area').value = OBDATA.area;
  if (OBDATA.home != null) { el('home').value = OBDATA.home; el('from3').value = OBDATA.home; }
  syncFirst();
  el('radius').value = (+el('own').value >= 1) ? 'auto' : 'off';
  saveCfg(); condSummary();
}

/* ── 용어 사전 ── */
var GLOSS = [
  ['평당가', '1평(3.3㎡)당 가격. 크기가 다른 집을 같은 잣대로 비교할 때 씁니다. 이 앱은 <b>전용면적</b> 기준이라 네이버 시세(공급면적)보다 25%쯤 높게 나옵니다.'],
  ['분위 / 급지', '전국 시·군·구를 가격순으로 10등분한 것. <b>1분위가 가장 비싼 상위 10%</b>입니다. 절대 가격은 매년 바뀌지만 분위는 잘 안 바뀝니다.'],
  ['필요현금', '집을 살 때 통장에서 실제로 나가는 돈. <b>매매가 − 대출 + 취득세 + 중개보수 + 등기·이사비</b>입니다. 집값과 다릅니다.'],
  ['전세가율', '전세값 ÷ 매매값. 이 값이 낮을수록 매매가에 <b>미래 기대</b>가 많이 실린 상태이고, 높을수록 실제 사용가치에 가깝습니다.'],
  ['밴드 (백분위)', '지금 값이 <b>지난 10년 안에서 몇 번째쯤</b>인지를 0~100%로 편 것. 0%면 역대 최저, 100%면 역대 최고입니다.'],
  ['배율', '목표 지역 가격 ÷ 내 지역 가격. 1.68이면 목표가 68% 비싸다는 뜻입니다. 갈아타기 비용은 절대 가격이 아니라 이 <b>격차</b>입니다.'],
  ['갭', '매매가 − 전세보증금. 전세를 끼고 살 때 실제로 필요한 돈입니다.'],
  ['LTV', '집값 대비 빌릴 수 있는 비율. 규제지역 40%, 비규제 70%가 기본이고 생애최초는 더 받습니다.'],
  ['DSR', '내 소득으로 갚을 수 있는 한도. 소득을 입력하면 LTV보다 이쪽이 먼저 막히는 경우가 많습니다.'],
  ['규제지역', '조정대상지역·투기과열지구·토지거래허가구역. <b>실거주 의무</b>가 있어 전세 끼고 사는 게 막힙니다.'],
  ['수급 / 입주물량', '앞으로 들어올 새 아파트 물량 ÷ 그 지역 수요. 1을 넘으면 공급이 많아 <b>전세가 밀립니다</b>. 행정구역이 아니라 반경 15km 생활권으로 계산합니다.'],
  ['준공후 미분양', '다 지어놓고도 안 팔린 물량. <b>가장 악성인 재고</b>라 일반 미분양보다 신호가 강합니다.'],
  ['10년 상승률 100%', '10년에 두 배(연복리 7.2%). 서울 아파트 장기 평균과 물가를 감안한 <b>통과선</b>입니다. 이 아래는 시장을 못 이긴 것으로 봅니다.'],
  ['연복리 (CAGR)', '매년 몇 %씩 불어난 셈인지. 10년에 100% 오르면 연복리 7.2%입니다. 단순히 10으로 나누면 안 됩니다.'],
  ['탑다운', '전국 서열 → 내 돈이 닿는 구간 → 그 안의 최상단 지역 → 조건을 통과한 단지 순으로 좁혀 내려가는 방식입니다.']
];
function openGloss() {
  var h = '';
  GLOSS.forEach(function (g) {
    h += '<div class="gl"><b>' + g[0] + '</b><p>' + g[1] + '</p></div>';
  });
  el('glBody').innerHTML = h;
  el('glWrap').hidden = false;
}

/* ══════════ 자금 계산기 ══════════ */
function renderCalc() {
  var c = CFG();
  var area = +el('calcArea').value;
  var own = +el('calcOwn').value;
  var reg = el('calcReg').checked, cap = el('calcCap').checked, first = el('calcFirst').checked && own === 0;
  var cc = Object.assign({}, c, { area: area, own: own, taxOwn: taxOwnOf(own), first: first });
  var fake = { reg: reg, cap: cap };
  var price = num('calcPrice'), cash = num('calcCash');

  /* 현금 → 최대 매수가 역산 */
  var maxP = maxBuy(cash, fake, cc);
  var L = loanOf(price, fake, cc);
  var tax = acqTax(price, area, cc.taxOwn, reg), fee = broker(price);
  var need = price - L.loan + tax + fee + cc.etc;
  var taxRate = price > 0 ? tax / price * 100 : 0;

  el('calcKpi').innerHTML =
    '<div class="kpi hero"><span class="lb">총 필요 현금</span><span class="vl">' + won(need) +
      '</span><span class="sb">' + won(price) + ' 매수 시 · 대출 ' + won(L.loan) + '</span></div>' +
    kpi('대출 가능액', won(L.loan), L.bind + ' 기준 · LTV ' + L.ltv + '%', L.loan > 0 ? 'good' : 'sig') +
    kpi('취득세 등', won(tax), '실효 ' + n1(taxRate) + '% (지방교육세·농특세 포함)', 'sig') +
    kpi('내 현금으로 최대', won(maxP), '같은 조건 기준', '');

  var rows = [
    ['매수가', won(price), ''],
    ['− 대출 가능액', '−' + won(L.loan), L.bind + ' · LTV ' + L.ltv + '%'],
    ['= 자기자금', won(price - L.loan), ''],
    ['+ 취득세·지방교육세·농특세', '+' + won(tax), '실효 ' + n1(taxRate) + '%' + (cc.taxOwn >= 1 && reg ? ' (다주택 중과)' : '')],
    ['+ 중개보수 (상한요율)', '+' + won(fee), n1(price > 0 ? fee / price * 100 : 0) + '%'],
    ['+ 등기·이사·기타', '+' + won(cc.etc), '설정값'],
    ['총 필요 현금', won(need), cash >= need ? '보유 현금으로 가능' : '부족 ' + won(need - cash)]
  ];
  var tb = el('tcalc').tBodies[0]; tb.innerHTML = '';
  rows.forEach(function (r, i) {
    var last1 = i === rows.length - 1;
    var tr = document.createElement('tr');
    if (last1) tr.className = 'pick';
    tr.innerHTML = '<td class="nm"' + (last1 ? ' style="font-weight:700"' : '') + '>' + r[0] + '</td>' +
      '<td style="font-weight:' + (last1 ? 700 : 450) + '">' + r[1] + '</td>' +
      '<td style="color:var(--slate)">' + r[2] + '</td>';
    tb.appendChild(tr);
  });

  /* 가격 구간별 대출 한도 표 */
  var pts = [50000, 90000, 120000, 150000, 150001, 200000, 250000, 250001, 300000];
  var tb2 = el('tcalc2').tBodies[0]; tb2.innerHTML = '';
  pts.forEach(function (P) {
    var l = loanOf(P, fake, cc), t = acqTax(P, area, cc.taxOwn, reg);
    var nd = P - l.loan + t + broker(P) + cc.etc;
    var tr = document.createElement('tr');
    if (P <= maxP) tr.className = 'pick';
    tr.innerHTML = '<td class="nm">' + won(P) + '</td><td>' + won(l.loan) + '</td>' +
      '<td><span class="b no">' + l.bind + '</span></td><td>' + won(t) + '</td>' +
      '<td>' + won(broker(P)) + '</td><td style="font-weight:700">' + won(nd) + '</td>' +
      '<td>' + (P <= maxP ? '<span class="b ok">가능</span>' : '<span class="b no">부족</span>') + '</td>';
    tb2.appendChild(tr);
  });
  el('calcNote').innerHTML = '<b>지금 적용 중인 규정</b> — ' +
    (reg ? '규제지역(조정+투기과열+토허)' : '비규제') + ' · ' + (cap ? '수도권' : '지방') + ' · ' +
    OWNL[own] + (first ? ' · 생애최초' : '') + '<br>' +
    'LTV ' + L.ltv + '% · 대출 총액 한도 15억 이하 ' + won(cc.capLoan) + ' / 15~25억 ' + won(cc.cap15) +
    ' / 25억 초과 ' + won(cc.cap25) + ' · DSR ' + cc.dsr + '% · 스트레스 가산 ' + cc.stress + '%p' +
    (cc.banOwner ? ' · 규제지역 다주택·추가매수 주담대 불가 반영' : '');
}

/* ══════════ 탭 · 초기화 ══════════ */
var RENDER = { pr: renderRec, pi: function () { }, pb: function () { }, pk: renderMarket, pv: function () { }, pq: renderQuad, ps: renderSup, p1: render1, pm: applyMapMode, pc: renderCalc, pf: renderFinal, p2: render2, px: function () { }, p3: render3, p4: render4, p5: render5 };
var GRP = { g0: ['pr', 'pi', 'p0'], g1: ['pk', 'pv', 'pq', 'ps', 'pb'], g2: ['p1', 'pm', 'p2', 'p3', 'p4', 'p5'],
  g3: ['p6', 'p7', 'px'], g4: ['pc', 'p8'], g5: ['pf'] };
var CURG = 'g0';
function groupOf(id) {
  var g = 'g0';
  Object.keys(GRP).forEach(function (k) { if (GRP[k].indexOf(id) >= 0) g = k; });
  return g;
}
function setGroup(g, jump) {
  CURG = g;
  document.querySelectorAll('#navGroups button').forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.g === g);
  });
  document.querySelectorAll('.tab').forEach(function (t) { t.hidden = (groupOf(t.dataset.p) !== g); });
  if (jump) {
    var cur = document.querySelector('.tab[aria-selected="true"]');
    if (!cur || groupOf(cur.dataset.p) !== g) show(GRP[g][0]);
  }
}
function show(id) {
  if (!document.getElementById(id)) id = 'p0';
  document.querySelectorAll('.pane').forEach(function (p) { p.hidden = p.id !== id; });
  document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.p === id); });
  el('cond').hidden = (id === 'p8' || id === 'pk');
  setGroup(groupOf(id), false);
  if (RENDER[id]) RENDER[id]();
  location.hash = id;
  try { window.scrollTo(0, 0); } catch (e) { }
}
function refresh() {
  var cur = document.querySelector('.tab[aria-selected="true"]');
  var id = cur ? cur.dataset.p : 'p1';
  if (RENDER[id]) RENDER[id]();
}
var CK = ['cash', 'home', 'area', 'income', 'rate', 'own', 'radius', 'ltvReg', 'ltvCap', 'ltvLoc',
  'ltvFirst', 'ltvFirstLoc', 'capLoan', 'cap15', 'cap25', 'dsr', 'stress', 'etc'];
function saveCfg() {
  var o = {}; CK.forEach(function (k) { o[k] = el(k).value; });
  o.first = el('first').checked; o.capOnly = el('capOnly').checked; o.banOwner = el('banOwner').checked;
  try { localStorage.setItem('td2_cfg', JSON.stringify(o)); } catch (e) { }
}
function loadCfg() {
  var o = null; try { o = JSON.parse(localStorage.getItem('td2_cfg') || 'null'); } catch (e) { }
  if (!o) return;
  CK.forEach(function (k) { if (o[k] != null && el(k)) el(k).value = o[k]; });
  if (o.first != null) el('first').checked = o.first;
  if (o.capOnly != null) el('capOnly').checked = o.capOnly;
  if (o.banOwner != null) el('banOwner').checked = o.banOwner;
}
function syncFirst() {
  var own = +el('own').value, cb = el('first');
  if (own > 0) { cb.checked = false; cb.disabled = true; } else cb.disabled = false;
}
function condSummary() {
  var c = CFG();
  el('condSum').innerHTML = '현금 <b>' + won(c.cash) + '</b> · ' + esc((BY[el('home').value] || {}).name || '') +
    ' · 전용 <b>' + c.area + '㎡</b> · ' + OWNL[c.own] +
    (c.first ? ' · 생애최초' : '') + (c.income ? ' · 소득 ' + won(c.income) : '') +
    ' · <b>' + radiusNote() + '</b>';
}
function initTheme() {
  var t = null; try { t = localStorage.getItem('td2_theme'); } catch (e) { }
  if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
}
function init() {
  initTheme();
  el('ver').textContent = VERSION;
  el('asof').textContent = '국토부 실거래 ' + ymL(KB.asof) + ' · 시군구 ' + NTOT + '곳';

  fillSel(el('home'), SGG, '41410');
  fillSel(el('from3'), SGG, '41410');
  fillSel(el('to3'), SGG, '41173');
  fillSel(el('base4'), SGG, '41173');
  fillSel(el('rg5'), allRegions(), '41173');
  fillSel(el('rg6'), allRegions(), '41173');
  fillSel(el('volReg'), allRegions(), '41173');
  fillSel(el('qdReg'), SGG, '41173');
  if (!el('home').value) el('home').selectedIndex = 0;

  /* 급지표 시도 세그먼트 */
  var sh = '<button data-v="전체" aria-pressed="true">전국 시군구</button>';
  SIDOS.forEach(function (s) { if (SGG.some(function (r) { return r.sido === s; })) sh += '<button data-v="' + s + '" aria-pressed="false">' + s + '</button>'; });
  sh += '<button data-v="시도" aria-pressed="false">시·도 단위 (18곳)</button>';
  el('sidoSeg').innerHTML = sh;
  el('sidoSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    SIDO2 = b.dataset.v;
    el('sidoSeg').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    render2();
  });
  el('areaSeg2').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    AREA2 = +b.dataset.v;
    el('areaSeg2').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    render2();
  });
  el('ltvSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    LTV_OVERRIDE = b.dataset.v;
    el('ltvSeg').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    render1();
  });
  /* 대장 시도 */
  var s6 = el('sido6');
  SIDOS.forEach(function (s) { if (SGG.some(function (r) { return r.sido === s; })) { var o = document.createElement('option'); o.value = s; o.textContent = s; s6.appendChild(o); } });
  s6.value = '경기';

  el('regnote').innerHTML = '<b>기본값 근거</b> — 2025.10.15 대책 이후 조정대상지역·투기과열지구·토지거래허가구역은 ' +
    '서울 25개 자치구 전역과 경기 12곳(과천, 광명, 성남 수정·중원·분당, 수원 장안·팔달·영통, 안양 동안, 용인 수지, 의왕, 하남)입니다. ' +
    '규제지역 일반 LTV 40%, 생애최초·수도권 70%(지방 80%), 수도권 주택구입 대출 총액 6억 상한, DSR 40%. ' +
    '취득세는 1주택 기준 6억 이하 1% / 6~9억 누진 / 9억 초과 3%에 지방교육세·농특세를 더해 계산합니다. ' +
    '<b>규정은 자주 바뀌니 실행 전 최신 고시와 은행 상담으로 확인하세요.</b>';

  (function () {
    var sel = el('mkReg'), g = {};
    KIR.forEach(function (r, i) { (g[r.sido] = g[r.sido] || []).push([i, r.name]); });
    ['집계', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '강원', '충북', '충남',
     '전북', '전남', '경북', '경남', '제주', '기타'].forEach(function (k) {
      if (!g[k]) return;
      var og = document.createElement('optgroup'); og.label = k === '집계' ? '전국·시도' : k;
      g[k].forEach(function (x) {
        var o = document.createElement('option'); o.value = x[0]; o.textContent = x[1];
        if (x[1] === '서울') o.selected = true;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
  })();
  el('mkReg').addEventListener('change', renderMarket);
  el('mkSpan').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    MK_SPAN = b.dataset.v;
    el('mkSpan').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    renderMarket();
  });
  el('imgMk').addEventListener('click', imgMk);
  el('imgMk2').addEventListener('click', imgMk2);
  document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.p); }); });
  el('navGroups').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    setGroup(b.dataset.g, true);
  });
  document.querySelectorAll('[data-jump]').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.jump); }); });

  el('theme').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var nx = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nx);
    try { localStorage.setItem('td2_theme', nx); } catch (e) { }
    if (chart4) timing();
    if (!el('pk').hidden) renderMarket();
    if (!el('pm').hidden) renderMap();
  });
  el('foldBtn').addEventListener('click', function () {
    var b = el('condBody'), on = b.hasAttribute('hidden');
    if (on) { b.removeAttribute('hidden'); el('foldBtn').textContent = '접기 ▲'; }
    else { b.setAttribute('hidden', ''); el('foldBtn').textContent = '펼치기 ▼'; }
    condSummary();
  });
  el('runBtn').addEventListener('click', function () {
    saveCfg(); condSummary();
    el('condBody').setAttribute('hidden', ''); el('foldBtn').textContent = '펼치기 ▼';
    show('pr');
  });
  el('radius').addEventListener('change', function () { saveCfg(); condSummary(); refresh(); });
  el('recOk').addEventListener('click', renderRec);
  el('recOk').addEventListener('change', renderRec);
  el('imgRec').addEventListener('click', imgRec);
  el('imgRecFull').addEventListener('click', imgRecFull);
  el('recApt').addEventListener('click', recTopApts);
  el('recAptOk').addEventListener('change', function () { if (el('recAptStat').textContent) recTopApts(); });
  el('recEntry').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    ENTRY = b.dataset.v;
    el('recEntry').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    renderRec();
  });
  el('recSort').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    RECSORT = b.dataset.v;
    el('recSort').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    renderRec();
  });
  fillSel(el('btA'), allRegions(), '41135');
  fillSel(el('btB'), allRegions(), '41173');
  el('btRun').addEventListener('click', runBT);
  el('btMode').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    BTMODE = b.dataset.v;
    el('btMode').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    el('btHint').innerHTML = BTMODE === 'ag'
      ? '<b>노후도 기준</b> &mdash; <b>검증 시작 시점</b>의 연차로 나눕니다(지금 연차가 아닙니다). 10년 미만 <b>신축</b>, 10~24년 <b>준구축</b>, 25년 이상 <b>구축</b>. K-apt에서 준공연도를 조회하므로 시간이 조금 더 걸립니다. <b>평형을 84㎡대로 고정</b>하고 돌려야 평형 효과와 섞이지 않습니다.'
      : BTMODE === 'sz'
      ? '<b>평형 기준</b> — <b>소형</b> 55㎡ 미만(14·18평), <b>중형</b> 55~95㎡(59·84), <b>대형</b> 95㎡ 이상. 위 평형 선택은 무시하고 전체 거래를 봅니다.'
      : BTMODE === 'hh'
      ? '<b>세대수 기준</b> — 300세대 미만을 <b>나홀로</b>, 1000세대 이상을 <b>대단지</b>로 나눕니다. K-apt에서 세대수를 조회하므로 시간이 조금 더 걸립니다.'
      : '<b>평당가 순위 기준</b> — 검증 시작 시점의 평당가로 줄 세워 상위 20%를 <b>대장</b>, 40~60%를 <b>중간</b>으로 나눕니다.';
    if (BT) runBT();
  });
  if (el('ladR')) el('ladR').addEventListener('input', ladder);
  el('imgBT').addEventListener('click', imgBT);
  el('own').addEventListener('change', function () {
    syncFirst();
    el('radius').value = (+el('own').value >= 1) ? 'auto' : 'off';
    saveCfg(); condSummary(); refresh();
  });
  ['cash', 'home', 'area', 'income', 'rate', 'first', 'capOnly',
    'ltvReg', 'ltvCap', 'ltvLoc', 'ltvFirst', 'ltvFirstLoc', 'capLoan', 'dsr', 'stress', 'etc']
    .forEach(function (id) { el(id).addEventListener('change', function () { saveCfg(); condSummary(); refresh(); }); });

  ['onlyOk1', 'regOnly1', 'sort1', 'ladAll'].forEach(function (id) { el(id).addEventListener('change', render1); });
  el('areaSeg1').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    AREA1 = +b.dataset.v;
    el('areaSeg1').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    render1();
  });
  el('dec1').addEventListener('change', render2);
  el('mapLabel').addEventListener('change', renderMap);
  KKEY = getKey();
  el('curDomain').textContent = location.origin;
  if (KKEY) el('kkey').value = KKEY;
  el('kkeySave').addEventListener('click', function () {
    var v = el('kkey').value.trim(); if (!v) return;
    try { localStorage.setItem('td2_kakao', v); } catch (e) { }
    KKEY = v; KREADY = false; KMAP = null; MAPMODE = 'real';
    el('mapMode').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.v === 'real'); });
    applyMapMode();
  });
  el('kkeyClear').addEventListener('click', function () {
    try { localStorage.removeItem('td2_kakao'); } catch (e) { }
    KKEY = DEFAULT_KKEY; KREADY = false; KMAP = null;
    el('kkey').value = ''; applyMapMode();
  });
  el('kkeyToggle').addEventListener('click', function () {
    var b = el('keybox'); b.hidden = !b.hidden;
  });
  el('mapMode').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    MAPMODE = b.dataset.v;
    el('mapMode').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    applyMapMode();
  });
  el('kback').addEventListener('click', function () { renderRealMap(); });
  el('mapAreaSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    MAP_AREA = +b.dataset.v;
    el('mapAreaSeg').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    applyMapMode();
  });
  el('mapKindSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    MAP_KIND = b.dataset.v;
    el('mapKindSeg').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    applyMapMode();
  });
  el('gapAreaSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    AREA_GAP = +b.dataset.v;
    el('gapAreaSeg').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    render3();
  });
  el('top6').addEventListener('change', function () { if (LAST6.length) run6(); });
  el('scope6').addEventListener('change', function () {
    var one = el('scope6').value === 'one';
    el('f_sido6').hidden = one; el('f_rg6').hidden = !one; el('f_lim6').hidden = one;
  });
  [0, 1, 2].forEach(function (i) {
    var d = slotIds(i);
    fillSel(el(d.reg), allRegions(), '41173');
    el(d.btn).addEventListener('click', function () { slotLoad(i); });
    el(d.apt).addEventListener('change', drawCmp);
  });
  el('imgCmp').addEventListener('click', imgCmp);
  el('imgPf').addEventListener('click', imgPf);
  el('imgReport').addEventListener('click', imgReport);
  var CSVFN = { img1: img1, img2: img2, img3: img3, img4: img4, img5: img5, img6: img6, img7: img7,
    imgMk: imgMk, imgMk2: imgMk2, imgVol: imgVol, imgQuad: imgQuad, imgSup: imgSup,
    imgCmp: imgCmp, imgPf: imgPf, imgReport: imgReport };
  document.querySelectorAll('[data-csv]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = CSVFN[b.dataset.csv];
      if (!f) return;
      CSVMODE = true;
      try { f(); } finally { CSVMODE = false; }
    });
  });
  el('volRun').addEventListener('click', runVol);
  el('imgVol').addEventListener('click', imgVol);
  el('volArea').addEventListener('change', function () { if (VOL) runVol(); });
  el('qSido').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    QSIDO = b.dataset.v;
    el('qSido').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    renderQuad();
  });
  el('qMo').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    QMO = +b.dataset.v;
    el('qMo').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    renderQuad();
  });
  el('qdRun').addEventListener('click', runQuadDong);
  (function () {
    if (!SUPOK) return;
    var order = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
                 '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
    var hh = '<option value="전국">전국</option>';
    order.forEach(function (s) { if (SUP.sido[s]) hh += '<option value="' + s + '">' + s + '</option>'; });
    el('supSel').innerHTML = hh;
    el('imgSup').addEventListener('click', imgSup);
    el('supSel').addEventListener('change', function () { SUP_SIDO = el('supSel').value; renderSup(); });
    el('supYears').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      SUP_YEARS = +b.dataset.v;
      el('supYears').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      renderSup();
    });
    el('supR').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      SUP_R = +b.dataset.v;
      el('supR').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      renderSup(); refresh();
    });
  })();
  el('imgQuad').addEventListener('click', imgQuad);
  ['pfRate', 'pfYears'].forEach(function (id) { el(id).addEventListener('change', renderFinal); el(id).addEventListener('input', renderFinal); });
  el('pfClear').addEventListener('click', function () { CART = []; cartSave(); renderFinal(); });
  cartLoad(); cartBadge();
  ['cap15', 'cap25', 'banOwner'].forEach(function (id) {
    el(id).addEventListener('change', function () { saveCfg(); refresh(); });
  });
  ['calcPrice', 'calcCash', 'calcReg', 'calcCap', 'calcOwn', 'calcFirst', 'calcArea']
    .forEach(function (id) { el(id).addEventListener('input', renderCalc); el(id).addEventListener('change', renderCalc); });
  el('mapView').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    MAPV = b.dataset.v;
    el('mapView').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    applyMapMode();
  });
  ['gapIncReg', 'gapJeonseOK', 'gapOnlyOk'].forEach(function (id) { el(id).addEventListener('change', render3); });
  ['from3', 'to3', 'yrs3'].forEach(function (id) { el(id).addEventListener('change', function () { timing(); targets(); }); });
  ['all3', 'reach3'].forEach(function (id) { el(id).addEventListener('change', targets); });
  ['base4', 'tol4', 'dir4'].forEach(function (id) { el(id).addEventListener('change', render5); });
  el('run6').addEventListener('click', run6);
  el('run5').addEventListener('click', run5);
  el('reset6').addEventListener('click', function () { try { localStorage.removeItem('td2_cfg'); } catch (e) { } location.reload(); });

  el('img1').addEventListener('click', img1); el('img2').addEventListener('click', img2);
  el('img3').addEventListener('click', img3); el('img4').addEventListener('click', img4);
  el('img5').addEventListener('click', img5); el('img6').addEventListener('click', img6);
  el('img7').addEventListener('click', img7);
  el('copy1').addEventListener('click', function () {
    copyTSV(['서열', '지역', '평당', '추정가', '규제', 'LTV', '대출', '필요현금', '가능'],
      LAST1.map(function (x, i) { return [i + 1, x.r.name, Math.round(last(x.r.s)), Math.round(x.price), x.r.reg ? '규제' : '비규제', x.nc.ltv, Math.round(x.nc.loan), Math.round(x.nc.need), x.ok ? 'O' : 'X']; }));
  });
  el('copy2').addEventListener('click', function () {
    copyTSV(['지역', '서열', '분위', '평당', '매매', '전세', '전세가율'],
      LAST2.map(function (r) { return [r.name, RANK[r.code], decile(r.code), Math.round(last(r.s)), Math.round(last(r.s) * AREA2), Math.round(last(r.j) * AREA2), (last(r.j) / last(r.s) * 100).toFixed(1)]; }));
  });
  el('copy3').addEventListener('click', function () {
    copyTSV(['지역', '매매', '전세', '순수갭', '총필요현금', '전세가율'],
      LAST3.map(function (x) { return [x.r.name, Math.round(x.p), Math.round(x.je), Math.round(x.g.gap), Math.round(x.g.need), x.jr.toFixed(1)]; }));
  });
  el('copy5').addEventListener('click', function () {
    copyTSV(['단지', '평형', '매매중위', '평당가', '세대수', '준공', '지하철', '전세', '갭', '거래'],
      LAST7.map(function (g) { return [g.apt, g.bucket, Math.round(g.med), Math.round(g.py), g.hh || '', g.byr || '', g.walk != null ? g.walk : '', g.jeon || '', g.jeon ? Math.round(g.med - g.jeon) : '', g.sale.length]; }));
  });
  el('home').addEventListener('change', function () { el('from3').value = el('home').value; });

  el('obSkip').addEventListener('click', function () { closeOb(true); });
  el('obClose').addEventListener('click', function () { closeOb(true); });
  el('obOpen').addEventListener('click', openOb);
  el('glOpen').addEventListener('click', openGloss);
  el('glClose').addEventListener('click', function () { el('glWrap').hidden = true; });
  el('glWrap').addEventListener('click', function (e) { if (e.target === el('glWrap')) el('glWrap').hidden = true; });
  document.querySelectorAll('[data-gloss]').forEach(function (b) { b.addEventListener('click', openGloss); });
  loadCfg(); syncFirst(); condSummary();
  var h = (location.hash || '').replace('#', '');
  show(h || 'pr');
  if (!obDone() && !h) setTimeout(openOb, 350);
}
window.tdShow = show;
window.tdCart = { add: cartAdd, list: function () { return CART; }, render: renderFinal };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();


/* ══ FAQ 아코디언 (v39.0) ══ */
(function () {
  var CARDS = [];
  function build() {
    var sec = document.getElementById('pi');
    if (!sec || sec.dataset.acc) return;
    var cards = [].slice.call(sec.querySelectorAll('.card.faq'));
    if (!cards.length) return;
    sec.dataset.acc = '1'; CARDS = cards;
    var nav = document.createElement('div');
    nav.className = 'card faqidx';
    nav.innerHTML = '<span class="eb">INDEX</span>' +
      '<h2>\uad81\uae08\ud55c \uac83\ubd80\ud130 \ubcf4\uc138\uc694</h2>' +
      '<p class="hint">\uc9c8\ubb38\uc744 \ub204\ub974\uba74 \uadfc\uac70\uac00 \ub41c \ub370\uc774\ud130\uc640 \ud45c\uac00 \uc544\ub798\uc5d0 \ud3bc\uccd0\uc9d1\ub2c8\ub2e4.</p>' +
      '<div class="faqnav"></div>';
    var list = nav.querySelector('.faqnav');
    cards.forEach(function (c, i) {
      var eb = c.querySelector('.eb'), h3 = c.querySelector('h3'), ans = c.querySelector('.ans');
      if (!h3) return;
      c.id = 'faqc' + (i + 1);
      var body = document.createElement('div'); body.className = 'faqbody'; body.id = c.id + 'b';
      var inner = document.createElement('div'); inner.className = 'faqinner';
      var start = ans || h3, n = start.nextSibling, mv = [];
      while (n) { mv.push(n); n = n.nextSibling; }
      mv.forEach(function (x) { inner.appendChild(x); });
      body.appendChild(inner); c.appendChild(body);
      var hd = document.createElement('button');
      hd.type = 'button'; hd.className = 'faqhd';
      hd.setAttribute('aria-expanded', 'false');
      hd.setAttribute('aria-controls', body.id);
      c.insertBefore(hd, c.firstChild);
      if (eb) hd.appendChild(eb);
      hd.appendChild(h3);
      if (ans) hd.appendChild(ans);
      var ch = document.createElement('span');
      ch.className = 'faqchev'; ch.setAttribute('aria-hidden', 'true'); ch.textContent = '+';
      hd.appendChild(ch);
      hd.addEventListener('click', function () { setState(i, !CARDS[i].classList.contains('on')); });
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'faqq'; b.dataset.i = i;
      var qn = document.createElement('span'); qn.className = 'qn'; qn.textContent = eb ? eb.textContent.trim() : 'Q' + (i + 1);
      var qt = document.createElement('span'); qt.className = 'qt'; qt.textContent = h3.textContent;
      b.appendChild(qn); b.appendChild(qt);
      b.addEventListener('click', function () {
        setState(i, true);
        setTimeout(function () { CARDS[i].scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
      });
      list.appendChild(b);
    });
    cards[0].parentNode.insertBefore(nav, cards[0]);
  }
  function setState(i, on) {
    var c = CARDS[i]; if (!c) return;
    c.classList.toggle('on', on);
    var hd = c.querySelector('.faqhd');
    if (hd) {
      hd.setAttribute('aria-expanded', on ? 'true' : 'false');
      var ch = hd.querySelector('.faqchev'); if (ch) ch.textContent = on ? '\u2212' : '+';
    }
    var q = document.querySelector('.faqq[data-i="' + i + '"]');
    if (q) q.classList.toggle('on', on);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();

