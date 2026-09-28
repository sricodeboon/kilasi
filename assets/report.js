/* ---------- พิมพ์รายงานผลการแข่งขัน + QR ตรวจสอบเอกสาร ----------
   ก่อนพิมพ์ ระบบเก็บสำเนาเอกสารไว้ที่เซิร์ฟเวอร์ (api.php?r=report.create) ได้รหัส 10 ตัว
   QR ชี้ไปที่ verify.php?r=รหัส (เกียรติบัตรรายใบ &n=ลำดับ) ซึ่งบอกว่าเอกสารออกจากระบบจริงไหม และผลถูกแก้หลังพิมพ์หรือไม่ */

function qrSvg(text){
  if(typeof qrcode!=='function')return '';
  const q=qrcode(0,'M');q.addData(text);q.make();
  return q.createSvgTag({cellSize:4,margin:0,scalable:true});
}
const verifyUrl=(id,n)=>new URL('verify.php?r='+id+(n!=null?'&n='+n:''),location.href).href;
const docCode=id=>id.replace(/(.{4})(?=.)/g,'$1-');
async function createDoc(kind,payload){
  try{const r=await api('report.create',{kind,payload});return r.id}
  catch(e){toast((e&&e.error)||'สร้างรหัสตรวจสอบไม่สำเร็จ');return null}
}
function nowThai(){
  const d=new Date();
  return thNum(d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})+' เวลา '+d.toTimeString().slice(0,5)+' น.');
}

/* ---------- รายงานผล ---------- */
function reportPayload(){
  const evs=Object.values(S.events).sort((a,b)=>(a.order||0)-(b.order||0));
  const nm=id=>(colorById(id)||{}).name||'';
  return {
    bronze:hasBronze(),
    done:evs.filter(e=>e.g).length,total:evs.length,
    standings:standings().map(r=>({rank:r.rank,name:r.name,hex:r.hex,g:r.g,s:r.s,b:r.b,pts:r.pts})),
    results:evs.map(e=>({cat:e.cat||'อื่น ๆ',name:e.name,level:e.level||'ทุกระดับ',g:e.g?nm(e.g):'',s:e.s?nm(e.s):'',b:e.b?nm(e.b):'',score:scoreText(e)||''}))
  };
}
function reportHTML(p,id){
  const c=cfg(),P=c.points||{},st=certSettings(),mk=medalKeys();
  const signers=[[st.s1n,st.s1p],[st.s2n,st.s2p]].filter(s=>s[0]||s[1]);
  const sw=name=>{const col=cfg().colors.find(x=>x.name===name);return name?`<i class="rpt-sw" style="background:${esc(col?col.hex:'#999')}"></i>${esc(name)}`:'<span class="rpt-dim">รอแข่ง</span>'};
  const cats=[...new Set(p.results.map(r=>r.cat))];
  const url=id?verifyUrl(id):'';
  return `<div class="rpt">
    <div class="rpt-h">
      <img class="rpt-logo" src="assets/logo.svg" alt="">
      <div class="rpt-t">
        <div class="rpt-school">${esc(c.school||'')}</div>
        ${c.affiliation?`<div class="rpt-affil">${esc(c.affiliation)}</div>`:''}
        <h1>รายงานผลการแข่งขันกีฬาสีภายใน “${esc(c.eventName||'กีฬาสีภายใน')}” ปีการศึกษา ${thNum(c.year||'')}</h1>
        <div class="rpt-meta">พิมพ์เมื่อ ${nowThai()} · โดย ${esc(S.user?S.user.name:'')} · แข่งแล้ว ${thNum(p.done)} จาก ${thNum(p.total)} รายการ</div>
      </div>
      ${id?`<div class="rpt-qr">${qrSvg(url)}<small>สแกนเพื่อตรวจสอบ<br><b>${docCode(id)}</b></small></div>`:''}
    </div>
    <h2>สรุปคะแนนรวม</h2>
    <table class="rpt-tb"><thead><tr><th>อันดับ</th><th>สี</th>${mk.map(k=>`<th class="r">${MEDAL[k]}</th>`).join('')}<th class="r">คะแนนรวม</th></tr></thead>
    <tbody>${p.standings.map(r=>`<tr><td>${thNum(r.rank)}</td><td>${sw(r.name)}</td>${mk.map(k=>`<td class="r">${thNum(r[k])}</td>`).join('')}<td class="r"><b>${thNum(r.pts)}</b></td></tr>`).join('')}</tbody></table>
    <p class="rpt-note">เกณฑ์คะแนน ${mk.map(k=>MEDAL[k]+' '+thNum(P[k]||0)).join(' · ')} คะแนน · คะแนนเท่ากันตัดสินด้วยจำนวนเหรียญทอง แล้วจึงเหรียญเงิน</p>
    ${cats.map(cat=>`<h2>${esc(cat)}</h2>
    <table class="rpt-tb"><thead><tr><th>ที่</th><th>รายการ</th><th>ระดับชั้น</th><th>ชนะเลิศ</th><th>${hasBronze()?'รองฯ อันดับ 1':'รองชนะเลิศ'}</th>${p.bronze?'<th>รองฯ อันดับ 2</th>':''}<th>ผล</th></tr></thead>
    <tbody>${p.results.filter(r=>r.cat===cat).map((r,i)=>`<tr><td>${thNum(i+1)}</td><td>${esc(r.name)}</td><td>${esc(r.level)}</td><td>${sw(r.g)}</td><td>${r.g?sw(r.s):''}</td>${p.bronze?`<td>${r.g?sw(r.b):''}</td>`:''}<td>${esc(r.score)}</td></tr>`).join('')}</tbody></table>`).join('')}
    ${signers.length?`<div class="rpt-sign">${signers.map(s=>`<div><span class="cert-line"></span><b>${s[0]?'('+esc(s[0])+')':'&nbsp;'}</b><small>${esc(s[1])}</small></div>`).join('')}</div>`:''}
    <p class="rpt-foot">${id?`ตรวจสอบรายงานฉบับนี้ได้ที่ ${esc(url)}`:'รายงานฉบับนี้ไม่มีรหัสตรวจสอบ'}</p>
  </div>`;
}
async function printReport(){
  if(!S.user){toast('กรุณาเข้าสู่ระบบครูก่อนพิมพ์รายงาน');return}
  const p=reportPayload();
  if(!p.total){toast('ยังไม่มีรายการแข่งขัน');return}
  toast('กำลังเตรียมรายงาน…');
  const id=await createDoc('report',p);
  printPages(reportHTML(p,id),'A4 portrait');
}

/* ---------- เกียรติบัตรมี QR รายใบ ---------- */
async function printCerts(){
  const list=certList();if(!list.length)return;
  toast('กำลังเตรียมเกียรติบัตร '+list.length+' ใบ…');
  const id=await createDoc('certs',{items:list.map(x=>({name:x.name,sub:x.sub,award:x.award,what:x.what}))});
  const html=list.map((x,i)=>certHTML(id?{...x,qr:qrSvg(verifyUrl(id,i)),code:docCode(id)+' · '+thNum(i+1)}:x)).join('');
  printPages(html,'A4 landscape');
}

document.addEventListener('click',ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;
  if(t.dataset.act==='print-report')printReport();
});
