/* 공통: CSV 읽기, 유틸, 덱 계산 규칙 */
function parseCSV(text){
  text=text.replace(/^\uFEFF/,"");
  const rows=[];let row=[],f="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c;}
    else if(c==='"')q=true;
    else if(c===','){row.push(f);f="";}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f="";}
    else f+=c;}
  if(f!==""||row.length){row.push(f);rows.push(row);}
  const head=(rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r=>r.some(v=>v.trim()!=="")).map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]||"").trim()])));
}
async function load(path){
  const res=await fetch(path,{cache:"no-store"});
  if(!res.ok)throw new Error(path+" 파일을 찾을 수 없습니다 ("+res.status+")");
  return parseCSV(await res.text());
}
const $=id=>document.getElementById(id);
const esc=s=>(s==null?"":String(s)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.round(n).toLocaleString("ko-KR");
function showError(e){const el=$("error");if(!el)return;el.hidden=false;
  el.innerHTML=esc(e.message)+"<br>파일을 더블클릭해서 열면 브라우저 보안 정책 때문에 데이터가 보이지 않습니다. GitHub Pages 주소로 확인하세요.";}
/* skills.csv 한 줄 → 계산용 데이터 */
function toCalcRow(r){const x=r["계산용 수치(%)"];return {n:r["사도"],p:r["성격"],c:r["피해 분류"]||null,x:x===""?null:+x,a:+(r["어사이드 단계"]||0),h:+(r["고학년 의존"]||0),t:r["대상"],pc:r["성격 조건"]||null};}
const CATS=["공격력 증가","주는 피해 증가","받는 피해 증가","스킬 피해 증가","치명타 피해 증가","방어력 감소","치명 피해 저항 감소"];
const BASIC=["순수","냉정","광기","활발","우울"];
const SYN_ON=["대충돌","대충돌 2.0 beta"];
function matchup(p,en){if(!en||en==="무속성"||en==="성격 없음")return"중립";const A={"광기":"순수","순수":"냉정","냉정":"광기","활발":"우울","우울":"활발"};if(A[p]===en)return"유리";if(A[en]===p&&!(p==="활발"||p==="우울"))return"불리";return"중립";}
function synBonus(n){const t=[[10,230],[9,200],[7,140],[6,100],[4,55],[2,20]];for(const[k,v]of t)if(n>=k)return v;return 0;}
function calc(DATA,slots,content,extra){
  extra=extra||{};
  const used=slots.filter(s=>s.name);
  const baseP=n=>{const r=DATA.find(d=>d.n===n);return r?r.p:"";};
  used.forEach(s=>{const b=baseP(s.name);s.per=b==="공명"?(s.choose||"공명(미선택)"):b;if(extra.enemy!==undefined)s.match=matchup(s.per,extra.enemy);});
  const uro=used.find(s=>s.name==="우로스");const uroP=uro?uro.per:null;
  const counts={};BASIC.forEach(p=>counts[p]=used.filter(s=>s.per===p).length+(extra[p]||0));
  const synTotal=BASIC.reduce((a,p)=>a+synBonus(counts[p]),0);
  const synOn=SYN_ON.includes(content);const syn=synOn?synTotal:0;
  const rowsOf=s=>DATA.filter(d=>d.n===s.name&&d.x!=null&&d.c&&d.a<=(+s.aside||0)&&(s.hi||d.h===0));
  const team={},pcRows=[];CATS.forEach(c=>team[c]=0);
  used.forEach(s=>rowsOf(s).forEach(d=>{
    if(d.t&&(d.t.startsWith("아군")||d.t.startsWith("적"))){
      if(d.pc){pcRows.push(d);return;}
      team[d.c]+=d.x;
    }}));
  const res=used.map(s=>{
    const self={};CATS.forEach(c=>self[c]=0);
    rowsOf(s).forEach(d=>{if(d.t==="자신"){self[d.c]+=d.x;}});
    let pcGive=0,pcTake=0;
    pcRows.forEach(d=>{const ok=d.pc==="냉정"?s.per==="냉정":(d.pc==="같은 성격"&&uroP&&s.per===uroP);
      if(ok){if(d.c==="주는 피해 증가")pcGive+=d.x;if(d.c==="받는 피해 증가")pcTake+=d.x;}});
    /* 공격력 증가: 유저 실측 계산법 기준 합산 */
    const pre=(+s.atk||0)*(1+(team["공격력 증가"]+self["공격력 증가"])/100);
    return {s,self,pcGive,pcTake,pre};
  });
  const grant=uro?0.35*Math.max(0,...res.map(r=>r.pre)):0;
  res.forEach(r=>{
    r.buffed=r.pre+grant;
    const give=team["주는 피해 증가"]+r.self["주는 피해 증가"]+r.pcGive+syn;
    const take=team["받는 피해 증가"]+r.pcTake;
    r.pool=1+(give+take)/100;
    r.E=r.s.match==="유리"?1.5:r.s.match==="불리"?0.75:1;
    r.deal=r.buffed*r.pool*r.E;
    r.skill=r.deal*(1+(team["스킬 피해 증가"]+r.self["스킬 피해 증가"])/100);
  });
  return {res,team,teamAtk:1+team["공격력 증가"]/100,counts,synTotal,syn,synOn,grant,uroP};
}

