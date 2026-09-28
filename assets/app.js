const TABS=[['score','สรุปคะแนน'],['split','แบ่งสี'],['roster','รายชื่อ'],['events','การแข่งขัน'],['certs','เกียรติบัตร'],['settings','ตั้งค่า']];
const CATS=['กรีฑา','กีฬาประเภททีม','กีฬาพื้นบ้าน','กองเชียร์','ขบวนพาเหรด','อื่น ๆ'];
const EXTRA=[['สีชมพู','#E4578F'],['สีม่วง','#7E4FC4'],['สีส้ม','#F07A1A'],['สีน้ำเงิน','#1F3C88'],['สีขาว','#E9EDF2'],['สีเทา','#6B7280']];
const DEFAULT_CONFIG={eventName:'กีฬาสีภายใน',school:'โรงเรียนของเรา',affiliation:'กองบังคับการตำรวจตระเวนชายแดนภาค 2',year:2569,points:{g:5,s:3,b:1},colors:[
  {id:'red',name:'สีแดง',hex:'#D7263D',teacher:''},{id:'yellow',name:'สีเหลือง',hex:'#F2B705',teacher:''},
  {id:'green',name:'สีเขียว',hex:'#2E9E5B',teacher:''},{id:'blue',name:'สีฟ้า',hex:'#1E88E5',teacher:''}]};
const MEDAL={g:'ทอง',s:'เงิน',b:'ทองแดง'};
const hasBronze=()=>cfg().colors.length>2; /* 2 สีมีแค่ที่ 1 กับที่ 2 */
const medalKeys=()=>hasBronze()?['g','s','b']:['g','s'];

const S={mode:'loading',config:null,classes:{},events:{},canWrite:false,user:null,setup:false,teachers:[],rev:-1,login:false,editT:null,openEv:null,matchId:null,certSel:null,certMode:'win',tab:'score',fClass:'all',fColor:'all',q:'',confirm:null,balanceSex:true,importCls:'',view:null};
let toastT=null,pollT=null,csrf=(document.querySelector('meta[name="csrf-token"]')||{}).content||'';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=p=>p+Date.now().toString(36).slice(-4)+Math.random().toString(36).slice(2,7);
const clone=o=>JSON.parse(JSON.stringify(o));
const cfg=()=>S.config||DEFAULT_CONFIG;
const colorById=id=>cfg().colors.find(c=>c.id===id);
const dis=()=>S.canWrite?'':' disabled';
const isAdmin=()=>!!(S.user&&S.user.role==='admin');
const disA=()=>isAdmin()?'':' disabled';
function ink(hex){const h=hex.replace('#','');const [r,g,b]=[0,2,4].map(i=>parseInt(h.substr(i,2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return (.2126*r+.7152*g+.0722*b)>.42?'#141B26':'#FFFFFF'}
function tag(c){return c?`<span class="tag" style="background:${esc(c.hex)};color:${ink(c.hex)}">${esc(c.name)}</span>`:'<span class="chip wait">ยังไม่มีสี</span>'}
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600)}
try{const h=location.hash.slice(1);if(TABS.some(t=>t[0]===h))S.tab=h;if(['board','pitch','ceremony','judge'].includes(h))S.view=h;if(/^match-[A-Za-z0-9_-]+$/.test(h)){S.view='match';S.matchId=h.slice(6)}}catch(e){}

/* ---------- ชั้นเรียน ---------- */
function normClass(t){
  const m=String(t).trim().match(/^(อนุบาล|อ|ป|ม)\s*\.?\s*(\d{1,2})(\s*\/\s*\d+)?$/);
  if(!m)return '';
  const p={อนุบาล:'อ',อ:'อ',ป:'ป',ม:'ม'}[m[1]];
  return p+'.'+m[2]+(m[3]?'/'+m[3].replace(/\D/g,''):'');
}
function classRank(n){const m=String(n).match(/^(อ|ป|ม)\.(\d+)(?:\/(\d+))?/);if(!m)return 9999;return {อ:0,ป:100,ม:200}[m[1]]+(+m[2])*10+(+(m[3]||0))}
function classList(){return Object.entries(S.classes).map(([id,c])=>({id,...c})).sort((a,b)=>classRank(a.name)-classRank(b.name)||a.name.localeCompare(b.name,'th'))}
function allStudents(){const out=[];for(const c of classList())for(const s of (c.students||[]))out.push({...s,cls:c.name,clsId:c.id});return out}

/* ---------- เซิร์ฟเวอร์ (api.php) ---------- */
async function api(r,body,retried){
  const opt=body===undefined?{credentials:'same-origin',headers:{Accept:'application/json'}}
    :{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)};
  let res,d;
  try{res=await fetch('api.php?r='+r,opt)}catch(e){throw {error:'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',status:0}}
  try{d=await res.json()}catch(e){throw {error:'เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ กรุณารีเฟรชหน้า',status:res.status}}
  if(res.status===419&&d.token&&!retried){csrf=d.token;return api(r,body,true)}
  if(!res.ok){d.status=res.status;throw d}
  if(typeof d.csrf==='string')csrf=d.csrf;
  return d;
}
const asObj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
function applyState(d){
  const wasUser=S.user&&S.user.id;
  S.user=d.user||null;S.setup=!!d.setup;S.canWrite=!!S.user;S.mode='server';
  if(d.same){
    // สถานะล็อกอินเปลี่ยนแต่ข้อมูลไม่เปลี่ยน (เช่น session หมดอายุ) ต้องโหลดใหม่ทั้งหมดรอบหน้า
    if((S.user&&S.user.id)!==wasUser){S.rev=-1;render()}
    return;
  }
  S.rev=d.rev;S.config=d.config||null;S.classes=asObj(d.classes);S.events=asObj(d.events);S.teachers=Array.isArray(d.teachers)?d.teachers:[];
  render();
}
async function poll(){
  clearTimeout(pollT);
  // แท็บที่ซ่อนอยู่ไม่ต้องถามบ่อย แต่ต้องโหลดครั้งแรกเสมอ
  if(!document.hidden||S.mode!=='server'){
    try{applyState(await api('state'+(S.rev>=0?'&since='+S.rev:'')))}
    catch(e){if(S.mode!=='server'){S.mode='offline';render()}}
  }
  pollT=setTimeout(poll,S.view?2000:4000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
function writeErr(e){
  if(e&&e.status===401){S.user=null;S.canWrite=false;S.rev=-1;render();poll()}
  toast((e&&e.error)||'บันทึกไม่สำเร็จ ลองอีกครั้ง');
}
/* บันทึกทับทั้งเอกสาร แสดงผลทันทีแล้วค่อยส่ง ถ้าไม่สำเร็จจะย้อนกลับ */
async function put(path,data){
  if(!S.user){toast('กรุณาเข้าสู่ระบบครูก่อน');return false}
  const [col,id]=path.split('/');const prev=col==='config'?S.config:S[col][id];
  if(col==='config')S.config=data;else S[col][id]=data;render();
  try{await api('put',{path,data});S.rev=-1;return true}
  catch(e){if(col==='config')S.config=prev;else if(prev===undefined)delete S[col][id];else S[col][id]=prev;render();writeErr(e);return false}
}
async function del(path){
  if(!S.user){toast('กรุณาเข้าสู่ระบบครูก่อน');return false}
  const [col,id]=path.split('/');const prev=S[col][id];
  delete S[col][id];render();
  try{await api('del',{path});S.rev=-1;return true}
  catch(e){if(prev!==undefined)S[col][id]=prev;render();writeErr(e);return false}
}
const saveConfig=c=>put('config/main',c);
async function authCall(r,body,okMsg){
  try{const d=await api(r,body);S.rev=-1;applyState(d);if(okMsg)toast(okMsg);return d}
  catch(e){toast((e&&e.error)||'ทำรายการไม่สำเร็จ');return null}
}

/* ---------- คำนวณ ---------- */
function standings(){
  const c=cfg(),P=c.points||{};
  const rows=c.colors.map(col=>({...col,pts:0,g:0,s:0,b:0,n:0}));
  const by=Object.fromEntries(rows.map(r=>[r.id,r]));
  for(const ev of Object.values(S.events))for(const k of ['g','s','b']){const r=by[ev[k]];if(r){r[k]++;r.pts+=+P[k]||0}}
  for(const s of allStudents())if(by[s.color])by[s.color].n++;
  rows.sort((a,b)=>b.pts-a.pts||b.g-a.g||b.s-a.s||b.b-a.b);
  rows.forEach((r,i)=>{r.rank=i&&r.pts===rows[i-1].pts&&r.g===rows[i-1].g&&r.s===rows[i-1].s&&r.b===rows[i-1].b?rows[i-1].rank:i+1});
  return rows;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

/* แบ่งสีแบบสมดุล: ในแต่ละชั้นเลือกสีที่ (เพศเดียวกันในชั้น) น้อยสุด → (ทั้งชั้น) น้อยสุด → (ทั้งโรงเรียน) น้อยสุด */
async function autoAssign(onlyNew){
  const ids=cfg().colors.map(c=>c.id);
  const total=Object.fromEntries(ids.map(i=>[i,0]));
  const changed=[];
  for(const cls of classList()){
    const doc=clone(S.classes[cls.id]);const st=doc.students||[];
    const inCls=Object.fromEntries(ids.map(i=>[i,0])),inSex={};
    const key=s=>S.balanceSex?(s.sex||'?'):'*';
    const bump=(s,c)=>{inCls[c]++;total[c]++;const k=key(s);inSex[k]=inSex[k]||Object.fromEntries(ids.map(i=>[i,0]));inSex[k][c]++};
    if(onlyNew)st.forEach(s=>{if(ids.includes(s.color))bump(s,s.color)});else st.forEach(s=>s.color='');
    const pending=shuffle(st.filter(s=>!ids.includes(s.color)));
    if(!pending.length)continue;
    for(const s of pending){
      const k=key(s);inSex[k]=inSex[k]||Object.fromEntries(ids.map(i=>[i,0]));
      const best=shuffle(ids.slice()).sort((a,b)=>inSex[k][a]-inSex[k][b]||inCls[a]-inCls[b]||total[a]-total[b])[0];
      s.color=best;bump(s,best);
    }
    changed.push([cls.id,doc]);
  }
  if(!changed.length){toast('ทุกคนมีสีแล้ว');return}
  for(const [id,doc] of changed)if(!await put('classes/'+id,doc))return;
  toast(`แบ่งสีแล้ว ${changed.length} ชั้น`);
}

/* ---------- นำเข้ารายชื่อ ---------- */
function parseSex(t){if(/^(ช|ชาย|m|male|ด\.?ช\.?)$/i.test(t))return 'ช';if(/^(ญ|หญิง|f|female|ด\.?ญ\.?)$/i.test(t))return 'ญ';return ''}
function sexFromName(n){if(/^(ด\.ช\.|เด็กชาย|นาย)/.test(n))return 'ช';if(/^(ด\.ญ\.|เด็กหญิง|นางสาว|น\.ส\.|นาง)/.test(n))return 'ญ';return ''}
function parseImport(text,defCls){
  const out=[];
  for(const raw of text.split(/\r?\n/)){
    let line=raw.trim();if(!line)continue;
    let no=null;const lead=line.match(/^(\d+)[.)]?\s+(?=\D)/);if(lead&&!/\t/.test(line)){no=+lead[1];line=line.slice(lead[0].length)}
    const toks=line.split(/\t|,|;/).map(t=>t.trim()).filter(Boolean);
    let cls=defCls,sex='';const rest=[];
    for(const t of toks){const c=normClass(t);if(c){cls=c;continue}const x=parseSex(t);if(x){sex=x;continue}if(/^\d+$/.test(t)){no=+t;continue}rest.push(t)}
    const name=rest.join(' ').replace(/\s+/g,' ').trim();
    if(!name||/^(ชื่อ|ลำดับ|เลขที่|ชั้น)/.test(name))continue;
    out.push({cls,name,sex:sex||sexFromName(name),no});
  }
  return out;
}
async function doImport(){
  const text=$('#imp-text').value;const sel=$('#imp-cls').value;
  const defCls=sel==='__new'?normClass($('#imp-new').value)||$('#imp-new').value.trim():sel;
  const rows=parseImport(text,defCls);
  if(!rows.length){toast('ไม่พบรายชื่อ วางรายชื่อบรรทัดละ 1 คน');return}
  if(rows.some(r=>!r.cls)){toast('เลือกชั้นก่อน หรือใส่คอลัมน์ชั้นในรายชื่อ');return}
  const byName=Object.fromEntries(classList().map(c=>[c.name,c.id]));
  const groups={};rows.forEach(r=>(groups[r.cls]=groups[r.cls]||[]).push(r));
  let n=0;
  for(const [name,list] of Object.entries(groups)){
    const id=byName[name]||uid('k');
    const doc=S.classes[id]?clone(S.classes[id]):{name,students:[]};
    let next=doc.students.reduce((m,s)=>Math.max(m,s.no||0),0);
    for(const r of list){doc.students.push({id:uid('s'),no:r.no||++next,name:r.name,sex:r.sex,color:''});if(r.no)next=Math.max(next,r.no);n++}
    doc.students.sort((a,b)=>a.no-b.no);
    if(!await put('classes/'+id,doc))return;
  }
  $('#imp-text').value='';
  toast(`เพิ่มแล้ว ${n} คน กด "แบ่งเฉพาะคนที่ยังไม่มีสี" ต่อได้เลย`);
}

/* ---------- ส่งออก ---------- */
function rosterRows(){
  const f=filtered();
  return [['ชั้น','เลขที่','ชื่อ-สกุล','เพศ','สี'],...f.map(s=>[s.cls,s.no,s.name,s.sex,(colorById(s.color)||{}).name||''])];
}
async function copyRoster(){
  const txt=rosterRows().map(r=>r.join('\t')).join('\n');
  try{await navigator.clipboard.writeText(txt);toast('คัดลอกแล้ว วางใน Excel หรือ Google Sheets ได้เลย')}
  catch(e){const t=$('#copy-fallback');t.hidden=false;t.value=txt;t.select();toast('กด Ctrl/⌘+C เพื่อคัดลอก')}
}
function downloadCsv(){
  const csv='﻿'+rosterRows().map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const c=colorById(S.fColor),k=S.fClass!=='all'&&S.classes[S.fClass]?S.classes[S.fClass].name:'';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=['รายชื่อกีฬาสี',c&&c.name,k].filter(Boolean).join('-').replace(/[\\/:*?"<>|]/g,'_')+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
}

/* ---------- แสดงผล ---------- */
function filtered(){
  const q=S.q.trim();
  return allStudents().filter(s=>(S.fClass==='all'||s.clsId===S.fClass)&&(S.fColor==='all'||(S.fColor==='none'?!colorById(s.color):s.color===S.fColor))&&(!q||s.name.includes(q)));
}
function confirmBtn(key,label,cls='ghost'){
  if(S.confirm===key)return `<span class="bar"><button class="btn sm danger" data-act="confirm" data-key="${key}">ยืนยัน${esc(label)}</button><button class="btn sm ghost" data-act="cancel">ยกเลิก</button></span>`;
  return `<button class="btn sm ${cls}" data-act="ask" data-key="${key}"${dis()}>${esc(label)}</button>`;
}

/* เสื้อบอลสีทีม เลขบนเสื้อ = อันดับ */
function shirt(hex,n){
  const fg=ink(hex);
  return `<svg class="shirt" viewBox="0 0 40 40" aria-label="อันดับ ${n}"><path d="M14 4 L6 8 L2 16 L8 19.5 L10.5 16.5 L10.5 36 L29.5 36 L29.5 16.5 L32 19.5 L38 16 L34 8 L26 4 Q20 9.5 14 4 Z" fill="${esc(hex)}" stroke="rgba(0,0,0,.35)" stroke-width="1" stroke-linejoin="round"/><path d="M14 4 Q20 9.5 26 4" fill="none" stroke="${fg}" stroke-opacity=".55" stroke-width="1.6"/><text x="20" y="29" text-anchor="middle" fill="${fg}">${n}</text></svg>`;
}
const BALL=`<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="14,8.5 19.2,12.3 17.2,18.4 10.8,18.4 8.8,12.3" fill="currentColor"/><path d="M14 8.5V2 M19.2 12.3L25.5 10 M17.2 18.4L21 23.8 M10.8 18.4L7 23.8 M8.8 12.3L2.5 10" stroke="currentColor" stroke-width="1.4"/></svg>`;
function vScore(){
  const rows=standings(),max=Math.max(1,...rows.map(r=>r.pts));
  const evs=Object.values(S.events),done=evs.filter(e=>e.g).length;
  const lanes=rows.map(r=>`
    <div class="row-team">
      ${shirt(r.hex,r.rank)}
      <div class="team-body">
        <div class="team-head"><span class="team">${esc(r.name)}</span>${r.rank===1&&r.pts>0?'<span class="lead">นำอยู่</span>':''}<span class="team-sub">${r.teacher?'หัวหน้าสี '+esc(r.teacher)+' · ':''}นักกีฬา ${r.n} คน</span></div>
        <div class="rail"><div class="fill" style="--w:${Math.max(2,r.pts/max*100)}%;--c:${esc(r.hex)}"></div></div>
        <div class="medals num"><span class="medal"><i style="background:var(--gold-bright)"></i>ทอง ${r.g}</span><span class="medal"><i style="background:var(--silver)"></i>เงิน ${r.s}</span>${hasBronze()?`<span class="medal"><i style="background:var(--bronze)"></i>ทองแดง ${r.b}</span>`:''}</div>
      </div>
      <div class="board num"><b>${r.pts}</b><small>คะแนน</small></div>
    </div>`).join('');
  const recent=evs.filter(e=>e.g).sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,6);
  return `
  <div class="bar showbar">
    <button class="btn" data-act="open" data-view="board">เปิดจอฉายป้ายไฟ</button>
    <button class="btn ghost" data-act="open" data-view="pitch">จอฉายสนามหญ้า</button>
    <button class="btn ghost" data-act="open" data-view="ceremony">หน้าพิธีมอบรางวัล</button>
    ${S.user?'<button class="btn ghost" data-act="open" data-view="judge">โหมดกรรมการ (มือถือ)</button><button class="btn ghost" data-act="print-report">พิมพ์รายงานผล + QR</button>':''}
    <span class="hint">ต่อโปรเจกเตอร์ในวันงาน คะแนนบนจอเปลี่ยนตามที่ครูบันทึกทันที</span>
  </div>
  <section class="pitch${rows.length<=2?' few':''}">
    <div class="pitch-head"><h2>ตารางคะแนนรวม</h2><span class="chip num">แข่งแล้ว ${done} จาก ${evs.length} รายการ</span></div>
    ${lanes}
  </section>
  <section class="panel">
    <h2>ผลล่าสุด</h2>
    <p class="hint">คิดคะแนน ${medalKeys().map(k=>MEDAL[k]+' '+cfg().points[k]).join(' · ')} คะแนน</p>
    ${recent.length?`<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>รายการ</th><th>ทอง</th><th>เงิน</th>${hasBronze()?'<th>ทองแดง</th>':''}</tr></thead><tbody>${recent.map(e=>`<tr><td>${esc(e.name)} <span class="lane-sub">${esc(e.level||'')}${scoreText(e)?' · ผล '+esc(scoreText(e)):''}</span></td><td>${tag(colorById(e.g))}</td><td>${colorById(e.s)?tag(colorById(e.s)):'–'}</td>${hasBronze()?`<td>${colorById(e.b)?tag(colorById(e.b)):'–'}</td>`:''}</tr>`).join('')}</tbody></table></div>`:`<p class="empty">${BALL}ยังไม่มีผลการแข่งขัน บันทึกได้ที่แท็บ “การแข่งขัน”</p>`}
  </section>`;
}

function vSplit(){
  const cols=cfg().colors,cls=classList();
  const tot=Object.fromEntries(cols.map(c=>[c.id,0]));let none=0;
  const body=cls.map(c=>{
    const st=c.students||[];let rowNone=0;
    const cells=cols.map(col=>{const a=st.filter(s=>s.color===col.id);tot[col.id]+=a.length;const m=a.filter(s=>s.sex==='ช').length,f=a.filter(s=>s.sex==='ญ').length;return `<td class="r num">${a.length}${a.length&&(m||f)?` <span class="lane-sub">(ช${m} ญ${f})</span>`:''}</td>`}).join('');
    rowNone=st.filter(s=>!colorById(s.color)).length;none+=rowNone;
    return `<tr><td>${esc(c.name)}</td>${cells}<td class="r num">${rowNone||'–'}</td><td class="r num">${st.length}</td><td>${confirmBtn('delcls:'+c.id,'ลบชั้น')}</td></tr>`;
  }).join('');
  const vals=Object.values(tot),diff=vals.length?Math.max(...vals)-Math.min(...vals):0,sum=vals.reduce((a,b)=>a+b,0)+none;
  const opts=cls.map(c=>`<option value="${esc(c.name)}"${S.importCls===c.name?' selected':''}>${esc(c.name)}</option>`).join('');
  return `
  <section class="panel">
    <div class="bar"><div><h2>สรุปการแบ่งสี</h2><p class="hint num">นักเรียนทั้งหมด ${sum} คน · ${cols.length} สี</p></div><span class="spacer"></span>
      ${sum?(none?`<span class="chip warn num">ยังไม่มีสี ${none} คน</span>`:diff<=1?'<span class="chip ok">จำนวนแต่ละสีเท่ากัน</span>':`<span class="chip warn num">แต่ละสีต่างกัน ${diff} คน</span>`):''}</div>
    ${cls.length?`<div class="tbl-wrap" style="margin-top:14px"><table>
      <thead><tr><th>ชั้น</th>${cols.map(c=>`<th class="r"><span class="bar" style="justify-content:flex-end;gap:6px"><i class="sw" style="background:${esc(c.hex)}"></i>${esc(c.name)}</span></th>`).join('')}<th class="r">ยังไม่มีสี</th><th class="r">รวม</th><th></th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td>รวม</td>${cols.map(c=>`<td class="r num">${tot[c.id]}</td>`).join('')}<td class="r num">${none||'–'}</td><td class="r num">${sum}</td><td></td></tr></tfoot>
    </table></div>`:`<div class="empty">${chibi('bsp',(cfg().colors[0]||{}).hex||'#A3212A')}<span>น้องเผือกรอรายชื่ออยู่ เพิ่มรายชื่อด้านล่างได้เลย</span></div>`}
    <div class="bar" style="margin-top:14px">
      <button class="btn" data-act="assign-new"${dis()}>แบ่งเฉพาะคนที่ยังไม่มีสี</button>
      ${confirmBtn('reassign','สุ่มแบ่งใหม่ทั้งหมด')}
      <label class="chk"><input type="checkbox" id="opt-sex" data-act="opt-sex"${S.balanceSex?' checked':''}> ให้ชาย-หญิงแต่ละสีใกล้เคียงกัน</label>
    </div>
    <p class="hint" style="margin-top:8px">ระบบแบ่งทีละชั้น ให้ทุกสีได้จำนวนคนในแต่ละชั้นใกล้เคียงกัน เศษที่เหลือจะหมุนไปสีที่คนน้อยกว่า ย้ายรายคนได้ที่แท็บ “รายชื่อ”</p>
  </section>
  <section class="panel">
    <h2>เพิ่มรายชื่อนักเรียน</h2>
    <p class="hint">คัดลอกจาก Excel หรือ Google Sheets มาวางได้เลย บรรทัดละ 1 คน ระบบอ่านคำนำหน้า ด.ช./ด.ญ. เป็นเพศให้เอง ถ้ามีคอลัมน์ชั้น (เช่น ป.4) ระบบจะแยกชั้นให้</p>
    <div class="grid2" style="margin-top:12px">
      <div style="display:grid;gap:10px;align-content:start">
        <label class="f">ชั้น<select id="imp-cls" data-act="imp-cls"${dis()}><option value="">— ใช้ชั้นจากคอลัมน์ในรายชื่อ —</option>${opts}<option value="__new"${S.importCls==='__new'?' selected':''}>+ ชั้นใหม่…</option></select></label>
        <label class="f" ${S.importCls==='__new'?'':'hidden'}>ชื่อชั้นใหม่<input type="text" id="imp-new" placeholder="เช่น ป.1 หรือ ป.1/2"${dis()}></label>
        <button class="btn" data-act="import"${dis()}>เพิ่มรายชื่อ</button>
      </div>
      <label class="f">รายชื่อ<textarea id="imp-text" placeholder="1&#9;ด.ช.ธนกร ใจดี&#10;2&#9;ด.ญ.ปริยา ศรีสุข&#10;ป.4&#9;ด.ช.ภูมิ แสนดี&#9;ช"${dis()}></textarea></label>
    </div>
  </section>`;
}

function vRoster(){
  const cols=cfg().colors,list=filtered();
  const colOpts=(sel)=>`<option value="">— ยังไม่มีสี —</option>`+cols.map(c=>`<option value="${c.id}"${sel===c.id?' selected':''}>${esc(c.name)}</option>`).join('');
  const rows=list.map(s=>{const c=colorById(s.color);return `<tr>
    <td>${esc(s.cls)}</td><td class="r num">${s.no??''}</td><td>${esc(s.name)}</td><td>${esc(s.sex||'–')}</td>
    <td><select data-act="move" data-cls="${s.clsId}" data-sid="${s.id}" style="border-left:6px solid ${c?esc(c.hex):'var(--line)'}"${dis()}>${colOpts(s.color)}</select></td>
    <td class="no-print">${confirmBtn('delstu:'+s.clsId+':'+s.id,'ลบ')}</td></tr>`}).join('');
  return `
  <h2 class="print-only">${esc(['รายชื่อนักกีฬา',(colorById(S.fColor)||{}).name,S.fClass!=='all'&&S.classes[S.fClass]?'ชั้น '+S.classes[S.fClass].name:'',cfg().eventName].filter(Boolean).join(' · '))}</h2>
  <section class="panel no-print">
    <div class="bar">
      <label class="f">ชั้น<select id="f-cls" data-act="f-cls"><option value="all">ทุกชั้น</option>${classList().map(c=>`<option value="${c.id}"${S.fClass===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="f">สี<select id="f-color" data-act="f-color"><option value="all">ทุกสี</option>${cols.map(c=>`<option value="${c.id}"${S.fColor===c.id?' selected':''}>${esc(c.name)}</option>`).join('')}<option value="none"${S.fColor==='none'?' selected':''}>ยังไม่มีสี</option></select></label>
      <label class="f" style="flex:1;min-width:160px">ค้นหาชื่อ<input type="text" id="f-q" data-act="f-q" value="${esc(S.q)}" placeholder="พิมพ์ชื่อ"></label>
    </div>
    <div class="bar" style="margin-top:12px">
      <span class="hint num">แสดง ${list.length} คน</span><span class="spacer"></span>
      <button class="btn sm ghost" data-act="copy">คัดลอกไปวางใน Excel</button>
      <button class="btn sm ghost" data-act="csv">ดาวน์โหลด CSV</button>
      <button class="btn sm ghost" data-act="print">พิมพ์รายชื่อ</button>
    </div>
    <textarea id="copy-fallback" hidden readonly style="margin-top:10px;min-height:80px"></textarea>
  </section>
  ${list.length?`<div class="tbl-wrap"><table><thead><tr><th>ชั้น</th><th class="r">เลขที่</th><th>ชื่อ-สกุล</th><th>เพศ</th><th>สี</th><th class="no-print"></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="panel empty">ไม่พบรายชื่อตามตัวกรองนี้</div>'}`;
}

function vSettings(){
  const c=cfg();
  return `${vAccount()}${isAdmin()?vTeachers():'<p class="banner"><span>ค่าตั้งงานด้านล่างแก้ได้เฉพาะผู้ดูแลระบบ</span></p>'}
  <section class="panel">
    <h2>ข้อมูลงาน</h2>
    <div class="grid2" style="margin-top:12px">
      <label class="f">ชื่องาน<input type="text" id="set-event" data-act="set" data-f="eventName" value="${esc(c.eventName||'กีฬาสีภายใน')}" placeholder="เช่น ช้างเผือกเกมส์"${disA()}></label>
      <label class="f">ชื่อโรงเรียน<input type="text" id="set-school" data-act="set" data-f="school" value="${esc(c.school)}"${disA()}></label>
      <label class="f">สังกัด<input type="text" id="set-affil" data-act="set" data-f="affiliation" value="${esc(c.affiliation||'')}" placeholder="เช่น กองบังคับการตำรวจตระเวนชายแดนภาค 2"${disA()}></label>
      <label class="f">ปีการศึกษา<input type="number" id="set-year" data-act="set" data-f="year" value="${esc(c.year)}"${disA()}></label>
    </div>
  </section>
  <section class="panel">
    <div class="bar"><div><h2>สีประจำทีม</h2><p class="hint">ตั้งชื่อสี เลือกเฉดสี และใส่ชื่อครูหัวหน้าสี (2–8 สี)</p></div><span class="spacer"></span>
      <button class="btn sm ghost" data-act="add-color"${c.colors.length>=8?' disabled':disA()}>+ เพิ่มสี</button></div>
    <div class="colors" style="margin-top:12px">${c.colors.map((col,i)=>`
      <div class="crow">
        <input type="color" id="col-hex-${col.id}" value="${esc(col.hex)}" data-act="col" data-i="${i}" data-f="hex" aria-label="เฉดสี"${disA()}>
        <input type="text" id="col-name-${col.id}" value="${esc(col.name)}" data-act="col" data-i="${i}" data-f="name" aria-label="ชื่อสี"${disA()}>
        <input class="t" type="text" id="col-t-${col.id}" value="${esc(col.teacher||'')}" data-act="col" data-i="${i}" data-f="teacher" placeholder="ครูหัวหน้าสี" aria-label="ครูหัวหน้าสี"${disA()}>
        ${c.colors.length>2&&isAdmin()?confirmBtn('delcol:'+i,'ลบ'):'<span></span>'}
      </div>`).join('')}</div>
  </section>
  <section class="panel">
    <h2>การคิดคะแนน</h2>
    <div class="pts" style="margin-top:12px">${medalKeys().map(k=>`<label class="f">${MEDAL[k]}<input type="number" min="0" id="pt-${k}" data-act="pt" data-k="${k}" value="${esc(c.points[k])}"${disA()}></label>`).join('')}</div>
    <p class="hint" style="margin-top:8px">คะแนนรวมจะคำนวณใหม่ทันทีทุกรายการ ถ้าคะแนนเท่ากันจะตัดสินด้วยจำนวนเหรียญทอง แล้วจึงดูเหรียญเงิน${hasBronze()?' และทองแดง':''}</p>
  </section>
  <section class="panel">
    <h2>ล้างข้อมูล</h2>
    <p class="hint">การลบย้อนกลับไม่ได้ ควรคัดลอกรายชื่อเก็บไว้ก่อน</p>
    <div class="bar" style="margin-top:12px">${isAdmin()?confirmBtn('clear-results','ล้างผลการแข่งขัน')+confirmBtn('clear-students','ลบรายชื่อทั้งหมด')+confirmBtn('clear-all','ลบข้อมูลทั้งหมด'):'<span class="hint">เฉพาะผู้ดูแลระบบ</span>'}</div>
  </section>`;
}

/* ---------- บัญชีครู ---------- */
function vSetup(){
  return `<section class="panel auth-panel">
    <h2>ตั้งค่าระบบครั้งแรก</h2>
    <p class="hint">สร้างบัญชีผู้ดูแลระบบ (ครูผู้รับผิดชอบงานกีฬาสี) ทำได้ครั้งเดียว หลังจากนั้นเพิ่มบัญชีครูท่านอื่นได้ที่แท็บตั้งค่า</p>
    <form id="su-form" class="auth-form">
      <label class="f">รหัสตั้งค่าระบบ (ได้จากผู้ติดตั้ง)<input type="text" id="su-code" autocomplete="off" autocapitalize="characters" required></label>
      <label class="f">ชื่อครู<input type="text" id="su-name" autocomplete="name" placeholder="เช่น ครูแจ็ก" required></label>
      <label class="f">ชื่อผู้ใช้ (ภาษาอังกฤษ)<input type="text" id="su-user" autocomplete="username" placeholder="เช่น krujack" autocapitalize="none" required></label>
      <label class="f">รหัสผ่าน (อย่างน้อย 6 ตัว)<input type="password" id="su-pass" autocomplete="new-password" required></label>
      <label class="f">ยืนยันรหัสผ่าน<input type="password" id="su-pass2" autocomplete="new-password" required></label>
      <button class="btn" type="submit">สร้างบัญชีผู้ดูแล</button>
    </form></section>`;
}
function vLogin(){
  return `<section class="panel auth-panel">
    <div class="bar"><h2>เข้าสู่ระบบครู</h2><span class="spacer"></span><button class="btn sm ghost" data-act="login-close">ปิด</button></div>
    <p class="hint">ใช้ชื่อผู้ใช้และรหัสผ่านที่ผู้ดูแลระบบสร้างให้ ลืมรหัสผ่านให้แจ้งผู้ดูแลตั้งใหม่</p>
    <form id="lg-form" class="auth-form">
      <label class="f">ชื่อผู้ใช้<input type="text" id="lg-user" autocomplete="username" autocapitalize="none" required></label>
      <label class="f">รหัสผ่าน<input type="password" id="lg-pass" autocomplete="current-password" required></label>
      <button class="btn" type="submit">เข้าสู่ระบบ</button>
    </form></section>`;
}
function vAccount(){
  return `<section class="panel">
    <h2>บัญชีของฉัน</h2>
    <p class="hint">${esc(S.user.name)} · ชื่อผู้ใช้ ${esc(S.user.username)} · ${isAdmin()?'ผู้ดูแลระบบ':'ครู'}</p>
    <form id="pw-form" class="bar" style="margin-top:12px;align-items:end">
      <label class="f">รหัสผ่านเดิม<input type="password" id="pw-old" autocomplete="current-password" required></label>
      <label class="f">รหัสผ่านใหม่<input type="password" id="pw-new" autocomplete="new-password" required></label>
      <button class="btn ghost" type="submit">เปลี่ยนรหัสผ่าน</button>
    </form></section>`;
}
function vTeachers(){
  const e=S.editT?S.teachers.find(t=>t.id===S.editT)||null:null;
  return `<section class="panel">
    <h2>บัญชีครู</h2>
    <p class="hint">สร้างบัญชีให้ครูที่กรอกรายชื่อและบันทึกผลแข่ง แล้วแจ้งชื่อผู้ใช้กับรหัสผ่านให้ครูแต่ละท่าน</p>
    <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>ชื่อครู</th><th>ชื่อผู้ใช้</th><th>สิทธิ์</th><th></th></tr></thead><tbody>
    ${S.teachers.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.username)}</td><td>${t.role==='admin'?'<span class="chip ok">ผู้ดูแล</span>':'<span class="chip wait">ครู</span>'}</td>
      <td><span class="bar"><button class="btn sm ghost" data-act="t-edit" data-id="${t.id}">แก้ไข</button>${t.id===S.user.id?'':confirmBtn('delt:'+t.id,'ลบ')}</span></td></tr>`).join('')}
    </tbody></table></div>
    <form id="t-form" class="auth-form wide" style="margin-top:14px">
      <h3 class="cat-h">${e?'แก้ไขบัญชี '+esc(e.name):'เพิ่มบัญชีครู'}</h3>
      <label class="f">ชื่อครู<input type="text" id="t-name" value="${esc(e?e.name:'')}" required></label>
      <label class="f">ชื่อผู้ใช้ (a-z 0-9)<input type="text" id="t-user" value="${esc(e?e.username:'')}" autocapitalize="none" autocomplete="off" required></label>
      <label class="f">${e?'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)':'รหัสผ่าน (อย่างน้อย 6 ตัว)'}<input type="text" id="t-pass" autocomplete="off"${e?'':' required'}></label>
      <label class="f">สิทธิ์<select id="t-role"><option value="teacher">ครู: กรอกรายชื่อ บันทึกผล</option><option value="admin"${e&&e.role==='admin'?' selected':''}>ผู้ดูแล: ตั้งค่างาน จัดการบัญชี</option></select></label>
      <span class="bar"><button class="btn" type="submit">${e?'บันทึกการแก้ไข':'เพิ่มบัญชี'}</button>${e?'<button class="btn ghost" type="button" data-act="t-cancel">ยกเลิก</button>':''}</span>
    </form></section>`;
}
const allowedTabs=()=>S.setup?[]:S.user?TABS:TABS.filter(([k])=>k==='score'||k==='events');
const KEEP=['ev-scoring','su-code','imp-text','imp-new','ev-name','ev-level','ev-cat','lg-user','lg-pass','su-user','su-name','su-pass','su-pass2','t-user','t-name','t-pass','t-role','pw-old','pw-new'];

function render(){
  const c=cfg();
  $('#hdr-affil').textContent=c.affiliation||'';
  const ev=c.eventName||'กีฬาสีภายใน';
  $('#hdr-event').textContent=ev;
  $('#hdr-sub').textContent=[(ev==='กีฬาสีภายใน'?'':'กีฬาสีภายใน')+(c.school||''),c.year?'ปีการศึกษา '+c.year:''].filter(Boolean).join(' · ');
  $('#hdr-mode').innerHTML=S.mode==='loading'?'<span class="dot"></span>กำลังเชื่อมต่อ…'
    :S.mode==='offline'?'<span class="dot"></span>เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองใหม่…'
    :S.user?`<span class="dot live"></span>${esc(S.user.name)}${isAdmin()?' (ผู้ดูแล)':''}<button class="acct acct-main" data-act="open" data-view="judge">บันทึกผล</button><button class="acct" data-act="logout">ออกจากระบบ</button>`
    :S.setup?'<span class="dot live"></span>รอตั้งค่าระบบครั้งแรก'
    :'<span class="dot live"></span>ดูอย่างเดียว<button class="acct" data-act="login-open">เข้าสู่ระบบครู</button>';
  const tabs=allowedTabs();
  if(tabs.length&&!tabs.some(([k])=>k===S.tab))S.tab='score';
  $('#tabs').innerHTML=tabs.map(([k,l])=>`<button role="tab" aria-selected="${S.tab===k}" data-act="tab" data-tab="${k}">${l}</button>`).join('');
  if(S.mode==='loading'||S.mode==='offline'&&S.rev<0)return;
  const a=document.activeElement,fid=a&&a.id,pos=a&&a.selectionStart;
  // เก็บค่าที่กำลังพิมพ์ค้างไว้ ข้อมูลจากครูท่านอื่นเข้ามาระหว่างพิมพ์จะได้ไม่หาย
  const kept={};KEEP.forEach(id=>{const el=document.getElementById(id);if(el)kept[id]=el.value});
  if(a&&a.id&&$('#view').contains(a)&&'value' in a&&a.type!=='checkbox')kept[a.id]=a.value;
  const views={score:vScore,split:vSplit,roster:vRoster,events:vEvents,certs:vCerts,settings:vSettings};
  $('#view').innerHTML=S.setup?vSetup():(S.login&&!S.user?vLogin():'')+views[S.tab]();
  Object.entries(kept).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&el.value!==v)el.value=v});
  renderOverlay();
  if(fid){const el=document.getElementById(fid);if(el){el.focus();try{if(pos!=null)el.setSelectionRange(pos,pos)}catch(e){}}}
}

/* ---------- ภาพประกอบ: ลูกบอล ช้างทรง น้องเผือก ครูช้าง ตรากีฬาสี ---------- */
const thNum=n=>String(n??'').replace(/\d/g,d=>'๐๑๒๓๔๕๖๗๘๙'[d]);
const shortSchool=s=>String(s||'').replace('โรงเรียนตำรวจตระเวนชายแดน','รร.ตชด.').replace(/^โรงเรียน/,'รร.');
const shortAffil=s=>String(s||'').replace('กองบังคับการตำรวจตระเวนชายแดน','บก.ตชด.');
function ballDefs(id,rim='#3B2A22'){
  return `<clipPath id="${id}c"><circle r="1"/></clipPath><g id="${id}"><circle r="1" fill="#fff"/><g clip-path="url(#${id}c)" fill="#1E1B18"><polygon points="0,-0.36 0.342,-0.111 0.212,0.291 -0.212,0.291 -0.342,-0.111"/><polygon points="0.364,-0.502 0.234,-0.904 0.576,-1.153 0.918,-0.904 0.788,-0.502"/><polygon points="0.59,0.192 0.932,-0.057 1.274,0.192 1.144,0.594 0.72,0.594"/><polygon points="0,0.62 0.342,0.869 0.212,1.271 -0.212,1.271 -0.342,0.869"/><polygon points="-0.59,0.192 -0.72,0.594 -1.144,0.594 -1.274,0.192 -0.932,-0.057"/><polygon points="-0.364,-0.502 -0.788,-0.502 -0.918,-0.904 -0.576,-1.153 -0.234,-0.904"/></g><path d="M0,-0.36V-0.62M0.342,-0.111L0.59,-0.192M0.212,0.291L0.364,0.502M-0.212,0.291L-0.364,0.502M-0.342,-0.111L-0.59,-0.192M0,-0.62L0.364,-0.502L0.59,-0.192L0.59,0.192L0.364,0.502L0,0.62L-0.364,0.502L-0.59,0.192L-0.59,-0.192L-0.364,-0.502Z" fill="none" stroke="#1E1B18" stroke-width=".05"/><circle r="1" fill="none" stroke="${rim}" stroke-width=".12"/></g>`;
}
/* ช้างเผือกด้านข้างสวมผ้าทรง (มาสคอต 3) */
function sideElephant(id){
  return `<svg viewBox="0 0 220 150" role="img" aria-label="ช้างเผือกสวมผ้าทรงเตะลูกฟุตบอล"><defs>${ballDefs(id,'#1E1B18')}</defs>
<rect x="150" y="96" width="19" height="46" rx="7" fill="#D9CFB8"/><rect x="92" y="98" width="19" height="44" rx="7" fill="#D9CFB8"/>
<path d="M186 70 C196 80 196 96 192 106" stroke="#E9DFC8" stroke-width="3.5" fill="none" stroke-linecap="round"/>
<ellipse cx="130" cy="78" rx="60" ry="40" fill="#F1E9D6" stroke="#C9A03A" stroke-width="1.2"/>
<rect x="80" y="96" width="21" height="48" rx="7" fill="#F1E9D6" stroke="#C9A03A" stroke-width="1.2"/><rect x="160" y="96" width="21" height="48" rx="7" fill="#F1E9D6" stroke="#C9A03A" stroke-width="1.2"/>
<path d="M100 44 Q132 30 168 44 L164 86 Q132 96 104 86 Z" fill="#C9A03A"/><path d="M104 80 Q132 90 164 80 L164 86 Q132 96 104 86 Z" fill="#8C1B20"/>
<path d="M112 50 L120 62 L112 74 L104 62 Z M134 45 L142 58 L134 71 L126 58 Z M156 50 L164 62 L156 74 L148 62 Z" fill="#8C1B20"/>
<circle cx="72" cy="62" r="31" fill="#F1E9D6" stroke="#C9A03A" stroke-width="1.2"/><path d="M80 38 C104 36 108 70 96 84 C90 90 80 86 78 78 Z" fill="#E6DCC4"/>
<path d="M56 34 Q70 26 84 34 L80 44 Q70 38 60 44 Z" fill="#C9A03A"/><circle cx="70" cy="46" r="3.2" fill="#8C1B20"/><circle cx="62" cy="58" r="3" fill="#2A1E17"/>
<path d="M50 70 C34 86 30 104 38 118" stroke="#F1E9D6" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M56 84 Q46 96 36 94" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round"/>
<use href="#${id}" transform="translate(24 128) scale(14)"/></svg>`;
}
/* ส่วนหัวน้องเผือก (ใช้ร่วมกันทั้งตัวเต็มและในตรา) */
function chibiHead(extra){
  return `<ellipse cx="108" cy="150" rx="80" ry="90" fill="#EFE6D3" stroke="#3B2A22" stroke-width="5"/><ellipse cx="116" cy="158" rx="50" ry="60" fill="#F2C4BA"/>
<ellipse cx="292" cy="150" rx="80" ry="90" fill="#EFE6D3" stroke="#3B2A22" stroke-width="5"/><ellipse cx="284" cy="158" rx="50" ry="60" fill="#F2C4BA"/>${extra.beforeHead||''}
<ellipse cx="200" cy="150" rx="100" ry="94" fill="#FBF7EC" stroke="#3B2A22" stroke-width="5"/>${extra.headwear}
<ellipse cx="162" cy="146" rx="12" ry="15" fill="#2A1E17"/><circle cx="166" cy="140" r="4.5" fill="#fff"/><ellipse cx="238" cy="146" rx="12" ry="15" fill="#2A1E17"/><circle cx="242" cy="140" r="4.5" fill="#fff"/>
<ellipse cx="138" cy="182" rx="15" ry="9" fill="#F29A93" opacity=".6"/><ellipse cx="262" cy="182" rx="15" ry="9" fill="#F29A93" opacity=".6"/>
<path d="M178 192 Q164 212 174 228 Q182 214 190 198 Z" fill="#fff" stroke="#3B2A22" stroke-width="3.5" stroke-linejoin="round"/><path d="M222 192 Q236 212 226 228 Q218 214 210 198 Z" fill="#fff" stroke="#3B2A22" stroke-width="3.5" stroke-linejoin="round"/>
<path d="${extra.trunk}" fill="none" stroke="#3B2A22" stroke-width="42" stroke-linecap="round"/><path d="${extra.trunk}" fill="none" stroke="#FBF7EC" stroke-width="32" stroke-linecap="round"/>
<ellipse cx="200" cy="166" rx="18" ry="16" fill="#FBF7EC"/><path d="M186 206 Q200 212 214 206 M188 224 Q201 230 214 224" fill="none" stroke="#3B2A22" stroke-width="3" stroke-linecap="round"/>`;
}
const ORNAMENT=`<path d="M154 68 Q200 42 246 68 L232 104 Q200 124 168 104 Z" fill="#D4A93A" stroke="#3B2A22" stroke-width="4" stroke-linejoin="round"/><path d="M170 98 Q200 114 230 98" fill="none" stroke="#A3212A" stroke-width="3"/><circle cx="200" cy="86" r="10" fill="#A3212A" stroke="#3B2A22" stroke-width="3"/><circle cx="175" cy="79" r="4" fill="#A3212A"/><circle cx="225" cy="79" r="4" fill="#A3212A"/>`;
const TRUNK_UP='M200 170 C200 206 196 236 206 256 C212 270 230 270 234 256';
const LEGS=`<rect x="140" y="384" width="50" height="44" rx="16" fill="#FBF7EC" stroke="#3B2A22" stroke-width="5"/><rect x="210" y="384" width="50" height="44" rx="16" fill="#FBF7EC" stroke="#3B2A22" stroke-width="5"/><g fill="#fff" stroke="#3B2A22" stroke-width="2.5"><ellipse cx="153" cy="421" rx="5" ry="4"/><ellipse cx="165" cy="422" rx="5" ry="4"/><ellipse cx="177" cy="421" rx="5" ry="4"/><ellipse cx="223" cy="421" rx="5" ry="4"/><ellipse cx="235" cy="422" rx="5" ry="4"/><ellipse cx="247" cy="421" rx="5" ry="4"/></g>`;
const arm=(d,fx,fy,r)=>`<path d="${d}" fill="none" stroke="#3B2A22" stroke-width="40" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#FBF7EC" stroke-width="30" stroke-linecap="round"/><circle cx="${fx}" cy="${fy}" r="${r}" fill="#FBF7EC" stroke="#3B2A22" stroke-width="5"/>`;
/* น้องเผือก ชุดนักฟุตบอล สีเสื้อตามทีม (มาสคอต 1) */
function chibi(id,jersey){
  const num=thNum(String(cfg().year||2569).slice(-2));
  const head=chibiHead({headwear:ORNAMENT,trunk:TRUNK_UP}),i=head.indexOf('<ellipse cx="200" cy="150"');
  return `<svg class="chibi" viewBox="0 0 400 440" role="img" aria-label="น้องเผือก มาสคอตช้างเผือกในชุดนักฟุตบอล"><defs>${ballDefs(id)}</defs>
<ellipse cx="210" cy="432" rx="160" ry="8" fill="#000" opacity=".12"/>
${head.slice(0,i)}${LEGS}
<path d="M126 350 L274 350 L268 394 L210 394 L200 380 L190 394 L132 394 Z" fill="#1F2A44" stroke="#3B2A22" stroke-width="5" stroke-linejoin="round"/>
<path d="M128 244 Q200 226 272 244 L284 354 Q200 370 116 354 Z" fill="${esc(jersey)}" stroke="#3B2A22" stroke-width="5" stroke-linejoin="round"/>
<path d="M122 336 Q200 352 278 336" fill="none" stroke="#D4A93A" stroke-width="7"/>
<text x="200" y="328" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-weight="700" font-size="42" fill="${ink(jersey)}">${num}</text>
${arm('M140 270 C104 262 70 250 50 222',48,218,21)}${arm('M262 272 C292 286 308 304 314 326',315,330,19)}
<use href="#${id}" transform="translate(326 404) scale(30)"/>
${head.slice(i)}</svg>`;
}
/* ครูช้าง โค้ชชุดกากี (มาสคอต 2) */
function coach(id){
  const cap=`<path d="M108 104 Q112 34 200 32 Q288 34 292 104 Z" fill="#6E6B3E" stroke="#3B2A22" stroke-width="5" stroke-linejoin="round"/><path d="M196 98 Q270 90 326 110 Q306 126 200 116 Z" fill="#5A5732" stroke="#3B2A22" stroke-width="5" stroke-linejoin="round"/><circle cx="160" cy="70" r="15" fill="#D4A93A" stroke="#3B2A22" stroke-width="3"/><polygon points="160,60 162.9,66 169.5,66.9 164.7,71.4 165.9,78 160,74.8 154.1,78 155.3,71.4 150.5,66.9 157.1,66" fill="#A3212A"/><path d="M146 124 Q162 118 178 126 M222 126 Q238 118 254 124" fill="none" stroke="#3B2A22" stroke-width="5" stroke-linecap="round"/>`;
  const head=chibiHead({headwear:cap,trunk:'M200 170 C200 206 194 234 186 252 C180 266 164 266 162 252'});
  const i=head.indexOf('<ellipse cx="200" cy="150"');
  return `<svg class="coach" viewBox="0 0 400 440" role="img" aria-label="ครูช้าง โค้ชช้างเผือกในชุดสีกากีถือกระดานจดคะแนน"><defs>${ballDefs(id)}</defs>
${head.slice(0,i)}<use href="#${id}" transform="translate(74 404) scale(28)"/>${LEGS}
<path d="M126 350 L274 350 L268 394 L210 394 L200 380 L190 394 L132 394 Z" fill="#4A4A2E" stroke="#3B2A22" stroke-width="5" stroke-linejoin="round"/>
<path d="M128 244 Q200 226 272 244 L284 354 Q200 370 116 354 Z" fill="#9C9163" stroke="#3B2A22" stroke-width="5" stroke-linejoin="round"/>
<rect x="134" y="288" width="36" height="32" rx="4" fill="#8A8055" stroke="#3B2A22" stroke-width="3"/><path d="M166 244 Q158 276 172 298" fill="none" stroke="#A3212A" stroke-width="3.5"/><rect x="160" y="296" width="28" height="15" rx="6" fill="#C9CED6" stroke="#3B2A22" stroke-width="3"/>
${arm('M140 270 C104 262 70 250 50 222',48,218,21)}<path d="M44 202 Q40 186 50 184 Q56 186 54 200" fill="#FBF7EC" stroke="#3B2A22" stroke-width="4" stroke-linejoin="round"/>
<rect x="290" y="290" width="68" height="88" rx="7" fill="#9A6B3E" stroke="#3B2A22" stroke-width="4"/><rect x="299" y="303" width="50" height="66" rx="3" fill="#fff"/><path d="M307 318 H341 M307 330 H341 M307 342 H330 M307 354 H336" stroke="#9AA0A8" stroke-width="3" stroke-linecap="round"/><rect x="311" y="284" width="26" height="12" rx="3" fill="#C9CED6" stroke="#3B2A22" stroke-width="3"/>
${arm('M262 272 C284 282 294 296 298 314',298,320,19)}${head.slice(i)}</svg>`;
}
/* ตรากีฬาสี (มาสคอต 4) */
function badge(id,top,bottom){
  const head=chibiHead({headwear:ORNAMENT,trunk:TRUNK_UP});
  return `<svg class="badge" viewBox="0 0 400 400" role="img" aria-label="ตรา${esc(top)}"><defs>${ballDefs(id)}<clipPath id="${id}i"><circle cx="200" cy="200" r="138"/></clipPath><path id="${id}t" d="M48,200 A152,152 0 0,1 352,200" fill="none"/><path id="${id}b" d="M22,200 A178,178 0 0,0 378,200" fill="none"/></defs>
<circle cx="200" cy="200" r="194" fill="#C9A03A"/><circle cx="200" cy="200" r="186" fill="#8C1B20"/><circle cx="200" cy="200" r="143" fill="#C9A03A"/>
<g clip-path="url(#${id}i)"><rect x="50" y="50" width="300" height="300" fill="#2F6A38"/><rect x="86" y="50" width="36" height="300" fill="#377A41"/><rect x="158" y="50" width="36" height="300" fill="#377A41"/><rect x="230" y="50" width="36" height="300" fill="#377A41"/><rect x="302" y="50" width="36" height="300" fill="#377A41"/>
<circle cx="200" cy="300" r="60" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/><path d="M50 300 H350" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>
<g transform="translate(56 64) scale(.72)">${head}</g><use href="#${id}" transform="translate(252 296) scale(24)"/></g>
<text font-family="Chakra Petch, sans-serif" font-weight="700" font-size="27" fill="#F4DC8C" letter-spacing="2"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${esc(top)}</textPath></text>
<text font-family="Chakra Petch, sans-serif" font-weight="600" font-size="20" fill="#F4DC8C" letter-spacing="1"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${esc(bottom)}</textPath></text>
<polygon points="30,190 33,197 40,197 34.5,201.5 36.5,209 30,204.5 23.5,209 25.5,201.5 20,197 27,197" fill="#F4DC8C"/><polygon points="370,190 373,197 380,197 374.5,201.5 376.5,209 370,204.5 363.5,209 365.5,201.5 360,197 367,197" fill="#F4DC8C"/></svg>`;
}

/* ---------- จอฉายและพิธีมอบรางวัล ---------- */
let wakeLock=null;
function vBoard(){
  const c=cfg(),rows=standings(),mk=medalKeys(),evs=Object.values(S.events),done=evs.filter(e=>e.g).length;
  const ev=c.eventName||'กีฬาสีภายใน',yr=thNum(c.year||'');
  return `<div class="ov ov-night" role="dialog" aria-label="จอฉายตารางคะแนน">
  <div class="ov-tools"><button class="ov-btn" data-act="open" data-view="pitch">สลับเป็นสนามหญ้า</button><button class="ov-btn" data-act="fs">เต็มจอ</button><button class="ov-btn" id="ov-close" data-act="close-ov">ปิด</button></div>
  <div class="nb-head">${badge('bgn',ev+' '+yr,shortSchool(c.school))}
    <div class="nb-title"><h1>ตารางคะแนน ${esc(ev)} ${yr}</h1><p>${esc(['กีฬาสีภายใน '+shortSchool(c.school),shortAffil(c.affiliation)].filter(Boolean).join(' · '))}</p></div>
    <div class="nb-prog num"><b>${done}/${evs.length}</b><small>รายการที่แข่งแล้ว</small></div>
  </div>
  <div class="nb-grid nb-labels" style="--mc:${mk.length}"><span>อันดับ</span><span>สี</span>${mk.map(k=>`<span class="c">${MEDAL[k]}</span>`).join('')}<span class="r">รวม</span></div>
  <div class="nb-rows">${rows.map(r=>`<div class="nb-grid nb-row${r.rank===1&&r.pts>0?' nb-lead':''}" style="--mc:${mk.length}">
    <span class="nb-rank num">${r.rank}</span><span class="nb-team">${shirt(r.hex,'')}<span>${esc(r.name)}</span></span>
    ${mk.map(k=>`<span class="nb-m nb-${k} num">${r[k]}</span>`).join('')}<span class="nb-total num">${r.pts}</span></div>`).join('')}</div>
  </div>`;
}
function vPitch(){
  const c=cfg(),rows=standings(),mk=medalKeys(),max=Math.max(1,...rows.map(r=>r.pts));
  const leader=rows[0]&&rows[0].pts>0?rows[0].hex:'#A3212A';
  return `<div class="ov ov-pitch" role="dialog" aria-label="จอฉายตารางคะแนนแบบสนามหญ้า">
  <div class="ov-tools"><button class="ov-btn" data-act="open" data-view="board">สลับเป็นป้ายไฟ</button><button class="ov-btn" data-act="fs">เต็มจอ</button><button class="ov-btn" id="ov-close" data-act="close-ov">ปิด</button></div>
  <div class="pt-side">
    <div style="display:grid;gap:8px">
      ${c.affiliation?`<span class="pt-chip">${esc(shortAffil(c.affiliation))}</span>`:''}
      <h1>${esc(c.eventName||'กีฬาสีภายใน')}</h1>
      <p>กีฬาสีภายใน ปีการศึกษา ${thNum(c.year||'')}<br>${esc(shortSchool(c.school))}</p>
    </div>
    ${chibi('bpt',leader)}
  </div>
  <div class="pt-cards">${rows.map(r=>`<div class="pt-card${r.rank===1&&r.pts>0?' pt-lead':''}">
    <div class="pt-top">${shirt(r.hex,r.rank)}<div><b>${esc(r.name)}</b><small class="num">นักกีฬา ${r.n} คน</small></div></div>
    <div class="pt-pts num"><b>${r.pts}</b><small>คะแนน</small></div>
    <div class="pt-rail"><i style="width:${Math.max(2,r.pts/max*100)}%;background:${esc(r.hex)}"></i></div>
    <div class="pt-med num">${mk.map(k=>MEDAL[k]+' '+r[k]).join(' · ')}</div>
  </div>`).join('')}</div>
  </div>`;
}
function vCeremony(){
  const c=cfg(),rows=standings(),evs=Object.values(S.events),done=evs.filter(e=>e.g).length;
  const ev=c.eventName||'กีฬาสีภายใน',any=rows.some(r=>r.pts>0);
  const two=rows.length===2,top=rows.slice(0,two?2:3);
  const H={1:220,2:160,3:120};
  const crown=`<svg class="crown" viewBox="0 0 44 30" aria-hidden="true"><path d="M2 28 L6 6 L16 16 L22 2 L28 16 L38 6 L42 28 Z" fill="#C9A03A" stroke="#9A7422" stroke-width="1.5" stroke-linejoin="round"/><circle cx="22" cy="20" r="3" fill="#8C1B20"/></svg>`;
  const pod=r=>`<div class="pod">${r.rank===1?crown:''}${shirt(r.hex,'')}<b>${esc(r.name)}</b><small class="num">${r.pts} คะแนน · ทอง ${r.g}${two?' · เงิน '+r.s:''}</small>
    <div class="pod-block" style="--h:${H[r.rank]||120}px;background:${esc(r.hex)};color:${ink(r.hex)}">${two?`<span class="lbl">${r.rank===1?(rows[1].rank===1?'ชนะเลิศร่วม':'ชนะเลิศ'):'รองชนะเลิศ'}</span>`:`<span class="th">${thNum(r.rank)}</span>`}</div></div>`;
  const order=two?top:[top[1],top[0],top[2]].filter(Boolean);
  const rest=rows.slice(top.length);
  const note=two&&any?(rows[0].pts===rows[1].pts?`แข่งขันแล้ว ${done} รายการ · คะแนนเท่ากัน`:`แข่งขันแล้ว ${done} รายการ · ${rows[0].name}ชนะไป ${rows[0].pts-rows[1].pts} คะแนน`)
    :rest.map(r=>`อันดับ ${thNum(r.rank)} ${r.name} · ${r.pts} คะแนน`).join('   ');
  return `<div class="ov ov-cer" role="dialog" aria-label="พิธีมอบรางวัล">
  <div class="ov-tools"><button class="ov-btn" data-act="fs">เต็มจอ</button><button class="ov-btn" id="ov-close" data-act="close-ov">ปิด</button></div>
  <div class="cer-frame"><div class="cer-in"><div class="cer-strip"></div>
    <div class="cer-body">
      <div class="cer-side">${sideElephant('bce')}<div class="plinth"></div></div>
      <div class="cer-main">
        <div class="cer-eyebrow">พิธีมอบรางวัล${c.affiliation?' · '+esc(c.affiliation):''}</div>
        <h1>${esc(ev)} ${thNum(c.year||'')}</h1>
        <p>กีฬาสีภายใน${esc(c.school||'')}</p>
        ${any?`<div class="podium-row">${order.map(pod).join('')}</div><div class="pod-base"></div>${note?`<p class="cer-note num">${esc(note)}</p>`:''}`:'<div class="cer-empty">ยังไม่มีผลการแข่งขัน บันทึกผลที่แท็บ “การแข่งขัน” ก่อน</div>'}
      </div>
    </div>
  <div class="cer-strip"></div></div></div></div>`;
}
function renderOverlay(){
  const el=$('#ov');
  if(!S.view||S.mode==='loading'){el.hidden=true;el.innerHTML='';document.body.style.overflow='';return}
  el.hidden=false;el.innerHTML=S.view==='board'?vBoard():S.view==='pitch'?vPitch():S.view==='match'?vMatch():S.view==='judge'?vJudge():vCeremony();document.body.style.overflow='hidden';
}
async function openOv(v,id){
  S.view=v;if(id)S.matchId=id;try{history.replaceState(null,'','#'+(v==='match'?'match-'+S.matchId:v))}catch(e){}
  render();const b=$('#ov-close');if(b)b.focus();
  try{wakeLock=await navigator.wakeLock?.request('screen')}catch(e){wakeLock=null}
}
function closeOv(){
  S.view=null;try{history.replaceState(null,'','#'+S.tab)}catch(e){}
  try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}
  try{wakeLock&&wakeLock.release()}catch(e){}wakeLock=null;
  render();
}
document.addEventListener('keydown',e=>{if(S.view&&e.key==='Escape'&&!document.fullscreenElement)closeOv()});

/* ---------- การกระทำ ---------- */
async function onConfirm(key){
  S.confirm=null;
  const [k,a,b]=key.split(':');const c=clone(cfg());
  if(k==='reassign')return autoAssign(false);
  if(k==='delcls')return del('classes/'+a);
  if(k==='delev')return del('events/'+a);
  if(k==='m-reset')return matchUpdate(e=>{e.score={};e.status='';e.g=e.s=e.b=''});
  if(k==='delstu'){const d=clone(S.classes[a]);d.students=d.students.filter(s=>s.id!==b);return put('classes/'+a,d)}
  if(k==='delcol'){c.colors.splice(+a,1);return saveConfig(c)}
  if(k==='delt'){if(S.editT===+a)S.editT=null;return authCall('teacher.del',{id:+a},'ลบบัญชีแล้ว')}
  if(k==='clear-results'){for(const [id,e] of Object.entries(S.events))if(e.g||e.s||e.b)await put('events/'+id,{...e,g:'',s:'',b:''});return toast('ล้างผลแล้ว')}
  if(k==='clear-students'){for(const id of Object.keys(S.classes))await del('classes/'+id);return toast('ลบรายชื่อแล้ว')}
  if(k==='clear-all'||k==='clear-sample'){
    for(const id of Object.keys(S.classes))await del('classes/'+id);
    for(const id of Object.keys(S.events))await del('events/'+id);
    delete c.sample;await saveConfig(c);return toast('ล้างข้อมูลแล้ว');
  }
}
document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;const act=t.dataset.act;
  if(act==='tab'){S.tab=t.dataset.tab;S.confirm=null;try{history.replaceState(null,'','#'+S.tab)}catch(e){}render();return}
  if(act==='ask'){S.confirm=t.dataset.key;render();return}
  if(act==='cancel'){S.confirm=null;render();return}
  if(act==='confirm'){await onConfirm(t.dataset.key);render();return}
  if(act==='open')return openOv(t.dataset.view);
  if(act==='close-ov')return closeOv();
  if(act==='fs'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(e){toast('เปิดเต็มจอจากหน้านี้ไม่ได้ กด F11 หรือปุ่มเต็มจอของเบราว์เซอร์แทน')}return}
  if(act==='assign-new')return autoAssign(true);
  if(act==='import')return doImport();
  if(act==='copy')return copyRoster();
  if(act==='print')return window.print();
  if(act==='login-open'){S.login=true;if(!allowedTabs().some(([k])=>k===S.tab))S.tab='score';render();const u=$('#lg-user');if(u){u.focus();window.scrollTo({top:u.getBoundingClientRect().top+scrollY-120,behavior:'smooth'})}return}
  if(act==='login-close'){S.login=false;render();return}
  if(act==='logout'){S.login=false;S.editT=null;await authCall('logout',{},'ออกจากระบบแล้ว');return}
  if(act==='t-edit'){S.editT=+t.dataset.id;render();KEEP.slice(-6).forEach(id=>{const el=document.getElementById(id);if(el&&el.id!=='pw-old'&&el.id!=='pw-new'){const e=S.teachers.find(x=>x.id===S.editT)||{};el.value=id==='t-name'?e.name||'':id==='t-user'?e.username||'':id==='t-role'?e.role||'teacher':''}});$('#t-name').focus();return}
  if(act==='t-cancel'){S.editT=null;['t-name','t-user','t-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});render();return}
  if(act==='csv')return downloadCsv();
  if(act==='add-ev'){
    const name=$('#ev-name').value.trim();if(!name){toast('ใส่ชื่อรายการก่อน');return}
    const cat=$('#ev-cat').value,sm=$('#ev-scoring').value;
    const ok=await put('events/'+uid('e'),{name,cat,level:$('#ev-level').value.trim(),scoring:sm==='auto'?defaultScoring(cat):sm,order:Date.now(),g:'',s:'',b:''});
    if(ok){toast('เพิ่มรายการแล้ว')}return;
  }
  if(act==='add-color'){
    const c=clone(cfg());const used=c.colors.map(x=>x.name);const [name,hex]=EXTRA.find(e=>!used.includes(e[0]))||['สีใหม่','#888888'];
    c.colors.push({id:uid('c'),name,hex,teacher:''});return saveConfig(c);
  }
});
document.addEventListener('change',async ev=>{
  const t=ev.target;const act=t.dataset&&t.dataset.act;if(!act)return;
  if(act==='f-cls'){S.fClass=t.value;render();return}
  if(act==='f-color'){S.fColor=t.value;render();return}
  if(act==='opt-sex'){S.balanceSex=t.checked;return}
  if(act==='imp-cls'){S.importCls=t.value;const txt=$('#imp-text').value;render();$('#imp-text').value=txt;return}
  if(act==='move'){const d=clone(S.classes[t.dataset.cls]);const s=d.students.find(x=>x.id===t.dataset.sid);if(s){s.color=t.value;await put('classes/'+t.dataset.cls,d)}return}
  if(act==='result'){const e=clone(S.events[t.dataset.ev]);e[t.dataset.k]=t.value;e.at=Date.now();if(e.g&&e.status!=='live')e.status='done';await put('events/'+t.dataset.ev,e);return}
  const c=clone(cfg());
  if(act==='set'){c[t.dataset.f]=t.dataset.f==='year'?+t.value:t.value.trim();return saveConfig(c)}
  if(act==='col'){c.colors[+t.dataset.i][t.dataset.f]=t.value.trim();return saveConfig(c)}
  if(act==='pt'){c.points[t.dataset.k]=Math.max(0,+t.value||0);return saveConfig(c)}
});
document.addEventListener('submit',async ev=>{
  const f=ev.target;ev.preventDefault();
  const v=id=>(document.getElementById(id)||{}).value||'';
  if(f.id==='lg-form'){
    const d=await authCall('login',{username:v('lg-user'),password:v('lg-pass')});
    if(d&&d.user){S.login=false;$('#lg-pass').value='';toast('ยินดีต้อนรับ '+d.user.name);render()}
    return;
  }
  if(f.id==='su-form'){
    if(v('su-pass')!==v('su-pass2')){toast('รหัสผ่านสองช่องไม่ตรงกัน');return}
    await authCall('setup',{code:v('su-code'),username:v('su-user'),name:v('su-name'),password:v('su-pass')},'สร้างบัญชีผู้ดูแลแล้ว');
    return;
  }
  if(f.id==='pw-form'){
    try{await api('password',{old:v('pw-old'),new:v('pw-new')});['pw-old','pw-new'].forEach(id=>document.getElementById(id).value='');toast('เปลี่ยนรหัสผ่านแล้ว')}
    catch(e){toast((e&&e.error)||'เปลี่ยนรหัสผ่านไม่สำเร็จ')}
    return;
  }
  if(f.id==='t-form'){
    const d=await authCall('teacher.save',{id:S.editT||0,name:v('t-name'),username:v('t-user'),password:v('t-pass'),role:v('t-role')},S.editT?'บันทึกบัญชีแล้ว':'เพิ่มบัญชีครูแล้ว');
    if(d){S.editT=null;['t-name','t-user','t-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});const r=$('#t-role');if(r)r.value='teacher';render()}
  }
});
let qT=null;
document.addEventListener('input',ev=>{if(ev.target.id==='f-q'){S.q=ev.target.value;clearTimeout(qT);qT=setTimeout(render,150)}});
// เริ่มหลังโหลดสคริปต์ครบ (games.js ต่อท้าย)
document.addEventListener('DOMContentLoaded',()=>{render();poll()});
