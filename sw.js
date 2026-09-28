// แอปบนมือถือ (PWA): เก็บหน้าตาแอปไว้ในเครื่อง เปิดเร็ว · ข้อมูลคะแนน (api.php) ดึงสดจากเซิร์ฟเวอร์เสมอ
const CACHE = 'kilasi-' + (new URL(location).searchParams.get('v') || '1');
const SHELL = ['./', 'assets/logo.svg', 'assets/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kilasi-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/api.php')) return;
  // เก็บเฉพาะหน้าแอป (./ หรือ index.php) · หน้าอื่นเช่น verify.php มีรายชื่อนักเรียนเมื่อครูล็อกอิน ห้ามเก็บลงเครื่อง
  const scope = new URL(self.registration.scope);
  const isShell = u.pathname === scope.pathname || u.pathname === scope.pathname + 'index.php';
  if (e.request.mode === 'navigate' && !isShell) return;
  if (e.request.mode === 'navigate') {
    // หน้าแอป: ใช้ของใหม่จากเซิร์ฟเวอร์ก่อน ออฟไลน์ค่อยใช้ของในเครื่อง
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./', cp)); }
      return r;
    }).catch(() => caches.match('./')));
    return;
  }
  // ไฟล์ประกอบมี ?v= ทุกครั้งที่อัปเดต จึงใช้ของในเครื่องได้เลย
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return r;
  })));
});
