/* ---------- PDF จากเซิร์ฟเวอร์ (mPDF) ----------
   รายงานผล + QR · เกียรติบัตร + QR รายใบ · ใบรายชื่อผู้แข่งขัน · รายชื่อนักเรียน
   ขอไฟล์จาก pdf.php เสร็จแล้วขึ้นกล่อง “เปิด PDF / ดาวน์โหลด” ให้ครูแตะ (ใช้ได้ทุกเครื่อง ไม่ติดตัวกันป๊อปอัป) */

async function pdfOpen(params,label){
  if(!S.user){toast('กรุณาเข้าสู่ระบบครูก่อน');return}
  toast('กำลังสร้าง'+label+'…');
  const send=()=>fetch('pdf.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(params)});
  let res;
  try{
    res=await send();
    if(res.status===419){const d=await res.clone().json().catch(()=>({}));if(d.token){csrf=d.token;res=await send()}}
  }catch(e){toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');return}
  if(!res.ok||!(res.headers.get('content-type')||'').includes('pdf')){
    let msg='สร้าง PDF ไม่สำเร็จ';try{msg=(await res.json()).error||msg}catch(e){}
    toast(msg);
    if(res.status===401){S.user=null;S.canWrite=false;S.rev=-1;render()}
    return;
  }
  const url=URL.createObjectURL(await res.blob());
  pdfReady(url,label);
}
function pdfReady(url,label){
  const old=$('#pdf-ready');if(old)old.remove();
  const box=document.createElement('div');box.id='pdf-ready';box.className='pdf-ready';box.setAttribute('role','dialog');
  box.innerHTML=`<b>${esc(label)} พร้อมแล้ว</b><span class="bar"><a class="btn" href="${url}" target="_blank" rel="noopener">เปิด PDF</a><a class="btn ghost" href="${url}" download="${esc(label)}.pdf">ดาวน์โหลด</a><button class="btn ghost" data-act="pdf-ready-close">ปิด</button></span>`;
  document.body.appendChild(box);
}
const printReport=()=>pdfOpen({type:'report'},'รายงานผล');
const printCerts=()=>pdfOpen({type:'certs',events:[...(S.certSel||[])],mode:S.certMode||'win',team:!!S.certTeam},'เกียรติบัตร');

document.addEventListener('click',ev=>{
  const t=ev.target.closest('[data-act]');if(!t)return;
  const a=t.dataset.act;
  if(a==='print-report')printReport();
  if(a==='pdf-entries')pdfOpen({type:'entries',event:t.dataset.ev},'ใบรายชื่อผู้แข่งขัน');
  if(a==='pdf-ready-close'){const b=$('#pdf-ready');if(b)b.remove()}
  if(a==='pdf-roster')pdfOpen({type:'roster',cls:S.fClass,color:S.fColor,q:S.q},'รายชื่อนักเรียน');
});
