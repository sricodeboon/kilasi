import json,urllib.request,http.cookiejar
B='http://127.0.0.1:8091/kilasi/'
cj=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
st=lambda:json.loads(op.open(B+'api.php?r=state').read())
def post(p,b,t):return op.open(urllib.request.Request(B+p,data=json.dumps(b,ensure_ascii=False).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':t})).read()
d=st();post('api.php?r=login',{'username':'tester','password':'test1234'},d['csrf']);d=st()
Y,P=[c['id'] for c in d['config']['colors']]
evs=[('e2','กรีฑา','วิ่ง 100 เมตร หญิง','ป.4–ป.6',Y,P),('e3','กีฬาประเภททีม','ฟุตบอล ชาย','ป.4–ป.6',P,Y),('e4','กีฬาประเภททีม','วอลเลย์บอล หญิง','ป.4–ป.6','',''),('e5','กีฬาพื้นบ้าน','ชักเย่อ','ป.1–ป.3',Y,P)]
for i,(id,cat,name,lv,g,s) in enumerate(evs):
    print(post('api.php?r=put',{'path':'events/'+id,'data':{'name':name,'cat':cat,'level':lv,'order':i+2,'g':g,'s':s,'b':'','entries':{Y:['s1'],P:['s2']}}},d['csrf']))
