/* ---------- โหมดกรรมการบนมือถือ: เลือกรายการ → บันทึกผลตามชนิดกีฬา → บันทึกแล้ว ----------
   โหลดต่อจาก games.js · เปิดด้วย #judge (แอปบนมือถือเริ่มที่หน้านี้)
   ชนิดการบันทึก (fmt): race แตะสีตามลำดับ · goals นับประตู+จุดโทษ · sets นับเซต · ends นับเอนด์ · judge คะแนนกรรมการ
   ช่องใหม่ใน events/<id>: fmt order[] half pk{สี:[1,0]} sets[{pts{สี:n},win}] setCfg{to,last,best,cap} ends[{c,p}] endCfg{to} */

const FMT={race:'ลำดับ',goals:'ประตู',sets:'เซต',ends:'เอนด์',judge:'กรรม การ'};
const FMT_STYLE={race:['#EAF1FB','#1F4E8C'],goals:['#E6F4EA','#1F7A4D'],sets:['#FDEFE3','#A5520F'],ends:['#EDE7F6','#5B2E91'],judge:['#FBF1DC','#8A5A00']};
const J={scr:'list',tab:'wait',cat:'all',ev:null,race:[],num:{},active:null,endC:null,endP:null,undo:null,hist:{}};
const colIds=()=>cfg().colors.map(c=>c.id);

function fmtOf(e){
  if(e.fmt)return e.fmt;
  const n=e.name||'';
  if(e.cat==='กองเชียร์'||e.cat==='ขบวนพาเหรด')return 'judge';
  if(e.cat==='กีฬาประเภททีม'){
    if(/วอลเลย์|ตะกร้อ/.test(n))return 'sets';
    if(/เปตอง/.test(n))return 'ends';
    return 'goals';
  }
  return 'race';
}
/** วอลเลย์บอล 2 ใน 3 เซต เซตละ 25 (เซต 3 = 15) · ตะกร้อ 2 ใน 3 เซต เซตละ 21 ไม่เกิน 25 */
function setCfg(e){return {...(/ตะกร้อ/.test(e.name||'')?{to:21,last:21,best:3,cap:25}:{to:25,last:15,best:3,cap:0}),...(e.setCfg||{})}}
function endCfg(e){return {to:13,...(e.endCfg||{})}}
function setsInfo(e){
  const c=setCfg(e),ids=colIds(),sets=e.sets||[],won=Object.fromEntries(ids.map(i=>[i,0]));
  sets.forEach(s=>{if(s.win&&won[s.win]!==undefined)won[s.win]++});
  const need=Math.ceil(c.best/2),champ=ids.find(i=>won[i]>=need)||'';
  const cur=sets.length&&!sets[sets.length-1].win?sets[sets.length-1]:null;
  return {cfg:c,sets,won,need,champ,cur};
}
function endsTotal(e){const t=Object.fromEntries(colIds().map(i=>[i,0]));(e.ends||[]).forEach(x=>{if(t[x.c]!==undefined)t[x.c]+=+x.p||0});return t}
/** +1/−1 แต้มในเซตปัจจุบัน ปิดเซตเมื่อถึงแต้มและนำ 2 · ครบเซตที่ต้องชนะแล้วจบแมตช์ · คืน false ถ้าไม่มีอะไรเปลี่ยน */
function applySetPoint(x,c,d){
  const inf=setsInfo(x);if(inf.champ)return false;
  x.sets=(x.sets||[]).map(s=>({pts:{...s.pts},win:s.win||''}));
  let s=x.sets[x.sets.length-1];
  if(!s||s.win){if(d<0)return false;s={pts:{},win:''};x.sets.push(s)}
  s.pts[c]=Math.max(0,(s.pts[c]||0)+d);
  const idx=x.sets.length-1,target=idx===inf.cfg.best-1?inf.cfg.last:inf.cfg.to;
  const a=s.pts[c],b=Math.max(0,...colIds().filter(i=>i!==c).map(i=>s.pts[i]||0));
  if(d>0&&a>=target&&(a-b>=2||(inf.cfg.cap&&a>=inf.cfg.cap))){s.win=c;toast(`${teamName(c)}ชนะเซตที่ ${idx+1}`)}
  x.status='live';x.g=x.s=x.b='';
  const ni=setsInfo(x);if(ni.champ)setWinner(x,ni.champ,i=>ni.won[i]);
}
const pkSum=(e,c)=>((e.pk||{})[c]||[]).reduce((a,b)=>a+b,0);
/** ผู้ชนะแมตช์ได้ที่ 1 ที่เหลือเรียงตามคะแนน */
function setWinner(e,w,metric){
  const rest=colIds().filter(i=>i!==w).sort((a,b)=>(metric?metric(b)-metric(a):0));
  e.g=w;e.s=rest[0]||'';e.b=hasBronze()?rest[1]||'':'';e.status='done';e.at=Date.now();
}
/** ตัวเลขใหญ่ของแต่ละสีบนจอแมตช์ + ข้อความประกอบ */
function matchDisplay(e){
  const f=fmtOf(e),ids=colIds(),big={};let sub='';
  if(f==='sets'){
    const inf=setsInfo(e),show=inf.cur||inf.sets[inf.sets.length-1];
    ids.forEach(i=>big[i]=show?(show.pts[i]||0):0);
    sub=inf.sets.length?`เซตที่ ${inf.cur?inf.sets.length:inf.sets.length} · นับเซต ${ids.map(i=>inf.won[i]).join(' – ')}`:'ยังไม่เริ่มเซตแรก';
  }else if(f==='ends'){
    const t=endsTotal(e);ids.forEach(i=>big[i]=t[i]);sub=`${(e.ends||[]).length} เอนด์ · ถึง ${endCfg(e).to} แต้มชนะ`;
  }else{
    const sc=e.score||{};ids.forEach(i=>big[i]=sc[i]||'0');
    if(e.pk&&ids.some(i=>(e.pk[i]||[]).length))sub='จุดโทษ '+ids.map(i=>pkSum(e,i)).join(' – ');
    else if(e.half==='2')sub='ครึ่งหลัง';else if(e.half==='1')sub='ครึ่งแรก';
  }
  return {big,sub};
}

/* ---------- ส่วนประกอบ ---------- */
function jdHead(title,meta,{back=true,right=''}={}){
  return `<header class="jd-h">${back?'<button class="jd-back" data-act="jd-list" aria-label="กลับไปรายการ">‹</button>':''}<div class="jd-ht"><b>${esc(title)}</b>${meta?`<span>${meta}</span>`:''}</div>${right}</header>`;
}
const teamName=id=>(colorById(id)||{}).name||'';
const pillScore=()=>standings().map(r=>esc(r.name.replace(/^สี/,''))+' '+r.pts).join(' · ');
function jdEvents(){return Object.entries(S.events).map(([id,e])=>({id,...e})).sort((a,b)=>(a.order||0)-(b.order||0))}
function nextWaiting(afterId){
  const l=jdEvents(),i=l.findIndex(e=>e.id===afterId);
  return l.slice(i+1).concat(l.slice(0,Math.max(0,i))).find(e=>!e.g&&e.status!=='live')||null;
}

/* ---------- A1 เลือกรายการ ---------- */
function jdList(){
  const all=jdEvents();
  const live=all.filter(e=>e.status==='live'),wait=all.filter(e=>!e.g&&e.status!=='live'),done=all.filter(e=>e.g&&e.status!=='live');
  const pool={wait:[...live,...wait],live,done}[J.tab];
  const cats=CATS.filter(c=>pool.some(e=>(e.cat||'อื่น ๆ')===c));
  const list=pool.filter(e=>J.cat==='all'||(e.cat||'อื่น ๆ')===J.cat);
  const card=e=>{
    const f=fmtOf(e),[bg,fg]=FMT_STYLE[f],isLive=e.status==='live';
    const res=e.g?` · ${esc(teamName(e.g))}ชนะ${scoreText(e)?' '+esc(scoreText(e)):''}`:isLive&&scoreText(e)?' · '+esc(scoreText(e)):'';
    return `<button class="jd-card${isLive?' live':''}" data-act="jd-open" data-ev="${e.id}">
      <span class="jd-ic" style="background:${isLive?'#FDE7E4':bg};color:${isLive?'#B42318':fg}">${isLive?'สด':FMT[f]}</span>
      <span class="jd-ct"><b>${esc(e.name)}</b><span>${esc(e.cat||'')} · ${esc(e.level||'ทุกระดับ')}${res}</span></span>
      <span class="jd-go" aria-hidden="true">›</span></button>`;
  };
  const n=all.length,d=done.length;
  return `<div class="jd">
  <header class="jd-h jd-top">
    <div class="jd-ht"><span class="jd-eyebrow">โหมดกรรมการ · ${esc(S.user.name)}</span><h1>บันทึกผล</h1></div>
    <div class="jd-topr"><span class="jd-pill num">${pillScore()}</span><button class="jd-x" data-act="close-ov" aria-label="ออกจากโหมดกรรมการ">✕</button></div>
  </header>
  <div class="jd-body">
    ${installHTML()}
    <div class="jd-seg" role="tablist">
      <button data-act="jd-tab" data-tab="wait" aria-pressed="${J.tab==='wait'}">รอแข่ง ${wait.length}</button>
      <button data-act="jd-tab" data-tab="live" aria-pressed="${J.tab==='live'}">กำลังแข่ง ${live.length}</button>
      <button data-act="jd-tab" data-tab="done" aria-pressed="${J.tab==='done'}">มีผลแล้ว ${d}</button>
    </div>
    ${cats.length>1?`<div class="jd-chips"><button data-act="jd-cat" data-cat="all" aria-pressed="${J.cat==='all'}">ทั้งหมด</button>${cats.map(c=>`<button data-act="jd-cat" data-cat="${esc(c)}" aria-pressed="${J.cat===c}">${esc(c)}</button>`).join('')}</div>`:''}
    <div class="jd-list">${list.map(card).join('')||`<p class="empty">${J.tab==='done'?'ยังไม่มีรายการที่มีผล':J.tab==='live'?'ไม่มีรายการที่กำลังแข่ง':'บันทึกผลครบทุกรายการแล้ว'}</p>`}</div>
  </div>
  <div class="jd-foot">
    <div class="jd-prog num"><span>แข่งแล้ว ${d} จาก ${n} รายการ</span><span>${n?Math.round(d/n*100):0}%</span></div>
    <div class="jd-bar"><i style="width:${n?d/n*100:0}%"></i></div>
  </div></div>`;
}

/* ---------- A2 แตะสีตามลำดับ (กรีฑา กีฬาพื้นบ้าน) ---------- */
function jdRace(e){
  const cols=cfg().colors,keys=medalKeys(),P=cfg().points||{};
  const slots=keys.map((k,i)=>{const c=colorById(J.race[i]);return `<div class="jd-slot${c?' on':''}"><small>ที่ ${i+1} · ${rankText(k)}</small><span style="${c?`background:${esc(c.hex)};color:${ink(c.hex)}`:''}">${c?esc(c.name):'—'}</span><em class="num">+${P[k]||0} คะแนน</em></div>`}).join('');
  const taps=cols.map(c=>{const i=J.race.indexOf(c.id);return `<button class="jd-tap${i>=0?' used':''}" data-act="jd-tap" data-c="${c.id}" style="background:${esc(c.hex)};color:${ink(c.hex)}">${shirt(c.hex,i>=0?i+1:'')}${esc(c.name)}<small>${i>=0?'ที่ '+(i+1):'แตะเมื่อเข้าเส้นชัย'}</small></button>`}).join('');
  const ready=J.race.length>=Math.min(cols.length,keys.length);
  return `<div class="jd">${jdHead(e.name,esc((e.cat||'')+' · '+(e.level||'ทุกระดับ')))}
  <div class="jd-body">
    <div class="jd-lead">แตะสีตามลำดับที่เข้าเส้นชัย</div>
    <div class="jd-slots" style="--n:${keys.length}">${slots}</div>
    <div class="jd-taps">${taps}</div>
    ${cols.length===2?'<p class="hint" style="text-align:center">มี 2 สี แตะสีที่ชนะครั้งเดียว ระบบใส่ที่ 2 ให้เอง</p>':''}
  </div>
  <div class="jd-foot jd-row2">
    <button class="jd-btn" data-act="jd-race-reset">เริ่มใหม่</button>
    <button class="jd-btn main" data-act="jd-race-save"${ready?'':' disabled'}>บันทึกผล</button>
  </div></div>`;
}

/* ---------- A3.1 นับประตู + จุดโทษ ---------- */
function jdGoals(e){
  const cols=cfg().colors,sc=e.score||{},half=e.half||'1';
  const seg=`<div class="jd-seg">${[['1','ครึ่งแรก'],['2','ครึ่งหลัง'],['pk','จุดโทษ']].map(([k,l])=>`<button data-act="jd-half" data-h="${k}" aria-pressed="${half===k}">${l}</button>`).join('')}</div>`;
  let body;
  if(half==='pk'){
    body=`<div class="jd-sum">${cols.map(c=>`<div><span>${esc(c.name)}</span><b class="num">${esc(sc[c.id]||'0')}</b></div>`).join('<em>เวลาปกติ</em>')}</div>
    <div class="jd-pkbox"><div class="jd-pkh"><b>ยิงจุดโทษ</b><b class="num">${cols.map(c=>pkSum(e,c.id)).join(' – ')}</b></div>
    ${cols.map(c=>{const k=(e.pk||{})[c.id]||[];return `<div class="jd-pkrow"><div class="jd-dots"><span class="jd-tname"><i style="background:${esc(c.hex)}"></i>${esc(c.name.replace(/^สี/,''))}</span>${k.map(h=>`<span class="${h?'hit':'miss'}">${h?'✓':'✗'}</span>`).join('')}${Array.from({length:Math.max(0,5-k.length)},()=>'<span></span>').join('')}</div>
      <div class="jd-2"><button class="jd-ok" data-act="jd-pk" data-c="${c.id}" data-hit="1">เข้า ✓</button><button class="jd-no" data-act="jd-pk" data-c="${c.id}" data-hit="0">พลาด ✗</button></div></div>`}).join('')}</div>`;
  }else{
    body=`<div class="jd-teams">${cols.map(c=>`<div class="jd-team">
      <button class="jd-minus" data-act="jd-goal" data-c="${c.id}" data-d="-1" aria-label="ลดประตู${esc(c.name)}">−</button>
      <div class="jd-mid"><span class="jd-tname"><i style="background:${esc(c.hex)}"></i>${esc(c.name)}</span><span class="jd-big num">${esc(sc[c.id]||'0')}</span></div>
      <button class="jd-plus" data-act="jd-goal" data-c="${c.id}" data-d="1" style="background:${esc(c.hex)};color:${ink(c.hex)}" aria-label="เพิ่มประตู${esc(c.name)}">+<small>ประตู</small></button></div>`).join('')}</div>`;
  }
  return `<div class="jd dark">${jdHead(e.name,esc(e.level||'ทุกระดับ')+' · นับประตู · เสมอยิงจุดโทษ',{right:e.status==='live'?'<span class="jd-live">● สด</span>':''})}
  <div class="jd-body">${seg}${body}${undoNote(e)}</div>
  <div class="jd-foot"><button class="jd-btn gold" data-act="jd-goals-end">จบการแข่งขัน · บันทึกผล</button></div></div>`;
}

/* ---------- A3.2 นับเซต (วอลเลย์บอล ตะกร้อ) ---------- */
function jdSets(e){
  const cols=cfg().colors,inf=setsInfo(e),c=inf.cfg;
  const show=inf.cur||{pts:{}};
  const chips=Array.from({length:c.best},(_,i)=>{const s=inf.sets[i];const cur=inf.cur&&i===inf.sets.length-1;return `<div class="${cur?'cur':''}"><small>เซต ${i+1}${s&&s.win?' · '+esc(teamName(s.win).replace(/^สี/,''))+'ชนะ':cur?' · กำลังแข่ง':''}</small><b class="num">${s?cols.map(x=>s.pts[x.id]||0).join('–'):'–'}</b></div>`}).join('');
  const done=!!inf.champ;
  return `<div class="jd dark">${jdHead(e.name,`${c.best===3?'2 ใน 3 เซต':'ชนะ '+inf.need+' เซต'} · เซตละ ${c.to}${c.last!==c.to?` (เซตสุดท้าย ${c.last})`:''} · นำ 2 แต้ม`,{right:e.status==='live'?'<span class="jd-live">● สด</span>':''})}
  <div class="jd-body">
    <div class="jd-setchips" style="--n:${c.best}">${chips}</div>
    <div class="jd-lead num">นับเซต · ${cols.map(x=>esc(x.name.replace(/^สี/,''))+' '+inf.won[x.id]).join(' – ')}</div>
    ${done?`<div class="jd-banner">${esc(teamName(inf.champ))}ชนะ ${cols.map(x=>inf.won[x.id]).join('–')} เซต</div>`:`<div class="jd-teams">${cols.map(x=>`<div class="jd-team">
      <button class="jd-minus" data-act="jd-set" data-c="${x.id}" data-d="-1" aria-label="ลดแต้ม${esc(x.name)}">−</button>
      <div class="jd-mid"><span class="jd-tname"><i style="background:${esc(x.hex)}"></i>${esc(x.name)}</span><span class="jd-big num">${show.pts[x.id]||0}</span></div>
      <button class="jd-plus" data-act="jd-set" data-c="${x.id}" data-d="1" style="background:${esc(x.hex)};color:${ink(x.hex)}" aria-label="เพิ่มแต้ม${esc(x.name)}">+1<small>ได้แต้ม</small></button></div>`).join('')}</div>`}
    <p class="jd-note">ถึง ${c.to} แต้มและนำ 2 แต้ม ระบบปิดเซตให้เอง${c.cap?` (ไม่เกิน ${c.cap})`:''} · ชนะ ${inf.need} เซตจบแมตช์</p>
    ${undoNote(e)}
  </div>
  <div class="jd-foot jd-row2">
    <button class="jd-btn" data-act="jd-step-undo"${(J.hist[e.id]||[]).length?'':' disabled'}>ย้อนแต้ม</button>
    <button class="jd-btn${done?' gold':''}" data-act="jd-sets-end">${done?'ดูผลที่บันทึก':'จบแมตช์ก่อนกำหนด'}</button>
  </div></div>`;
}

/* ---------- A3.3 นับเอนด์ (เปตอง) ---------- */
function jdEnds(e){
  const cols=cfg().colors,t=endsTotal(e),to=endCfg(e).to,ends=e.ends||[],done=!!e.g&&e.status!=='live';
  return `<div class="jd dark">${jdHead(e.name,`นับเอนด์ · ใครถึง ${to} แต้มก่อนชนะ`,{right:e.status==='live'?'<span class="jd-live">● สด</span>':''})}
  <div class="jd-body">
    ${cols.map(c=>`<div class="jd-endbar"><span class="jd-tname"><i style="background:${esc(c.hex)}"></i>${esc(c.name.replace(/^สี/,''))}</span><div class="t"><i style="width:${Math.min(100,t[c.id]/to*100)}%;background:${esc(c.hex)}"></i></div><b class="num">${t[c.id]}</b></div>`).join('')}
    ${done?`<div class="jd-banner">${esc(teamName(e.g))}ชนะ ${cols.map(c=>t[c.id]).join(' : ')}</div>`:`<div class="jd-pkbox">
      <b>เอนด์ที่ ${ends.length+1} · ใครได้แต้ม?</b>
      <div class="jd-2">${cols.map(c=>`<button class="jd-cbtn ${J.endC===c.id?'on':J.endC?'off':''}" data-act="jd-end-c" data-c="${c.id}" style="background:${esc(c.hex)};color:${ink(c.hex)}">${esc(c.name)}${J.endC===c.id?' ✓':''}</button>`).join('')}</div>
      <span class="jd-note" style="text-align:left">ได้กี่แต้ม (จำนวนลูกที่ใกล้เป้ากว่า)</span>
      <div class="jd-nums">${[1,2,3,4,5,6].map(p=>`<button data-act="jd-end-p" data-p="${p}" aria-pressed="${J.endP===p}">${p}</button>`).join('')}</div>
    </div>`}
    ${ends.length?`<div class="jd-hist">${ends.map((x,i)=>{const c=colorById(x.c)||{hex:'#999',name:''};return `<span><i style="background:${esc(c.hex)}"></i>เอนด์ ${i+1} · ${esc(c.name.replace(/^สี/,''))} +${x.p}</span>`}).join('')}</div>`:''}
  </div>
  <div class="jd-foot jd-row2">
    <button class="jd-btn" data-act="jd-step-undo"${(J.hist[e.id]||[]).length?'':' disabled'}>ย้อนเอนด์</button>
    ${done?'<button class="jd-btn gold" data-act="jd-show-done">ดูผลที่บันทึก</button>':`<button class="jd-btn gold" data-act="jd-end-add"${J.endC&&J.endP?'':' disabled'}>บันทึกเอนด์ที่ ${ends.length+1}${J.endP?' · +'+J.endP:''}</button>`}
  </div></div>`;
}

/* ---------- A4 คะแนนกรรมการ (กองเชียร์ ขบวนพาเหรด) ---------- */
function jdJudge(e){
  const cols=cfg().colors;
  const vals=cols.map(c=>`<button class="jd-val${J.active===c.id?' on':''}" data-act="jd-active" data-c="${c.id}" style="--pc:${esc(c.hex)}"><span class="jd-tname" style="font-size:16px"><i style="background:${esc(c.hex)};box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)"></i>${esc(c.name)}</span><b class="num">${esc(J.num[c.id]||'–')}${J.active===c.id?'<span class="jd-caret">|</span>':''}</b><small>${J.active===c.id?'กำลังกรอก':J.num[c.id]?'กรอกแล้ว':'แตะเพื่อกรอก'}</small></button>`).join('');
  const tmp={...e,score:{...J.num},scoring:'high'},r=autoRank(tmp);
  const pre=r&&!r.tie?`ผลเบื้องต้น: <b>${esc(teamName(r.g))} ชนะเลิศ</b> (${cols.map(c=>J.num[c.id]).join(' ต่อ ')})`:r&&r.tie?'คะแนนอันดับต้นเท่ากัน ต้องตัดสินใหม่':'กรอกให้ครบทุกสี';
  const keys=['1','2','3','4','5','6','7','8','9'].map(k=>`<button data-act="jd-key" data-k="${k}">${k}</button>`).join('')+'<button class="fn" data-act="jd-key" data-k="del">ลบ</button><button data-act="jd-key" data-k="0">0</button><button class="nx" data-act="jd-key" data-k="next">สีถัดไป</button>';
  return `<div class="jd">${jdHead(e.name,'คะแนนกรรมการ · คะแนนมากชนะ')}
  <div class="jd-body"><div class="jd-vals">${vals}</div><div class="jd-pre">${pre}</div></div>
  <div class="jd-keys">${keys}</div>
  <div class="jd-foot"><button class="jd-btn main" data-act="jd-judge-save"${r&&!r.tie?'':' disabled'}>บันทึกผล</button></div></div>`;
}

/* ---------- A5 บันทึกแล้ว ---------- */
function jdDone(e){
  const P=cfg().points||{},nx=nextWaiting(e.id),canUndo=J.undo&&J.undo.id===e.id&&Date.now()<J.undo.until;
  const rows=medalKeys().filter(k=>e[k]).map(k=>`<div><em>${rankText(k)}</em>${tag(colorById(e[k]))}<strong class="num">+${P[k]||0}</strong></div>`).join('');
  return `<div class="jd"><div class="jd-done">
    <div class="jd-check"><svg width="52" height="52" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 L10 17.5 L19 7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h1>บันทึกผลแล้ว</h1>
    <p class="hint" style="font-size:16px">${esc(e.name)} · ${esc(e.level||'ทุกระดับ')}${scoreText(e)?' · '+esc(scoreText(e)):''}</p>
    <div class="jd-res">${rows}</div>
    <div class="jd-tot">${standings().map(r=>`<span><small>${esc(r.name)}</small><b class="num">${r.pts}</b></span>`).join('<small>คะแนนรวม</small>')}</div>
    ${canUndo?'<button class="jd-link" data-act="jd-undo" style="color:#8C1B20;text-decoration:underline">กดผิด? ย้อนกลับผลนี้</button>':'<p class="hint">แก้ภายหลังได้ที่แท็บ “มีผลแล้ว”</p>'}
  </div>
  <div class="jd-foot">
    ${nx?`<span class="hint">รายการถัดไป</span><button class="jd-next" data-act="jd-open" data-ev="${nx.id}"><span>${esc(nx.name)} · ${esc(nx.level||'')}</span><span aria-hidden="true">›</span></button>`:'<p class="hint" style="text-align:center">บันทึกผลครบทุกรายการแล้ว</p>'}
    <button class="jd-link" data-act="jd-list">กลับไปรายการทั้งหมด</button>
  </div></div>`;
}
function undoNote(e){
  const h=J.hist[e.id]||[];
  return h.length?`<p class="jd-note">แก้ไขล่าสุดบันทึกแล้ว · <button data-act="jd-step-undo">ย้อนกลับ 1 ขั้น</button></p>`:'';
}

function vJudge(){
  if(!S.user)return `<div class="ov ov-judge" role="dialog" aria-label="โหมดกรรมการ"><div class="jd"><header class="jd-h jd-top"><div class="jd-ht"><span class="jd-eyebrow">${esc(cfg().eventName||'กีฬาสีภายใน')}</span><h1>โหมดกรรมการ</h1></div><div class="jd-topr"><button class="jd-x" data-act="close-ov" aria-label="ปิด">✕</button></div></header><div class="jd-body">${installHTML()}${vLogin().replace('data-act="login-close"','data-act="close-ov"')}</div></div></div>`;
  const e=J.ev&&S.events[J.ev]?{id:J.ev,...S.events[J.ev]}:null;
  let html;
  if(!e||J.scr==='list')html=jdList();
  else if(J.scr==='done')html=jdDone(e);
  else html={race:jdRace,goals:jdGoals,sets:jdSets,ends:jdEnds,judge:jdJudge}[fmtOf(e)](e);
  return `<div class="ov ov-judge" role="dialog" aria-label="โหมดกรรมการ">${html}</div>`;
}

/* ---------- บันทึก ---------- */
async function jdMutate(fn){
  const id=J.ev,cur=S.events[id];if(!cur)return;
  const prev=clone(cur),e=clone(cur);
  if(fn(e)===false)return;
  (J.hist[id]=J.hist[id]||[]).push(prev);if(J.hist[id].length>80)J.hist[id].shift();
  const ok=await put('events/'+id,e);
  if(!ok){J.hist[id].pop();return}
  if(e.status==='done'&&prev.status!=='done'){J.undo={id,prev,until:Date.now()+15000};J.scr='done';render()}
}
function jdOpen(id){
  const e=S.events[id];if(!e)return;
  J.ev=id;J.scr='event';
  J.race=e.order&&e.order.length?[...e.order]:medalKeys().map(k=>e[k]).filter(Boolean);
  J.num={};cfg().colors.forEach(c=>{if(e.score&&e.score[c.id]!==undefined&&e.score[c.id]!=='')J.num[c.id]=String(e.score[c.id])});
  J.active=cfg().colors[0]?cfg().colors[0].id:null;J.endC=null;J.endP=null;
  render();const o=$('#ov');if(o)o.scrollTop=0;
}

/* ---------- ติดตั้งแอปบนมือถือ (PWA) ---------- */
let installEvt=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installEvt=ev;render()});
window.addEventListener('appinstalled',()=>{installEvt=null;toast('ติดตั้งแอปแล้ว เปิดจากไอคอนช้างเผือกบนหน้าจอได้เลย');render()});
function installHTML(){
  if(isStandalone())return '';
  if(installEvt)return '<div class="jd-inst"><span>ใช้เป็นแอปบนมือถือ เปิดเร็ว เต็มจอ</span><button class="btn sm" data-act="jd-install">ติดตั้งแอป</button></div>';
  if(/iPhone|iPad|iPod/.test(navigator.userAgent))return '<div class="jd-inst"><span>ติดตั้งเป็นแอป: แตะ <b>แชร์</b> แล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b></span></div>';
  if(/Android/.test(navigator.userAgent))return '<div class="jd-inst"><span>ติดตั้งเป็นแอป: แตะเมนู <b>⋮</b> แล้วเลือก <b>ติดตั้งแอป</b> หรือ <b>เพิ่มลงในหน้าจอหลัก</b></span></div>';
  return '';
}
if('serviceWorker' in navigator&&document.body.dataset.sw){
  window.addEventListener('load',()=>navigator.serviceWorker.register(document.body.dataset.sw).catch(()=>{}));
}

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;const act=t.dataset.act;
  if(!act.startsWith('jd-'))return;
  const c=t.dataset.c,e=J.ev?S.events[J.ev]:null;
  if(act==='jd-list'){J.scr='list';J.ev=null;render();return}
  if(act==='jd-tab'){J.tab=t.dataset.tab;J.cat='all';render();return}
  if(act==='jd-cat'){J.cat=t.dataset.cat;render();return}
  if(act==='jd-open')return jdOpen(t.dataset.ev);
  if(act==='jd-install'){if(installEvt){installEvt.prompt();try{await installEvt.userChoice}catch(x){}installEvt=null;render()}return}
  if(act==='jd-undo'){if(J.undo&&Date.now()<J.undo.until){const u=J.undo;J.undo=null;if(await put('events/'+u.id,u.prev)){toast('ย้อนผลแล้ว');J.ev=u.id;J.scr='event';jdOpen(u.id)}}else toast('หมดเวลาย้อนกลับ แก้ได้ที่แท็บ “มีผลแล้ว”');return}
  if(act==='jd-step-undo'){const h=J.hist[J.ev]||[];const p=h.pop();if(p){await put('events/'+J.ev,p);J.scr='event';render()}return}
  if(act==='jd-show-done'){J.scr='done';render();return}
  if(!e)return;
  // A2 แตะตามลำดับ
  if(act==='jd-tap'){
    const ids=colIds();if(J.race.includes(c)){J.race=J.race.slice(0,J.race.indexOf(c))}else J.race.push(c);
    if(J.race.length===ids.length-1)J.race.push(ids.find(i=>!J.race.includes(i)));
    render();return;
  }
  if(act==='jd-race-reset'){J.race=[];render();return}
  if(act==='jd-race-save'){const o=J.race.slice();return jdMutate(x=>{x.order=o;x.g=o[0]||'';x.s=o[1]||'';x.b=hasBronze()?o[2]||'':'';x.status='done';x.at=Date.now();x.fmt=x.fmt||'race'}).then(()=>{if(S.events[J.ev]&&S.events[J.ev].g&&J.scr!=='done'){J.scr='done';render()}})}
  // A3.1 ประตู
  if(act==='jd-goal')return jdMutate(x=>{x.score={...(x.score||{})};x.score[c]=String(Math.max(0,(scoreNum(x.score[c])||0)+ +t.dataset.d));x.status='live';x.g=x.s=x.b='';x.scoring='high';x.half=x.half||'1'});
  if(act==='jd-half')return jdMutate(x=>{x.half=t.dataset.h;if(x.status!=='done')x.status='live'});
  if(act==='jd-pk')return jdMutate(x=>{x.pk={...(x.pk||{})};x.pk[c]=[...(x.pk[c]||[]),+t.dataset.hit];x.status='live';x.g=x.s=x.b=''});
  if(act==='jd-goals-end'){
    const ids=colIds(),sc=ids.map(i=>scoreNum((e.score||{})[i])||0);
    if(ids.length===2&&sc[0]===sc[1]&&pkSum(e,ids[0])===pkSum(e,ids[1])){toast('ผลยังเสมอ ไปที่แท็บ “จุดโทษ” เพื่อบันทึกการยิงจุดโทษ');return}
    return jdMutate(x=>{x.scoring='high';
      if(ids.length===2){const w=sc[0]!==sc[1]?(sc[0]>sc[1]?ids[0]:ids[1]):(pkSum(x,ids[0])>pkSum(x,ids[1])?ids[0]:ids[1]);setWinner(x,w)}
      else{x.status='done';applyRank(x);if(!x.g)return false}
      x.status='done';x.at=Date.now()}).then(()=>{if(S.events[J.ev]&&S.events[J.ev].g){J.scr='done';render()}});
  }
  // A3.2 เซต
  if(act==='jd-set')return jdMutate(x=>applySetPoint(x,c,+t.dataset.d));
  if(act==='jd-sets-end'){
    const inf=setsInfo(e);if(inf.champ||e.g){J.scr='done';render();return}
    const ids=colIds(),best=[...ids].sort((a,b)=>inf.won[b]-inf.won[a]);
    if(ids.length<2||inf.won[best[0]]===inf.won[best[1]]){toast('จำนวนเซตยังเท่ากัน จบก่อนกำหนดไม่ได้');return}
    return jdMutate(x=>{setWinner(x,best[0],i=>setsInfo(x).won[i])});
  }
  // A3.3 เอนด์
  if(act==='jd-end-c'){J.endC=c;render();return}
  if(act==='jd-end-p'){J.endP=+t.dataset.p;render();return}
  if(act==='jd-end-add'){
    if(!J.endC||!J.endP)return;const ec=J.endC,ep=J.endP;J.endC=J.endP=null;
    return jdMutate(x=>{x.ends=[...(x.ends||[]),{c:ec,p:ep}];x.status='live';x.g=x.s=x.b='';const tt=endsTotal(x);if(tt[ec]>=endCfg(x).to)setWinner(x,ec,i=>tt[i])});
  }
  // A4 คะแนนกรรมการ
  if(act==='jd-active'){J.active=c;render();return}
  if(act==='jd-key'){
    const k=t.dataset.k,a=J.active;if(!a)return;
    if(k==='next'){const ids=colIds();J.active=ids[(ids.indexOf(a)+1)%ids.length]}
    else if(k==='del')J.num[a]=(J.num[a]||'').slice(0,-1);
    else if((J.num[a]||'').length<3)J.num[a]=((J.num[a]||'')+k).replace(/^0+(?=\d)/,'');
    render();return;
  }
  if(act==='jd-judge-save'){const n={...J.num};return jdMutate(x=>{x.score=n;x.scoring='high';x.fmt=x.fmt||'judge';applyRank(x);if(!x.g)return false;x.status='done'}).then(()=>{if(S.events[J.ev]&&S.events[J.ev].g&&J.scr!=='done'){J.scr='done';render()}})}
});
