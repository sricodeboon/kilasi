<?php
// JSON API ของระบบกีฬาสี
//   GET  ?r=state[&since=rev]  ข้อมูลทั้งหมด (คนทั่วไปไม่เห็นชื่อนักเรียน)
//   POST ?r=setup | login | logout | password
//   POST ?r=put | del           บันทึก/ลบเอกสาร config/classes/events
//   POST ?r=teacher.save | teacher.del   จัดการบัญชีครู (ผู้ดูแลเท่านั้น)
// เอกสาร PDF และสำเนาสำหรับ QR สร้างที่ pdf.php
require __DIR__ . '/lib/bootstrap.php';

$r = $_GET['r'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($isPost) csrf_check();

function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, DOC_MAX_BYTES + 1024);
    if ($raw === false || strlen($raw) > DOC_MAX_BYTES + 1000) json_out(['error' => 'ข้อมูลใหญ่เกินไป'], 413);
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

function parse_path($path): array {
    if (!is_string($path) || !preg_match('#^(config|classes|events)/([A-Za-z0-9_-]{1,40})$#', $path, $m)) {
        json_out(['error' => 'ที่อยู่ข้อมูลไม่ถูกต้อง'], 422);
    }
    if ($m[1] === 'config' && $m[2] !== 'main') json_out(['error' => 'ที่อยู่ข้อมูลไม่ถูกต้อง'], 422);
    return [$m[1], $m[2]];
}

/** คนที่ไม่ได้ล็อกอินเห็นเฉพาะสีของนักเรียน (ใช้นับจำนวนนักกีฬา) ไม่เห็นชื่อ */
function public_classes(array $classes): array {
    $out = [];
    foreach ($classes as $id => $c) {
        $out[$id] = [
            'name' => (string) ($c['name'] ?? ''),
            'students' => array_map(fn($s) => ['color' => (string) ($s['color'] ?? '')], is_array($c['students'] ?? null) ? $c['students'] : []),
        ];
    }
    return $out;
}

function state_out(): never {
    $t = current_teacher();
    $rev = data_rev();
    $since = isset($_GET['since']) ? (int) $_GET['since'] : -1;
    $base = ['rev' => $rev, 'user' => teacher_public($t), 'setup' => setup_needed(), 'csrf' => csrf_token()];
    if ($since === $rev) json_out($base + ['same' => true]);
    $d = docs_load();
    if (!$t) $d['classes'] = public_classes($d['classes']);
    // ทำเนียบครู: คนทั่วไปไม่เห็น ครูเห็นแค่ชื่อ ชื่อผู้ใช้ Q-Info เฉพาะผู้ดูแล
    if (!$t) unset($d['config']['staff'], $d['config']['order'], $d['config']['judges']);
    elseif ($t['role'] !== 'admin' && is_array($d['config']['staff'] ?? null)) {
        $d['config']['staff'] = array_map(fn($p) => ['name' => $p['name'] ?? '', 'cls' => $p['cls'] ?? '', 'color' => $p['color'] ?? ''], $d['config']['staff']);
    }
    $out = $base + $d;
    if ($t && $t['role'] === 'admin') {
        $out['teachers'] = array_map('teacher_public', db_all('SELECT id, username, name, role FROM teachers ORDER BY role, name'));
    }
    json_out($out);
}

try {
    switch ($r) {
        case 'state':
            state_out();

        case 'setup':
            // สร้างบัญชีผู้ดูแลคนแรก ทำได้ครั้งเดียวตอนยังไม่มีบัญชีใดเลย
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            if (!setup_needed()) json_out(['error' => 'ตั้งค่าระบบไปแล้ว กรุณาเข้าสู่ระบบ'], 409);
            if (login_blocked()) json_out(['error' => 'ลองผิดหลายครั้ง กรุณารอ 10 นาที'], 429);
            $b = body();
            // กันคนอื่นเปิดหน้าก่อนแล้วยึดบัญชีผู้ดูแล: ต้องใส่รหัสตั้งค่าระบบใน config.php
            $code = (string) cfg('setup_code', '');
            if ($code !== '' && !hash_equals($code, strtoupper(trim((string) ($b['code'] ?? ''))))) {
                login_failed();
                json_out(['error' => 'รหัสตั้งค่าระบบไม่ถูกต้อง'], 403);
            }
            $u = strtolower(trim((string) ($b['username'] ?? '')));
            $n = trim((string) ($b['name'] ?? ''));
            $p = (string) ($b['password'] ?? '');
            if ($err = validate_account($u, $n, $p)) json_out(['error' => $err], 422);
            db_exec('INSERT INTO teachers (username, name, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
                [$u, $n, password_hash($p, PASSWORD_DEFAULT), 'admin', now()]);
            login_as(db_one('SELECT id FROM teachers WHERE username = ?', [$u]));
            state_out();

        case 'login':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            if (login_blocked()) json_out(['error' => 'ใส่รหัสผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่'], 429);
            $b = body();
            $t = db_one('SELECT * FROM teachers WHERE username = ?', [strtolower(trim((string) ($b['username'] ?? '')))]);
            if (!$t || !password_verify((string) ($b['password'] ?? ''), $t['pass_hash'])) {
                login_failed();
                usleep(400000);
                json_out(['error' => 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'], 401);
            }
            if (password_needs_rehash($t['pass_hash'], PASSWORD_DEFAULT)) {
                db_exec('UPDATE teachers SET pass_hash = ? WHERE id = ?', [password_hash((string) $b['password'], PASSWORD_DEFAULT), $t['id']]);
            }
            login_as($t);
            state_out();

        case 'logout':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            $_SESSION = [];
            session_regenerate_id(true);
            state_out();

        case 'password':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            $t = require_teacher();
            $b = body();
            $row = db_one('SELECT pass_hash FROM teachers WHERE id = ?', [$t['id']]);
            if (!password_verify((string) ($b['old'] ?? ''), $row['pass_hash'])) json_out(['error' => 'รหัสผ่านเดิมไม่ถูกต้อง'], 422);
            $p = (string) ($b['new'] ?? '');
            if ($err = validate_account($t['username'], $t['name'], $p)) json_out(['error' => $err], 422);
            db_exec('UPDATE teachers SET pass_hash = ? WHERE id = ?', [password_hash($p, PASSWORD_DEFAULT), $t['id']]);
            json_out(['ok' => true]);

        case 'put':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            $t = require_teacher();
            $b = body();
            [$col, $id] = parse_path($b['path'] ?? null);
            if ($col === 'config' && $t['role'] !== 'admin') json_out(['error' => 'ตั้งค่างานได้เฉพาะผู้ดูแลระบบ'], 403);
            if (!is_array($b['data'] ?? null) || array_is_list($b['data']) && $b['data'] !== []) json_out(['error' => 'ข้อมูลไม่ถูกต้อง'], 422);
            if (strlen(json_encode($b['data'], JSON_UNESCAPED_UNICODE)) > DOC_MAX_BYTES) json_out(['error' => 'ข้อมูลชิ้นนี้ใหญ่เกินไป แบ่งชั้นเรียนให้เล็กลง'], 413);
            doc_put($col, $id, $b['data'], (int) $t['id']);
            json_out(['ok' => true, 'rev' => bump_rev()]);

        case 'del':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            $t = require_teacher();
            [$col, $id] = parse_path((body())['path'] ?? null);
            if ($col === 'config' && $t['role'] !== 'admin') json_out(['error' => 'ตั้งค่างานได้เฉพาะผู้ดูแลระบบ'], 403);
            db_exec('DELETE FROM docs WHERE col = ? AND id = ?', [$col, $id]);
            json_out(['ok' => true, 'rev' => bump_rev()]);

        case 'teacher.save':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            $me = require_admin();
            $b = body();
            $id = (int) ($b['id'] ?? 0);
            $u = strtolower(trim((string) ($b['username'] ?? '')));
            $n = trim((string) ($b['name'] ?? ''));
            $p = (string) ($b['password'] ?? '');
            $role = ($b['role'] ?? '') === 'admin' ? 'admin' : 'teacher';
            if ($err = validate_account($u, $n, $id && $p === '' ? null : $p)) json_out(['error' => $err], 422);
            $dup = db_one('SELECT id FROM teachers WHERE username = ? AND id <> ?', [$u, $id]);
            if ($dup) json_out(['error' => 'ชื่อผู้ใช้นี้มีแล้ว'], 422);
            if ($id) {
                if ($id === (int) $me['id'] && $role !== 'admin') json_out(['error' => 'ลดสิทธิ์บัญชีตัวเองไม่ได้'], 422);
                db_exec('UPDATE teachers SET username = ?, name = ?, role = ? WHERE id = ?', [$u, $n, $role, $id]);
                if ($p !== '') db_exec('UPDATE teachers SET pass_hash = ? WHERE id = ?', [password_hash($p, PASSWORD_DEFAULT), $id]);
            } else {
                db_exec('INSERT INTO teachers (username, name, pass_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
                    [$u, $n, password_hash($p, PASSWORD_DEFAULT), $role, now()]);
            }
            state_out();

        case 'teacher.del':
            if (!$isPost) json_out(['error' => 'ต้องใช้ POST'], 405);
            $me = require_admin();
            $id = (int) ((body())['id'] ?? 0);
            if ($id === (int) $me['id']) json_out(['error' => 'ลบบัญชีตัวเองไม่ได้'], 422);
            db_exec('DELETE FROM teachers WHERE id = ?', [$id]);
            state_out();

        default:
            json_out(['error' => 'ไม่พบคำสั่ง'], 404);
    }
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 422);
} catch (Throwable $e) {
    error_log('[kilasi] ' . $e->getMessage());
    json_out(['error' => 'ระบบขัดข้อง กรุณาลองใหม่'], 500);
}
