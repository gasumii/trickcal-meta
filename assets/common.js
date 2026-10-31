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
/* 사도 정보(성격·위치·역할·공격 타입·이미지) */
const PER_LIST=["순수","냉정","광기","활발","우울","공명"];
let SADO_INFO={};
async function loadSadoInfo(){try{(await load("data/battle/sado_info.csv")).forEach(x=>SADO_INFO[x["사도"]]=x);}catch(_){}}
const perVar=p=>PER_LIST.includes(p)?`var(--${p})`:"var(--미분류)";
function face(n,size,per){
  const i=SADO_INFO[n]||{},p=per||i["성격"]||"",ch=(n||"?").replace(/\(.*\)/,"").trim().slice(0,1);
  return `<span class="face" style="--pc:${perVar(p)};--fs:${size||36}px" aria-hidden="true">${i["이미지"]?`<img src="assets/sado/${encodeURIComponent(i["이미지"])}" alt="" loading="lazy">`:`<b>${esc(ch)}</b>`}</span>`;
}

/* skills.csv 한 줄 → 계산용 데이터 */
function toCalcRow(r){const x=r["계산용 수치(%)"],v=r["생존 계산용 수치(%)"];return {n:r["사도"],p:r["성격"],loc:r["위치"]||"",g:r["효과 유형"],c:r["피해 분류"]||null,x:x===""?null:+x,sv:(v===""||v==null)?null:+v,a:+(r["어사이드 단계"]||0),h:+(r["고학년 의존"]||0),t:r["대상"],cond:r["발동 조건"]||"",pc:r["성격 조건"]||null,pos:r["대상 배치 조건"]||null,role:r["대상 역할 조건"]||null,atype:r["공격 타입 조건"]||null,val:r["수치"]||"",dur:r["지속"]||"",kind:r["스킬 구분"]||""};}
const CATS=["공격력 증가","주는 피해 증가","받는 피해 증가","스킬 피해 증가","치명타 피해 증가","방어력 감소","치명 피해 저항 감소","일반 공격 피해 증가","받는 스킬 피해 증가","받는 고학년 스킬 피해 증가"];
const BASIC=["순수","냉정","광기","활발","우울"];
const SYN_ON=["대충돌","대충돌 2.0 beta"];
function matchup(p,en){if(!en||en==="무속성"||en==="성격 없음")return"중립";const A={"광기":"순수","순수":"냉정","냉정":"광기","활발":"우울","우울":"활발"};if(A[p]===en)return"유리";if(A[en]===p&&!(p==="활발"||p==="우울"))return"불리";return"중립";}
function synBonus(n){const t=[[10,230],[9,200],[7,140],[6,100],[4,55],[2,20]];for(const[k,v]of t)if(n>=k)return v;return 0;}
/* 받는 사도 조건: 성격(냉정·활발·광기·같은 성격) / 열(전열·중열·후열 — 편성 칸 기준) / 역할 / 공격 타입 */
function condOK(d,s,uroP){
  if(d.pc){if(d.pc==="같은 성격"){if(!(uroP&&s.per===uroP))return false;}else if(s.per!==d.pc)return false;}
  if(d.pos&&!d.pos.includes(s.row||""))return false;
  const i=SADO_INFO[s.name]||{};
  if(d.role&&i["역할"]&&!d.role.includes(i["역할"]))return false;
  if(d.atype&&i["공격 타입"]&&!d.atype.includes(i["공격 타입"]))return false;
  return true;
}
const hasCond=d=>!!(d.pc||d.pos||d.role||d.atype);
function prep(DATA,slots,extra){
  const used=slots.filter(s=>s.name);
  const baseP=n=>{const r=DATA.find(d=>d.n===n);return r?r.p:"";};
  used.forEach(s=>{const b=baseP(s.name);s.per=b==="공명"?(s.choose||"공명(미선택)"):b;if(extra&&extra.enemy!==undefined)s.match=matchup(s.per,extra.enemy);
    if(!s.row){const l=(SADO_INFO[s.name]||{})["위치"]||(DATA.find(d=>d.n===s.name)||{}).loc;s.row=l;}});
  const uro=used.find(s=>s.name==="우로스");
  return {used,uroP:uro?uro.per:null};
}
const rowsOfSlot=(DATA,s)=>DATA.filter(d=>d.n===s.name&&d.a<=(+s.aside||0)&&(s.hi||d.h===0));
function calc(DATA,slots,content,extra){
  extra=extra||{};
  const {used,uroP}=prep(DATA,slots,extra);
  const counts={};BASIC.forEach(p=>counts[p]=used.filter(s=>s.per===p).length+(extra[p]||0));
  const synTotal=BASIC.reduce((a,p)=>a+synBonus(counts[p]),0);
  const synOn=SYN_ON.includes(content);const syn=synOn?synTotal:0;
  const team={},condRows=[];CATS.forEach(c=>team[c]=0);
  used.forEach(s=>rowsOfSlot(DATA,s).forEach(d=>{
    if(d.x==null||!d.c||!(d.c in team))return;
    if(d.t&&(d.t.startsWith("아군")||d.t.startsWith("적"))){
      if(hasCond(d)){condRows.push(d);return;}
      team[d.c]+=d.x;
    }}));
  const res=used.map(s=>{
    const self={},cond={};CATS.forEach(c=>{self[c]=0;cond[c]=0;});
    rowsOfSlot(DATA,s).forEach(d=>{if(d.t==="자신"&&d.x!=null&&(d.c in self)){self[d.c]+=d.x;}});
    condRows.forEach(d=>{if(condOK(d,s,uroP))cond[d.c]+=d.x;});
    const sum=c=>team[c]+self[c]+cond[c];
    /* 공격력 증가: 유저 실측 계산법 기준 합산 */
    const pre=(+s.atk||0)*(1+sum("공격력 증가")/100);
    return {s,self,cond,sum,pcGive:cond["주는 피해 증가"],pcTake:cond["받는 피해 증가"],pre};
  });
  const grant=used.some(s=>s.name==="우로스")?0.35*Math.max(0,...res.map(r=>r.pre)):0;
  const def=extra.def&&extra.def.on?extra.def:null;
  res.forEach(r=>{
    r.buffed=r.pre+grant;
    r.eff=def?Math.max(0.05*r.buffed,0.8*r.buffed-(+def.t||0)*Math.max(0,(+def.D||0)-team["방어력 감소"])/5):r.buffed;
    const give=r.sum("주는 피해 증가")+syn,take=r.sum("받는 피해 증가");
    r.pool=1+(give+take)/100;
    r.E=r.s.match==="유리"?1.5:r.s.match==="불리"?0.75:1;
    r.deal=r.eff*(r.pool+r.sum("일반 공격 피해 증가")/100)*r.E;
    r.skill=r.eff*(r.pool+(r.sum("받는 스킬 피해 증가")+r.sum("받는 고학년 스킬 피해 증가"))/100)*r.E*(1+r.sum("스킬 피해 증가")/100);
  });
  return {res,team,teamAtk:1+team["공격력 증가"]/100,counts,synTotal,syn,synOn,grant,uroP,def:!!def};
}
/* 보호막: 누가 누구에게 최대 HP의 몇 %를 주는가 (보호막 %는 받는 사도의 최대 HP 기준 — 가정)
   - 처치 시·전투불능 시처럼 특정 사건에만 생기는 보호막은 합계에서 빼고 '조건부'로 따로 표시
   - 'HP 비율이 가장 낮은 아군' 같은 단일 대상은 누가 받을지 몰라 주는 사람 쪽에 '1명'으로만 표시 */
const SH_TRIGGER=/처치|전투불능|보호 발동/;
function shieldPct(d){if(d.sv!=null)return d.sv;const m=(d.val||"").match(/HP의\s*([\d.]+)%/);return m?+m[1]:null;}
function shieldMap(DATA,slots,opt){
  opt=opt||{};
  const {used,uroP}=prep(DATA,slots,{});
  const out=new Map(used.map(s=>[s,{recv:[],give:[],single:[],trig:[]}]));
  used.forEach(from=>rowsOfSlot(DATA,from).forEach(d=>{
    if(d.g!=="보호막"||!d.t||!(d.t==="자신"||d.t.startsWith("아군")))return;
    if(opt.always&&!d.cond.startsWith("상시"))return;
    const pct=shieldPct(d);if(pct==null)return;
    const src={from:from.name,kind:d.kind,pct,dur:d.dur,cond:d.cond};
    if(SH_TRIGGER.test(d.cond)){out.get(from).trig.push(src);return;}
    if(d.t==="아군 단일"||/가장 낮은|가장 높은/.test(d.cond)){out.get(from).single.push(src);return;}
    let tos;
    if(d.t==="자신")tos=[from];
    else{tos=used.filter(s=>{
      if(/자신(을)? 제외/.test(d.cond)&&s===from)return false;
      if(/같은 열/.test(d.cond)&&s.row!==from.row)return false;
      return !hasCond(d)||condOK(d,s,uroP);});}
    tos.forEach(to=>{out.get(to).recv.push(src);out.get(from).give.push({...src,to:to.name});});
  }));
  return {used,out};
}
/* 생존 계산 (엑셀 덱_계산기 49행~과 같은 규칙, 간이판)
   유효 HP = (버프 후 최대 HP + 보호막) ÷ (1 − 적용 피해 감소) ÷ (1 − 공격력 감소)
   적용 피해 감소 = MIN(75, 아군 받는 피해 감소 + 적 주는 피해 감소 (+스킬 피해 감소: 적 공격이 스킬일 때) − 적 피해 증가) */
function survive(DATA,slots,content,opt){
  opt=opt||{};
  const {used,uroP}=prep(DATA,slots,{});
  const counts={};BASIC.forEach(p=>counts[p]=used.filter(s=>s.per===p).length);
  const synHP=SYN_ON.includes(content)?BASIC.reduce((a,p)=>a+synBonus(counts[p]),0):0;
  const src=[];used.forEach(s=>rowsOfSlot(DATA,s).forEach(d=>{if(d.sv==null)return;if(opt.always&&!d.cond.startsWith("상시"))return;src.push({d,from:s});}));
  const SM=shieldMap(DATA,slots,opt);
  return used.map((s,ui)=>{
    let hp=synHP,sh=SM.out.get(SM.used[ui]).recv.reduce((a,x)=>a+x.pct,0),dr=0,ad=0;
    src.forEach(({d,from})=>{
      const toSelf=d.t==="자신"?from===s:false;
      const ally=d.t&&d.t.startsWith("아군")?(!hasCond(d)||condOK(d,s,uroP)):false;
      const enemy=d.t&&d.t.startsWith("적");
      if(d.g==="최대 HP 증가"&&(toSelf||ally))hp+=d.sv;
      else if(d.g==="받는 피해 감소"&&(toSelf||ally))dr+=d.sv;
      else if(d.g==="주는 피해 감소"&&enemy)dr+=d.sv;
      else if(d.g==="스킬 피해 감소"&&(enemy||toSelf||ally)&&opt.enemySkill)dr+=d.sv;
      else if(d.g==="공격력 감소"&&enemy)ad+=d.sv;
    });
    const HP=+s.hp||0,bHP=HP*(1+hp/100),shield=bHP*sh/100,applied=Math.min(75,dr-(+opt.enemyInc||0)),atkDown=Math.min(90,ad);
    const eff=HP?(bHP+shield)/(1-applied/100)/(1-atkDown/100):0;
    return {s,hp,bHP,sh,shield,dr,applied,atkDown,eff};
  });
}
