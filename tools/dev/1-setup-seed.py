import json,subprocess,urllib.request,http.cookiejar,re,sys,os,tempfile
CFG=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..','config.php'))
os.chdir(tempfile.mkdtemp(prefix='kilasi-seed-'))  # PDF ทดสอบไม่ลงโฟลเดอร์โปรเจกต์
B='http://127.0.0.1:8091/kilasi/'
cj=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def st():return json.loads(op.open(B+'api.php?r=state').read())
def post(path,body,tok):
    r=urllib.request.Request(B+path,data=json.dumps(body,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':tok})
    return op.open(r)
d=st()
code=subprocess.check_output(['php','-r','$c=require "'+CFG+'";echo $c["setup_code"];']).decode()
if d.get('setup'):post('api.php?r=setup',{'code':code,'username':'tester','name':'ครูทดสอบ','password':'test1234'},d['csrf'])
else:post('api.php?r=login',{'username':'tester','password':'test1234'},d['csrf'])
d=st();cfg=d['config'];cols=[c['id'] for c in cfg['colors']]
cfg['staff']=[{'name':'พ.ต.ท.สมชาย ใจดี','cls':'','user':'kru01','color':cols[1]},{'name':'ด.ต.หญิงมาลี ศรีสุข','cls':'ป.1','user':'kru04','color':cols[0]}]
cfg['colors'][1]['teacher']='พ.ต.ท.สมชาย ใจดี'
post('api.php?r=put',{'path':'config/main','data':cfg},d['csrf'])
stu=[{'id':'s1','no':1,'name':'ด.ช.ทดสอบ หนึ่ง','sex':'ช','color':cols[0]},{'id':'s2','no':2,'name':'ด.ญ.ทดสอบ สอง','sex':'ญ','color':cols[1]}]
post('api.php?r=put',{'path':'classes/c1','data':{'name':'ป.4','students':stu}},d['csrf'])
post('api.php?r=put',{'path':'events/e1','data':{'name':'วิ่ง 50 ม.','cat':'กรีฑา','level':'ป.4','order':1,'g':'','s':'','b':'','entries':{cols[0]:['s1'],cols[1]:['s2']}}},d['csrf'])
d=st()
out={}
for body,fn in [({'type':'roster','cls':'all','color':'all','q':''},'q_roster.pdf'),({'type':'entries','event':'e1'},'q_entries.pdf')]:
    r=post('pdf.php',body,d['csrf']);open(fn,'wb').write(r.read())
    txt=subprocess.run(['pdftotext',fn,'-'],capture_output=True,text=True).stdout
    m=re.search(r'verify\.php\?r=([A-Z0-9]{10})',txt);out[fn]=m.group(1) if m else None
print(out)
anon=urllib.request.build_opener()
def v(opener,rid):
    h=opener.open(B+'verify.php?r='+rid).read().decode()
    return [t for t in ['ออกจากระบบกีฬาสีของโรงเรียนจริง','รายชื่อยังตรงกับระบบปัจจุบัน','มีการแก้ไขรายชื่อหลังพิมพ์','ทดสอบ หนึ่ง','รายชื่อเต็มแสดงเฉพาะครู','สมชาย'] if t in h]
for fn,rid in out.items():print(fn,'anon',v(anon,rid));print(fn,'teacher',v(op,rid))
# ย้ายสีนักเรียน s1 → ต้องขึ้นว่าแก้ไขแล้ว
stu[0]['color']=cols[1];post('api.php?r=put',{'path':'classes/c1','data':{'name':'ป.4','students':stu}},d['csrf'])
for fn,rid in out.items():print('after move',fn,v(anon,rid))
