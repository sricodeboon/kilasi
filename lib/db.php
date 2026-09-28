<?php
// ฐานข้อมูล: SQLite (ค่าเริ่มต้น) หรือ MySQL ผ่าน PDO + สร้างตารางอัตโนมัติ
// ข้อมูลกีฬาสีเก็บเป็นเอกสาร JSON ต่อชิ้น (docs) รูปเดียวกับที่หน้าแอปใช้:
//   config/main · classes/<id> (ชั้น + รายชื่อนักเรียน) · events/<id> (รายการแข่ง + ผล)
declare(strict_types=1);

const DOC_COLLECTIONS = ['config', 'classes', 'events'];
const DOC_MAX_BYTES = 256 * 1024;
const DOC_MAX_COUNT = 3000;

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $driver = cfg('db.driver', 'sqlite');
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if ($driver === 'mysql') {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', cfg('db.host'), cfg('db.name'));
        $pdo = new PDO($dsn, (string) cfg('db.user'), (string) cfg('db.pass'), $opts);
    } else {
        $path = (string) cfg('db.sqlite_path', APP_ROOT . '/storage/kilasi.sqlite');
        $pdo = new PDO('sqlite:' . $path, null, null, $opts);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
    }
    migrate($pdo, $driver);
    return $pdo;
}

function migrate(PDO $pdo, string $driver): void {
    $id = $driver === 'mysql' ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $text = $driver === 'mysql' ? 'LONGTEXT' : 'TEXT';
    $key = $driver === 'mysql' ? 'VARCHAR(64)' : 'TEXT';
    $pdo->exec("CREATE TABLE IF NOT EXISTS teachers (
        id $id,
        username $key NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL,
        pass_hash VARCHAR(255) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'teacher',
        created_at VARCHAR(20) NOT NULL
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS docs (
        col VARCHAR(16) NOT NULL,
        id $key NOT NULL,
        data $text NOT NULL,
        updated_at VARCHAR(20) NOT NULL,
        updated_by INT NULL,
        PRIMARY KEY (col, id)
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS meta (k $key PRIMARY KEY, v VARCHAR(255) NOT NULL)");
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_fails (ip VARCHAR(64) NOT NULL, at INT NOT NULL)");
    // นับผิดแยกตามชื่อผู้ใช้ (ครูทั้งโรงเรียนใช้ Wi-Fi วงเดียวกัน ไม่ให้คนหนึ่งพิมพ์ผิดแล้วล็อกทุกคน)
    $cols = $driver === 'mysql'
        ? array_column($pdo->query('SHOW COLUMNS FROM login_fails')->fetchAll(PDO::FETCH_ASSOC), 'Field')
        : array_column($pdo->query('PRAGMA table_info(login_fails)')->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('username', $cols, true)) $pdo->exec("ALTER TABLE login_fails ADD COLUMN username VARCHAR(64) NOT NULL DEFAULT ''");
    // เอกสารที่พิมพ์ (รายงานผล เกียรติบัตร) เก็บสำเนาไว้ให้ QR ตรวจสอบย้อนหลังได้
    $pdo->exec("CREATE TABLE IF NOT EXISTS reports (
        id $key PRIMARY KEY,
        kind VARCHAR(16) NOT NULL,
        data $text NOT NULL,
        results_hash VARCHAR(64) NOT NULL,
        created_at VARCHAR(20) NOT NULL,
        created_by VARCHAR(120) NOT NULL
    )");
}

function db_all(string $sql, array $args = []): array {
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st->fetchAll();
}

function db_one(string $sql, array $args = []): ?array {
    $st = db()->prepare($sql);
    $st->execute($args);
    $r = $st->fetch();
    return $r === false ? null : $r;
}

function db_exec(string $sql, array $args = []): int {
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st->rowCount();
}

/** เลขรอบข้อมูล เพิ่มทุกครั้งที่มีการบันทึก หน้าจอใช้ดูว่ามีอะไรเปลี่ยนไหม */
function data_rev(): int {
    $r = db_one("SELECT v FROM meta WHERE k = 'rev'");
    return $r ? (int) $r['v'] : 0;
}

function bump_rev(): int {
    $n = data_rev() + 1;
    if (db_exec("UPDATE meta SET v = ? WHERE k = 'rev'", [(string) $n]) === 0) {
        db_exec("INSERT INTO meta (k, v) VALUES ('rev', ?)", [(string) $n]);
    }
    return $n;
}

/** ค่าตั้งงานเริ่มต้นของระบบใหม่ (แก้ได้ในแท็บตั้งค่า) */
function default_config(): array {
    return [
        'eventName' => 'ช้างเผือกเกมส์',
        'school' => 'โรงเรียนตำรวจตระเวนชายแดนช่างกลปทุมวันอนุสรณ์ 8',
        'affiliation' => 'กองกำกับการตำรวจตระเวนชายแดนที่ 23',
        'year' => 2569,
        'points' => ['g' => 5, 's' => 3, 'b' => 1],
        'colors' => [
            ['id' => 'yellow', 'name' => 'สีเหลือง', 'hex' => '#ffea00', 'teacher' => ''],
            ['id' => 'purple', 'name' => 'สีม่วง', 'hex' => '#9e10e0', 'teacher' => ''],
        ],
    ];
}

function docs_load(): array {
    $out = ['config' => null, 'classes' => [], 'events' => []];
    foreach (db_all('SELECT col, id, data FROM docs') as $r) {
        $d = json_decode($r['data'], true);
        if (!is_array($d)) continue;
        if ($r['col'] === 'config') $out['config'] = $d;
        else $out[$r['col']][$r['id']] = $d;
    }
    if ($out['config'] === null) $out['config'] = default_config();
    return $out;
}

function doc_put(string $col, string $id, array $data, int $by): void {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    if (db_exec('UPDATE docs SET data = ?, updated_at = ?, updated_by = ? WHERE col = ? AND id = ?', [$json, now(), $by, $col, $id]) === 0) {
        $n = (int) db_one('SELECT COUNT(*) AS n FROM docs')['n'];
        if ($n >= DOC_MAX_COUNT) throw new RuntimeException('ข้อมูลเต็มแล้ว ลบรายการที่ไม่ใช้ก่อน');
        db_exec('INSERT INTO docs (col, id, data, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)', [$col, $id, $json, now(), $by]);
    }
}

/** ลายนิ้วมือของผลการแข่งขันทุกรายการ + เกณฑ์คะแนน · เปลี่ยนเมื่อผลถูกแก้ ใช้บอกว่าเอกสารที่พิมพ์ยังตรงกับระบบไหม */
function results_hash(): string {
    $parts = [];
    foreach (db_all("SELECT id, data FROM docs WHERE col = 'events' ORDER BY id") as $r) {
        $e = json_decode($r['data'], true) ?: [];
        $keep = [];
        foreach (['g', 's', 'b', 'score', 'pk', 'sets', 'ends'] as $k) $keep[$k] = $e[$k] ?? null;
        $parts[] = $r['id'] . '=' . json_encode($keep, JSON_UNESCAPED_UNICODE);
    }
    $cfg = docs_load()['config'];
    $parts[] = 'points=' . json_encode($cfg['points'] ?? null);
    return sha1(implode("\n", $parts));
}

/** รหัสเอกสาร 10 ตัว ไม่มีตัวที่อ่านสับสน (0 O 1 I) */
function report_id(): string {
    $abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $id = '';
        for ($i = 0; $i < 10; $i++) $id .= $abc[random_int(0, strlen($abc) - 1)];
    } while (db_one('SELECT id FROM reports WHERE id = ?', [$id]));
    return $id;
}
