<?php
// คำนวณผลฝั่งเซิร์ฟเวอร์ (ตรงกับ assets/*.js) สำหรับ PDF และหน้าตรวจสอบ
// ตารางคะแนนรวม · ข้อความผลการแข่งขัน · รายชื่อเกียรติบัตร · สำเนาเอกสารสำหรับ QR
declare(strict_types=1);

const THAI_MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MEDAL_NAMES = ['g' => 'ทอง', 's' => 'เงิน', 'b' => 'ทองแดง'];

function thai_digits(string $s): string {
    return strtr($s, ['0' => '๐', '1' => '๑', '2' => '๒', '3' => '๓', '4' => '๔', '5' => '๕', '6' => '๖', '7' => '๗', '8' => '๘', '9' => '๙']);
}
/** "28 กันยายน 2569 เวลา 14:05 น." */
function thai_dt(string $dt): string {
    $t = strtotime($dt);
    return (int) date('j', $t) . ' ' . THAI_MONTHS[(int) date('n', $t)] . ' ' . ((int) date('Y', $t) + 543) . ' เวลา ' . date('H:i', $t) . ' น.';
}
/** "๒๘ เดือนกันยายน พ.ศ. ๒๕๖๙" แบบหนังสือราชการ */
function thai_date_formal(string $iso): string {
    $t = strtotime($iso) ?: time();
    return thai_digits((int) date('j', $t) . ' เดือน' . THAI_MONTHS[(int) date('n', $t)] . ' พ.ศ. ' . ((int) date('Y', $t) + 543));
}

function cfg_colors(array $cfg): array { return array_values(array_filter($cfg['colors'] ?? [], 'is_array')); }
function color_ids(array $cfg): array { return array_map(fn($c) => (string) $c['id'], cfg_colors($cfg)); }
function color_name(array $cfg, string $id): string {
    foreach (cfg_colors($cfg) as $c) if ($c['id'] === $id) return (string) $c['name'];
    return '';
}
function color_hex(array $cfg, string $id): string {
    foreach (cfg_colors($cfg) as $c) if ($c['id'] === $id) return preg_match('/^#[0-9a-fA-F]{6}$/', (string) $c['hex']) ? $c['hex'] : '#999999';
    return '#999999';
}
function has_bronze(array $cfg): bool { return count(cfg_colors($cfg)) > 2; }
function medal_keys(array $cfg): array { return has_bronze($cfg) ? ['g', 's', 'b'] : ['g', 's']; }
function rank_text(array $cfg, string $k): string {
    if ($k === 'g') return 'ชนะเลิศ';
    if ($k === 's') return has_bronze($cfg) ? 'รองชนะเลิศอันดับ 1' : 'รองชนะเลิศ';
    return 'รองชนะเลิศอันดับ 2';
}

function events_sorted(array $d): array {
    $l = [];
    foreach ($d['events'] as $id => $e) $l[] = ['id' => (string) $id] + $e;
    usort($l, fn($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));
    return $l;
}
function class_rank(string $n): int {
    if (!preg_match('/^(อ|ป|ม)\.(\d+)(?:\/(\d+))?/u', $n, $m)) return 9999;
    return ['อ' => 0, 'ป' => 100, 'ม' => 200][$m[1]] + (int) $m[2] * 10 + (int) ($m[3] ?? 0);
}
/** นักเรียนทุกคน เรียงตามชั้นและเลขที่ พร้อมชื่อชั้น */
function all_students(array $d): array {
    $cls = [];
    foreach ($d['classes'] as $id => $c) $cls[] = ['id' => (string) $id] + $c;
    usort($cls, fn($a, $b) => class_rank($a['name'] ?? '') <=> class_rank($b['name'] ?? '') ?: strcmp($a['name'] ?? '', $b['name'] ?? ''));
    $out = [];
    foreach ($cls as $c) foreach ($c['students'] ?? [] as $s) $out[] = $s + ['cls' => $c['name'] ?? '', 'clsId' => $c['id']];
    return $out;
}

/** ตารางคะแนนรวม เรียงตามคะแนน แล้วทอง เงิน ทองแดง */
function standings(array $d): array {
    $cfg = $d['config'];
    $P = $cfg['points'] ?? [];
    $rows = [];
    foreach (cfg_colors($cfg) as $c) $rows[$c['id']] = ['id' => $c['id'], 'name' => $c['name'], 'hex' => color_hex($cfg, $c['id']), 'teacher' => $c['teacher'] ?? '', 'pts' => 0, 'g' => 0, 's' => 0, 'b' => 0, 'n' => 0];
    foreach ($d['events'] as $e) foreach (['g', 's', 'b'] as $k) {
        $w = (string) ($e[$k] ?? '');
        if (isset($rows[$w])) { $rows[$w][$k]++; $rows[$w]['pts'] += (int) ($P[$k] ?? 0); }
    }
    foreach (all_students($d) as $s) if (isset($rows[$s['color'] ?? ''])) $rows[$s['color']]['n']++;
    $rows = array_values($rows);
    usort($rows, fn($a, $b) => [$b['pts'], $b['g'], $b['s'], $b['b']] <=> [$a['pts'], $a['g'], $a['s'], $a['b']]);
    foreach ($rows as $i => &$r) {
        $p = $rows[$i - 1] ?? null;
        $r['rank'] = $p && [$p['pts'], $p['g'], $p['s'], $p['b']] === [$r['pts'], $r['g'], $r['s'], $r['b']] ? $p['rank'] : $i + 1;
    }
    return $rows;
}

function fmt_of(array $e): string {
    if (!empty($e['fmt'])) return (string) $e['fmt'];
    $n = (string) ($e['name'] ?? '');
    $cat = (string) ($e['cat'] ?? '');
    if ($cat === 'กองเชียร์' || $cat === 'ขบวนพาเหรด') return 'judge';
    if ($cat === 'กีฬาประเภททีม') {
        if (preg_match('/วอลเลย์|ตะกร้อ/u', $n)) return 'sets';
        if (preg_match('/เปตอง/u', $n)) return 'ends';
        return 'goals';
    }
    return 'race';
}
/** ข้อความผล เช่น "2 : 1" "1 (3) : 1 (2)" "เซต 2–1 (25–20, …)" "13 : 9" */
function score_text(array $cfg, array $e): string {
    $ids = color_ids($cfg);
    $f = fmt_of($e);
    if ($f === 'sets' && !empty($e['sets'])) {
        $won = array_fill_keys($ids, 0);
        foreach ($e['sets'] as $s) if (!empty($s['win']) && isset($won[$s['win']])) $won[$s['win']]++;
        $sets = array_map(fn($s) => implode('–', array_map(fn($i) => (int) ($s['pts'][$i] ?? 0), $ids)), $e['sets']);
        return 'เซต ' . implode('–', array_values($won)) . ' (' . implode(', ', $sets) . ')';
    }
    if ($f === 'ends' && !empty($e['ends'])) {
        $t = array_fill_keys($ids, 0);
        foreach ($e['ends'] as $x) if (isset($t[$x['c'] ?? ''])) $t[$x['c']] += (int) ($x['p'] ?? 0);
        return implode(' : ', $t);
    }
    $sc = $e['score'] ?? [];
    $hasPk = false;
    foreach ($ids as $i) if (!empty($e['pk'][$i])) $hasPk = true;
    if ($f === 'goals' && $hasPk) return implode(' : ', array_map(fn($i) => ($sc[$i] ?? '0') . ' (' . array_sum($e['pk'][$i] ?? []) . ')', $ids));
    $any = false;
    foreach ($ids as $i) if (isset($sc[$i]) && $sc[$i] !== '') $any = true;
    if (!$any) return '';
    if (count($ids) === 2) return implode(' : ', array_map(fn($i) => (string) ($sc[$i] ?? '0') ?: '0', $ids));
    $parts = [];
    foreach (cfg_colors($cfg) as $c) if (isset($sc[$c['id']]) && $sc[$c['id']] !== '') $parts[] = preg_replace('/^สี/u', '', $c['name']) . ' ' . $sc[$c['id']];
    return implode(' · ', $parts);
}

/** สำเนารายงานผล (รูปเดียวกับที่ verify.php แสดง) */
function report_payload(array $d): array {
    $cfg = $d['config'];
    $evs = events_sorted($d);
    return [
        'bronze' => has_bronze($cfg),
        'done' => count(array_filter($evs, fn($e) => !empty($e['g']))),
        'total' => count($evs),
        'standings' => array_map(fn($r) => array_intersect_key($r, array_flip(['rank', 'name', 'hex', 'g', 's', 'b', 'pts'])), standings($d)),
        'results' => array_map(fn($e) => [
            'cat' => $e['cat'] ?? 'อื่น ๆ', 'name' => $e['name'] ?? '', 'level' => $e['level'] ?: 'ทุกระดับ',
            'g' => color_name($cfg, (string) ($e['g'] ?? '')), 's' => color_name($cfg, (string) ($e['s'] ?? '')), 'b' => color_name($cfg, (string) ($e['b'] ?? '')),
            'score' => score_text($cfg, $e),
        ], $evs),
    ];
}

/** รายการเกียรติบัตร: ผู้ได้รางวัล (หรือทุกคนในรายการ) + คณะสีที่ได้รางวัลคะแนนรวม */
function cert_items(array $d, array $eventIds, string $mode, bool $team): array {
    $cfg = $d['config'];
    $stu = [];
    foreach (all_students($d) as $s) $stu[$s['id']] = $s;
    $out = [];
    foreach (events_sorted($d) as $e) {
        if (!in_array($e['id'], $eventIds, true)) continue;
        $ranks = [];
        foreach (medal_keys($cfg) as $k) if (!empty($e[$k])) $ranks[$e[$k]] = $k;
        foreach (cfg_colors($cfg) as $c) {
            $k = $ranks[$c['id']] ?? null;
            if (!$k && $mode !== 'all') continue;
            foreach ($e['entries'][$c['id']] ?? [] as $sid) {
                if (!isset($stu[$sid])) continue;
                $s = $stu[$sid];
                $out[] = [
                    'name' => $s['name'], 'sub' => 'นักเรียนชั้น ' . $s['cls'] . ' · ' . $c['name'],
                    'award' => $k ? 'ได้รับรางวัล' . rank_text($cfg, $k) : 'ได้เข้าร่วมการแข่งขัน',
                    'what' => 'การแข่งขัน' . ($e['name'] ?? '') . (!empty($e['level']) ? ' ระดับชั้น ' . $e['level'] : ''),
                ];
            }
        }
    }
    if ($team) {
        $keys = medal_keys($cfg);
        foreach (standings($d) as $r) {
            if ($r['pts'] <= 0 || $r['rank'] > count($keys)) continue;
            $out[] = ['name' => 'คณะ' . $r['name'], 'sub' => $r['teacher'] ? 'หัวหน้าสี ' . $r['teacher'] : '',
                'award' => 'ได้รับรางวัล' . rank_text($cfg, $keys[$r['rank'] - 1]) . 'คะแนนรวม', 'what' => 'คะแนนรวม ' . $r['pts'] . ' คะแนน'];
        }
    }
    return $out;
}

/** เก็บสำเนาเอกสารที่ออก คืนรหัส 10 ตัวสำหรับ QR */
function create_report(string $kind, array $payload, array $teacher): string {
    $id = report_id();
    db_exec('INSERT INTO reports (id, kind, data, results_hash, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [$id, $kind, json_encode($payload, JSON_UNESCAPED_UNICODE), results_hash(), now(), mb_substr((string) $teacher['name'], 0, 120)]);
    return $id;
}
function doc_code(string $id): string { return implode('-', str_split($id, 4)); }
function app_base_url(): string {
    $https = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir;
}
function verify_url(string $id, ?int $n = null): string {
    return app_base_url() . '/verify.php?r=' . $id . ($n !== null ? '&n=' . $n : '');
}
