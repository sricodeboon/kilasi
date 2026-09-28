<?php
// แกนกลางของระบบกีฬาสี: โหลดค่าตั้ง, session, ฐานข้อมูล, ตัวช่วยทั่วไป
declare(strict_types=1);

date_default_timezone_set('Asia/Bangkok');
if (PHP_SAPI !== 'cli' && extension_loaded('zlib') && !ini_get('zlib.output_compression')) ob_start('ob_gzhandler');
define('APP_ROOT', dirname(__DIR__));

$configFile = APP_ROOT . '/config.php';
$GLOBALS['CFG'] = is_file($configFile) ? require $configFile : require APP_ROOT . '/config.sample.php';

function cfg(string $path, $default = null) {
    $v = $GLOBALS['CFG'];
    foreach (explode('.', $path) as $k) {
        if (!is_array($v) || !array_key_exists($k, $v)) return $default;
        $v = $v[$k];
    }
    return $v;
}

// ---------- ความปลอดภัยพื้นฐาน ----------
if (PHP_SAPI !== 'cli') {
    // ไม่แสดงข้อผิดพลาดบนหน้าเว็บ (โฮสต์ฟรีบางที่เปิด display_errors ไว้ → รั่วที่อยู่ไฟล์บนเซิร์ฟเวอร์) · ยังเขียนลง error log
    @ini_set('display_errors', '0');
    @ini_set('log_errors', '1');
    // ไม่รับรหัส session ที่เซิร์ฟเวอร์ไม่ได้สร้างเอง (กัน session fixation)
    @ini_set('session.use_strict_mode', '1');
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    // CSP: สคริปต์เฉพาะไฟล์ของเว็บเอง (หน้าแอปไม่มีสคริปต์ inline / onclick) → ถ้ามีข้อมูลแปลกปลอมหลุดเข้า HTML ก็รันสคริปต์ไม่ได้
    // สไตล์ inline ต้องเปิดไว้ (หน้าแอปใช้ style="…" และ verify.php มี <style>) · ฟอนต์จาก Google Fonts
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()');
    // HSTS เฉพาะเมื่อเข้ามาทาง HTTPS อยู่แล้ว (ไม่ใส่ includeSubDomains เพราะโดเมนย่อยของโฮสต์ฟรีไม่ใช่ของเรา)
    if ($https) header('Strict-Transport-Security: max-age=15552000');
}

// ---------- session ----------
if (PHP_SAPI !== 'cli' && session_status() !== PHP_SESSION_ACTIVE) {
    $secure = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    session_name('kssid');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => ($dir === '' ? '' : $dir) . '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ---------- helpers ----------
function h(?string $s): string { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }

function json_out($data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function now(): string { return date('Y-m-d H:i:s'); }

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}

function csrf_check(): void {
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (is_string($sent) && $sent !== '' && hash_equals(csrf_token(), $sent)) return;
    json_out(['error' => 'หน้านี้เปิดค้างไว้นานจนหมดเวลา กรุณาลองอีกครั้ง', 'csrf' => true, 'token' => csrf_token()], 419);
}

/** เวอร์ชันไฟล์สำหรับ ?v= กันเบราว์เซอร์ใช้ไฟล์เก่าหลังอัปเดต */
function asset_v(string $rel): string {
    $f = APP_ROOT . '/' . $rel;
    return $rel . '?v=' . (is_file($f) ? filemtime($f) : '0');
}

require __DIR__ . '/db.php';
require __DIR__ . '/auth.php';
