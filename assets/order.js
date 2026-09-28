/* ---------- คำสั่งแต่งตั้งคณะกรรมการดำเนินงานกีฬาสี ----------
   เก็บใน config.order · ผู้ดูแลแก้ได้ ครูทุกคนพิมพ์ PDF ได้ (pdf.php type=order)
   ฝ่ายชนิด colors ดึงครูประจำสีจากแท็บแบ่งสีตอนพิมพ์ ไม่ต้องกรอกซ้ำ */

const ROLES=['ประธานกรรมการ','รองประธานกรรมการ','กรรมการ','กรรมการและเลขานุการ','กรรมการและผู้ช่วยเลขานุการ'];
const ORDER_UNITS=[
  ['คณะกรรมการอำนวยการ','ให้คำปรึกษา แนะนำ อำนวยความสะดวก และแก้ไขปัญหาต่าง ๆ เพื่อให้การดำเนินงานเป็นไปด้วยความเรียบร้อย'],
  ['คณะกรรมการดำเนินงาน','วางแผน กำหนดโปรแกรมการแข่งขัน ประสานงานกับทุกฝ่าย และดำเนินการจัดการแข่งขันให้เป็นไปตามกำหนดการ'],
  ['คณะกรรมการครูประจำสี','ดูแล ฝึกซ้อม และควบคุมนักกีฬาในสีที่รับผิดชอบ จัดส่งรายชื่อนักกีฬา จัดขบวนพาเหรดและกองเชียร์ ดูแลความปลอดภัยและระเบียบวินัยของนักเรียน','colors'],
  ['คณะกรรมการฝ่ายสถานที่และอุปกรณ์','จัดเตรียมสนามแข่งขัน ขีดเส้นสนาม เต็นท์ โต๊ะ เก้าอี้ เครื่องเสียง และอุปกรณ์การแข่งขัน ดูแลความสะอาดเรียบร้อยหลังเสร็จสิ้นการแข่งขัน'],
  ['คณะกรรมการฝ่ายพิธีการและประชาสัมพันธ์','จัดพิธีเปิดและพิธีปิด ดำเนินรายการ ประกาศผลการแข่งขัน ประชาสัมพันธ์ และบันทึกภาพกิจกรรม'],
  ['คณะกรรมการฝ่ายตัดสินการแข่งขัน','ตัดสินการแข่งขันตามกติกาด้วยความยุติธรรม บันทึกผลการแข่งขันลงระบบ และส่งผลให้ฝ่ายประเมินผล','judges'],
  ['คณะกรรมการฝ่ายพยาบาล','ปฐมพยาบาลเบื้องต้น จัดเตรียมยาและเวชภัณฑ์ และประสานส่งต่อผู้บาดเจ็บไปยังสถานพยาบาล'],
  ['คณะกรรมการฝ่ายรางวัลและเกียรติบัตร','จัดเตรียมเหรียญรางวัล ถ้วยรางวัล และเกียรติบัตร และดำเนินการมอบรางวัล'],
  ['คณะกรรมการฝ่ายประเมินผลและรายงาน','ประเมินผลการดำเนินงาน สรุปและรายงานผลการแข่งขันเสนอผู้บริหาร'],
];
const orderCfg=()=>cfg().order||null;
/* ฝ่ายตัดสิน: ชนิด judges หรือร่างเก่าที่ชื่อฝ่ายมีคำว่า ตัดสิน (ต้องตรงกับ order_payload) */
const isJudgeUnit=u=>u.type==='judges'||(!u.type&&/ตัดสิน/.test(u.name||''));

/* ร่างคำสั่งจากทำเนียบครู: คนแรกในทำเนียบ = ครูใหญ่ */
function orderDraft(){
  const c=cfg(),S0=staffList().map(p=>p.name),st=certSettings();
  const boss=st.s1n||S0[0]||'';
  const rest=S0.filter(n=>norm(n)!==norm(boss));
  const m=(n,role)=>({name:n,role});
  const units=ORDER_UNITS.map(([name,duty,type])=>({id:uid('u'),name,duty,...(type?{type}:{}),members:[]}));
  if(boss)units[0].members.push(m(boss,'ประธานกรรมการ'));
  if(rest[0])units[0].members.push(m(rest[0],'รองประธานกรรมการ'));
  if(rest[1])units[0].members.push(m(rest[1],'กรรมการและเลขานุการ'));
  if(rest.length){
    units[1].members=rest.map((n,i)=>m(n,i===0?'ประธานกรรมการ':i===rest.length-1&&rest.length>2?'กรรมการและเลขานุการ':'กรรมการ'));
  }
  const pool=rest.slice(1),side=units.slice(3);
  pool.forEach((n,i)=>side[i%side.length].members.push(m(n,'')));
  side.forEach(u=>u.members.forEach((x,i)=>x.role=i===0?'ประธานกรรมการ':i===u.members.length-1?'กรรมการและเลขานุการ':'กรรมการ'));
  return {
    no:'',date:new Date().toISOString().slice(0,10),
    subject:`แต่งตั้งคณะกรรมการดำเนินงานการแข่งขันกีฬาสีภายใน “${c.eventName||'กีฬาสีภายใน'}” ประจำปีการศึกษา ${c.year||''}`,
    intro:`ด้วย${c.school||'โรงเรียน'} กำหนดจัดการแข่งขันกีฬาสีภายใน “${c.eventName||'กีฬาสีภายใน'}” ประจำปีการศึกษา ${c.year||''} เพื่อส่งเสริมให้นักเรียนได้ออกกำลังกาย มีสุขภาพกายและสุขภาพจิตที่ดี รู้แพ้ รู้ชนะ รู้อภัย มีน้ำใจนักกีฬา และรู้จักการทำงานร่วมกันเป็นหมู่คณะ ดังนั้น เพื่อให้การดำเนินงานเป็นไปด้วยความเรียบร้อยและบรรลุวัตถุประสงค์ จึงแต่งตั้งคณะกรรมการดำเนินงาน ดังต่อไปนี้`,
    closing:'ให้ผู้ที่ได้รับการแต่งตั้งปฏิบัติหน้าที่ที่ได้รับมอบหมายอย่างเต็มกำลังความสามารถ ด้วยความรับผิดชอบ เพื่อให้เกิดผลดีต่อนักเรียนและทางราชการ\nทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป',
    signer:boss,signerPos:'ครูใหญ่'+(c.school||''),units,
  };
}
function saveOrder(fn){const c=clone(cfg());c.order=clone(c.order||orderDraft());fn(c.order);return saveConfig(c)}

/* ครูประจำสีจากแท็บแบ่งสี (หัวหน้าสีขึ้นก่อน) */
function colorTeams(){
  return cfg().colors.map(col=>({col,list:staffIn(col.id).slice().sort((a,b)=>(headOf(b)?1:0)-(headOf(a)?1:0))}));
}

function vOrder(){
  const o=orderCfg(),A=isAdmin();
  if(!o)return `<section class="panel">
    <h2>คำสั่งแต่งตั้งคณะกรรมการ</h2>
    <p class="hint">ระบบร่างคำสั่งแต่งตั้งคณะกรรมการดำเนินงานกีฬาสี 9 ฝ่าย พร้อมหน้าที่ และกระจายชื่อครูจากทำเนียบครูให้ก่อน (คนแรกในทำเนียบเป็นครูใหญ่) แล้วแก้ไขได้ทุกช่อง ฝ่ายครูประจำสีดึงจากแท็บแบ่งสีอัตโนมัติ</p>
    ${A?`<div class="bar" style="margin-top:12px"><button class="btn" data-act="ord-draft"${staffList().length?'':' disabled'}>ร่างคำสั่งจากทำเนียบครู</button>${staffList().length?'':'<span class="hint">เพิ่มทำเนียบครูที่ ตั้งค่า → บัญชีครู ก่อน</span>'}</div>`:'<p class="hint" style="margin-top:10px">ผู้ดูแลระบบยังไม่ได้ร่างคำสั่ง</p>'}
  </section>`;
  const f=(k,label,ph='',type='text')=>`<label class="f">${label}<input type="${type}" id="ord-${k}" data-act="ord-set" data-f="${k}" value="${esc(o[k]||'')}" placeholder="${ph}"${k==='signer'?' list="staff-dl"':''}${disA()}></label>`;
  const roleOpts=r=>ROLES.map(x=>`<option${x===r?' selected':''}>${x}</option>`).join('');
  const units=(o.units||[]).map((u,i)=>{
    const body=u.type==='colors'
      ?`<div class="ord-colors">${colorTeams().map(({col,list})=>`<div><b><i class="sw" style="background:${esc(col.hex)}"></i>${esc(col.name)}</b>${list.length?`<ol>${list.map(p=>`<li>${esc(p.name)} <span class="hint">${headOf(p)?'หัวหน้าสี':'ครูประจำสี'}</span></li>`).join('')}</ol>`:'<p class="hint">ยังไม่มีครูในสีนี้</p>'}</div>`).join('')}</div>
        <p class="hint">ดึงจากแท็บ “แบ่งสี” อัตโนมัติ แก้รายชื่อหรือหัวหน้าสีได้ที่นั่น</p>`
      :`<div class="tbl-wrap"><table><thead><tr><th>ชื่อ-สกุล</th><th>ตำแหน่งในคณะกรรมการ</th><th></th></tr></thead><tbody>
        ${(u.members||[]).map((x,j)=>`<tr>
          <td><input type="text" id="om-n-${u.id}-${j}" list="staff-dl" data-act="ord-mem" data-u="${i}" data-j="${j}" data-f="name" value="${esc(x.name)}" aria-label="ชื่อกรรมการ" style="min-width:210px"${disA()}></td>
          <td><select id="om-r-${u.id}-${j}" data-act="ord-mem" data-u="${i}" data-j="${j}" data-f="role" aria-label="ตำแหน่ง"${disA()}>${roleOpts(x.role)}</select></td>
          <td>${A?`<button class="btn sm ghost" data-act="ord-mem-del" data-u="${i}" data-j="${j}">ลบ</button>`:''}</td></tr>`).join('')}
        </tbody></table></div>
        ${A?`<button class="btn sm ghost" data-act="ord-mem-add" data-u="${i}" style="margin-top:8px">+ เพิ่มกรรมการ</button>`:''}
        ${isJudgeUnit(u)?`<div class="ord-colors" style="margin-top:10px">${sportGroups().filter(g=>judgeNames(g.key).length).map(g=>`<div><b>${esc(g.key)}</b><ol>${judgesOf(g.key).filter(x=>x.name).map(x=>`<li>${esc(x.name)} <span class="hint">${esc(x.role||'กรรมการ')}</span></li>`).join('')}</ol></div>`).join('')||'<p class="hint">ยังไม่ได้ตั้งกรรมการตัดสินแต่ละชนิดกีฬา</p>'}</div>
          <p class="hint">กรรมการตัดสินแต่ละชนิดกีฬาดึงจากแท็บ “การแข่งขัน” → คณะกรรมการตัดสิน ต่อท้ายรายชื่อด้านบน</p>`:''}`;
    return `<section class="panel ord-unit">
      <div class="bar"><span class="ord-no num">${i+1}</span>
        <input type="text" id="ou-n-${u.id}" class="ord-uname" data-act="ord-unit" data-u="${i}" data-f="name" value="${esc(u.name)}" aria-label="ชื่อฝ่าย"${disA()}>
        ${A?`<span class="bar" style="gap:4px"><button class="btn sm ghost" data-act="ord-mv" data-u="${i}" data-d="-1"${i===0?' disabled':''} aria-label="เลื่อนขึ้น">↑</button><button class="btn sm ghost" data-act="ord-mv" data-u="${i}" data-d="1"${i===o.units.length-1?' disabled':''} aria-label="เลื่อนลง">↓</button>${confirmBtn('delunit:'+i,'ลบฝ่าย')}</span>`:''}</div>
      <div style="margin-top:10px">${body}</div>
      <label class="f" style="margin-top:10px">มีหน้าที่<textarea id="ou-d-${u.id}" data-act="ord-unit" data-u="${i}" data-f="duty" rows="2"${disA()}>${esc(u.duty||'')}</textarea></label>
    </section>`;
  }).join('');
  return `
  <section class="panel">
    <div class="bar"><div><h2>คำสั่งแต่งตั้งคณะกรรมการ</h2><p class="hint">${A?'แก้ไขแล้วบันทึกทันที':'แก้ได้เฉพาะผู้ดูแลระบบ พิมพ์ได้ทุกคน'} · PDF รูปแบบหนังสือราชการ ตราครุฑ (ไม่มี QR)</p></div><span class="spacer"></span>
      <button class="btn" data-act="pdf-order">PDF คำสั่ง</button></div>
    <div class="cert-grid">
      ${f('no','เลขที่คำสั่ง (ไม่ต้องใส่ /ปี)','เช่น 12')}
      ${f('date','สั่ง ณ วันที่','','date')}
    </div>
    <label class="f" style="margin-top:12px">เรื่อง<input type="text" id="ord-subject" data-act="ord-set" data-f="subject" value="${esc(o.subject||'')}"${disA()}></label>
    <label class="f" style="margin-top:12px">ข้อความนำ<textarea id="ord-intro" data-act="ord-set" data-f="intro" rows="4"${disA()}>${esc(o.intro||'')}</textarea></label>
  </section>
  ${units}
  ${A?`<div class="bar" style="margin:4px 0 16px"><button class="btn ghost" data-act="ord-unit-add">+ เพิ่มฝ่าย</button><span class="spacer"></span>${confirmBtn('ord-redraft','ร่างใหม่ทั้งหมดจากทำเนียบครู')}</div>`:''}
  <section class="panel">
    <h2>ท้ายคำสั่งและผู้ลงนาม</h2>
    <label class="f" style="margin-top:10px">ข้อความท้าย (ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่)<textarea id="ord-closing" data-act="ord-set" data-f="closing" rows="3"${disA()}>${esc(o.closing||'')}</textarea></label>
    <div class="cert-grid">
      ${f('signer','ผู้ลงนาม','ชื่อ-สกุล')}
      ${f('signerPos','ตำแหน่ง','เช่น ครูใหญ่โรงเรียน…')}
    </div>
  </section>`;
}

document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,u=+t.dataset.u;
  if(a==='ord-draft'){const c=clone(cfg());c.order=orderDraft();await saveConfig(c);toast('ร่างคำสั่งแล้ว ตรวจและแก้ไขได้เลย');return}
  if(a==='ord-mem-add')return saveOrder(o=>o.units[u].members.push({name:'',role:'กรรมการ'}));
  if(a==='ord-mem-del')return saveOrder(o=>o.units[u].members.splice(+t.dataset.j,1));
  if(a==='ord-mv')return saveOrder(o=>{const d=+t.dataset.d,x=o.units.splice(u,1)[0];o.units.splice(u+d,0,x)});
  if(a==='ord-unit-add')return saveOrder(o=>o.units.push({id:uid('u'),name:'คณะกรรมการฝ่าย',duty:'',members:[{name:'',role:'ประธานกรรมการ'}]}));
  if(a==='pdf-order')return pdfOpen({type:'order'},'คำสั่งแต่งตั้ง');
});
document.addEventListener('change',async ev=>{
  const t=ev.target;const a=t.dataset&&t.dataset.act;if(!a)return;const u=+t.dataset.u;
  if(a==='ord-set')return saveOrder(o=>{o[t.dataset.f]=t.value.trim()});
  if(a==='ord-unit')return saveOrder(o=>{o.units[u][t.dataset.f]=t.value.trim()});
  if(a==='ord-mem')return saveOrder(o=>{o.units[u].members[+t.dataset.j][t.dataset.f]=t.value.trim()});
});
