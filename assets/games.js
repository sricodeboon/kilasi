/* ---------- การแข่งขัน: กรอกคะแนน รายชื่อผู้แข่งขัน จอฉายแมตช์ เกียรติบัตร ----------
   โหลดต่อจาก app.js ใช้ S, put, render ฯลฯ ร่วมกัน
   events/<id> เพิ่มช่อง: scoring (high|low|manual) score{สี:ค่า} status (''|live|done) entries{สี:[รหัสนักเรียน]} */

const SCORING={high:'คะแนนมากชนะ',low:'เวลาน้อยชนะ',manual:'เลือกอันดับเอง'};
const defaultScoring=cat=>cat==='กรีฑา'?'low':cat==='กีฬาพื้นบ้าน'?'manual':'high';
const modeOf=e=>e.scoring||defaultScoring(e.cat);
const rankText=k=>k==='g'?'ชนะเลิศ':k==='s'?(hasBronze()?'รองชนะเลิศอันดับ 1':'รองชนะเลิศ'):'รองชนะเลิศอันดับ 2';

/** ค่าที่กรอก "12.5" หรือ "1:05.3" (นาที:วินาที) → ตัวเลข · ว่าง/อ่านไม่ได้ → null */
function scoreNum(v){
  if(v===''||v==null)return null;
  const s=String(v).trim().replace(',','.');
  const m=s.match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/);
  if(m)return +m[1]*60+ +m[2];
  const n=parseFloat(s);
  return Number.isFinite(n)?n:null;
}

/** จัดอันดับจากคะแนนเมื่อทุกสีมีคะแนนครบ · คืน null ถ้ายังไม่ครบ, {tie:true} ถ้าอันดับที่ต้องให้รางวัลเสมอกัน */
function autoRank(e){
  const mode=modeOf(e);if(mode==='manual')return null;
  const sc=e.score||{},cols=cfg().colors.map(c=>c.id);
  const vals=cols.map(id=>({id,v:scoreNum(sc[id])}));
  if(vals.some(x=>x.v===null))return null;
  vals.sort((a,b)=>mode==='low'?a.v-b.v:b.v-a.v);
  const keys=medalKeys();
  for(let i=0;i<keys.length&&i+1<vals.length;i++)if(vals[i].v===vals[i+1].v)return {tie:true};
  const r={g:'',s:'',b:''};keys.forEach((k,i)=>{r[k]=vals[i]?vals[i].id:''});
  return r;
}
function applyRank(e){
  const r=autoRank(e);
  if(r&&r.tie){toast('คะแนนอันดับต้น ๆ เท่ากัน กรุณาเลือกอันดับเอง');return}
  if(r){e.g=r.g;e.s=r.s;e.b=r.b;e.at=Date.now();e.status='done'}
}
/** ข้อความผล เช่น "2 : 1" (2 สี) หรือ "เหลือง 12.4 · ม่วง 12.9" */
function scoreText(e){
  const f=fmtOf(e),cols=cfg().colors;
  if(f==='sets'&&(e.sets||[]).length){const inf=setsInfo(e);return 'เซต '+cols.map(c=>inf.won[c.id]).join('–')+' ('+e.sets.map(s=>cols.map(c=>s.pts[c.id]||0).join('–')).join(', ')+')'}
  if(f==='ends'&&(e.ends||[]).length){const tt=endsTotal(e);return cols.map(c=>tt[c.id]).join(' : ')}
  if(f==='goals'&&e.pk&&cols.some(c=>(e.pk[c.id]||[]).length))return cols.map(c=>((e.score||{})[c.id]||'0')+' ('+pkSum(e,c.id)+')').join(' : ');
  const sc=e.score||{};
  if(!cols.some(c=>sc[c.id]!==undefined&&sc[c.id]!==''))return '';
  if(cols.length===2)return cols.map(c=>sc[c.id]||'0').join(' : ');
  return cols.filter(c=>sc[c.id]!==undefined&&sc[c.id]!=='').map(c=>c.name.replace(/^สี/,'')+' '+sc[c.id]).join(' · ');
}
const stuMap=()=>Object.fromEntries(allStudents().map(s=>[s.id,s]));
/** ระดับชั้นของรายการ เช่น "ป.4–ป.6" "ป.5" → ช่วงลำดับชั้น · อ่านไม่ออก = ทุกชั้น */
function levelRange(level){
  const m=[...String(level||'').matchAll(/(อ|ป|ม)\.?\s?(\d)/g)].map(x=>classRank(x[1]+'.'+x[2]));
  if(!m.length)return null;
  return [Math.min(...m),Math.max(...m)+9];
}
function statusChip(e){
  if(e.status==='live')return '<span class="chip live">กำลังแข่ง</span>';
  return e.g?'<span class="chip ok">มีผลแล้ว</span>':'<span class="chip wait">รอแข่ง</span>';
}

/* ---------- แท็บการแข่งขัน ---------- */
function vEvents(){
  const cols=cfg().colors,evs=Object.entries(S.events).map(([id,e])=>({id,...e})).sort((a,b)=>(a.order||0)-(b.order||0));
  const sel=(e,k)=>{const c=colorById(e[k]);return `<label>${MEDAL[k]}<select data-act="result" data-ev="${e.id}" data-k="${k}" style="--pc:${c?esc(c.hex):'var(--line)'}"${dis()}><option value="">—</option>${cols.map(x=>`<option value="${x.id}"${e[k]===x.id?' selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`};
  const groups=CATS.concat(evs.map(e=>e.cat).filter(c=>!CATS.includes(c))).filter((c,i,a)=>a.indexOf(c)===i).map(cat=>[cat,evs.filter(e=>(e.cat||'อื่น ๆ')===cat)]).filter(g=>g[1].length);
  const card=e=>{
    const mode=modeOf(e),sc=e.score||{},n=Object.values(e.entries||{}).reduce((a,l)=>a+l.length,0);
    return `<div class="ev" id="ev-${e.id}">
      <div class="ev-top">
        <div><div class="ev-name">${esc(e.name)}</div><div class="ev-meta">${esc(e.level||'ทุกระดับ')} · ${statusChip(e)}${S.user?` · <span class="num">ผู้แข่งขัน ${n} คน</span>`:''}</div></div>
        <div class="bar">
          <button class="btn sm ghost" data-act="match-open" data-ev="${e.id}">จอแมตช์</button>
          ${S.user?`<button class="btn sm ghost" data-act="ev-open" data-ev="${e.id}" aria-expanded="${S.openEv===e.id}">${S.openEv===e.id?'ปิดรายชื่อ':'รายชื่อผู้แข่งขัน'}</button>`:''}
          ${S.canWrite?confirmBtn('delev:'+e.id,'ลบ'):''}
        </div>
      </div>
      <div class="ev-score">
        ${cols.map(c=>`<label class="sc" style="--pc:${esc(c.hex)}"><span>${esc(c.name)}</span><input type="text" inputmode="decimal" id="sc-${e.id}-${c.id}" data-act="score" data-ev="${e.id}" data-c="${c.id}" value="${esc(sc[c.id]??'')}" placeholder="${mode==='low'?'เวลา เช่น 12.5':mode==='high'?'คะแนน':'คะแนน (ถ้ามี)'}"${dis()}></label>`).join('')}
        ${S.canWrite?`<label class="f sc-mode">วิธีตัดสิน<select data-act="scoring" data-ev="${e.id}">${Object.entries(SCORING).map(([k,l])=>`<option value="${k}"${mode===k?' selected':''}>${l}</option>`).join('')}</select></label>`:`<span class="hint">${SCORING[mode]}</span>`}
      </div>
      <div class="podium">${medalKeys().map(k=>sel(e,k)).join('')}</div>
      ${S.user&&S.openEv===e.id?vEntries(e):''}
    </div>`;
  };
  return `
  ${S.canWrite?'':`<div class="banner"><span>ดูผลการแข่งขันได้อย่างเดียว ครูที่ต้องการบันทึกผลกรุณาเข้าสู่ระบบ</span><button class="btn sm ghost" data-act="login-open">เข้าสู่ระบบครู</button></div>`}
  <section class="panel" ${S.canWrite?'':'hidden'}><div class="ev-add-in"><div>
    <h2>เพิ่มรายการแข่งขัน</h2>
    <p class="hint">ครูช้างแนะนำ: กรอกคะแนนหรือเวลาของทุกสี ระบบจัดอันดับให้เอง แข่งฟุตบอลใช้ปุ่ม “จอแมตช์” กดเพิ่มประตูจากมือถือได้</p>
    <div class="bar" style="margin-top:10px;align-items:end">
      <label class="f" style="flex:2;min-width:200px">ชื่อรายการ<input type="text" id="ev-name" placeholder="เช่น วิ่ง 50 เมตร ชาย"${dis()}></label>
      <label class="f">ประเภท<select id="ev-cat"${dis()}>${CATS.map(c=>`<option>${c}</option>`).join('')}</select></label>
      <label class="f" style="flex:1;min-width:120px">ระดับชั้น<input type="text" id="ev-level" placeholder="เช่น ป.4–ป.6"${dis()}></label>
      <label class="f">วิธีตัดสิน<select id="ev-scoring"${dis()}><option value="auto">ตามประเภท</option>${Object.entries(SCORING).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
      <button class="btn" data-act="add-ev"${dis()}>เพิ่ม</button>
    </div>
  </div>${coach('bco')}</div></section>
  ${groups.length?groups.map(([cat,list])=>`
  <section class="panel">
    <div class="bar"><h3 class="cat-h">${BALL}${esc(cat)}</h3><span class="spacer"></span><span class="hint num">${list.filter(e=>e.g).length}/${list.length} มีผลแล้ว</span></div>
    <div class="results">${list.map(card).join('')}</div>
  </section>`).join(''):`<div class="panel empty">${BALL}ยังไม่มีรายการแข่งขัน</div>`}`;
}

function vEntries(e){
  const sm=stuMap(),rg=levelRange(e.level),ent=e.entries||{};
  const cols=cfg().colors;
  const pool=allStudents().filter(s=>!rg||(()=>{const r=classRank(s.cls);return r>=rg[0]&&r<=rg[1]})());
  return `<div class="ev-entries">
    <p class="hint">เลือกนักกีฬาของแต่ละสี${rg?` (แสดงเฉพาะชั้น ${esc(e.level)})`:''} ใช้ทำใบรายชื่อและออกเกียรติบัตร</p>
    <div class="ent-grid">${cols.map(c=>{
      const ids=ent[c.id]||[],cand=pool.filter(s=>s.color===c.id&&!ids.includes(s.id));
      return `<div class="ent-col" style="--pc:${esc(c.hex)}">
        <div class="ent-h">${tag(c)}<span class="hint num">${ids.length} คน</span></div>
        <div class="chips">${ids.map(id=>{const s=sm[id];return `<span class="pchip">${s?esc(s.name)+' <small>'+esc(s.cls)+'</small>':'<i>นักเรียนถูกลบ</i>'}<button class="x" data-act="ent-del" data-ev="${e.id}" data-c="${c.id}" data-sid="${id}" aria-label="เอาออก"${dis()}>×</button></span>`}).join('')||'<span class="hint">ยังไม่มีนักกีฬา</span>'}</div>
        <select id="ent-${e.id}-${c.id}" data-act="ent-add" data-ev="${e.id}" data-c="${c.id}"${dis()}><option value="">+ เพิ่มนักกีฬา${esc(c.name)} (${cand.length} คน)</option>${cand.map(s=>`<option value="${s.id}">${esc(s.cls)} · ${esc(s.name)}</option>`).join('')}</select>
      </div>`}).join('')}</div>
    <div class="bar" style="margin-top:10px">
      <button class="btn sm ghost" data-act="pdf-entries" data-ev="${e.id}">PDF ใบรายชื่อผู้แข่งขัน</button>
      <button class="btn sm ghost" data-act="cert-ev" data-ev="${e.id}">ออกเกียรติบัตรรายการนี้</button>
    </div>
  </div>`;
}

/* ---------- จอฉายแมตช์ ---------- */
function vMatch(){
  const e=S.events[S.matchId],cols=cfg().colors;
  if(!e)return `<div class="ov ov-night" role="dialog" aria-label="จอแมตช์"><div class="ov-tools"><button class="ov-btn" id="ov-close" data-act="close-ov">ปิด</button></div><p class="empty">ไม่พบรายการแข่งขันนี้</p></div>`;
  const md=matchDisplay(e),lead=e.g,f=fmtOf(e);
  return `<div class="ov ov-night ov-match" role="dialog" aria-label="จอแมตช์ ${esc(e.name)}">
  <div class="ov-tools"><button class="ov-btn" data-act="fs">เต็มจอ</button><button class="ov-btn" id="ov-close" data-act="close-ov">ปิด</button></div>
  <div class="mt-head">
    <div class="mt-eyebrow">${esc(cfg().eventName||'กีฬาสีภายใน')} · ${esc(e.cat||'')}</div>
    <h1>${esc(e.name)}</h1>
    <p>${esc(e.level||'ทุกระดับ')} · ${e.status==='live'?'<span class="mt-live">● กำลังแข่ง</span>':e.g?'จบการแข่งขัน':'รอแข่ง'}${md.sub?' · '+esc(md.sub):''}</p>
  </div>
  <div class="mt-teams" style="--n:${cols.length}">${cols.map(c=>`
    <div class="mt-team${lead===c.id&&e.status!=='live'?' mt-win':''}">
      ${shirt(c.hex,'')}<div class="mt-name">${esc(c.name)}</div>
      <div class="mt-score num">${esc(md.big[c.id])}</div>
      ${S.canWrite&&f!=='ends'?`<div class="mt-ctl"><button class="mt-btn" data-act="m-inc" data-c="${c.id}" data-d="-1" aria-label="ลดคะแนน${esc(c.name)}">−</button><button class="mt-btn plus" data-act="m-inc" data-c="${c.id}" data-d="1" aria-label="เพิ่มคะแนน${esc(c.name)}">+</button></div>`:''}
      ${lead===c.id&&e.status!=='live'?`<div class="mt-badge">${rankText('g')}</div>`:''}
    </div>`).join('')}</div>
  ${S.canWrite?`<div class="mt-actions">${e.status==='live'?'<button class="ov-btn big" data-act="m-end">จบการแข่งขัน บันทึกผล</button>':'<button class="ov-btn big" data-act="m-live">เริ่ม/แข่งต่อ</button>'}${confirmBtn('m-reset','ล้างคะแนนเป็น 0')}</div>`:''}
  </div>`;
}
async function matchUpdate(fn){
  const id=S.matchId;if(!S.events[id])return;
  const e=clone(S.events[id]);e.score={...(e.score||{})};
  fn(e);await put('events/'+id,e);
}

/* ---------- เกียรติบัตร ---------- */
function certSettings(){const c=cfg().cert||{};return {s1n:c.s1n||'',s1p:c.s1p||'ครูใหญ่',s2n:c.s2n||'',s2p:c.s2p||'',date:c.date||new Date().toISOString().slice(0,10),mode:S.certMode||'win'}}
function thaiDate(iso){
  const d=new Date(iso+'T00:00:00');if(isNaN(d))return '';
  return thNum(d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}).replace(/^(\d+) (\S+) (\d+)$/,'$1 เดือน$2 พ.ศ. $3'));
}
function certList(){
  const sm=stuMap(),out=[],sel=S.certSel||new Set();
  const evs=Object.entries(S.events).map(([id,e])=>({id,...e})).filter(e=>sel.has(e.id)).sort((a,b)=>(a.order||0)-(b.order||0));
  for(const e of evs){
    const ranks={};medalKeys().forEach(k=>{if(e[k])ranks[e[k]]=k});
    for(const c of cfg().colors){
      const k=ranks[c.id];if(!k&&S.certMode!=='all')continue;
      for(const sid of ((e.entries||{})[c.id]||[])){const s=sm[sid];if(s)out.push({name:s.name,sub:'นักเรียนชั้น '+s.cls+' · '+c.name,award:k?'ได้รับรางวัล'+rankText(k):'ได้เข้าร่วมการแข่งขัน',what:'การแข่งขัน'+e.name+(e.level?' ระดับชั้น '+e.level:''),hex:c.hex})}
    }
  }
  if(S.certTeam)standings().filter(r=>r.pts>0&&r.rank<=medalKeys().length).forEach(r=>out.push({name:'คณะ'+r.name,sub:r.teacher?'หัวหน้าสี '+r.teacher:'',award:'ได้รับรางวัล'+rankText(medalKeys()[r.rank-1])+'คะแนนรวม',what:'คะแนนรวม '+r.pts+' คะแนน',hex:r.hex}));
  return out;
}
function certHTML(x){
  const c=cfg(),st=certSettings();
  const signers=[[st.s1n,st.s1p],[st.s2n,st.s2p]].filter(s=>s[0]||s[1]);
  return `<div class="cert"><div class="cert-frame"><div class="cert-in">
    <div class="cert-strip"></div>
    <div class="cert-body">
      <img class="cert-logo" src="assets/logo.svg" alt="">
      <div class="cert-school">${esc(c.school||'')}</div>
      ${c.affiliation?`<div class="cert-affil">${esc(c.affiliation)}</div>`:''}
      <h1 class="cert-title">เกียรติบัตร</h1>
      <p class="cert-lead">ให้ไว้เพื่อแสดงว่า</p>
      <div class="cert-name">${esc(x.name)}</div>
      ${x.sub?`<p class="cert-sub">${esc(x.sub)}</p>`:''}
      <p class="cert-award" style="--pc:${esc(x.hex)}">${esc(x.award)}</p>
      <p class="cert-what">${esc(x.what)}</p>
      <p class="cert-what">ในการแข่งขันกีฬาสีภายใน “${esc(c.eventName||'กีฬาสีภายใน')}” ประจำปีการศึกษา ${thNum(c.year||'')}</p>
      <p class="cert-date">ขอให้มีความสุข ความเจริญ และเป็นกำลังสำคัญของโรงเรียนสืบไป<br>ให้ไว้ ณ วันที่ ${thaiDate(st.date)}</p>
      <div class="cert-sign">${signers.map(s=>`<div><span class="cert-line"></span><b>${s[0]?'('+esc(s[0])+')':'&nbsp;'}</b><small>${esc(s[1])}</small></div>`).join('')}</div>
    </div>
    ${x.qr?`<div class="cert-qr">${x.qr}<small>ตรวจสอบเกียรติบัตร<br>${esc(x.code||'')}</small></div>`:''}
    <div class="cert-strip"></div>
  </div></div></div>`;
}
function vCerts(){
  if(!S.certSel)S.certSel=new Set(Object.entries(S.events).filter(([,e])=>e.g).map(([id])=>id));
  if(S.certTeam===undefined)S.certTeam=true;
  const st=certSettings(),list=certList();
  const evs=Object.entries(S.events).map(([id,e])=>({id,...e})).sort((a,b)=>(a.order||0)-(b.order||0));
  const cnt=e=>Object.values(e.entries||{}).reduce((a,l)=>a+l.length,0);
  const sel=S.certSel||new Set();
  requestAnimationFrame(fitCertPreview);
  return `
  <section class="panel">
    <h2>ผู้ลงนามและวันที่</h2>
    <p class="hint">${isAdmin()?'ใช้กับเกียรติบัตรทุกใบ':'แก้ได้เฉพาะผู้ดูแลระบบ'}</p>
    <div class="cert-grid">
      <label class="f">ผู้ลงนามคนที่ 1<input type="text" id="cs-s1n" data-act="cert-set" data-f="s1n" value="${esc(st.s1n)}" placeholder="ชื่อ-สกุล"${disA()}></label>
      <label class="f">ตำแหน่ง<input type="text" id="cs-s1p" data-act="cert-set" data-f="s1p" value="${esc(st.s1p)}" placeholder="เช่น ครูใหญ่"${disA()}></label>
      <label class="f">ผู้ลงนามคนที่ 2 (ไม่ใส่ก็ได้)<input type="text" id="cs-s2n" data-act="cert-set" data-f="s2n" value="${esc(st.s2n)}" placeholder="ชื่อ-สกุล"${disA()}></label>
      <label class="f">ตำแหน่ง<input type="text" id="cs-s2p" data-act="cert-set" data-f="s2p" value="${esc(st.s2p)}" placeholder="เช่น ประธานจัดการแข่งขัน"${disA()}></label>
      <label class="f">วันที่ในเกียรติบัตร<input type="date" id="cs-date" data-act="cert-set" data-f="date" value="${esc(st.date)}"${disA()}></label>
    </div>
  </section>
  <section class="panel">
    <h2>เลือกเกียรติบัตรที่จะพิมพ์</h2>
    <div class="bar" style="margin-top:10px">
      <label class="chk"><input type="radio" name="cert-mode" id="cm-win" data-act="cert-mode" value="win"${S.certMode!=='all'?' checked':''}> เฉพาะผู้ได้รับรางวัล</label>
      <label class="chk"><input type="radio" name="cert-mode" id="cm-all" data-act="cert-mode" value="all"${S.certMode==='all'?' checked':''}> ทุกคนที่มีชื่อในรายการ (คนอื่นได้ใบเข้าร่วม)</label>
      <label class="chk"><input type="checkbox" id="cm-team" data-act="cert-team"${S.certTeam?' checked':''}> คณะสีที่ได้รางวัลคะแนนรวม</label>
    </div>
    ${evs.length?`<div class="cert-evs">
      <label class="chk"><input type="checkbox" id="ce-all" data-act="cert-all"${evs.every(e=>sel.has(e.id))?' checked':''}> <b>เลือกทุกรายการ</b></label>
      ${evs.map(e=>`<label class="chk"><input type="checkbox" data-act="cert-ev-sel" value="${e.id}"${sel.has(e.id)?' checked':''}> ${esc(e.name)} <span class="hint num">${esc(e.level||'')} · ${cnt(e)} คน${e.g?'':' · ยังไม่มีผล'}</span></label>`).join('')}
    </div>`:'<p class="hint" style="margin-top:10px">ยังไม่มีรายการแข่งขัน</p>'}
    <div class="bar" style="margin-top:14px">
      <button class="btn" data-act="cert-print"${list.length?'':' disabled'}>สร้าง PDF เกียรติบัตร (${list.length} ใบ)</button>
      <span class="hint">${list.length?'ไฟล์ PDF จากเซิร์ฟเวอร์ A4 แนวนอน ทุกใบมี QR ตรวจสอบรายใบ':'ต้องเลือกนักกีฬาในรายการก่อน (แท็บการแข่งขัน → รายชื่อผู้แข่งขัน)'}</span>
    </div>
  </section>
  ${list.length?`<section class="panel"><h2>ตัวอย่างใบแรก</h2><div class="cert-preview" id="cert-preview">${certHTML(list[0])}</div></section>`:''}`;
}
function fitCertPreview(){
  const box=$('#cert-preview');if(!box)return;
  const c=box.querySelector('.cert');if(!c)return;
  const k=box.clientWidth/c.offsetWidth;c.style.transform=`scale(${k})`;box.style.height=(c.offsetHeight*k)+'px';
}
window.addEventListener('resize',fitCertPreview);

/* ---------- เหตุการณ์ ---------- */
document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;const act=t.dataset.act,id=t.dataset.ev;
  if(act==='ev-open'){S.openEv=S.openEv===id?null:id;render();return}
  if(act==='match-open')return openOv('match',id);
  if(act==='ent-del'){const e=clone(S.events[id]);const ent={...(e.entries||{})};ent[t.dataset.c]=(ent[t.dataset.c]||[]).filter(x=>x!==t.dataset.sid);e.entries=ent;await put('events/'+id,e);return}
  if(act==='cert-ev'){S.tab='certs';S.certSel=new Set([id]);S.certMode=S.certMode||'win';try{history.replaceState(null,'','#certs')}catch(e){}render();window.scrollTo(0,0);return}
  if(act==='cert-print')return printCerts();
  if(act==='m-inc'&&S.events[S.matchId]&&fmtOf(S.events[S.matchId])==='sets')return matchUpdate(e=>applySetPoint(e,t.dataset.c,+t.dataset.d));
  if(act==='m-inc'){const d=+t.dataset.d,c=t.dataset.c;return matchUpdate(e=>{e.score[c]=String(Math.max(0,(scoreNum(e.score[c])||0)+d));if(e.status!=='live'){e.status='live';e.g=e.s=e.b=''}if(!e.scoring||e.scoring==='low')e.scoring='high'})}
  if(act==='m-live')return matchUpdate(e=>{e.status='live';e.g=e.s=e.b=''});
  if(act==='m-end')return matchUpdate(e=>{e.status='done';if(modeOf(e)==='manual')e.scoring='high';applyRank(e);if(!e.g)toast('บันทึกคะแนนแล้ว เลือกอันดับเองที่แท็บการแข่งขัน')});
},true);
document.addEventListener('change',async ev=>{
  const t=ev.target;const act=t.dataset&&t.dataset.act;if(!act)return;const id=t.dataset.ev;
  if(act==='score'){
    const e=clone(S.events[id]);e.score={...(e.score||{}),[t.dataset.c]:t.value.trim()};
    if(e.status!=='live')applyRank(e);
    await put('events/'+id,e);return;
  }
  if(act==='scoring'){const e=clone(S.events[id]);e.scoring=t.value;if(e.status!=='live')applyRank(e);await put('events/'+id,e);return}
  if(act==='ent-add'&&t.value){const e=clone(S.events[id]);const ent={...(e.entries||{})};ent[t.dataset.c]=[...(ent[t.dataset.c]||[]),t.value];e.entries=ent;await put('events/'+id,e);return}
  if(act==='cert-set'){const c=clone(cfg());c.cert={...(c.cert||{}),[t.dataset.f]:t.value.trim()};return saveConfig(c)}
  if(act==='cert-mode'){S.certMode=t.value;render();return}
  if(act==='cert-team'){S.certTeam=t.checked;render();return}
  if(act==='cert-ev-sel'){const s=new Set(S.certSel||[]);t.checked?s.add(t.value):s.delete(t.value);S.certSel=s;render();return}
  if(act==='cert-all'){S.certSel=t.checked?new Set(Object.keys(S.events)):new Set();render();return}
});
