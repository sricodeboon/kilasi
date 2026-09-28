import json,urllib.request,http.cookiejar,subprocess,re,os,tempfile
# เขียน PDF ทดสอบไว้ในโฟลเดอร์ชั่วคราว ไม่ให้หลุดเข้า git/zip
os.chdir(tempfile.mkdtemp(prefix='kilasi-docs-'))
print('ไฟล์ทดสอบอยู่ที่', os.getcwd())
B='http://127.0.0.1:8091/kilasi/'
cj=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
st=lambda:json.loads(op.open(B+'api.php?r=state').read())
def post(p,b,t):return op.open(urllib.request.Request(B+p,data=json.dumps(b,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':t}))
d=st();post('api.php?r=login',{'username':'tester','password':'test1234'},d['csrf']);d=st()
cols=[c['id'] for c in d['config']['colors']]
e=d['events']['e1'];e['g']=cols[1];e['s']=cols[0];post('api.php?r=put',{'path':'events/e1','data':e},d['csrf']);d=st()
docs=[('order',{'type':'order'}),('roster',{'type':'roster','cls':'all','color':'all','q':''}),('entries',{'type':'entries','event':'e1'}),('report',{'type':'report'}),('certs',{'type':'certs','events':['e1'],'mode':'win','team':True})]
for n,b in docs:
    r=post('pdf.php',b,d['csrf']);data=r.read();open('t_'+n+'.pdf','wb').write(data)
    info=subprocess.run(['pdfinfo','t_'+n+'.pdf'],capture_output=True,text=True).stdout
    txt=subprocess.run(['pdftotext','t_'+n+'.pdf','-'],capture_output=True,text=True).stdout
    bad=re.findall(r'\S*งา​?น\b',txt)
    rid=re.search(r'verify\.php\?r=([A-Z0-9]{10})',txt)
    print(n,r.headers.get('content-type'),re.search(r'Pages:\s+(\d+)',info).group(1),'code=',rid and rid.group(1),'tofu=',txt.count('�'))
    if n=='order':
        v=urllib.request.build_opener().open(B+'verify.php?r='+rid.group(1)).read().decode()
        print('  verify:',[t for t in ['ออกจากระบบกีฬาสีของโรงเรียนจริง','คำสั่งยังตรงกับระบบปัจจุบัน','คณะกรรมการครูประจำสี','พ.ต.ท.สมชาย'] if t in v])
