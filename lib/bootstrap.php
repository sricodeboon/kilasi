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
