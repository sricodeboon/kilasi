<?php
// สร้าง PDF ด้วย mPDF: รายงานผล · เกียรติบัตร · ใบรายชื่อผู้แข่งขัน · รายชื่อนักเรียน
// ฟอนต์ Sarabun (เนื้อหา) และ Chonburi (หัวเรื่อง) อยู่ที่ fonts/ · QR ใช้ <barcode type="QR"> ของ mPDF
declare(strict_types=1);

use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;
use Mpdf\Mpdf;

const PDF_RED = '#8C1B20';
const PDF_GOLD = '#C9A03A';

function make_mpdf(string $format, array $opt = []): Mpdf {
    require_once APP_ROOT . '/vendor/autoload.php';
    $tmp = APP_ROOT . '/storage/tmp';
    if (!is_dir($tmp)) @mkdir($tmp, 0775, true);
    $defDirs = (new ConfigVariables())->getDefaults()['fontDir'];
    $defFonts = (new FontVariables())->getDefaults()['fontdata'];
    $m = new Mpdf($opt + [
        'mode' => 'utf-8',
        'format' => $format,
        'tempDir' => $tmp,
        'fontDir' => array_merge([APP_ROOT . '/fonts'], $defDirs),
        'fontdata' => [
            'sarabun' => ['R' => 'Sarabun-Regular.ttf', 'B' => 'Sarabun-Bold.ttf', 'useOTL' => 0xFF],
            'sarabunsemi' => ['R' => 'Sarabun-SemiBold.ttf', 'useOTL' => 0xFF],
            'chonburi' => ['R' => 'Chonburi-Regular.ttf', 'useOTL' => 0xFF],
            'dejavusanscondensed' => $defFonts['dejavusanscondensed'],
        ],
        'default_font' => 'sarabun',
        'useDictionaryLBR' => true,
        'margin_top' => 14, 'margin_bottom' => 14, 'margin_left' => 15, 'margin_right' => 15,
    ]);
    $m->SetCreator('ระบบกีฬาสีภายใน');
    return $m;
}

function e(?string $s): string { return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8'); }
/** ช่องสีเล็ก ๆ หน้าชื่อสี */
function pdf_swatch(array $cfg, string $name): string {
    if ($name === '') return '<span style="color:#8A8E84">รอแข่ง</span>';
    $hex = '#999999';
    foreach (cfg_colors($cfg) as $c) if ($c['name'] === $name) $hex = color_hex($cfg, $c['id']);
    return '<span style="background-color:' . $hex . ';color:' . $hex . ';font-size:8pt">&#9632;&#9632;</span>&nbsp;' . e($name);
}
function pdf_signers(array $cfg): array {
    $c = $cfg['cert'] ?? [];
    $s = [[(string) ($c['s1n'] ?? ''), (string) ($c['s1p'] ?? 'ครูใหญ่')], [(string) ($c['s2n'] ?? ''), (string) ($c['s2p'] ?? '')]];
    return array_values(array_filter($s, fn($x) => $x[0] !== '' || $x[1] !== ''));
}
function pdf_signature_block(array $cfg, string $lineWidth = '60mm'): string {
    $s = pdf_signers($cfg);
    if (!$s) return '';
    $w = floor(100 / count($s));
    $cells = array_map(fn($x) => '<td style="width:' . $w . '%;text-align:center;vertical-align:bottom">
        <div style="height:6mm">&nbsp;</div>
        <div>ลงชื่อ ................................................</div>
        <div style="margin-top:1mm">' . ($x[0] !== '' ? '(' . e($x[0]) . ')' : '&nbsp;') . '</div>
        <div style="color:#5B4A3A">' . e($x[1]) . '</div></td>', $s);
    return '<table style="width:100%;margin-top:8mm"><tr>' . implode('', $cells) . '</tr></table>';
}
function pdf_head_html(array $cfg, string $title, string $meta, ?string $qrUrl, ?string $code): string {
    $logo = APP_ROOT . '/assets/pdf/logo.png';
    $qr = $qrUrl ? '<td style="width:30mm;text-align:center;vertical-align:top"><barcode code="' . e($qrUrl) . '" type="QR" error="M" size="0.8" disableborder="1" />
        <div style="font-size:7.5pt;color:#5E6259;line-height:1.3">สแกนเพื่อตรวจสอบ<br><b style="color:#1B1C18">' . e($code) . '</b></div></td>' : '';
    return '<table style="width:100%;border-bottom:1.2mm solid ' . PDF_GOLD . ';padding-bottom:2mm;margin-bottom:2mm"><tr>
        <td style="width:22mm;vertical-align:top"><img src="' . $logo . '" style="width:20mm;height:20mm"></td>
        <td style="vertical-align:top;padding-left:2mm">
          <div style="font-family:sarabunsemi;font-size:12pt">' . e($cfg['school'] ?? '') . '</div>
          <div style="font-size:9.5pt;color:#6B5A48">' . e($cfg['affiliation'] ?? '') . '</div>
          <div style="font-family:chonburi;font-size:14pt;color:' . PDF_RED . ';line-height:1.35">' . $title . '</div>
          <div style="font-size:9pt;color:#5E6259">' . $meta . '</div>
        </td>' . $qr . '</tr></table>';
}
const PDF_TABLE_CSS = '
  body{font-family:sarabun;font-size:10.5pt;color:#1B1C18}
  h2{font-family:sarabunsemi;font-size:12.5pt;color:#8C1B20;margin:5mm 0 1.5mm 0;font-weight:normal}
  table.tb{width:100%;border-collapse:collapse}
  table.tb th{background-color:#F1EDE2;font-family:sarabunsemi;font-weight:normal;border:0.25mm solid #B9BDB2;padding:1.4mm 2mm;text-align:left}
  table.tb td{border:0.25mm solid #B9BDB2;padding:1.4mm 2mm}
  .r{text-align:right}
  .note{font-size:9pt;color:#5E6259}
';

/* ---------- รายงานผลการแข่งขัน (A4 แนวตั้ง) ---------- */
function pdf_report(array $d, array $p, string $id, array $teacher): Mpdf {
    $cfg = $d['config'];
    $keys = medal_keys($cfg);
    $P = $cfg['points'] ?? [];
    $title = 'รายงานผลการแข่งขันกีฬาสีภายใน “' . e($cfg['eventName'] ?? 'กีฬาสีภายใน') . '” ปีการศึกษา ' . thai_digits((string) ($cfg['year'] ?? ''));
    $meta = 'พิมพ์เมื่อ ' . thai_digits(thai_dt(now())) . ' · โดย ' . e($teacher['name']) . ' · แข่งแล้ว ' . thai_digits((string) $p['done']) . ' จาก ' . thai_digits((string) $p['total']) . ' รายการ';
    $h = '<style>' . PDF_TABLE_CSS . '</style>' . pdf_head_html($cfg, $title, $meta, verify_url($id), doc_code($id));
    $h .= '<h2>สรุปคะแนนรวม</h2><table class="tb"><tr><th>อันดับ</th><th>สี</th>';
    foreach ($keys as $k) $h .= '<th class="r">' . MEDAL_NAMES[$k] . '</th>';
    $h .= '<th class="r">คะแนนรวม</th></tr>';
    foreach ($p['standings'] as $r) {
        $h .= '<tr><td>' . thai_digits((string) $r['rank']) . '</td><td>' . pdf_swatch($cfg, $r['name']) . '</td>';
        foreach ($keys as $k) $h .= '<td class="r">' . thai_digits((string) $r[$k]) . '</td>';
        $h .= '<td class="r"><b>' . thai_digits((string) $r['pts']) . '</b></td></tr>';
    }
    $h .= '</table><div class="note" style="margin-top:1.5mm">เกณฑ์คะแนน ' . implode(' · ', array_map(fn($k) => MEDAL_NAMES[$k] . ' ' . thai_digits((string) ($P[$k] ?? 0)), $keys)) . ' คะแนน · คะแนนเท่ากันตัดสินด้วยจำนวนเหรียญทอง แล้วจึงเหรียญเงิน</div>';
    $cats = array_values(array_unique(array_column($p['results'], 'cat')));
    foreach ($cats as $cat) {
        $h .= '<h2>' . e($cat) . '</h2><table class="tb"><tr><th style="width:8mm">ที่</th><th>รายการ</th><th>ระดับชั้น</th><th>ชนะเลิศ</th><th>' . (has_bronze($cfg) ? 'รองฯ อันดับ 1' : 'รองชนะเลิศ') . '</th>' . ($p['bronze'] ? '<th>รองฯ อันดับ 2</th>' : '') . '<th>ผล</th></tr>';
        $i = 0;
        foreach ($p['results'] as $r) {
            if ($r['cat'] !== $cat) continue;
            $i++;
            $h .= '<tr><td>' . thai_digits((string) $i) . '</td><td>' . e($r['name']) . '</td><td>' . e($r['level']) . '</td><td>' . pdf_swatch($cfg, $r['g']) . '</td><td>' . ($r['g'] !== '' ? pdf_swatch($cfg, $r['s']) : '') . '</td>' . ($p['bronze'] ? '<td>' . ($r['g'] !== '' ? pdf_swatch($cfg, $r['b']) : '') . '</td>' : '') . '<td>' . e($r['score']) . '</td></tr>';
        }
        $h .= '</table>';
    }
    $h .= pdf_signature_block($cfg);
    $m = make_mpdf('A4');
    $m->SetTitle('รายงานผลการแข่งขัน ' . ($cfg['eventName'] ?? ''));
    $m->SetHTMLFooter('<div style="font-size:8pt;color:#5E6259">ตรวจสอบรายงานฉบับนี้ได้ที่ ' . e(verify_url($id)) . ' · รหัส ' . e(doc_code($id)) . '<span style="float:right"> หน้า {PAGENO}/{nbpg}</span></div>');
    $m->WriteHTML($h);
    return $m;
}

/* ---------- เกียรติบัตร (A4 แนวนอน กรอบทองลายผ้าทรง) ---------- */
function pdf_certs(array $d, array $items, string $id): Mpdf {
    $cfg = $d['config'];
    $c = $cfg['cert'] ?? [];
    $date = thai_date_formal((string) ($c['date'] ?? '') ?: date('Y-m-d'));
    $frame = APP_ROOT . '/assets/pdf/cert-frame.png';
    $logo = APP_ROOT . '/assets/pdf/logo.png';
    $m = make_mpdf('A4-L', ['margin_top' => 24, 'margin_bottom' => 20, 'margin_left' => 30, 'margin_right' => 30]);
    $m->SetTitle('เกียรติบัตร ' . ($cfg['eventName'] ?? ''));
    $css = '<style>
      @page{background-image:url("' . $frame . '");background-repeat:no-repeat;background-image-resize:6}
      body{font-family:sarabun;color:#2A1E17;text-align:center}
      .school{font-family:sarabunsemi;font-size:15pt}
      .affil{font-size:11pt;color:#6B5A48}
      .title{font-family:chonburi;font-size:40pt;color:' . PDF_RED . ';line-height:1.25}
      .lead{font-size:13pt}
      .name{font-family:chonburi;font-size:27pt;line-height:1.35}
      .sub{font-size:12.5pt;color:#5B4A3A}
      .award{font-family:sarabunsemi;font-size:18pt;color:' . PDF_RED . ';margin-top:2mm}
      .what{font-size:13pt}
      .date{font-size:12pt;color:#5B4A3A;margin-top:2mm}
    </style>';
    foreach ($items as $n => $x) {
        if ($n > 0) $m->AddPage();
        $h = '<div><img src="' . $logo . '" style="width:24mm;height:24mm"></div>
          <div class="school">' . e($cfg['school'] ?? '') . '</div>'
          . (!empty($cfg['affiliation']) ? '<div class="affil">' . e($cfg['affiliation']) . '</div>' : '')
          . '<div class="title">เกียรติบัตร</div>
          <div class="lead">ให้ไว้เพื่อแสดงว่า</div>
          <div class="name">' . e($x['name']) . '</div>'
          . ($x['sub'] !== '' ? '<div class="sub">' . e($x['sub']) . '</div>' : '')
          . '<div class="award">' . e($x['award']) . '</div>
          <div class="what">' . e($x['what']) . '</div>
          <div class="what">ในการแข่งขันกีฬาสีภายใน “' . e($cfg['eventName'] ?? 'กีฬาสีภายใน') . '” ประจำปีการศึกษา ' . thai_digits((string) ($cfg['year'] ?? '')) . '</div>
          <div class="date">ขอให้มีความสุข ความเจริญ และเป็นกำลังสำคัญของโรงเรียนสืบไป<br>ให้ไว้ ณ วันที่ ' . $date . '</div>'
          . pdf_signature_block($cfg)
          . '<div style="position:absolute;right:20mm;bottom:19mm;width:28mm;text-align:center">
               <barcode code="' . e(verify_url($id, $n)) . '" type="QR" error="M" size="0.7" disableborder="1" />
               <div style="font-size:7pt;color:#5B4A3A;line-height:1.3">ตรวจสอบเกียรติบัตร<br>' . e(doc_code($id)) . ' · ' . thai_digits((string) ($n + 1)) . '</div></div>';
        // หน้าแรกส่ง CSS พร้อมเนื้อหา กรอบพื้นหลังจาก @page ติดทุกหน้า
        $m->WriteHTML($n === 0 ? $css . $h : $h, $n === 0 ? \Mpdf\HTMLParserMode::DEFAULT_MODE : \Mpdf\HTMLParserMode::HTML_BODY);
    }
    return $m;
}

/* ---------- ใบรายชื่อผู้แข่งขัน (A4 แนวตั้ง ให้กรรมการกรอกผล) ---------- */
function pdf_entries(array $d, array $e): Mpdf {
    $cfg = $d['config'];
    $stu = [];
    foreach (all_students($d) as $s) $stu[$s['id']] = $s;
    $title = 'ใบรายชื่อผู้แข่งขัน · ' . e($e['name'] ?? '');
    $meta = 'ประเภท ' . e($e['cat'] ?? '-') . ' · ระดับชั้น ' . e($e['level'] ?: 'ทุกระดับ') . ' · ' . e($cfg['eventName'] ?? '') . ' ปีการศึกษา ' . thai_digits((string) ($cfg['year'] ?? ''));
    $h = '<style>' . PDF_TABLE_CSS . '</style>' . pdf_head_html($cfg, $title, $meta, null, null);
    foreach (cfg_colors($cfg) as $c) {
        $ids = $e['entries'][$c['id']] ?? [];
        $h .= '<h2>' . pdf_swatch($cfg, $c['name']) . ' (' . thai_digits((string) count($ids)) . ' คน)</h2>
          <table class="tb"><tr><th style="width:9mm">ที่</th><th>ชื่อ-สกุล</th><th style="width:18mm">ชั้น</th><th style="width:34mm">ผลการแข่งขัน</th><th style="width:40mm">ลายมือชื่อกรรมการ</th></tr>';
        $rows = $ids ?: ['', '', ''];
        foreach ($rows as $i => $sid) {
            $s = $stu[$sid] ?? null;
            $h .= '<tr><td style="text-align:center">' . thai_digits((string) ($i + 1)) . '</td><td style="height:8mm">' . ($s ? e($s['name']) : '') . '</td><td>' . ($s ? e($s['cls']) : '') . '</td><td></td><td></td></tr>';
        }
        $h .= '</table>';
    }
    $h .= pdf_signature_block($cfg);
    $m = make_mpdf('A4');
    $m->SetTitle('ใบรายชื่อผู้แข่งขัน ' . ($e['name'] ?? ''));
    $m->WriteHTML($h);
    return $m;
}

/* ---------- รายชื่อนักเรียนตามตัวกรอง (A4 แนวตั้ง) ---------- */
function pdf_roster(array $d, string $cls, string $color, string $q): Mpdf {
    $cfg = $d['config'];
    $list = array_values(array_filter(all_students($d), function ($s) use ($cls, $color, $q, $cfg) {
        if ($cls !== 'all' && $s['clsId'] !== $cls) return false;
        $has = in_array($s['color'] ?? '', color_ids($cfg), true);
        if ($color === 'none' && $has) return false;
        if ($color !== 'all' && $color !== 'none' && ($s['color'] ?? '') !== $color) return false;
        return $q === '' || mb_strpos((string) $s['name'], $q) !== false;
    }));
    $clsName = '';
    if ($cls !== 'all') foreach ($d['classes'] as $id => $c) if ((string) $id === $cls) $clsName = $c['name'] ?? '';
    $what = array_filter(['รายชื่อนักกีฬา', $color === 'none' ? 'ยังไม่มีสี' : ($color !== 'all' ? color_name($cfg, $color) : ''), $clsName !== '' ? 'ชั้น ' . $clsName : '']);
    $meta = e($cfg['eventName'] ?? '') . ' ปีการศึกษา ' . thai_digits((string) ($cfg['year'] ?? '')) . ' · ' . thai_digits((string) count($list)) . ' คน · พิมพ์เมื่อ ' . thai_digits(thai_dt(now()));
    $h = '<style>' . PDF_TABLE_CSS . '</style>' . pdf_head_html($cfg, e(implode(' · ', $what)), $meta, null, null);
    $h .= '<table class="tb" style="margin-top:3mm"><tr><th style="width:9mm">ที่</th><th style="width:18mm">ชั้น</th><th style="width:14mm">เลขที่</th><th>ชื่อ-สกุล</th><th style="width:12mm">เพศ</th><th style="width:32mm">สี</th></tr>';
    foreach ($list as $i => $s) {
        $h .= '<tr><td style="text-align:center">' . thai_digits((string) ($i + 1)) . '</td><td>' . e($s['cls']) . '</td><td>' . e((string) ($s['no'] ?? '')) . '</td><td>' . e($s['name']) . '</td><td>' . e($s['sex'] ?? '') . '</td><td>' . pdf_swatch($cfg, color_name($cfg, (string) ($s['color'] ?? ''))) . '</td></tr>';
    }
    $h .= '</table>';
    $m = make_mpdf('A4');
    $m->SetTitle(implode(' ', $what));
    $m->SetHTMLFooter('<div style="font-size:8pt;color:#5E6259;text-align:right">หน้า {PAGENO}/{nbpg}</div>');
    $m->WriteHTML($h);
    return $m;
}
