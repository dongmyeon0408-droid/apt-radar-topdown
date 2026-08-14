/* ══════════════════════════════════════════════════════════════
   월간 갱신  ·  tools/update.js
   최근 N개월만 다시 받아 raw-agg.json 을 갱신하고
   곧바로 market-data.js 를 새로 만듭니다.  보통 5~10분.
   실행:  node tools/update.js          (기본 최근 4개월)
          node tools/update.js 6        (최근 6개월)
   필요:  raw-agg.json · kb-data.js · 환경변수 MOLIT_API_KEY
   ══════════════════════════════════════════════════════════════ */
const fs=require('fs');
const KEY=process.env.MOLIT_API_KEY;
if(!KEY){console.error('환경변수 MOLIT_API_KEY 가 없습니다.');process.exit(1);}
const BACK=Math.max(2,Math.min(24,parseInt(process.argv[2]||'4',10)));

const BANDS=[[40,55],[55,70],[70,95],[95,135]];
const AREA_LO=40, AREA_HI=135, MIN_N=3, ROLL=5, FROM=200601;
const PY=3.3058;
const SD_CODE={'서울':'S11','부산':'S26','대구':'S27','인천':'S28','광주':'S29','대전':'S30',
  '울산':'S31','세종':'S36','경기':'S41','강원':'S51','충북':'S43','충남':'S44',
  '전북':'S52','전남':'S46','경북':'S47','경남':'S48','제주':'S50'};
const CAP_SD=['서울','경기','인천'];

const KBSRC=fs.readFileSync('kb-data.js','utf8');
const KB=JSON.parse(KBSRC.slice(KBSRC.indexOf('=')+1).trim().replace(/;$/,''));
const REG=KB.regions.filter(r=>r.k==='sgg');
let AGG=fs.existsSync('raw-agg.json')?JSON.parse(fs.readFileSync('raw-agg.json','utf8')):null;
if(!AGG){console.error('raw-agg.json 이 없습니다. 먼저 node tools/make-agg.js 를 실행하세요.');process.exit(1);}

const num=v=>{const n=parseFloat(String(v==null?'':v).replace(/[,\s]/g,''));return isFinite(n)?n:NaN;};
const med=a=>{if(!a.length)return null;const s=a.slice().sort((x,y)=>x-y),m=s.length>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const pick=(o,k)=>{for(const x of k) if(o[x]!=null&&o[x]!=='')return o[x];return null;};
const bandOf=a=>{for(let i=0;i<BANDS.length;i++) if(a>=BANDS[i][0]&&a<BANDS[i][1])return i;return -1;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ── 받을 달 목록: 최근 BACK개월 (신고 지연 때문에 다시 받는다) ── */
const now=new Date();
const MONTHS=[];
for(let k=BACK-1;k>=0;k--){
  const d=new Date(now.getFullYear(),now.getMonth()-k,1);
  MONTHS.push(d.getFullYear()*100+(d.getMonth()+1));
}
console.log(`갱신 대상: ${MONTHS[0]} ~ ${MONTHS[MONTHS.length-1]} (${MONTHS.length}개월) · 지역 ${REG.length}곳\n`);

const URLS={ trade:'https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
             rent :'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent' };
async function fetchMonth(url,code,ym){
  let all=[],page=1;
  while(true){
    const u=`${url}?serviceKey=${encodeURIComponent(KEY)}&LAWD_CD=${code}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=1000&_type=json`;
    let got=null;
    for(let t=0;t<4;t++){
      try{
        const res=await fetch(u,{headers:{Accept:'application/json'}});
        const txt=await res.text();
        if(txt.trim().startsWith('<')) throw new Error('XML 응답(키 확인)');
        const j=JSON.parse(txt);
        const b=j.response&&j.response.body; if(!b) throw new Error('body 없음');
        let items=(b.items&&b.items.item)||[]; if(!Array.isArray(items))items=[items];
        got={items,total:+b.totalCount||0}; break;
      }catch(e){ if(t===3) throw e; await sleep(1000*(t+1)); }
    }
    all=all.concat(got.items);
    if(all.length>=got.total||got.items.length===0)break;
    page++; await sleep(120);
  }
  return all;
}
function digest(items,isRent){
  const acc=[[],[],[],[]];
  for(const it of items){
    const ar=num(pick(it,['excluUseAr','전용면적'])), bi=bandOf(ar); if(bi<0)continue;
    let psm;
    if(isRent){
      const dep=num(pick(it,['deposit','보증금액'])), mo=num(pick(it,['monthlyRent','월세금액']));
      if(!isFinite(dep)||(isFinite(mo)&&mo>0))continue; psm=dep/ar;
    }else{
      if(String(pick(it,['cdealType','해제여부'])||'').trim()==='O')continue;
      const amt=num(pick(it,['dealAmount','거래금액'])); if(!isFinite(amt))continue; psm=amt/ar;
    }
    acc[bi].push(psm);
  }
  return { v:acc.map(a=>a.length?Math.round(med(a)):0), n:acc.map(a=>a.length) };
}
(async()=>{
  let calls=0, changed=0;
  for(let ri=0;ri<REG.length;ri++){
    const r=REG[ri];
    for(const ym of MONTHS){
      try{
        const t=await fetchMonth(URLS.trade,r.c,ym); calls++;
        const rt=await fetchMonth(URLS.rent ,r.c,ym); calls++;
        AGG[r.c]=AGG[r.c]||{}; AGG[r.c][ym]=AGG[r.c][ym]||{};
        const dt=digest(t,false), dr=digest(rt,true);
        AGG[r.c][ym].t=dt.v; AGG[r.c][ym].tn=dt.n;
        AGG[r.c][ym].r=dr.v; AGG[r.c][ym].rn=dr.n;
        if(dt.n.reduce((a,b)=>a+b,0)) changed++;
      }catch(e){ console.log(`  !! ${r.n} ${ym}: ${e.message}`); }
      await sleep(100);
    }
    if((ri+1)%25===0)console.log(`  ... ${ri+1}/${REG.length}곳 (호출 ${calls})`);
  }
  fs.writeFileSync('raw-agg.json',JSON.stringify(AGG));
  console.log(`\n수집 완료 — 호출 ${calls}회 · 거래가 있던 지역·월 ${changed}건`);

  /* ── market-data.js 생성 ── */
  const last=new Date(now.getFullYear(),now.getMonth()-1,1);
  const LAST=last.getFullYear()*100+(last.getMonth()+1);
  const ALLM=[];
  for(let y=Math.floor(FROM/100);y<=Math.floor(LAST/100);y++)
    for(let m=1;m<=12;m++){const v=y*100+m; if(v>=FROM&&v<=LAST)ALLM.push(v);}
  const MI={}; ALLM.forEach((m,i)=>MI[m]=i);

  function series(code,key,keyN){
    const A=AGG[code]||{};
    const cnt=[0,0,0,0];
    ALLM.forEach(m=>{ const o=A[m]; if(o&&o[keyN]) o[keyN].forEach((c,i)=>cnt[i]+=c); });
    const tot=cnt.reduce((a,b)=>a+b,0);
    if(tot<200) return ALLM.map(()=>null);
    const W=cnt.map(c=>c/tot);
    const band=[0,1,2,3].map(bi=>{
      const raw=ALLM.map(m=>{const o=A[m]; return (o&&o[keyN]&&o[keyN][bi]>=MIN_N&&o[key][bi])?o[key][bi]:null;});
      return smooth(raw);
    });
    const out=ALLM.map((_,t)=>{
      let s=0,w=0;
      for(let i=0;i<4;i++) if(band[i][t]!=null){ s+=W[i]*band[i][t]; w+=W[i]; }
      return w<0.35?null:s/w;
    });
    return smooth(out);
  }
  function smooth(arr){
    const out=arr.slice();
    for(let i=0;i<arr.length;i++){
      const w=[]; for(let k=i-(ROLL-1);k<=i;k++) if(k>=0&&arr[k]!=null) w.push(arr[k]);
      out[i]=w.length?med(w):null;
    }
    for(let i=0;i<out.length;i++){
      if(out[i]!=null)continue;
      let a=i-1; while(a>=0&&out[a]==null)a--;
      let c=i+1; while(c<out.length&&out[c]==null)c++;
      if(a>=0&&c<out.length&&c-a<=5) out[i]=out[a]+(out[c]-out[a])*(i-a)/(c-a);
    }
    return out;
  }
  const regions=[], missing=[];
  for(const r of REG){
    const s=series(r.c,'t','tn'), j=series(r.c,'r','rn');
    if(!s.filter(v=>v!=null).length){ missing.push(r.n); continue; }
    regions.push({c:r.c,n:r.n,sd:r.sd,k:'sgg',reg:r.reg,cap:r.cap,
      s:s.map(v=>v==null?'':Math.round(v)).join(','),
      j:j.map(v=>v==null?'':Math.round(v)).join(',')});
  }
  function agg(code,name,sido,f){
    const sub=regions.filter(f);
    const p=key=>ALLM.map((_,i)=>{
      const v=sub.map(x=>{const q=x[key].split(',')[i]; return q===''?null:+q;}).filter(q=>q!=null);
      return v.length?Math.round(med(v)):'';
    }).join(',');
    return {c:code,n:name,sd:sido,k:'agg',reg:0,cap:0,s:p('s'),j:p('j')};
  }
  const aggs=[agg('ALL','전국','전국',()=>true)];
  [...new Set(regions.map(r=>r.sd))].forEach(sd=>{
    const code=SD_CODE[sd]||'SD'+sd, nm=SD_CODE[sd]?sd+' 전체':sd;
    aggs.push(agg(code,nm,sd,r=>r.sd===sd));
  });
  aggs.push(agg('CAP','수도권','수도권',r=>CAP_SD.indexOf(r.sd)>=0));
  const ALLR=aggs.concat(regions);
  const out={asof:ALLM[ALLM.length-1],dates:ALLM,regions:ALLR};

  /* 연도별 지수 (전국 최신 = 100) */
  const YEARS=[...new Set(ALLM.map(m=>Math.floor(m/100)))];
  const yearly=csv=>{const v=csv.split(','); return YEARS.map(y=>{
    let last2=null; for(let m=1;m<=12;m++){const i=MI[y*100+m]; if(i!=null&&v[i]!=='')last2=+v[i];} return last2;});};
  const NAT=ALLR.find(r=>r.c==='ALL');
  const natY=NAT?yearly(NAT.s):null;
  const BASE0=(natY&&[...natY].reverse().find(v=>v!=null))||1;
  const kbiRegions=ALLR.map(r=>{
    const ys=yearly(r.s), yj=yearly(r.j);
    const norm=a=>a.map(v=>v==null?'':(v/BASE0*100).toFixed(1));
    const sd=r.k==='agg'?'집계':(SD_CODE[r.sd]?r.sd+' 전체':r.sd);
    return {n:r.n,sd:sd,k:r.k,s:norm(ys).join(','),j:norm(yj).join(',')};
  });
  const kbi={years:YEARS,dates:ALLM,regions:kbiRegions,
    base:'전국 '+YEARS[YEARS.length-1]+'년 = 100 (국토부 실거래 집계)',monthly:{}};
  fs.writeFileSync('market-data.js','window.KB = '+JSON.stringify(out)+';\nwindow.KBI = '+JSON.stringify(kbi)+';\n');
  console.log(`\nmarket-data.js 생성 — ${ALLM[0]}~${ALLM[ALLM.length-1]} · 시군구 ${regions.length}곳 · ${(fs.statSync('market-data.js').size/1024).toFixed(0)} KB`);
  if(missing.length) console.log('  자료 없어 빠진 곳: '+missing.join(', '));
  console.log('\n이제 market-data.js 와 raw-agg.json 을 GitHub 에 올리면 끝입니다.');
})();
