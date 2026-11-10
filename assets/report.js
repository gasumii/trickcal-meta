/* ===== 설정 ===== */
/* 페이지별 설정: global.html은 window.REPORT_CFG로 데이터 폴더·비교 대상·순위 구간을 바꿈 */
const CFG=Object.assign({
  root:"data/",            // seasons.csv와 seasons/<시즌ID>/ 가 있는 폴더
  compare:"prev",          // "prev" = 같은 서버 이전 시즌, "kr" = 한국 서버 같은 콘텐츠 최신 시즌
  attrFallback:false,      // true면 sado.csv에 없는 사도의 성격을 전투 메커니즘 DB(sado_info.csv)에서 가져옴
  bands:[[1,50],[51,150],[151,300]],
  brand:"PvE 덱 리포트", brandHref:"./"
},window.REPORT_CFG||{});
const TIERS = [                      // 채용률 이상이면 해당 티어
  { name:"필수",  min:0.90, color:"#1F2A44" },
  { name:"1티어", min:0.60, color:"#3B4F7A" },
  { name:"2티어", min:0.30, color:"#5F7299" },
  { name:"3티어", min:0.10, color:"#717E98" },
  { name:"채용 10% 미만", min:0,   color:"#7A818D" },
];
const BANDS = CFG.bands;
const ATTRS = ["광기","순수","냉정","활발","우울","공명"];

/* ===== CSV ===== */
function parseCSV(text){
  text = text.replace(/^\uFEFF/,"");
  const rows=[]; let row=[], f="", q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){ if(c==='"'){ if(text[i+1]==='"'){f+='"';i++} else q=false } else f+=c; }
    else if(c==='"') q=true;
    else if(c===','){ row.push(f); f=""; }
    else if(c==='\n'||c==='\r'){ if(c==='\r'&&text[i+1]==='\n') i++; row.push(f); rows.push(row); row=[]; f=""; }
    else f+=c;
  }
  if(f!==""||row.length){ row.push(f); rows.push(row); }
  const head=(rows.shift()||[]).map(h=>h.trim());
  return rows.filter(r=>r.some(v=>v.trim()!=="")).map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]||"").trim()])));
}
async function load(path){
  const res = await fetch(path,{cache:"no-store"});
  if(!res.ok) throw new Error(path+" 파일을 찾을 수 없습니다 ("+res.status+")");
  return parseCSV(await res.text());
}

/* ===== 유틸 ===== */
const $=id=>document.getElementById(id);
const pct=(v,d=0)=>(v*100).toFixed(d)+"%";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const numB=s=>esc(s).replace(/(\d+(?:[.,]\d+)?(?:~\d+(?:[.,]\d+)?)?(?:%p|%|초|덱|위|명|배)?)/g,(m,x)=>/[%초덱위명배p]$/.test(x)||x.includes("~")?`<b>${x}</b>`:x); // 수치만 굵게
let ATTR={};
const col=n=>`var(--${ATTRS.includes(ATTR[n])?ATTR[n]:"미분류"})`;
const chip=(n,extra="",cls="")=>`<span class="chip ${cls}" style="--c:${col(n)}">${esc(n)}${extra}</span>`;
const tierOf=r=>TIERS.find(t=>r>=t.min);
/* 도넛: [[값, 색], …] → conic-gradient 배경 */
const conic=parts=>{ const tot=parts.reduce((s,p)=>s+p[0],0)||1; let acc=0;
  return "conic-gradient("+parts.map(([v,c])=>{ const a=acc/tot*100; acc+=v; return `${c} ${a.toFixed(2)}% ${(acc/tot*100).toFixed(2)}%`; }).join(",")+")"; };

async function main(){
  let decksRaw, sado, info, seasons=[], cur=null, prev=null, prevRaw=null, seasonNotes=[], seasonAnalysis=[], seasonLevels=[];
  try{
    try{ seasons=(await load(CFG.root+"seasons.csv")).filter(r=>r["시즌ID"]); }catch(_){ seasons=[]; }
    if(seasons.length){
      const want=new URLSearchParams(location.search).get("s");
      const idx=Math.max(0,seasons.findIndex(r=>r["시즌ID"]===want));
      cur=want&&seasons[idx]["시즌ID"]===want?seasons[idx]:seasons[seasons.length-1];
      const ci=seasons.indexOf(cur);
      let prevRoot=CFG.root;
      if(CFG.compare==="kr"){
        let kr=[]; try{ kr=(await load("data/seasons.csv")).filter(r=>r["시즌ID"]); }catch(_){}
        prev=[...kr].reverse().find(r=>r["콘텐츠"]===cur["콘텐츠"])||null; prevRoot="data/";
      }else prev=[...seasons.slice(0,ci)].reverse().find(r=>r["콘텐츠"]===cur["콘텐츠"])||null;
      const base=CFG.root+"seasons/"+cur["시즌ID"]+"/";
      [decksRaw, sado, info] = await Promise.all([load(base+"decks.csv"),load("data/sado.csv"),load(base+"info.csv")]);
      if(prev){ try{ prevRaw=await load(prevRoot+"seasons/"+prev["시즌ID"]+"/decks.csv"); }catch(_){ prevRaw=null; } }
      try{ seasonNotes=(await load(base+"notes.csv")).filter(r=>r["사도명"]&&r["평가"]); }catch(_){ seasonNotes=[]; }
      try{ seasonAnalysis=(await load(base+"analysis.csv")).filter(r=>r["제목"]&&r["내용"]); }catch(_){ seasonAnalysis=[]; }
      try{ seasonLevels=(await load(base+"levels.csv")).filter(r=>r["순위"]); }catch(_){ seasonLevels=[]; }
      let contents=[];
      try{ contents=(await load("data/contents.csv")).map(r=>r["콘텐츠"]).filter(Boolean); }catch(_){}
      seasons.forEach(r=>{ if(r["콘텐츠"]&&!contents.includes(r["콘텐츠"])) contents.push(r["콘텐츠"]); });
      const nav=$("gnb"); nav.hidden=false;
      $("gnbIn").innerHTML=`<a class="brand" href="${CFG.brandHref}">${esc(CFG.brand)}</a>`+contents.map(c=>{
        const list=seasons.filter(r=>r["콘텐츠"]===c).slice().reverse();
        const items=list.length?list.map(r=>`<li><a href="?s=${encodeURIComponent(r["시즌ID"])}"${r===cur?' aria-current="page"':''}>${esc(r["표시이름"]||r["시즌ID"])}${r["조사일"]?`<small>조사일 ${esc(r["조사일"])}</small>`:""}</a></li>`).join("")
          :`<li class="empty">아직 기록이 없습니다. 시즌이 끝나면 추가합니다</li>`;
        return `<details${c===cur["콘텐츠"]?' class="cur"':''}><summary>${esc(c)}</summary><ul class="menu">${items}</ul></details>`;
      }).join("");
      const dets=[...nav.querySelectorAll("details")];
      dets.forEach(d=>d.addEventListener("toggle",()=>{ if(d.open) dets.forEach(o=>{ if(o!==d) o.open=false; }); }));
      document.addEventListener("click",e=>{ if(!nav.contains(e.target)) dets.forEach(d=>d.open=false); });
      document.addEventListener("keydown",e=>{ if(e.key==="Escape") dets.forEach(d=>d.open=false); });
    }else{
      [decksRaw, sado, info] = await Promise.all([load("data/decks.csv"),load("data/sado.csv"),load("data/info.csv")]);
    }
  }catch(e){
    $("summary").textContent="데이터를 불러오지 못했습니다.";
    const err=$("error"); err.hidden=false;
    err.innerHTML=`${esc(e.message)}<br>파일을 더블클릭해서 열면 브라우저 보안 정책 때문에 데이터가 보이지 않습니다. GitHub Pages에 올린 주소로 확인하세요.`;
    return;
  }

  /* 정보 */
  const INFO=Object.fromEntries(info.map(r=>[r["항목"],r["내용"]]));
  const COMMENT={};
  if(CFG.attrFallback){ try{ (await load("data/battle/sado_info.csv")).forEach(s=>{ if(s["사도"]&&s["성격"]) ATTR[s["사도"]]=s["성격"]; }); }catch(_){} }
  sado.forEach(s=>{ const n=s["사도명"]; if(!n) return; ATTR[n]=s["성격"]||s["속성"]||""; if(s["코멘트"]) COMMENT[n]=s["코멘트"]; });

  /* 덱 */
  const slotKeys=Object.keys(decksRaw[0]||{}).filter(k=>/^사도\s*\d+$/.test(k));
  /* 공명 사도: '우로스[공명:활발]'처럼 성격을 붙여 기록 → 채용률·티어는 사도 하나로 합치고, 성격 분포는 고른 성격으로 셈 */
  const RESO=/\[공명:([^\]]+)\]$/;
  const baseName=n=>n.replace(RESO,"");
  const decks=decksRaw.map(r=>{
    const raw=slotKeys.map(k=>r[k]).filter(Boolean);
    return { rank:parseInt(r["순위"],10), stage:r["단계"], boss:r["보스"], raw, members:raw.map(baseName) };
  }).filter(d=>d.members.length>0);
  const N=decks.length;
  if(!N){ $("summary").textContent="decks.csv에 입력된 덱이 없습니다."; return; }

  /* 채용률 */
  const cnt={};
  decks.forEach(d=>new Set(d.members).forEach(m=>cnt[m]=(cnt[m]||0)+1));
  const stats=Object.entries(cnt).map(([n,c])=>({n,c,r:c/N})).sort((a,b)=>b.c-a.c||a.n.localeCompare(b.n,"ko"));
  const rateOf=Object.fromEntries(stats.map(s=>[s.n,s.r]));

  /* 표준 덱 */
  const key=d=>[...new Set(d.members)].sort().join("|");
  const dc={}; decks.forEach(d=>dc[key(d)]=(dc[key(d)]||0)+1);
  const [stdKey,stdCount]=Object.entries(dc).sort((a,b)=>b[1]-a[1])[0];
  const std=stdKey.split("|").sort((a,b)=>rateOf[b]-rateOf[a]);
  const must=stats.filter(s=>s.r>=TIERS[0].min).length;

  /* 태그 */
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const ranks=decks.map(d=>d.rank).filter(Number.isFinite);
  const tags=[INFO["조사일"]&&("조사일 "+INFO["조사일"]), INFO["시즌/콘텐츠명"], INFO["시즌"],...uniq(decks.map(d=>d.stage)).filter(Boolean).map(s=>/단계$/.test(s)?s:s+"단계"), ...uniq(decks.map(d=>d.boss)), ranks.length&&(`${Math.min(...ranks)}~${Math.max(...ranks)}위 ${N}덱`)].filter(Boolean);
  $("tags").innerHTML=tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("");

  /* 요약 */
  const sum=$("summary");
  if(INFO["한줄요약"]) sum.textContent=INFO["한줄요약"];
  else { sum.classList.add("auto"); sum.textContent=must?`필수 ${must}명이 고정되고, 상위 ${N}덱 중 ${stdCount}덱(${pct(stdCount/N)})이 같은 ${slotKeys.length}명으로 편성됐습니다.`:`채용률 90% 이상인 필수 사도가 없고, 상위 ${N}덱 중 같은 ${slotKeys.length}명 덱은 가장 많아도 ${stdCount}덱(${pct(stdCount/N)})입니다.`; }

  /* 보드 */
  const board=$("board"); board.hidden=false;
  /* 계산기 링크: 표준 덱과 같은 9명인 덱 중 가장 많은 실제 기록(공명 성격 포함) */
  const rc2={}; decks.filter(d=>key(d)===stdKey).forEach(d=>{ const k=d.raw.join(","); rc2[k]=(rc2[k]||0)+1; });
  const stdRaw=(Object.entries(rc2).sort((a,b)=>b[1]-a[1])[0]||[std.join(",")])[0];
  const calcHref=`calculator.html?deck=${encodeURIComponent(stdRaw)}${cur?`&s=${encodeURIComponent(cur["시즌ID"])}`:""}`;
  /* 칸 하나: 성격 색 칩 + 이름 + 채용률 (캐릭터 이미지 없음) */
  const slotHTML=m=>{ const n=baseName(m), rp=(m.match(RESO)||[])[1];
    return `<div class="slot" style="--c:${col(n)}"><i class="hex" aria-hidden="true"></i>
    <div class="pct">${pct(rateOf[n])}</div><div class="nm">${esc(n)}${rp?`<small class="rp">공명 ${esc(rp)}</small>`:""}</div>
    <div class="meter"><i style="width:${rateOf[n]*100}%"></i></div></div>`; };
  /* 게임 편성 화면과 같은 배치: 왼쪽 후열 · 가운데 중열 · 오른쪽 전열 (기록 순서는 사도1~3 전열, 4~6 중열, 7~9 후열) */
  const stdSlots=stdRaw.split(",");
  let slotsHTML;
  if(slotKeys.length===9&&stdSlots.length===9){
    const cells=[]; for(let i=0;i<3;i++) cells.push(stdSlots[6+i],stdSlots[3+i],stdSlots[i]);
    slotsHTML=`<div class="formation"><div class="fh">후열</div><div class="fh">중열</div><div class="fh">전열 <span aria-hidden="true">→</span><span class="sr">적 방향</span></div>${cells.map(slotHTML).join("")}</div>`;
  }else slotsHTML=`<div class="slots">${std.map(slotHTML).join("")}</div>`;
  /* 덱 수렴도: 같은 9명 구성 상위 3개가 전체에서 차지하는 비율 */
  const topDecks=Object.values(dc).sort((a,b)=>b-a);
  const shareParts=[["최다 덱",topDecks[0]||0],["2위 구성",topDecks[1]||0],["3위 구성",topDecks[2]||0]].filter(p=>p[1]);
  const others=N-shareParts.reduce((s,p)=>s+p[1],0); if(others>0) shareParts.push(["그 외",others]);
  const SHADES=["var(--s1)","var(--s2)","var(--s3)","var(--s4)"];
  const top3=shareParts.filter(p=>p[0]!=="그 외").reduce((s,p)=>s+p[1],0);
  board.innerHTML=`<div class="board-head"><b>표준 덱</b><span>${N}덱 중 ${stdCount}덱이 이 ${slotKeys.length}명 그대로 편성, 칸의 숫자는 채용률${/global/.test(location.pathname)?"":` · <a href="${calcHref}">덱 계산기로 열기 →</a>`}</span></div>
  <div class="board-body">${slotsHTML}
  <figure class="donut-card"><div class="donut lg" style="background:${conic(shareParts.map((p,i)=>[p[1],SHADES[i]]))}" role="img" aria-label="상위 3개 덱 구성이 ${pct(top3/N)} 차지"><div class="hole"><b>${pct(top3/N)}</b><small>상위 3구성</small></div></div>
    <figcaption><b>덱 수렴도</b>${shareParts.map((p,i)=>`<span class="lg-row"><i style="background:${SHADES[i]}"></i>${p[0]} <b>${p[1]}덱</b> <small>${pct(p[1]/N)}</small></span>`).join("")}</figcaption></figure></div>`;

  /* 이전 시즌 비교 */
  if(prevRaw&&prevRaw.length){
    const pk=Object.keys(prevRaw[0]).filter(k=>/^사도\s*\d+$/.test(k));
    const pd=prevRaw.map(r=>pk.map(k=>r[k]).filter(Boolean).map(baseName)).filter(m=>m.length);
    const pc={}; pd.forEach(m=>new Set(m).forEach(x=>pc[x]=(pc[x]||0)+1));
    /* 글로벌 비교: 글로벌에 아직 출시되지 않은 사도는 채용률 0%가 아니라 '고를 수 없음'이라 표에서 제외 (CFG.root/unreleased.csv) */
    let unreleased=[];
    if(CFG.compare==="kr"){ try{ unreleased=(await load(CFG.root+"unreleased.csv")).map(r=>r["사도명"]).filter(Boolean); }catch(_){ unreleased=[]; } }
    const names=[...new Set([...Object.keys(pc),...Object.keys(cnt)])].filter(n=>!unreleased.includes(n));
    const rows=names.map(n=>({n,a:(pc[n]||0)/pd.length,b:rateOf[n]||0})).map(o=>({...o,d:o.b-o.a}))
      .filter(o=>Math.abs(o.d)>=0.05).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)).slice(0,15);
    $("s-compare").hidden=false;
    $("cmpLead").textContent=CFG.compare==="kr"
      ?`한국 서버 ${prev["표시이름"]||prev["시즌ID"]} (${pd.length}덱) → 글로벌 서버 ${cur["표시이름"]||cur["시즌ID"]} (${N}덱). 같은 콘텐츠에서 두 서버에 모두 출시된 사도 중 채용률이 5%p 이상 다른 사도를 차이가 큰 순서로 정리했습니다.`
      :`${prev["표시이름"]||prev["시즌ID"]} (${pd.length}덱) → ${cur["표시이름"]||cur["시즌ID"]} (${N}덱). 채용률이 5%p 이상 바뀐 사도를 변화가 큰 순서로 정리했습니다. 패치 노트로 설명되지 않는 변화는 따로 확인이 필요합니다.`;
    $("cmp").innerHTML=`<thead><tr><th>사도</th><th>${CFG.compare==="kr"?"한국":"이전"}</th><th>${CFG.compare==="kr"?"글로벌":"이번"}</th><th>${CFG.compare==="kr"?"차이":"변화"}</th></tr></thead><tbody>`+
      (rows.length?rows.map(o=>`<tr><td>${chip(o.n)}</td><td>${pct(o.a)}</td><td>${pct(o.b)}</td><td class="${o.d>0?'up':'down'}">${o.d>0?'▲':'▼'} ${(Math.abs(o.d)*100).toFixed(0)}%p</td></tr>`).join("")
       :`<tr><td colspan="4">5%p 이상 바뀐 사도가 없습니다.</td></tr>`)+`</tbody>`;
    const krOnly=unreleased.filter(n=>pc[n]);
    const note=$("cmpNote");
    if(note&&krOnly.length){ note.hidden=false; note.innerHTML=`글로벌 미출시라 비교에서 제외: ${krOnly.map(n=>esc(n)).join(" · ")}`; }
  }

  /* 메타 코멘트 */
  if(INFO["메타 코멘트"]){ $("s-comment").hidden=false; $("metaComment").innerHTML=INFO["메타 코멘트"].split(/\n+/).filter(s=>s.trim()).map(s=>`<p>${numB(s.trim())}</p>`).join(""); }

  /* 분석 보고서: 시즌 폴더의 analysis.csv (제목,내용). 내용의 줄바꿈 = 문단, "- "로 시작하는 줄 = 목록 */
  /* 보고서 차트: 내용 한 줄에 [차트:구간 1-100,101-200,201-300] (구간 생략 가능) 또는 [차트:레벨] (시즌 폴더 levels.csv 필요) */
  const fig=(h,body,cap)=>`<figure class="an-chart"><svg viewBox="0 0 760 ${h}" role="img" font-size="16">${body}</svg>${cap?`<figcaption><b>읽는 법</b> ${esc(cap)}</figcaption>`:""}</figure>`;
  const chartBands=arg=>{
    let bs=(arg||"").split(",").map(x=>x.trim().split("-").map(Number)).filter(b=>b.length===2&&b.every(Number.isFinite));
    if(!bs.length){ const mx=Math.max(...ranks); bs=mx>150?[[1,100],[101,200],[201,mx]]:[[1,Math.round(mx/2)],[Math.round(mx/2)+1,mx]]; }
    const bd=bs.map(([lo,hi])=>decks.filter(d=>d.rank>=lo&&d.rank<=hi));
    const share=(n,i)=>bd[i].length?bd[i].filter(d=>d.members.includes(n)).length/bd[i].length*100:0;
    let rows=Object.keys(cnt).filter(n=>cnt[n]/N>=0.04).map(n=>{ const v=bs.map((_,i)=>share(n,i)); return {n,v,d:v[v.length-1]-v[0]}; })
      .filter(r=>Math.min(...r.v)<97).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,10).sort((a,b)=>b.d-a.d);
    if(!rows.length) return "";
    const x0=190,x1=660,y0=84,rh=32,yEnd=y0+rows.length*rh,sx=v=>x0+v/100*(x1-x0);
    /* 구간 색: 첫 구간 회색 → 중간 연한 파랑 → 마지막 진한 파랑 */
    const dot=j=>j===0?`fill="var(--미분류)"`:j===bs.length-1?`fill="var(--leaf)"`:`fill="var(--leaf)" fill-opacity=".45"`;
    let s=`<text x="20" y="22" fill="var(--muted)">순위 구간별 채용률(%) · 화살표 = 첫 구간 → 마지막 구간</text>`;
    s+=bs.map(([lo,hi],i)=>`<circle cx="${26+i*150}" cy="50" r="7" ${dot(i)}/><text x="${40+i*150}" y="55" fill="var(--muted)">${lo}~${hi}위</text>`).join("");
    s+=`<text x="740" y="${y0-8}" text-anchor="end" fill="var(--muted)">변화</text>`;
    s+=[0,25,50,75,100].map(t=>`<line x1="${sx(t)}" x2="${sx(t)}" y1="${y0}" y2="${yEnd}" stroke="var(--line)"/><text x="${sx(t)}" y="${yEnd+18}" text-anchor="middle" fill="var(--muted)">${t}</text>`).join("");
    s+=rows.map((r,i)=>{ const y=y0+i*rh+rh/2, xs=r.v.map(sx), xl=xs[xs.length-1], xp=xs[xs.length-2]??xs[0], dir=Math.sign(xl-xp);
      const path=xs.map((x,j)=>`${j?"L":"M"}${x.toFixed(1)} ${y}`).join(" ");
      const head=dir&&Math.abs(xl-xp)>12?`<path d="M${(xl-dir*8).toFixed(1)} ${y} l${(-dir*9).toFixed(1)} -6 l0 12 z" fill="var(--leaf)"/>`:"";
      return `<text x="178" y="${y+5}" text-anchor="end" fill="var(--ink)">${esc(r.n)}</text><path d="${path}" fill="none" stroke="var(--leaf)" stroke-opacity=".55" stroke-width="2.5"/>${head}`
        +r.v.map((v,j)=>`<circle cx="${sx(v)}" cy="${y}" r="6.5" ${dot(j)}><title>${esc(r.n)} ${bs[j][0]}~${bs[j][1]}위: ${v.toFixed(1)}%</title></circle>`).join("")
        +`<text x="740" y="${y+5}" text-anchor="end" fill="var(--ink)" font-weight="600">${r.d>0?"+":""}${Math.round(r.d)}%p</text>`; }).join("");
    return fig(yEnd+30,s,`한 줄이 사도 한 명입니다. 점은 순위 구간별로 그 사도를 쓴 덱의 비율(%)이고, 회색 점이 ${bs[0][0]}~${bs[0][1]}위, 진한 파란 점이 ${bs[bs.length-1][0]}~${bs[bs.length-1][1]}위입니다. 선은 위 구간에서 아래 구간 순서로 이은 것이고 화살표가 마지막 구간 쪽을 가리킵니다. 오른쪽 숫자는 마지막 구간에서 첫 구간을 뺀 값으로, +면 순위가 내려갈수록 더 많이 쓴 사도, −면 상위권에서 더 많이 쓴 사도입니다. 중간에 꺾이는 사도는 숫자만 보지 말고 점 위치도 같이 보세요.`);
  };
  const chartLevels=()=>{
    const L=seasonLevels.map(r=>({rank:+r["순위"],t:+r["클리어 시간(초)"],n:+r["편성 인원"],lo:+r["최저 Lv"],hi:+r["최고 Lv"],f:r["이상"]||""})).filter(r=>Number.isFinite(r.t));
    if(!L.length) return "";
    const tm=Math.ceil(Math.max(...L.map(r=>r.t))/10)*10, x0=70,x1=720,yT=60,yB=330, sx=t=>x0+t/tm*(x1-x0), sy=v=>yB-v/150*(yB-yT);
    let s=`<text x="20" y="22" fill="var(--muted)">클리어 시간과 덱 최고 레벨 · 진한 점 = 특히 이상, 연한 점 = 이상</text>`;
    s+=[0,50,100,150].map(v=>`<line x1="${x0}" x2="${x1}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)"/><text x="${x0-8}" y="${sy(v)+4}" text-anchor="end" fill="var(--muted)">${v}</text>`).join("");
    for(let t=0;t<=tm;t+=10) s+=`<text x="${sx(t)}" y="${yB+18}" text-anchor="middle" fill="var(--muted)">${t}</text>`;
    s+=`<text x="${x0-8}" y="${yT-12}" text-anchor="end" fill="var(--muted)">최고 Lv</text><text x="${x1}" y="${yB+38}" text-anchor="end" fill="var(--muted)">클리어 시간(초)</text>`;
    const tip=r=>`<title>${r.rank}위: ${r.t}초, ${r.n}명, Lv.${r.lo}~${r.hi}</title>`;
    s+=L.filter(r=>!r.f).map(r=>`<circle cx="${sx(r.t)}" cy="${sy(r.hi)}" r="4.5" fill="var(--미분류)" fill-opacity=".7">${tip(r)}</circle>`).join("");
    const odd=L.filter(r=>r.f).sort((a,b)=>b.hi-a.hi), ly0=Math.max(yT+20,sy(odd.length?odd[0].hi:0));
    s+=odd.map((r,i)=>{ const ly=ly0+i*26, lx=430;
      return `<line x1="${sx(r.t)+7}" y1="${sy(r.hi)}" x2="${lx-6}" y2="${ly-4}" stroke="var(--muted)" stroke-opacity=".6"/><circle cx="${sx(r.t)}" cy="${sy(r.hi)}" r="6.5" fill="var(--leaf)" fill-opacity="${r.f==="특히 이상"?1:.4}" stroke="var(--leaf)">${tip(r)}</circle><text x="${lx}" y="${ly}" fill="var(--ink)">${r.rank}위 · ${r.n}명 Lv.${r.lo}~${r.hi} · ${r.t}초</text>`; }).join("");
    return fig(yB+48,s,"점 하나가 덱 하나입니다. 가로는 클리어 시간(왼쪽일수록 빠르고 순위가 높음), 세로는 그 덱에서 가장 높은 사도 레벨입니다. 대부분의 덱은 Lv.100 안팎에 모여 있고, 그 아래로 떨어진 파란 점은 낮은 레벨로 빠르게 클리어한 기록입니다. 진한 파랑은 특히 이상한 기록, 연한 파랑은 이상 기록입니다.");
  };
  const parseBands=arg=>{ let bs=(arg||"").split(",").map(x=>x.trim().split("-").map(Number)).filter(b=>b.length===2&&b.every(Number.isFinite));
    if(!bs.length){ const mx=Math.max(...ranks); bs=mx>150?[[1,100],[101,200],[201,mx]]:[[1,Math.round(mx/2)],[Math.round(mx/2)+1,mx]]; } return bs; };
  const persOf=m=>{ const r=m.match(RESO); return r?r[1]:(ATTR[baseName(m)]||"미분류"); };
  const PORDER=["냉정","광기","활발","우울","순수","공명","미분류"];
  /* 100% 가로 막대 한 줄: parts=[[이름,값]] */
  const stackRow=(y,label,parts,x0=150,x1=740,h=30)=>{ const tot=parts.reduce((s,p)=>s+p[1],0)||1; let acc=x0;
    return `<text x="${x0-12}" y="${y+h/2+5}" text-anchor="end" fill="var(--ink)">${esc(label)}</text>`+parts.filter(p=>p[1]>0).map(([k,v])=>{ const w=v/tot*(x1-x0), sx=acc; acc+=w; const pc=v/tot*100;
      return `<rect x="${sx}" y="${y}" width="${Math.max(w-1,0)}" height="${h}" fill="var(--${k})" fill-opacity=".85"><title>${esc(label)} ${k}: ${pc.toFixed(1)}% (${v}칸)</title></rect>`+(pc>=8?`<text x="${sx+w/2}" y="${y+h/2+5}" text-anchor="middle" fill="#fff" font-size="14">${pc.toFixed(0)}%</text>`:""); }).join(""); };
  const legendP=(keys,y)=>keys.map((k,i)=>`<rect x="${20+i*96}" y="${y-11}" width="14" height="14" rx="3" fill="var(--${k})"/><text x="${40+i*96}" y="${y+1}" fill="var(--muted)">${k}</text>`).join("");
  const chartPers=arg=>{
    const bs=parseBands(arg);
    const rows=bs.map(([lo,hi])=>{ const c={}; decks.filter(d=>d.rank>=lo&&d.rank<=hi).forEach(d=>d.raw.forEach(m=>{ const p=persOf(m); c[p]=(c[p]||0)+1; })); return {label:`${lo}~${hi}위`,c}; });
    const keys=PORDER.filter(k=>rows.some(r=>r.c[k]));
    let s=`<text x="20" y="22" fill="var(--muted)">순위 구간별 편성 칸의 성격 비율</text>`+legendP(keys,50);
    s+=rows.map((r,i)=>stackRow(72+i*44,r.label,keys.map(k=>[k,r.c[k]||0]))).join("");
    return fig(72+rows.length*44+10,s,"막대 하나가 순위 구간 하나입니다. 그 구간에 편성된 칸 전체를 100%로 놓고 성격별 비율을 색으로 나눴습니다(공명 사도는 고른 성격으로 셌습니다). 위아래 막대에서 같은 색 조각의 길이를 비교하면, 순위가 내려갈수록 어떤 성격이 늘고 줄었는지 보입니다. 8% 미만 조각은 숫자를 생략했고, 막대에 마우스를 올리면 정확한 값이 나옵니다.");
  };
  const chartReso=arg=>{
    const bs=parseBands(arg);
    const bases=uniq(decks.flatMap(d=>d.raw.filter(m=>RESO.test(m)).map(baseName)));
    if(!bases.length) return "";
    const rows=[]; bases.forEach(b=>bs.forEach(([lo,hi])=>{ const c={}; decks.filter(d=>d.rank>=lo&&d.rank<=hi).forEach(d=>d.raw.forEach(m=>{ if(baseName(m)===b&&RESO.test(m)){ const p=m.match(RESO)[1]; c[p]=(c[p]||0)+1; } })); rows.push({label:`${b} ${lo}~${hi}위`,c}); }));
    const keys=PORDER.filter(k=>rows.some(r=>r.c[k]));
    let s=`<text x="20" y="22" fill="var(--muted)">공명 사도가 고른 성격 · 순위 구간별 비율</text>`+legendP(keys,50);
    s+=rows.map((r,i)=>stackRow(72+i*40+Math.floor(i/bs.length)*12,r.label,keys.map(k=>[k,r.c[k]||0]),230,740,28)).join("");
    return fig(72+rows.length*40+Math.floor((rows.length-1)/bs.length)*12+10,s,"공명 사도는 편성할 때 성격을 골라 씁니다. 막대 하나가 '사도 × 순위 구간'이고, 그 구간에서 그 사도를 쓴 덱 전체를 100%로 놓고 고른 성격 비율을 나눴습니다. 같은 사도의 막대를 위에서 아래로 보면, 순위가 내려갈수록 성격 선택이 어떻게 바뀌는지 보입니다.");
  };
  const chartRows=()=>{
    const ROWN=["전열","중열","후열"], c=ROWN.map(()=>({}));
    decksRaw.forEach(r=>slotKeys.forEach((k,i)=>{ const m=r[k]; if(!m) return; const b=baseName(m), ri=Math.min(2,Math.floor(i/3)); c[ri][b]=(c[ri][b]||0)+1; }));
    const x0=200,x1=660, mx=Math.max(...c.flatMap(o=>Object.values(o)));
    let y=40, s=`<text x="20" y="22" fill="var(--muted)">열마다 많이 놓인 사도 (덱 수, 막대 색 = 성격)</text>`;
    ROWN.forEach((rn,ri)=>{ const top=Object.entries(c[ri]).sort((a,b)=>b[1]-a[1]).slice(0,6);
      s+=`<text x="20" y="${y+20}" fill="var(--ink)" font-weight="600">${rn}</text>`; y+=30;
      top.forEach(([n,v])=>{ s+=`<text x="${x0-12}" y="${y+16}" text-anchor="end" fill="var(--ink)">${esc(n)}</text><rect x="${x0}" y="${y+2}" width="${v/mx*(x1-x0)}" height="20" rx="3" fill="var(--${ATTRS.includes(ATTR[n])?ATTR[n]:"미분류"})" fill-opacity=".85"><title>${esc(n)} ${rn}: ${v}덱</title></rect><text x="${x0+v/mx*(x1-x0)+8}" y="${y+17}" fill="var(--ink)">${v}</text>`; y+=26; });
      y+=10; });
    return fig(y+6,s,"전·중·후열마다 그 자리에 가장 많이 놓인 사도 6명입니다. 막대 길이와 숫자는 그 열에 놓인 덱 수이고, 막대 색은 사도의 성격입니다. 한 사도가 여러 열에 나오면 덱마다 다른 자리에 놓았다는 뜻입니다.");
  };
  const chartFor=x=>{ const m=x.match(/^\[차트:(\S+)\s*(.*)\]$/); if(!m) return "";
    return m[1]==="구간"?chartBands(m[2]):m[1]==="레벨"?chartLevels():m[1]==="성격"?chartPers(m[2]):m[1]==="공명"?chartReso(m[2]):m[1]==="열"?chartRows():""; };

  if(seasonAnalysis.length&&$("s-analysis")){
    $("s-analysis").hidden=false;
    $("analysis").innerHTML=seasonAnalysis.map(r=>{
      const lines=r["내용"].split(/\n+/).map(x=>x.trim()).filter(Boolean); let h="",ul=[];
      const flush=()=>{ if(ul.length){ h+=`<ul>${ul.map(x=>`<li>${numB(x)}</li>`).join("")}</ul>`; ul=[]; } };
      lines.forEach(x=>{ if(x.startsWith("[차트:")){ flush(); h+=chartFor(x); } else if(x.startsWith("- ")) ul.push(x.slice(2)); else { flush(); h+=`<p>${numB(x)}</p>`; } }); flush();
      return `<article><h3>${esc(r["제목"])}</h3>${h}</article>`;
    }).join("");
    /* 그래프 등장 효과: 화면에 들어오면 막대가 자라고 점이 나타남 */
    const figs=[...$("analysis").querySelectorAll(".an-chart")];
    if(figs.length&&"IntersectionObserver" in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
      figs.forEach(f=>f.classList.add("anim"));
      const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }),{threshold:.2});
      figs.forEach(f=>io.observe(f));
    }
  }

  /* 티어 */
  $("tierLead").textContent="채용률 기준은 "+TIERS.slice(0,-1).map(t=>`${t.name} ${pct(t.min)} 이상`).join(", ")+", 그 외는 채용 10% 미만입니다.";
  $("tiers").innerHTML=TIERS.map(t=>{
    const list=stats.filter(s=>tierOf(s.r)===t);
    return `<div class="tier" style="--t:${t.color}"><div class="lab"><b>${t.name}</b><small>${list.length}명</small></div>
      <div class="chips">${list.length?list.map(s=>chip(s.n,` <em>${pct(s.r)}</em>`)).join(""):'<span class="empty">해당 없음</span>'}</div></div>`;
  }).join("");

  /* 막대 */
  $("bars").innerHTML=stats.map(s=>`<div class="bar" data-n="${esc(s.n)}" style="--c:${col(s.n)}"><span class="n">${esc(s.n)}</span>
    <span class="track" role="img" aria-label="${esc(s.n)} 채용률 ${pct(s.r,1)}"><i style="width:${s.r*100}%"></i></span>
    <span class="v">${pct(s.r,1)} <small>${s.c}덱</small></span></div>`).join("")
    +`<div class="legend">${[...ATTRS,"미분류"].map(a=>`<span style="--c:var(--${a})">${a}</span>`).join("")}</div>`;

  /* 교체 패턴 */
  const stdSet=new Set(std), sw={};
  decks.forEach(d=>{
    const s=new Set(d.members);
    const out=std.filter(m=>!s.has(m)), inn=[...s].filter(m=>!stdSet.has(m)).sort((a,b)=>rateOf[b]-rateOf[a]);
    if(!out.length&&!inn.length) return;
    const k=out.join("+")+"→"+inn.join("+");
    (sw[k]=sw[k]||{out,inn,c:0}).c++;
  });
  const swList=Object.values(sw).sort((a,b)=>b.c-a.c);
  $("swaps").innerHTML=swList.length?swList.slice(0,10).map(s=>`<div class="swap"><div class="flow">
      ${s.out.map(n=>chip(n,"","out")).join("")||'<span class="empty">(빈 자리)</span>'}
      <span class="arrow" aria-label="대신">→</span>
      ${s.inn.map(n=>chip(n)).join("")||'<span class="empty">(빈 자리)</span>'}
    </div><span class="cnt">${s.c}덱 <small>${pct(s.c/N)}</small></span></div>`).join("")
    :'<p class="empty">모든 덱이 표준 덱과 같습니다.</p>';

  /* ===== 순위 지정: 한 번 고른 범위로 성격 원 그래프·열별 도넛·칸 합계·사도별 채용률이 같이 움직인다 (트릭컬 레코드 '순위 지정' 참고) ===== */
  const RMX=Math.max(...ranks), STILL=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PRESETS=[[1,RMX,"전체"]].concat(RMX>150?[[1,100],[101,200],[201,RMX]]:[[1,Math.round(RMX/2)],[Math.round(RMX/2)+1,RMX]]);
  const pk=p=>PORDER.includes(p)?p:"미분류";
  const rangeSubs=[]; let ranged=false;
  const setRange=(lo,hi)=>{ ranged=true; lo=Math.max(1,Math.min(RMX,lo||1)); hi=Math.max(1,Math.min(RMX,hi||RMX)); if(lo>hi) [lo,hi]=[hi,lo];
    if(!decks.some(d=>d.rank>=lo&&d.rank<=hi)) return; rangeSubs.forEach(f=>f(lo,hi)); };
  /* 범위 버튼 묶음: 어디서 바꿔도 모든 묶음의 버튼·입력칸이 같은 범위를 가리킨다 */
  const rangeCtl=box=>{
    box.insertAdjacentHTML("beforeend",`<div class="pie-ctl">${PRESETS.map((p,i)=>`<button type="button" data-i="${i}"${i?"":' class="on"'}>${p[2]||`${p[0]}~${p[1]}위`}</button>`).join("")}
      <span class="pie-range"><input type="number" min="1" max="${RMX}" value="1" aria-label="시작 순위"><span>~</span><input type="number" min="1" max="${RMX}" value="${RMX}" aria-label="끝 순위"><button type="button" data-apply>적용</button></span></div>`);
    const ctl=box.lastElementChild, ins=ctl.querySelectorAll("input");
    ctl.querySelectorAll("button[data-i]").forEach(b=>b.onclick=()=>{ const p=PRESETS[+b.dataset.i]; setRange(p[0],p[1]); });
    ctl.querySelector("[data-apply]").onclick=()=>setRange(+ins[0].value,+ins[1].value);
    ins.forEach(x=>x.onkeydown=e=>{ if(e.key==="Enter") setRange(+ins[0].value,+ins[1].value); });
    rangeSubs.push((lo,hi)=>{ ins[0].value=lo; ins[1].value=hi; ctl.querySelectorAll("button[data-i]").forEach(b=>{ const p=PRESETS[+b.dataset.i]; b.classList.toggle("on",p[0]===lo&&p[1]===hi); }); });
  };
  /* 범위 안 편성 칸의 성격 수 (idx = 칸 번호, 생략하면 9칸 전부). 공명 사도는 고른 성격으로 센다 */
  const persCount=(lo,hi,idx)=>{ const c={}; let t=0, n=0;
    decksRaw.forEach(r=>{ const rk=parseInt(r["순위"],10); if(!(rk>=lo&&rk<=hi)) return; n++;
      (idx||slotKeys.map((_,i)=>i)).forEach(i=>{ const m=(r[slotKeys[i]]||"").trim(); if(!m) return; const p=pk(persOf(m)); c[p]=(c[p]||0)+1; t++; }); });
    return {c,t,n}; };
  /* 값 배열을 0.75초 동안 새 값으로 옮기며 매 프레임 그린다 */
  const tween=(from,to,paint,D=750)=>{ let raf=0; const t0=performance.now(), d=STILL?0:D;
    const step=now=>{ const k=d?Math.min(1,(now-t0)/d):1, e=1-Math.pow(1-k,3); paint(from.map((f,i)=>Array.isArray(f)?f.map((x,j)=>x+(to[i][j]-x)*e):f+(to[i]-f)*e)); if(k<1) raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step); return ()=>cancelAnimationFrame(raf); };

  /* 성격 분포 */
  const ENEMY=((cur&&cur["적 성격"])||INFO["적 성격"]||"").trim();
  const BEATS={"광기":"순수","순수":"냉정","냉정":"광기","활발":"우울","우울":"활발"};
  const good=ATTRS.filter(a=>BEATS[a]===ENEMY);
  const bad=ATTRS.filter(a=>BEATS[ENEMY]===a&&!["활발","우울"].includes(a));
  const mark=a=>good.includes(a)?' <b>유리</b>':bad.includes(a)?' <b class="bad">불리</b>':'';

  /* 전체 칸 합계 막대: 조각 폭(flex-grow)이 CSS로 부드럽게 바뀐다 */
  const stackEl=$("stack"), stackCap=document.querySelector(".stack-cap");
  stackEl.innerHTML=PORDER.map(a=>`<i style="--c:var(--${a})" data-a="${a}"></i>`).join("");
  rangeSubs.push((lo,hi)=>{ const {c,t}=persCount(lo,hi);
    stackEl.querySelectorAll("i").forEach(e=>{ const a=e.dataset.a, v=c[a]||0; e.style.flexGrow=v; e.title=v?`${a} ${pct(v/t,1)}`:""; e.textContent=v/t>=.08?pct(v/t):""; });
    $("stackLegend").innerHTML=PORDER.filter(a=>c[a]).map(a=>`<span style="--c:var(--${a})">${a} ${pct(c[a]/t,1)}${mark(a)}</span>`).join("");
    if(stackCap) stackCap.textContent=lo===1&&hi===RMX?"전체 칸 합계":`${lo}~${hi}위 칸 합계`; });

  /* 열별 성격 구성 도넛 — 게임 화면 순서(후열·중열·전열), 범위를 바꾸면 조각이 움직인다 */
  const cd=$("colDonuts");
  if(cd&&slotKeys.length===9){
    const COLS=[["후열",[6,7,8]],["중열",[3,4,5]],["전열",[0,1,2]]];
    cd.hidden=false;
    cd.innerHTML=COLS.map(([nm])=>`<figure class="donut-card"><div class="donut" role="img"><div class="hole"><b>${nm}</b><small></small></div></div><figcaption></figcaption></figure>`).join("");
    const figs=[...cd.querySelectorAll(".donut-card")];
    let vals=COLS.map(()=>PORDER.map(()=>0)), stop=()=>{};
    const paint=v=>{ vals=v; figs.forEach((f,j)=>{ const s=v[j].reduce((a,b)=>a+b,0); f.querySelector(".donut").style.background=s>0.001?conic(PORDER.map((k,i)=>[v[j][i],`var(--${k})`])):"var(--line)"; }); };
    paint(vals);
    rangeSubs.push((lo,hi)=>{
      const to=COLS.map(([nm,idx],j)=>{ const {c,t}=persCount(lo,hi,idx), list=PORDER.filter(a=>c[a]).sort((x,y)=>c[y]-c[x]);
        figs[j].querySelector(".hole small").textContent=`${t}칸`;
        figs[j].querySelector(".donut").setAttribute("aria-label",`${lo}~${hi}위 ${nm} 성격 구성: ${list.map(a=>`${a} ${pct(c[a]/t)}`).join(", ")}`);
        figs[j].querySelector("figcaption").innerHTML=list.map(a=>`<span class="lg-row"><i style="background:var(--${a})"></i>${a} <b>${c[a]/t<0.005?"1% 미만":pct(c[a]/t)}</b></span>`).join("");
        return PORDER.map(k=>t?(c[k]||0)/t:0); });
      stop(); stop=tween(vals,to,paint); });
  }

  /* 움직이는 성격 원 그래프: 순위 범위를 바꾸면 조각이 새 비율로 움직인다 */
  const pieBox=$("persPie");
  if(pieBox){
    pieBox.innerHTML=`<div class="pie-wrap"><svg viewBox="0 0 220 220" class="pie" role="img" aria-label="순위 범위별 성격 비율"></svg><div class="pie-side"></div></div>`;
    const side=pieBox.querySelector(".pie-side"); rangeCtl(side);
    side.insertAdjacentHTML("beforeend",`<ul class="pie-legend"></ul><p class="pie-note"></p>`);
    const svg=pieBox.querySelector("svg"), leg=side.querySelector(".pie-legend"), note=side.querySelector(".pie-note");
    const arc=(a0,a1)=>{ const R=100,r=60,P=(a,q)=>[(110+q*Math.sin(a)).toFixed(2),(110-q*Math.cos(a)).toFixed(2)]; if(a1-a0>=Math.PI*2-1e-4) a1=a0+Math.PI*2-1e-3;
      const lg=a1-a0>Math.PI?1:0,[x0,y0]=P(a0,R),[x1,y1]=P(a1,R),[x2,y2]=P(a1,r),[x3,y3]=P(a0,r); return `M${x0} ${y0}A${R} ${R} 0 ${lg} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${lg} 0 ${x3} ${y3}Z`; };
    let lab=["",""];
    const draw=v=>{ let a=0; svg.innerHTML=PORDER.map((k,i)=>{ const w=v[i]*Math.PI*2, mid=a+w/2;
        const s=w>0.002?`<path d="${arc(a,a+w)}" fill="var(--${k})"><title>${k} ${(v[i]*100).toFixed(1)}%</title></path>`:"";
        const t=v[i]>=0.06?`<text x="${(110+80*Math.sin(mid)).toFixed(1)}" y="${(114-80*Math.cos(mid)).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${Math.round(v[i]*100)}%</text>`:"";
        a+=w; return s+t; }).join("")+`<text x="110" y="106" text-anchor="middle" font-size="13" fill="var(--muted)">${lab[0]}</text><text x="110" y="126" text-anchor="middle" font-size="16" font-weight="700" fill="var(--ink)">${lab[1]}</text>`; };
    let pv=PORDER.map(()=>0), stop=()=>{};
    rangeSubs.push((lo,hi)=>{ const {c,t,n}=persCount(lo,hi), v=PORDER.map(k=>t?(c[k]||0)/t:0); lab=[`${lo}~${hi}위`,`${n}덱`];
      leg.innerHTML=PORDER.map((k,i)=>v[i]>0?`<li><i style="background:var(--${k})"></i>${k}<b>${(v[i]*100).toFixed(1)}%</b></li>`:"").join("");
      note.textContent=`${lo}~${hi}위 ${n}덱 · 편성 칸 ${t}칸 기준입니다. 공명 사도는 고른 성격으로 셌고, 아래 열별 도넛과 칸 합계, 위 사도별 채용률도 같이 바뀝니다.`;
      stop(); stop=tween(pv,v,x=>{ pv=x; draw(x); }); });
    draw(pv);
  }

  /* 사도별 채용률 막대: 범위를 바꾸면 막대 길이가 바뀌고 순서가 다시 정렬된다 */
  const barsEl=$("bars");
  if(barsEl){
    const top=document.createElement("div"); top.className="bars-ctl"; barsEl.before(top); rangeCtl(top);
    top.insertAdjacentHTML("beforeend",`<p class="pie-note"></p>`); const bnote=top.lastElementChild;
    const rowsB=Object.fromEntries([...barsEl.querySelectorAll(".bar")].map(e=>[e.dataset.n,e])), legEl=barsEl.querySelector(".legend");
    rangeSubs.push((lo,hi)=>{ const ds=decks.filter(d=>d.rank>=lo&&d.rank<=hi), n=ds.length, c={};
      ds.forEach(d=>new Set(d.members).forEach(m=>c[m]=(c[m]||0)+1));
      const order=stats.map(s=>({n:s.n,c:c[s.n]||0})).sort((a,b)=>b.c-a.c||rateOf[b.n]-rateOf[a.n]||a.n.localeCompare(b.n,"ko"));
      const before=STILL?null:Object.fromEntries(order.map(o=>[o.n,rowsB[o.n].getBoundingClientRect().top]));
      order.forEach(o=>{ const e=rowsB[o.n]; e.querySelector(".track i").style.width=(o.c/n*100)+"%";
        e.querySelector(".track").setAttribute("aria-label",`${o.n} ${lo}~${hi}위 채용률 ${pct(o.c/n,1)}`);
        e.querySelector(".v").innerHTML=`${pct(o.c/n,1)} <small>${o.c}덱</small>`; e.classList.toggle("zero",!o.c); barsEl.insertBefore(e,legEl); });
      if(before){ const moved=order.map(o=>[rowsB[o.n],before[o.n]-rowsB[o.n].getBoundingClientRect().top]).filter(x=>Math.abs(x[1])>1);
        moved.forEach(([e,dy])=>{ e.style.transition="none"; e.style.transform=`translateY(${dy}px)`; });
        barsEl.offsetHeight; moved.forEach(([e])=>{ e.style.transition=""; e.style.transform=""; }); }
      bnote.textContent=`${lo}~${hi}위 ${n}덱 기준입니다. 0덱인 사도는 흐리게 아래로 내려갑니다.`; });
  }

  /* 처음 그리기: 원 그래프가 화면에 들어오면 전체 범위로 움직이며 채운다 */
  const firstRange=()=>{ if(!ranged) setRange(1,RMX); };
  /* 원 그래프·열별 도넛·칸 합계 중 하나라도 화면에 들어오면 시작 (빠르게 스크롤해 원 그래프를 건너뛰어도 비지 않게) */
  const watch=[pieBox,cd&&!cd.hidden?cd:null,stackEl].filter(Boolean);
  if(watch.length&&!STILL&&"IntersectionObserver" in window){ const io=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ io.disconnect(); firstRange(); } },{threshold:.1}); watch.forEach(w=>io.observe(w)); }
  else firstRange();
  if(ENEMY){
    const ml=$("matchLead"); ml.hidden=false;
    ml.textContent=ENEMY==="성격 없음"
      ?"이번 보스는 성격이 없어 성격 상성이 적용되지 않습니다."
      :`이번 보스 성격은 ${ENEMY}입니다. ${good.join("·")} 성격이 유리(주는 피해 1.5배)${bad.length?`, ${bad.join("·")} 성격이 불리(0.75배)`:""}합니다.`;
  }

  /* 구간 */
  const bandDecks=BANDS.map(([lo,hi])=>decks.filter(d=>d.rank>=lo&&d.rank<=hi));
  $("bands").innerHTML=`<thead><tr><th>사도</th><th>전체</th>${BANDS.map(([lo,hi],i)=>`<th>${lo}~${hi}위 <small>(${bandDecks[i].length}덱)</small></th>`).join("")}</tr></thead>
  <tbody>${stats.filter(s=>s.r>=0.05).map(s=>`<tr><td>${esc(s.n)}</td><td class="heat" style="--p:${s.r*100}">${pct(s.r,1)}</td>${bandDecks.map(bd=>{
      if(!bd.length) return `<td class="na">미조사</td>`;
      const r=bd.filter(d=>d.members.includes(s.n)).length/bd.length;
      return `<td class="heat" style="--p:${r*100}">${pct(r,1)}</td>`;
    }).join("")}</tr>`).join("")}</tbody>`;

  /* 공명 성격 선택 */
  const resoBases=uniq(decks.flatMap(d=>d.raw.filter(m=>RESO.test(m)).map(baseName)));
  if(resoBases.length){
    $("s-reso").hidden=false;
    const rows=[];
    resoBases.forEach(b=>{
      const vs=uniq(decks.flatMap(d=>d.raw.filter(m=>baseName(m)===b&&RESO.test(m))));
      const vr=v=>decks.filter(d=>d.raw.includes(v)).length;
      vs.sort((x,y)=>vr(y)-vr(x)).forEach((v,i)=>{
        const p=v.match(RESO)[1];
        rows.push(`<tr><td>${i===0?`<b>${esc(b)}</b>`:""}</td><td><span class="chip" style="--c:var(--${ATTRS.includes(p)?p:"미분류"})">${esc(p)}</span></td><td class="heat" style="--p:${vr(v)/N*100}">${pct(vr(v)/N,1)}</td>${bandDecks.map(bd=>{
          if(!bd.length) return `<td class="na">미조사</td>`;
          const r=bd.filter(d=>d.raw.includes(v)).length/bd.length; return `<td class="heat" style="--p:${r*100}">${pct(r,1)}</td>`;
        }).join("")}</tr>`);
      });
    });
    $("reso").innerHTML=`<thead><tr><th>사도</th><th>고른 성격</th><th>전체</th>${BANDS.map(([lo,hi],i)=>`<th>${lo}~${hi}위 <small>(${bandDecks[i].length}덱)</small></th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody>`;
  }

  /* 노트: 시즌별 평가(notes.csv)가 있으면 그것을, 없으면 사도 목록 코멘트 */
  if(seasonNotes.length){
    $("s-notes").hidden=false;
    $("notesH").textContent="사도별 평가";
    $("notesLead").textContent="이번 시즌 채용 데이터와 전투 메커니즘 DB(스킬 판정표)의 효과와 대조한 평가입니다. 추정이 들어간 문장은 '~로 보인다'로 적었습니다.";
    const list=seasonNotes.map(r=>({n:r["사도명"],t:r["평가"],r:rateOf[r["사도명"]]||0})).sort((a,b)=>b.r-a.r);
    $("notes").innerHTML=list.map(s=>`<article class="note" style="--c:${col(s.n)}"><h3>${esc(s.n)}</h3>
      <div class="meta">${esc(ATTR[s.n]||"미분류")} / ${tierOf(s.r).name} / 채용률 ${pct(s.r,1)}</div><p>${numB(s.t)}</p></article>`).join("");
  }else{
    const noted=stats.filter(s=>COMMENT[s.n]);
    if(noted.length){
      $("s-notes").hidden=false;
      $("notes").innerHTML=noted.map(s=>`<article class="note" style="--c:${col(s.n)}"><h3>${esc(s.n)}</h3>
        <div class="meta">${esc(ATTR[s.n]||"미분류")} / ${tierOf(s.r).name} / 채용률 ${pct(s.r,1)}</div><p>${esc(COMMENT[s.n])}</p></article>`).join("");
    }
  }

  $("stackLead").textContent=`편성 칸(덱 수 × ${slotKeys.length}) 중 각 성격이 차지한 비율입니다. 공명 사도는 고른 성격으로 셌습니다. 순위 범위를 바꾸면 원 그래프·열별 도넛·칸 합계가 같이 움직입니다.`;
  if(cur) document.title=`${cur["표시이름"]||cur["시즌ID"]} — ${CFG.titleSuffix||"트릭컬 리바이브 PvE 상위권 덱 리포트"}`;

  /* 조사 방법 & 데이터 점검 */
  const infoRows=[["조사일",INFO["조사일"]],["시즌/콘텐츠",INFO["시즌/콘텐츠명"]],["시즌",INFO["시즌"],1],["보스 성격",((cur&&cur["적 성격"])||INFO["적 성격"]||"")],["게임 버전",INFO["게임 버전"],1],["조사 범위",ranks.length?`${Math.min(...ranks)}~${Math.max(...ranks)}위 (${N}덱 · ${INFO["순위 구간"]||"상위 1% 미만"})`:""],["기록 기준","유저별 최고 단계 덱 1개"],["조사자",INFO["조사자"]]];
  $("info").innerHTML=infoRows.filter(([k,v,opt])=>!opt||v).map(([k,v])=>`<dt>${k}</dt><dd>${esc(v||"—")}</dd>`).join("");

  const checks=[];
  const short=decks.filter(d=>d.members.length<slotKeys.length);
  const dup=decks.filter(d=>new Set(d.members).size!==d.members.length);
  const unknown={}; decks.forEach(d=>d.raw.forEach(m=>{ if(!(m in ATTR)) (unknown[m]=unknown[m]||[]).push(d.rank); }));
  const rc={}; ranks.forEach(r=>rc[r]=(rc[r]||0)+1); const dupRank=Object.keys(rc).filter(r=>rc[r]>1);
  const line=(ok,okText,badText)=>checks.push(ok?`<li class="ok">✓ ${okText}</li>`:`<li class="warn">! ${badText}</li>`);
  line(!short.length,`모든 덱 ${slotKeys.length}명 편성 확인`,`빈칸 있는 덱: ${short.map(d=>d.rank+"위").join(", ")}`);
  line(!dup.length,"덱 내 사도 중복 없음",`사도 중복 덱: ${dup.map(d=>d.rank+"위").join(", ")}`);
  line(!dupRank.length,"순위 중복 없음",`중복 순위: ${dupRank.join(", ")}`);
  line(!Object.keys(unknown).length,"모든 사도 이름이 사도 목록과 일치",
    "사도 목록에 없는 이름: "+Object.entries(unknown).map(([n,r])=>`'${esc(n)}' (${r.join(", ")}위)`).join(", "));
  $("checks").innerHTML=`<li><b>데이터 점검</b> (페이지가 자동 검사)</li>`+checks.join("");
}
main();
