/* ---------- คณะกรรมการตัดสินแยกตามชนิดกีฬา ----------
   config.judges = { "ชนิดกีฬา": [{name, role}] } (ผู้ดูแลแก้ ครูทุกคนดูได้)
   ชนิดกีฬาของรายการ: กีฬาประเภททีมแยกตามชื่อกีฬา (ฟุตบอล วอลเลย์บอล …) ประเภทอื่นรวมตามประเภท (กรีฑา กีฬาพื้นบ้าน)
   ใช้ใน: คำสั่งแต่งตั้ง (ฝ่ายตัดสิน) · รายงานผล PDF · ช่องลงนามใบรายชื่อผู้แข่งขัน — ต้องตรงกับ sport_key() ใน lib/report.php */

function sportKey(e){
  if(e.sport)return String(e.sport).trim();
  const name=String(e.name||'').trim();
  if(e.cat==='กีฬาประเภททีม')return name.replace(/\s+(ชาย|หญิง|ผสม)$/,'').trim()||name;
  return e.cat||name||'อื่น ๆ';
}
function sportGroups(){
  const evs=Object.entries(S.events).map(([id,e])=>({id,...e})).sort((a,b)=>(a.order||0)-(b.order||0));
  const out=[];
  for(const e of evs){const k=sportKey(e);let g=out.find(x=>x.key===k);if(!g)out.push(g={key:k,events:[]});g.events.push(e)}
  return out;
}
const judgesOf=key=>((cfg().judges||{})[key]||[]);
const judgeNames=key=>judgesOf(key).filter(x=>x.name).map(x=>x.name);

function vJudges(){
  const G=sportGroups(),A=isAdmin();
  if(!G.length)return '';
  const done=G.filter(g=>judgeNames(g.key).length).length;
  const head=`<div class="bar"><div><h2>คณะกรรมการตัดสิน</h2><p class="hint num">แยกตามชนิดกีฬา ${G.length} ชนิด · ตั้งแล้ว ${done} ชนิด · ชื่อขึ้นในคำสั่งแต่งตั้ง รายงานผล และช่องลงนามใบรายชื่อผู้แข่งขัน</p></div><span class="spacer"></span>
    <button class="btn sm ghost" data-act="jg-toggle" aria-expanded="${!!S.judgesOpen}">${S.judgesOpen?'ซ่อน':'จัดกรรมการตัดสิน'}</button></div>`;
  if(!S.judgesOpen)return `<section class="panel">${head}</section>`;
  const roleOpts=r=>ROLES.map(x=>`<option${x===r?' selected':''}>${x}</option>`).join('');
  const cards=G.map((g,gi)=>{
    const list=judgesOf(g.key);
    return `<div class="jg-card">
      <div class="jg-h"><b>${esc(g.key)}</b><span class="hint">${g.events.map(e=>esc(e.name)).join(' · ')}</span></div>
      ${list.length?`<div class="tbl-wrap"><table><tbody>${list.map((x,j)=>`<tr>
        <td><input type="text" id="jg-n-${gi}-${j}" list="staff-dl" data-act="jg-mem" data-k="${esc(g.key)}" data-j="${j}" data-f="name" value="${esc(x.name)}" placeholder="ชื่อกรรมการ" aria-label="ชื่อกรรมการตัดสิน${esc(g.key)}" style="min-width:170px"${disA()}></td>
        <td><select id="jg-r-${gi}-${j}" data-act="jg-mem" data-k="${esc(g.key)}" data-j="${j}" data-f="role" aria-label="ตำแหน่ง"${disA()}>${roleOpts(x.role)}</select></td>
        <td>${A?`<button class="btn sm ghost" data-act="jg-del" data-k="${esc(g.key)}" data-j="${j}">ลบ</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">ยังไม่มีกรรมการ</p>'}
      ${A?`<button class="btn sm ghost" data-act="jg-add" data-k="${esc(g.key)}" style="margin-top:6px">+ เพิ่มกรรมการ</button>`:''}
    </div>`;
  }).join('');
  return `<section class="panel">${head}
    ${A?`<div class="bar" style="margin-top:10px"><button class="btn sm" data-act="jg-draft"${staffList().length?'':' disabled'}>ร่างกรรมการตัดสินจากทำเนียบครู</button><span class="hint">ใส่ชื่อเฉพาะชนิดกีฬาที่ยังไม่มีกรรมการ ไม่แตะชนิดที่ตั้งไว้แล้ว</span></div>`:'<p class="hint">แก้ได้เฉพาะผู้ดูแลระบบ</p>'}
    <div class="jg-grid">${cards}</div></section>`;
}
/* ร่างกรรมการตัดสินให้ชนิดกีฬาที่ยังไม่มี: กระจายครูในทำเนียบ (ยกเว้นครูใหญ่) ให้คนที่ได้งานน้อยสุดก่อน
   กรีฑาใช้ 3 ท่าน ชนิดอื่น 2 ท่าน · คนแรกเป็นประธานกรรมการ คนสุดท้ายเป็นกรรมการและเลขานุการ */
function draftJudges(){
  const boss=norm((cfg().order||{}).signer||certSettings().s1n||'');
  const pool=staffList().map(p=>p.name).filter(n=>n&&norm(n)!==boss);
  const todo=sportGroups().filter(g=>!judgeNames(g.key).length);
  if(!pool.length){toast('ยังไม่มีทำเนียบครู');return}
  if(!todo.length){toast('ทุกชนิดกีฬามีกรรมการแล้ว');return}
  const c=clone(cfg());c.judges={...(c.judges||{})};
  // เลือกครูที่ได้งานตัดสินน้อยที่สุดก่อน (นับรวมชนิดที่ตั้งไว้แล้ว) ภาระงานจะกระจาย
  const used=Object.fromEntries(pool.map(n=>[n,0]));
  Object.values(c.judges).forEach(l=>l.forEach(x=>{if(x.name in used)used[x.name]++}));
  for(const g of todo){
    const n=Math.min(pool.length,g.key==='กรีฑา'?3:2);
    const pick=pool.map((name,i)=>({name,i})).sort((a,b)=>used[a.name]-used[b.name]||a.i-b.i).slice(0,n).map(x=>x.name);
    pick.forEach(x=>used[x]++);
    c.judges[g.key]=pick.map((name,i)=>({name,role:i===0?'ประธานกรรมการ':i===n-1?'กรรมการและเลขานุการ':'กรรมการ'}));
  }
  return saveConfig(c).then(r=>{toast(`ร่างกรรมการตัดสินแล้ว ${todo.length} ชนิดกีฬา ตรวจและแก้ได้เลย`);return r});
}
function saveJudges(key,fn){
  const c=clone(cfg());c.judges={...(c.judges||{})};
  const list=(c.judges[key]||[]).map(x=>({...x}));fn(list);
  if(list.length)c.judges[key]=list;else delete c.judges[key];
  return saveConfig(c);
}

document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,k=t.dataset.k;
  if(a==='jg-toggle'){S.judgesOpen=!S.judgesOpen;render();return}
  if(a==='jg-draft')return draftJudges();
  if(a==='jg-add')return saveJudges(k,l=>l.push({name:'',role:l.length?'กรรมการ':'ประธานกรรมการ'}));
  if(a==='jg-del')return saveJudges(k,l=>l.splice(+t.dataset.j,1));
});
document.addEventListener('change',async ev=>{
  const t=ev.target;if(!t.dataset||t.dataset.act!=='jg-mem')return;
  return saveJudges(t.dataset.k,l=>{if(l[+t.dataset.j])l[+t.dataset.j][t.dataset.f]=t.value.trim()});
});
