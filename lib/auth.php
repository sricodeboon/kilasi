<?php
// บัญชีครู: ผู้ดูแล (admin) ตั้งค่างานและจัดการบัญชี · ครู (teacher) กรอกรายชื่อและบันทึกผล
declare(strict_types=1);

const LOGIN_MAX_FAILS = 8;      // ผิดเกินนี้ใน 10 นาที ต่อ IP → ให้รอก่อน
const LOGIN_WINDOW = 600;

function current_teacher(): ?array {
    static $cache = false;
    if ($cache !== false) return $cache;
    $id = (int) ($_SESSION['tid'] ?? 0);
    $cache = $id ? db_one('SELECT id, username, name, role FROM teachers WHERE id = ?', [$id]) : null;
    if ($id && !$cache) unset($_SESSION['tid']);
    return $cache;
}

function teacher_public(?array $t): ?array {
    return $t ? ['id' => (int) $t['id'], 'username' => $t['username'], 'name' => $t['name'], 'role' => $t['role']] : null;
}

function require_teacher(): array {
    $t = current_teacher();
    if (!$t) json_out(['error' => 'กรุณาเข้าสู่ระบบครูก่อน', 'auth' => true], 401);
    return $t;
}

function require_admin(): array {
    $t = require_teacher();
    if ($t['role'] !== 'admin') json_out(['error' => 'เฉพาะผู้ดูแลระบบเท่านั้น'], 403);
    return $t;
}

function setup_needed(): bool {
    return (int) db_one('SELECT COUNT(*) AS n FROM teachers')['n'] === 0;
}

function client_ip(): string { return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64); }

function login_blocked(): bool {
    db_exec('DELETE FROM login_fails WHERE at < ?', [time() - LOGIN_WINDOW]);
    return (int) db_one('SELECT COUNT(*) AS n FROM login_fails WHERE ip = ?', [client_ip()])['n'] >= LOGIN_MAX_FAILS;
}

function login_failed(): void { db_exec('INSERT INTO login_fails (ip, at) VALUES (?, ?)', [client_ip(), time()]); }

function login_as(array $t): void {
    session_regenerate_id(true);
    $_SESSION['tid'] = (int) $t['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

/** ตรวจชื่อผู้ใช้/ชื่อ/รหัสผ่าน คืนข้อความผิดพลาด หรือ null ถ้าผ่าน */
function validate_account(string $username, string $name, ?string $password): ?string {
    if (!preg_match('/^[a-z0-9._-]{3,32}$/', $username)) return 'ชื่อผู้ใช้ใช้ a-z 0-9 . _ - ยาว 3–32 ตัว';
    if ($name === '' || mb_strlen($name) > 120) return 'กรอกชื่อครู (ไม่เกิน 120 ตัวอักษร)';
    if ($password !== null && (strlen($password) < 6 || strlen($password) > 200)) return 'รหัสผ่านอย่างน้อย 6 ตัวอักษร';
    return null;
}
