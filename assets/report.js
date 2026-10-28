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
  { name:"필수",  min:0.90, color:"#2F6B22" },
  { name:"1티어", min:0.60, color:"#4E9A3A" },
  { name:"2티어", min:0.30, color:"#78AE63" },
  { name:"3티어", min:0.10, color:"#9DBF8E" },
  { name:"비주류", min:0,   color:"#9AA39A" },
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

async function main(){
  let decksRaw, sado, info, seasons=[], cur=null, prev=null, prevRaw=null, seasonNotes=[];
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
      let contents=[];
      try{ contents=(await load("data/contents.csv")).map(r=>r["콘텐츠"]).filter(Boolean); }catch(_){}
      seasons.forEach(r=>{ if(r["콘텐츠"]&&!contents.includes(r["콘텐츠"])) contents.push(r["콘텐츠"]); });
      const nav=$("gnb"); nav.hidden=false;
      $("gnbIn").innerHTML=`<a class="brand" href="${CFG.brandHref}">${esc(CFG.brand)}</a>`+contents.map(c=>{
        const list=seasons.filter(r=>r["콘텐츠"]===c).slice().reverse();
        const items=list.length?list.map(r=>`<li><a href="?s=${encodeURIComponent(r["시즌ID"])}"${r===cur?' aria-current="page"':''}>${esc(r["표시이름"]||r["시즌ID"])}${r["조사일"]?`<small>조사일 ${esc(r["조사일"])}</small>`:""}</a></li>`).join("")
          :`<li class="empty">아직 기록 없음 — 시즌 종료 후 추가 예정</li>`;
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
  const tags=[INFO["조사일"]&&("조사일 "+INFO["조사일"]), INFO["시즌/콘텐츠명"], ...uniq(decks.map(d=>d.stage)).filter(Boolean).map(s=>/단계$/.test(s)?s:s+"단계"), ...uniq(decks.map(d=>d.boss)), ranks.length&&(`${Math.min(...ranks)}~${Math.max(...ranks)}위 ${N}덱`)].filter(Boolean);
  $("tags").innerHTML=tags.map(t=>`<span class="tag">${esc(t)}</span>`).join("");

  /* 요약 */
  const sum=$("summary");
  if(INFO["한줄요약"]) sum.textContent=INFO["한줄요약"];
  else { sum.classList.add("auto"); sum.textContent=`필수 ${must}명이 고정되고, 상위 ${N}덱 중 ${stdCount}덱(${pct(stdCount/N)})이 같은 ${slotKeys.length}명으로 편성됐습니다.`; }

  /* 보드 */
  const board=$("board"); board.hidden=false;
  /* 계산기 링크: 표준 덱과 같은 9명인 덱 중 가장 많은 실제 기록(공명 성격 포함) */
  const rc2={}; decks.filter(d=>key(d)===stdKey).forEach(d=>{ const k=d.raw.join(","); rc2[k]=(rc2[k]||0)+1; });
  const stdRaw=(Object.entries(rc2).sort((a,b)=>b[1]-a[1])[0]||[std.join(",")])[0];
  const calcHref=`calculator.html?deck=${encodeURIComponent(stdRaw)}${cur?`&s=${encodeURIComponent(cur["시즌ID"])}`:""}`;
  board.innerHTML=`<div class="board-head"><b>표준 덱</b><span>${N}덱 중 ${stdCount}덱이 이 ${slotKeys.length}명 그대로 편성, 칸의 숫자는 채용률 · <a href="${calcHref}">덱 계산기로 열기 →</a></span></div>
  <div class="slots">${std.map(n=>`<div class="slot" style="--c:${col(n)}"><i class="hex" aria-hidden="true"></i>
    <div class="pct">${pct(rateOf[n])}</div><div class="nm">${esc(n)}</div>
    <div class="meter"><i style="width:${rateOf[n]*100}%"></i></div></div>`).join("")}</div>`;

  /* 이전 시즌 비교 */
  if(prevRaw&&prevRaw.length){
    const pk=Object.keys(prevRaw[0]).filter(k=>/^사도\s*\d+$/.test(k));
    const pd=prevRaw.map(r=>pk.map(k=>r[k]).filter(Boolean)).filter(m=>m.length);
    const pc={}; pd.forEach(m=>new Set(m).forEach(x=>pc[x]=(pc[x]||0)+1));
    const names=[...new Set([...Object.keys(pc),...Object.keys(cnt)])];
    const rows=names.map(n=>({n,a:(pc[n]||0)/pd.length,b:rateOf[n]||0})).map(o=>({...o,d:o.b-o.a}))
      .filter(o=>Math.abs(o.d)>=0.05).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)).slice(0,15);
    $("s-compare").hidden=false;
    $("cmpLead").textContent=CFG.compare==="kr"
      ?`한국 서버 ${prev["표시이름"]||prev["시즌ID"]} (${pd.length}덱) → 글로벌 서버 ${cur["표시이름"]||cur["시즌ID"]} (${N}덱). 같은 콘텐츠에서 채용률이 5%p 이상 다른 사도를 차이 폭 순으로 보여줍니다. 출시 순서·보유 사도 차이가 드러나는 지점입니다.`
      :`${prev["표시이름"]||prev["시즌ID"]} (${pd.length}덱) → ${cur["표시이름"]||cur["시즌ID"]} (${N}덱). 채용률이 5%p 이상 바뀐 사도를 변화 폭 순으로 보여줍니다. 패치 노트에 없는 변화라면 확인이 필요한 지점입니다.`;
    $("cmp").innerHTML=`<thead><tr><th>사도</th><th>${CFG.compare==="kr"?"한국":"이전"}</th><th>${CFG.compare==="kr"?"글로벌":"이번"}</th><th>${CFG.compare==="kr"?"차이":"변화"}</th></tr></thead><tbody>`+
      (rows.length?rows.map(o=>`<tr><td>${chip(o.n)}</td><td>${pct(o.a)}</td><td>${pct(o.b)}</td><td class="${o.d>0?'up':'down'}">${o.d>0?'▲':'▼'} ${(Math.abs(o.d)*100).toFixed(0)}%p</td></tr>`).join("")
       :`<tr><td colspan="4">5%p 이상 바뀐 사도가 없습니다.</td></tr>`)+`</tbody>`;
  }

  /* 메타 코멘트 */
  if(INFO["메타 코멘트"]){ $("s-comment").hidden=false; $("metaComment").innerHTML=INFO["메타 코멘트"].split(/\n+/).filter(s=>s.trim()).map(s=>`<p>${numB(s.trim())}</p>`).join(""); }

  /* 티어 */
  $("tierLead").textContent="채용률 기준: "+TIERS.slice(0,-1).map(t=>`${t.name} ${pct(t.min)} 이상`).join(", ")+", 그 외 비주류.";
  $("tiers").innerHTML=TIERS.map(t=>{
    const list=stats.filter(s=>tierOf(s.r)===t);
    return `<div class="tier" style="--t:${t.color}"><div class="lab"><b>${t.name}</b><small>${list.length}명</small></div>
      <div class="chips">${list.length?list.map(s=>chip(s.n,` <em>${pct(s.r)}</em>`)).join(""):'<span class="empty">해당 없음</span>'}</div></div>`;
  }).join("");

  /* 막대 */
  $("bars").innerHTML=stats.map(s=>`<div class="bar" style="--c:${col(s.n)}"><span class="n">${esc(s.n)}</span>
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

  /* 성격 분포 */
  const ac={}; let tot=0;
  decks.forEach(d=>d.raw.forEach(m=>{ const a=ATTRS.includes(ATTR[m])?ATTR[m]:"미분류"; ac[a]=(ac[a]||0)+1; tot++; }));
  const aList=[...ATTRS,"미분류"].filter(a=>ac[a]);
  $("stack").innerHTML=aList.map(a=>`<i style="--c:var(--${a});flex:${ac[a]}" title="${a} ${pct(ac[a]/tot,1)}">${ac[a]/tot>=.08?pct(ac[a]/tot):""}</i>`).join("");
  const ENEMY=((cur&&cur["적 성격"])||INFO["적 성격"]||"").trim();
  const BEATS={"광기":"순수","순수":"냉정","냉정":"광기","활발":"우울","우울":"활발"};
  const good=ATTRS.filter(a=>BEATS[a]===ENEMY);
  const bad=ATTRS.filter(a=>BEATS[ENEMY]===a&&!["활발","우울"].includes(a));
  const mark=a=>good.includes(a)?' <b>유리</b>':bad.includes(a)?' <b class="bad">불리</b>':'';
  $("stackLegend").innerHTML=aList.map(a=>`<span style="--c:var(--${a})">${a} ${pct(ac[a]/tot,1)}${mark(a)}</span>`).join("");
  if(ENEMY){
    const ml=$("matchLead"); ml.hidden=false;
    ml.textContent=ENEMY==="성격 없음"
      ?"이번 보스는 성격이 없어 상성 영향이 없습니다. 이 시즌의 성격 분포는 상성과 무관한 선택입니다."
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
    $("notesLead").textContent="이번 시즌 채용 데이터와 전투 메커니즘 DB(스킬 판정표)의 효과를 맞춰 본 평가입니다. 해석이 들어간 부분은 '~로 보인다'로 구분했습니다.";
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

  $("stackLead").textContent=`전체 편성 칸(덱 수 × ${slotKeys.length}) 중 각 성격이 차지한 비율입니다.`;
  if(cur) document.title=`${cur["표시이름"]||cur["시즌ID"]} — ${CFG.titleSuffix||"트릭컬 리바이브 PvE 상위권 덱 리포트"}`;

  /* 조사 방법 & 데이터 점검 */
  const infoRows=[["조사일",INFO["조사일"]],["시즌/콘텐츠",INFO["시즌/콘텐츠명"]],["보스 성격",((cur&&cur["적 성격"])||INFO["적 성격"]||"")],["게임 버전",INFO["게임 버전"]],["조사 범위",ranks.length?`${Math.min(...ranks)}~${Math.max(...ranks)}위 (${N}덱 · ${INFO["순위 구간"]||"상위 1% 미만"})`:""],["기록 기준","유저별 최고 단계 덱 1개"],["조사자",INFO["조사자"]]];
  $("info").innerHTML=infoRows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v||"—")}</dd>`).join("");

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
