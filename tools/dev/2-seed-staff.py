import json,urllib.request,http.cookiejar
B='http://127.0.0.1:8091/kilasi/'
cj=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
st=lambda:json.loads(op.open(B+'api.php?r=state').read())
def post(p,b,t):return op.open(urllib.request.Request(B+p,data=json.dumps(b,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':t})).read()
d=st();post('api.php?r=login',{'username':'tester','password':'test1234'},d['csrf']);d=st()
cfg=d['config'];Y,P=[c['id'] for c in cfg['colors']]
names=[("พ.ต.ท.สมชาย ใจดี","",""),("ร.ต.อ.สมศักดิ์ มั่นคง","",Y),("ร.ต.ท.ประเสริฐ ทองดี","",P),("ด.ต.หญิงมาลี ศรีสุข","ป.1",Y),("ด.ต.หญิงวันดี มีสุข","ป.2",P),("ด.ต.หญิงสุนีย์ รักดี","ป.4",Y),("จ.ส.ต.หญิงบุญมี ใจงาม","ป.3",P),("ส.ต.ท.สมหมาย ดีเลิศ","ป.6",Y),("นางสาวกมลา แสงทอง","อ.1, อ.2",P),("นางสาวพรทิพย์ สุขใจ","อ.3",Y),("นางสาวอรุณี ทองคำ","ป.5",P)]
cfg['staff']=[{'name':n,'cls':c,'user':'kru%02d'%(i+1),'color':col} for i,(n,c,col) in enumerate(names)]
cfg['colors'][0]['teacher']="ร.ต.อ.สมศักดิ์ มั่นคง";cfg['colors'][1]['teacher']="ร.ต.ท.ประเสริฐ ทองดี"
cfg.pop('order',None);cfg['cert']={'s1n':'พ.ต.ท.สมชาย ใจดี','s1p':'ครูใหญ่'}
print(post('api.php?r=put',{'path':'config/main','data':cfg},d['csrf']))
