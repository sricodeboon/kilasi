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
/** เก็บสำเนาเอกสารไว้ตรวจสอบจาก QR · $hash = ลายนิ้วมือข้อมูลที่เอกสารนี้อ้างถึง (ค่าเริ่มต้น = ผลการแข่งขันทั้งหมด) */
function create_report(string $kind, array $payload, array $teacher, ?string $hash = null): string {
    $id = report_id();
    db_exec('INSERT INTO reports (id, kind, data, results_hash, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [$id, $kind, json_encode($payload, JSON_UNESCAPED_UNICODE), $hash ?? results_hash(), now(), mb_substr((string) $teacher['name'], 0, 120)]);
    return $id;
}
function payload_hash(array $p): string { return sha1(json_encode($p, JSON_UNESCAPED_UNICODE)); }

/** รายชื่อคณะครูและนักกีฬาตามตัวกรอง (ใช้ทั้งพิมพ์ PDF และตรวจสอบจาก QR ว่ารายชื่อยังตรงกับระบบ) */
function roster_payload(array $d, string $cls, string $color, string $q): array {
    $cfg = $d['config'];
    $ids = color_ids($cfg);
    $match = function (string $c) use ($color, $ids) {
        if ($color === 'all') return true;
        return $color === 'none' ? !in_array($c, $ids, true) : $c === $color;
    };
    $students = [];
    foreach (all_students($d) as $s) {
        if ($cls !== 'all' && $s['clsId'] !== $cls) continue;
        if (!$match((string) ($s['color'] ?? ''))) continue;
        if ($q !== '' && mb_strpos((string) $s['name'], $q) === false) continue;
        $students[] = ['cls' => (string) $s['cls'], 'no' => (string) ($s['no'] ?? ''), 'name' => (string) $s['name'], 'sex' => (string) ($s['sex'] ?? ''), 'color' => color_name($cfg, (string) ($s['color'] ?? ''))];
    }
    $clsName = '';
    if ($cls !== 'all') foreach ($d['classes'] as $id => $c) if ((string) $id === $cls) $clsName = $c['name'] ?? '';
    // คณะครูประจำสี (เมื่อไม่ได้กรองชั้นหรือค้นชื่อ) เรียงตามสี หัวหน้าสีขึ้นก่อน
    $heads = [];
    foreach ($cfg['colors'] ?? [] as $c) $heads[$c['id'] ?? ''] = preg_replace('/\s+/u', '', (string) ($c['teacher'] ?? ''));
    $ord = array_flip($ids);
    $staff = [];
    if ($cls === 'all' && $q === '' && is_array($cfg['staff'] ?? null)) foreach ($cfg['staff'] as $p) {
        $c = (string) ($p['color'] ?? '');
        if (!$match($c)) continue;
        $head = $c !== '' && ($heads[$c] ?? '') !== '' && $heads[$c] === preg_replace('/\s+/u', '', (string) ($p['name'] ?? ''));
        $staff[] = ['o' => $ord[$c] ?? 99, 'name' => (string) ($p['name'] ?? ''), 'cls' => (string) ($p['cls'] ?? ''), 'head' => $head, 'color' => color_name($cfg, $c)];
    }
    usort($staff, fn($a, $b) => [$a['o'], $a['head'] ? 0 : 1] <=> [$b['o'], $b['head'] ? 0 : 1]);
    $staff = array_map(fn($p) => array_diff_key($p, ['o' => 1]), $staff);
    $what = array_values(array_filter([$staff ? 'รายชื่อคณะครูและนักกีฬา' : 'รายชื่อนักกีฬา', $color === 'none' ? 'ยังไม่มีสี' : ($color !== 'all' ? color_name($cfg, $color) : ''), $clsName !== '' ? 'ชั้น ' . $clsName : '', $q !== '' ? 'ค้นหา “' . $q . '”' : '']));
    return ['params' => ['cls' => $cls, 'color' => $color, 'q' => $q], 'title' => implode(' · ', $what), 'staff' => $staff, 'students' => $students];
}

/** ใบรายชื่อผู้แข่งขันของรายการหนึ่ง แยกสี (null = ไม่มีรายการนี้แล้ว) */
function entries_payload(array $d, string $eid): ?array {
    $e = $d['events'][$eid] ?? null;
    if (!is_array($e)) return null;
    $cfg = $d['config'];
    $stu = [];
    foreach (all_students($d) as $s) $stu[$s['id']] = $s;
    $colors = [];
    foreach (cfg_colors($cfg) as $c) {
        $list = [];
        foreach ($e['entries'][$c['id']] ?? [] as $sid) if (isset($stu[$sid])) $list[] = ['name' => (string) $stu[$sid]['name'], 'cls' => (string) $stu[$sid]['cls']];
        $colors[] = ['name' => (string) $c['name'], 'students' => $list];
    }
    return ['params' => ['event' => $eid], 'name' => (string) ($e['name'] ?? ''), 'cat' => (string) ($e['cat'] ?? ''), 'level' => (string) ($e['level'] ?? ''), 'colors' => $colors];
}

/** ตัวตรวจว่าครูคนนี้เป็นหัวหน้าสีของสีตัวเองไหม (เทียบชื่อแบบไม่สนช่องว่าง) */
function staff_head_fn(array $cfg): callable {
    $heads = [];
    foreach ($cfg['colors'] ?? [] as $c) $heads[$c['id'] ?? ''] = preg_replace('/\s+/u', '', (string) ($c['teacher'] ?? ''));
    return fn(array $p) => ($p['color'] ?? '') !== '' && ($heads[$p['color']] ?? '') !== '' && $heads[$p['color']] === preg_replace('/\s+/u', '', (string) ($p['name'] ?? ''));
}

/** แยกยศออกจากชื่อ: "พ.ต.ท.สมชาย ใจดี" → ["พันตำรวจโท", "สมชาย ใจดี"] (ไม่มียศ → ["", ชื่อเดิม])
 *  ระเบียบงานสารบรรณ: ผู้มียศให้พิมพ์ยศเต็มไว้หน้าลายมือชื่อ ชื่อในวงเล็บไม่ต้องมียศ */
function split_rank(string $name): array {
    static $R = [
        // ตำรวจ
        'พล.ต.อ.' => 'พลตำรวจเอก', 'พล.ต.ท.' => 'พลตำรวจโท', 'พล.ต.ต.' => 'พลตำรวจตรี',
        'พ.ต.อ.' => 'พันตำรวจเอก', 'พ.ต.ท.' => 'พันตำรวจโท', 'พ.ต.ต.' => 'พันตำรวจตรี',
        'ร.ต.อ.' => 'ร้อยตำรวจเอก', 'ร.ต.ท.' => 'ร้อยตำรวจโท', 'ร.ต.ต.' => 'ร้อยตำรวจตรี',
        'ด.ต.' => 'ดาบตำรวจ', 'จ.ส.ต.' => 'จ่าสิบตำรวจ', 'ส.ต.อ.' => 'สิบตำรวจเอก', 'ส.ต.ท.' => 'สิบตำรวจโท', 'ส.ต.ต.' => 'สิบตำรวจตรี',
        // ทหาร
        'พล.อ.' => 'พลเอก', 'พล.ท.' => 'พลโท', 'พล.ต.' => 'พลตรี', 'พ.อ.' => 'พันเอก', 'พ.ท.' => 'พันโท', 'พ.ต.' => 'พันตรี',
        'ร.อ.' => 'ร้อยเอก', 'ร.ท.' => 'ร้อยโท', 'ร.ต.' => 'ร้อยตรี', 'จ.ส.อ.' => 'จ่าสิบเอก', 'จ.ส.ท.' => 'จ่าสิบโท', // จ.ส.ต. = จ่าสิบตำรวจ (ตชด.) ไม่ใช่จ่าสิบตรี
        'ส.อ.' => 'สิบเอก', 'ส.ท.' => 'สิบโท', 'ส.ต.' => 'สิบตรี', 'ว่าที่ ร.ต.' => 'ว่าที่ร้อยตรี', 'ว่าที่ร.ต.' => 'ว่าที่ร้อยตรี',
    ];
    static $keys = null;
    if ($keys === null) { $keys = array_keys($R); usort($keys, fn($a, $b) => mb_strlen($b) <=> mb_strlen($a)); }
    $n = trim($name);
    foreach ($keys as $k) {
        if (mb_substr($n, 0, mb_strlen($k)) !== $k) continue;
        $rest = ltrim(mb_substr($n, mb_strlen($k)));
        $rank = $R[$k];
        if (mb_substr($rest, 0, 4) === 'หญิง') { $rank .= 'หญิง'; $rest = ltrim(mb_substr($rest, 4)); }
        return [$rank, $rest];
    }
    foreach (['พันตำรวจ', 'ร้อยตำรวจ', 'พลตำรวจ', 'ดาบตำรวจ', 'จ่าสิบตำรวจ', 'สิบตำรวจ'] as $full) {  // พิมพ์ยศเต็มมาแล้ว
        if (preg_match('/^(' . $full . '(?:เอก|โท|ตรี)?(?:หญิง)?)\s*(.+)$/u', $n, $m)) return [$m[1], $m[2]];
    }
    return ['', $n];
}

/** คำสั่งแต่งตั้งคณะกรรมการ (config.order) พร้อมฝ่ายครูประจำสีจากการแบ่งสีปัจจุบัน · null = ยังไม่ได้ร่าง */
function order_payload(array $d): ?array {
    $cfg = $d['config'];
    $o = $cfg['order'] ?? null;
    if (!is_array($o)) return null;
    $isHead = staff_head_fn($cfg);
    $staff = is_array($cfg['staff'] ?? null) ? $cfg['staff'] : [];
    $units = [];
    foreach ($o['units'] ?? [] as $u) {
        if (!is_array($u)) continue;
        $x = ['name' => trim((string) ($u['name'] ?? '')), 'duty' => trim((string) ($u['duty'] ?? ''))];
        if (($u['type'] ?? '') === 'colors') {
            $x['groups'] = [];
            foreach (cfg_colors($cfg) as $c) {
                $mem = array_values(array_filter($staff, fn($p) => ($p['color'] ?? '') === $c['id'] && trim((string) ($p['name'] ?? '')) !== ''));
                usort($mem, fn($a, $b) => ($isHead($b) ? 1 : 0) <=> ($isHead($a) ? 1 : 0));
                $x['groups'][] = ['color' => (string) $c['name'], 'members' => array_map(fn($p) => ['name' => trim((string) $p['name']), 'role' => $isHead($p) ? 'หัวหน้าสี' : 'ครูประจำสี'], $mem)];
            }
        } else {
            $x['members'] = array_values(array_map(fn($m) => ['name' => trim((string) ($m['name'] ?? '')), 'role' => trim((string) ($m['role'] ?? ''))],
                array_filter($u['members'] ?? [], fn($m) => is_array($m) && trim((string) ($m['name'] ?? '')) !== '')));
        }
        $units[] = $x;
    }
    $s = fn($k) => trim((string) ($o[$k] ?? ''));
    return ['school' => (string) ($cfg['school'] ?? ''), 'year' => (string) ($cfg['year'] ?? ''), 'no' => $s('no'), 'date' => $s('date'), 'subject' => $s('subject'),
        'intro' => $s('intro'), 'closing' => $s('closing'), 'signer' => $s('signer'), 'signerPos' => $s('signerPos'), 'units' => $units];
}

/** ลายนิ้วมือปัจจุบันของข้อมูลที่เอกสารอ้างถึง เทียบกับตอนพิมพ์ */
function current_doc_hash(string $kind, array $data, array $d): ?string {
    $p = $data['params'] ?? [];
    if ($kind === 'roster') return payload_hash(roster_payload($d, (string) ($p['cls'] ?? 'all'), (string) ($p['color'] ?? 'all'), (string) ($p['q'] ?? '')));
    if ($kind === 'entries') { $now = entries_payload($d, (string) ($p['event'] ?? '')); return $now ? payload_hash($now) : null; }
    if ($kind === 'order') { $now = order_payload($d); return $now ? payload_hash($now) : null; }
    return results_hash();
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
