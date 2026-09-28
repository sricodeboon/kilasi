<?php
// สร้าง PDF ด้วย mPDF: รายงานผล · เกียรติบัตร · ใบรายชื่อผู้แข่งขัน · รายชื่อนักเรียน
// ฟอนต์ Sarabun (เนื้อหา) และ Chonburi (หัวเรื่อง) อยู่ที่ fonts/ · QR ใช้ <barcode type="QR"> ของ mPDF
declare(strict_types=1);

use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;
use Mpdf\Mpdf;

const PDF_RED = '#8C1B20';
const PDF_GOLD = '#C9A03A';

/** ใส่ U+200B ระหว่างคำไทยตามตัวตัดคำ ICU ให้ mPDF ขึ้นบรรทัดใหม่ตรงรอยต่อคำ (ฟอนต์มี U+200B แบบว่างแล้ว) */
function thai_lbr(string $html): string {
    if (!class_exists('IntlBreakIterator')) return $html;
    static $bi = null;
    $bi ??= IntlBreakIterator::createWordInstance('th');
    // ข้อความสั้นในเครื่องหมายคำพูด (เช่นชื่องาน “ช้างเผือกเกมส์”) ไม่แทรกจุดตัด ให้ขึ้นบรรทัดใหม่ทั้งก้อน
    $parts = preg_split('/(“[^”<]{1,40}”)/u', $html, -1, PREG_SPLIT_DELIM_CAPTURE);
    if ($parts === false) return $html;
    foreach ($parts as $i => $part) if ($i % 2 === 0) $parts[$i] = thai_lbr_run($part, $bi);
    return implode('', $parts);
}
function thai_lbr_run(string $html, IntlBreakIterator $bi): string {
    return preg_replace_callback('/\p{Thai}+/u', function ($r) use ($bi) {
        $t = $r[0];
        $bi->setText($t);
        $out = '';
        $prev = 0;
        foreach ($bi as $pos) {
            if ($pos === 0) continue;
            $out .= ($out !== '' ? "\u{200B}" : '') . substr($t, $prev, $pos - $prev);
            $prev = $pos;
        }
        return $out;
    }, $html) ?? $html;
}
function pdf_write(Mpdf $m, string $html, int $mode = \Mpdf\HTMLParserMode::DEFAULT_MODE): void {
    $m->WriteHTML(thai_lbr($html), $mode);
}

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
            // ฟอนต์แห่งชาติ TH Sarabun New สำหรับหนังสือราชการ (16 พอยต์ตามระเบียบงานสารบรรณ)
            'thsarabun' => ['R' => 'THSarabunNew-Regular.ttf', 'B' => 'THSarabunNew-Bold.ttf', 'useOTL' => 0xFF],
            'dejavusanscondensed' => $defFonts['dejavusanscondensed'],
        ],
        'default_font' => 'sarabun',
        // ตัดคำไทยด้วย ICU (thai_lbr) แม่นกว่าพจนานุกรมของ mPDF ที่ตัด “งาน” เป็น “งา|น” · ไม่มี intl ค่อยใช้พจนานุกรมของ mPDF
        'useDictionaryLBR' => !class_exists('IntlBreakIterator'),
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
/** ชื่อครูใหญ่: ผู้ลงนามเกียรติบัตรคนที่ 1 → ผู้ลงนามในคำสั่ง → คนแรกในทำเนียบครู */
function principal_name(array $cfg): string {
    foreach ([$cfg['cert']['s1n'] ?? '', $cfg['order']['signer'] ?? '', $cfg['staff'][0]['name'] ?? ''] as $n) if (trim((string) $n) !== '') return trim((string) $n);
    return '';
}
function pdf_signers(array $cfg): array {
    $c = $cfg['cert'] ?? [];
    $s = [[principal_name($cfg), (string) (($c['s1p'] ?? '') ?: 'ครูใหญ่')], [(string) ($c['s2n'] ?? ''), (string) ($c['s2p'] ?? '')]];
    return array_values(array_filter($s, fn($x) => $x[0] !== '' || $x[1] !== ''));
}
function pdf_signature_block(array $cfg, string $lineWidth = '60mm'): string {
    return pdf_sign_rows(pdf_signers($cfg));
}
/** ช่องลงนาม [[ชื่อ, ตำแหน่ง], …] แถวละไม่เกิน 3 คน */
function pdf_sign_rows(array $s): string {
    if (!$s) return '';
    $out = '';
    foreach (array_chunk($s, 3) as $row) {
        $w = floor(100 / max(count($row), min(count($s), 3)));
        $cells = array_map(fn($x) => '<td style="width:' . $w . '%;text-align:center;vertical-align:bottom">
            <div style="height:6mm">&nbsp;</div>
            <div>ลงชื่อ ....................................</div>
            <div style="margin-top:1mm">' . ($x[0] !== '' ? '(' . e($x[0]) . ')' : '&nbsp;') . '</div>
            <div style="color:#5B4A3A">' . e($x[1]) . '</div></td>', $row);
        $out .= '<table style="width:100%;margin-top:6mm;page-break-inside:avoid"><tr>' . implode('', $cells) . '</tr></table>';
    }
    return $out;
}
/** กรรมการตัดสินเป็นบรรทัดเดียว: ชื่อ (ตำแหน่ง), … */
function judges_line(array $list): string {
    return implode(', ', array_map(fn($x) => e($x['name']) . ' (' . e($x['role']) . ')', $list));
}
function pdf_head_html(array $cfg, string $title, string $meta, ?string $qrUrl, ?string $code, bool $official = false): string {
    $logo = APP_ROOT . '/assets/pdf/logo.png';
    if ($official) {  // ใบรายชื่อ: ฟอนต์ราชการ TH Sarabun New ทั้งหัวกระดาษ
        $qr = $qrUrl ? '<td style="width:30mm;text-align:center;vertical-align:top"><barcode code="' . e($qrUrl) . '" type="QR" error="M" size="0.8" disableborder="1" />
            <div style="font-size:11pt;color:#5E6259;line-height:1.1">สแกนเพื่อตรวจสอบ<br><b style="color:#000">' . e($code) . '</b></div></td>' : '';
        return '<table style="width:100%;border-bottom:1mm solid ' . PDF_GOLD . ';padding-bottom:1mm;margin-bottom:2mm;font-family:thsarabun"><tr>
            <td style="width:22mm;vertical-align:top"><img src="' . $logo . '" style="width:20mm;height:20mm"></td>
            <td style="vertical-align:top;padding-left:2mm;line-height:1.15">
              <div style="font-size:16pt;font-weight:bold">' . e($cfg['school'] ?? '') . '</div>
              <div style="font-size:14pt;color:#333">' . e($cfg['affiliation'] ?? '') . '</div>
              <div style="font-size:18pt;font-weight:bold;color:' . PDF_RED . '">' . $title . '</div>
              <div style="font-size:13pt;color:#333">' . $meta . '</div>
            </td>' . $qr . '</tr></table>';
    }
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
/** ใบรายชื่อ (ผู้แข่งขัน / คณะครูและนักกีฬา): ฟอนต์ราชการ TH Sarabun New 16 พอยต์ */
const PDF_OFFICIAL_CSS = '
  body{font-family:thsarabun;font-size:16pt;color:#000}
  h2{font-family:thsarabun;font-weight:bold;font-size:16pt;color:#8C1B20;margin:4mm 0 1mm 0}
  table.tb{width:100%;border-collapse:collapse}
  table.tb th{background-color:#F1EDE2;font-family:thsarabun;font-weight:bold;border:0.25mm solid #9A9E94;padding:0.6mm 2mm;text-align:left}
  table.tb td{border:0.25mm solid #9A9E94;padding:0.6mm 2mm}
  .r{text-align:right}
  .note{font-size:13pt;color:#333}
';
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
        $sports = array_values(array_unique(array_column(array_filter($p['results'], fn($r) => $r['cat'] === $cat), 'sport')));
        foreach ($p['judges'] ?? [] as $g) {
            if (!in_array($g['sport'], $sports, true)) continue;
            $h .= '<div class="note" style="margin-top:1mm;color:#1B1C18"><b>กรรมการตัดสิน' . e($g['sport']) . '</b> ' . judges_line($g['members']) . '</div>';
        }
    }
    $h .= pdf_signature_block($cfg);
    $m = make_mpdf('A4');
    $m->SetTitle('รายงานผลการแข่งขัน ' . ($cfg['eventName'] ?? ''));
    $m->SetHTMLFooter('<div style="font-size:8pt;color:#5E6259">ตรวจสอบรายงานฉบับนี้ได้ที่ ' . e(verify_url($id)) . ' · รหัส ' . e(doc_code($id)) . '<span style="float:right"> หน้า {PAGENO}/{nbpg}</span></div>');
    pdf_write($m, $h);
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
        pdf_write($m, $n === 0 ? $css . $h : $h, $n === 0 ? \Mpdf\HTMLParserMode::DEFAULT_MODE : \Mpdf\HTMLParserMode::HTML_BODY);
    }
    return $m;
}

/* ---------- ใบรายชื่อผู้แข่งขัน (A4 แนวตั้ง ให้กรรมการกรอกผล) + QR ตรวจสอบ ---------- */
function pdf_entries(array $d, array $p, string $id): Mpdf {
    $cfg = $d['config'];
    $title = 'ใบรายชื่อผู้แข่งขัน · ' . e($p['name']);
    $meta = 'ประเภท ' . e($p['cat'] ?: '-') . ' · ระดับชั้น ' . e($p['level'] ?: 'ทุกระดับ') . ' · ' . e($cfg['eventName'] ?? '') . ' ปีการศึกษา ' . thai_digits((string) ($cfg['year'] ?? '')) . ' · พิมพ์เมื่อ ' . thai_digits(thai_dt(now()));
    $h = '<style>' . PDF_OFFICIAL_CSS . '</style>' . pdf_head_html($cfg, $title, $meta, verify_url($id), doc_code($id), true);
    foreach ($p['colors'] as $c) {
        $h .= '<h2>' . pdf_swatch($cfg, $c['name']) . ' (' . thai_digits((string) count($c['students'])) . ' คน)</h2>
          <table class="tb"><tr><th style="width:9mm">ที่</th><th>ชื่อ-สกุล</th><th style="width:18mm">ชั้น</th><th style="width:34mm">ผลการแข่งขัน</th><th style="width:40mm">ลายมือชื่อกรรมการ</th></tr>';
        $rows = $c['students'] ?: [null, null, null];
        foreach ($rows as $i => $s) {
            $h .= '<tr><td style="text-align:center">' . thai_digits((string) ($i + 1)) . '</td><td style="height:8mm">' . ($s ? e($s['name']) : '') . '</td><td>' . ($s ? e($s['cls']) : '') . '</td><td></td><td></td></tr>';
        }
        $h .= '</table>';
    }
    if (!empty($p['judges'])) {
        $h .= '<div style="margin-top:4mm"><b>กรรมการตัดสิน' . e($p['sport']) . '</b></div>'
            . pdf_sign_rows(array_map(fn($x) => [$x['name'], $x['role']], $p['judges']));
    }
    $h .= pdf_signature_block($cfg);
    $m = make_mpdf('A4');
    $m->SetTitle('ใบรายชื่อผู้แข่งขัน ' . $p['name']);
    $m->SetHTMLFooter(pdf_code_footer($id, true));
    pdf_write($m, $h);
    return $m;
}

/* ---------- รายชื่อคณะครูและนักกีฬาตามตัวกรอง (A4 แนวตั้ง) + QR ตรวจสอบ ---------- */
function roster_color(array $cfg, string $name): string {
    return $name === '' ? '<span style="color:#8A8E84">ยังไม่มีสี</span>' : pdf_swatch($cfg, $name);
}
function pdf_code_footer(string $id, bool $official = false): string {
    return '<table style="width:100%;font-size:' . ($official ? '12pt;font-family:thsarabun' : '8pt') . ';color:#5E6259"><tr><td>รหัสเอกสาร ' . e(doc_code($id)) . ' · ตรวจสอบได้ที่ ' . e(verify_url($id)) . '</td><td style="text-align:right">หน้า {PAGENO}/{nbpg}</td></tr></table>';
}
function pdf_roster(array $d, array $p, string $id): Mpdf {
    $cfg = $d['config'];
    // เลือก “ทุกสี” → แยกสีละหน้า (สีที่ตั้งไว้ตามลำดับ แล้วคนที่ยังไม่มีสี) · เลือกสีเดียว/ยังไม่มีสี → หน้าเดียว
    $split = ($p['params']['color'] ?? 'all') === 'all';
    $groups = [];
    if ($split) {
        foreach (array_merge(array_map(fn($c) => (string) $c['name'], cfg_colors($cfg)), ['']) as $name) {
            $st = array_values(array_filter($p['staff'], fn($x) => $x['color'] === $name));
            $li = array_values(array_filter($p['students'], fn($x) => $x['color'] === $name));
            if ($st || $li || $name !== '') $groups[] = [$name, $st, $li];
        }
    } else {
        $groups[] = [null, $p['staff'], $p['students']];
    }
    $css = '<style>' . PDF_OFFICIAL_CSS . '</style>';
    $m = make_mpdf('A4');
    $m->SetTitle($p['title']);
    $m->SetHTMLFooter(pdf_code_footer($id, true));
    foreach ($groups as $n => [$name, $staff, $list]) {
        $title = e($p['title']) . ($name !== null ? ' · ' . ($name === '' ? 'ยังไม่มีสี' : e($name)) : '');
        $f = count(array_filter($list, fn($x) => $x['sex'] === 'ญ'));
        $meta = e($cfg['eventName'] ?? '') . ' ปีการศึกษา ' . thai_digits((string) ($cfg['year'] ?? '')) . ' · ' . ($staff ? 'ครู ' . thai_digits((string) count($staff)) . ' ท่าน · ' : '') . 'นักกีฬา ' . thai_digits((string) count($list)) . ' คน'
            . ($list ? ' (ชาย ' . thai_digits((string) (count($list) - $f)) . ' หญิง ' . thai_digits((string) $f) . ')' : '') . ' · พิมพ์เมื่อ ' . thai_digits(thai_dt(now()));
        $colCol = $name === null; // หน้ารวมหลายสีเท่านั้นที่ต้องมีคอลัมน์สี
        $h = pdf_head_html($cfg, $title, $meta, verify_url($id), doc_code($id), true);
        if ($name !== null && $name !== '') $h .= '<div style="margin-top:1mm">' . pdf_swatch($cfg, $name) . ($staff && ($hd = array_values(array_filter($staff, fn($x) => $x['head']))) ? ' · หัวหน้าสี ' . e($hd[0]['name']) : '') . '</div>';
        if ($staff) {
            $h .= '<div style="font-weight:bold;font-size:16pt;margin-top:3mm">คณะครู ' . thai_digits((string) count($staff)) . ' ท่าน</div>';
            $h .= '<table class="tb" style="margin-top:1.5mm"><tr><th style="width:9mm">ที่</th><th>ชื่อ-สกุล</th><th style="width:30mm">ครูประจำชั้น</th><th style="width:24mm">หน้าที่</th>' . ($colCol ? '<th style="width:32mm">สี</th>' : '') . '</tr>';
            foreach ($staff as $i => $x) {
                $h .= '<tr><td style="text-align:center">' . thai_digits((string) ($i + 1)) . '</td><td>' . e($x['name']) . '</td><td>' . e($x['cls'] !== '' ? $x['cls'] : '–') . '</td><td>' . ($x['head'] ? 'หัวหน้าสี' : 'ครูประจำสี') . '</td>' . ($colCol ? '<td>' . roster_color($cfg, $x['color']) . '</td>' : '') . '</tr>';
            }
            $h .= '</table><div style="font-weight:bold;font-size:16pt;margin-top:4mm">นักกีฬา ' . thai_digits((string) count($list)) . ' คน</div>';
        }
        if ($list) {
            $h .= '<table class="tb" style="margin-top:3mm"><tr><th style="width:9mm">ที่</th><th style="width:18mm">ชั้น</th><th style="width:14mm">เลขที่</th><th>ชื่อ-สกุล</th><th style="width:12mm">เพศ</th>' . ($colCol ? '<th style="width:32mm">สี</th>' : '') . '</tr>';
            foreach ($list as $i => $x) {
                $h .= '<tr><td style="text-align:center">' . thai_digits((string) ($i + 1)) . '</td><td>' . e($x['cls']) . '</td><td>' . e($x['no']) . '</td><td>' . e($x['name']) . '</td><td>' . e($x['sex']) . '</td>' . ($colCol ? '<td>' . roster_color($cfg, $x['color']) . '</td>' : '') . '</tr>';
            }
            $h .= '</table>';
        } else {
            $h .= '<p style="color:#8A8E84;margin-top:3mm">ยังไม่มีนักกีฬาในสีนี้</p>';
        }
        $h .= pdf_signature_block($cfg);
        if ($n > 0) $m->AddPage();
        pdf_write($m, $n === 0 ? $css . $h : $h, $n === 0 ? \Mpdf\HTMLParserMode::DEFAULT_MODE : \Mpdf\HTMLParserMode::HTML_BODY);
    }
    return $m;
}

/* ---------- คำสั่งแต่งตั้งคณะกรรมการ (รูปแบบหนังสือราชการ ตราครุฑ) + QR ตรวจสอบท้ายทุกหน้า ---------- */
function pdf_order(array $d, array $p, string $id): Mpdf {
    // หนังสือราชการใช้เลขไทยทั้งฉบับ
    $T = fn(string $x) => e(thai_digits($x));
    $m = make_mpdf('A4', ['margin_top' => 15, 'margin_bottom' => 20, 'margin_left' => 30, 'margin_right' => 20, 'margin_header' => 12, 'margin_footer' => 5]);
    $m->defaultPageNumStyle = 'thai';
    $m->SetTitle('คำสั่ง ' . $p['subject']);
    $m->SetFont('thsarabun', '', 16);
    $m->SetFontSize(16);
    $W = fn(string $x) => $m->GetStringWidth(thai_digits($x));          // ความกว้างจริง (มม.) ใช้จัดตำแหน่งท้ายคำสั่ง
    $t = strtotime($p['date'] ?: date('Y-m-d')) ?: time();
    $beYear = (string) ((int) date('Y', $t) + 543);                      // เลขที่คำสั่งทับปี พ.ศ. ที่ออกคำสั่ง (ปีปฏิทิน)
    $dateText = 'สั่ง ณ วันที่ ' . (int) date('j', $t) . ' ' . THAI_MONTHS[(int) date('n', $t)] . ' พ.ศ. ' . $beYear;
    $para = fn(string $x) => implode('', array_map(fn($l) => '<p class="ind" style="margin-left:0">' . $T($l) . '</p>', array_filter(array_map('trim', preg_split('/\R/u', $x)), 'strlen')));
    // ระเบียบงานสารบรรณ: TH Sarabun 16 พอยต์ ระยะบรรทัดเดี่ยว ครุฑสูง 3 ซม. ห่างขอบบน 1.5 ซม. ขอบซ้าย 3 ซม. ขวา 2 ซม.
    // เลขหน้าเลขไทยกลางบน “- ๒ -” ตั้งแต่หน้าที่ 2
    $css = '<style>
      @page{margin-top:25mm;header:html_pn;footer:html_qf}
      @page :first{margin-top:15mm;header:_blank;footer:html_qf}
      body{font-family:thsarabun;font-size:16pt;line-height:20.8pt;color:#000}
      td{line-height:20.8pt}
      p{margin:0}
      .c{text-align:center}
      .ind{text-indent:25mm}
      .unit{margin-top:3mm;text-indent:25mm;font-weight:bold}
      table.mem{margin-left:25mm;border-collapse:collapse;width:135mm}
      table.mem td{padding:0 0 0 0;vertical-align:top}
      .duty{margin-left:25mm}
    </style>';
    $h = $css . '<div class="c"><img src="' . APP_ROOT . '/assets/pdf/garuda.png" style="height:30mm"></div>
      <htmlpagefooter name="qf"><table style="width:100%;font-family:sarabun;font-size:8pt;line-height:normal;color:#5E6259"><tr>
        <td style="vertical-align:bottom;line-height:11pt">รหัสเอกสาร ' . e(doc_code($id)) . '<br>ตรวจสอบได้ที่ ' . e(verify_url($id)) . '</td>
        <td style="width:16mm;text-align:right;vertical-align:bottom;line-height:normal"><barcode code="' . e(verify_url($id)) . '" type="QR" error="M" size="0.42" disableborder="1" /></td></tr></table></htmlpagefooter>
      <htmlpageheader name="pn"><div style="text-align:center;font-family:thsarabun;font-size:16pt">- {PAGENO} -</div></htmlpageheader>
      <p class="c" style="font-weight:bold;margin-top:2mm">คำสั่ง' . $T($p['school']) . '</p>
      <p class="c">ที่ ' . ($p['no'] !== '' ? $T($p['no']) : str_repeat('&nbsp;', 15)) . '/' . $T($beYear) . '</p>
      <p class="c">เรื่อง&nbsp;&nbsp;' . $T($p['subject']) . '</p>
      <table style="width:160mm;margin-top:1mm;border-collapse:collapse"><tr><td style="width:55mm"></td><td style="width:50mm;border-top:0.3mm solid #000;height:1mm;line-height:1mm;font-size:2pt">&nbsp;</td><td></td></tr></table>
      <div style="margin-top:3mm">' . $para($p['intro']) . '</div>';
    foreach ($p['units'] as $i => $u) {
        $n = $i + 1;
        $h .= '<p class="unit">' . $T($n . '. ' . $u['name']) . '</p>';
        if (isset($u['groups'])) {
            foreach ($u['groups'] as $k => $g) {
                $h .= '<p style="margin-left:25mm;margin-top:1mm">' . $T($n . '.' . ($k + 1) . ' ' . $g['color']) . '</p>';
                if (!$g['members']) { $h .= '<p style="margin-left:33mm">–</p>'; continue; }
                $h .= '<table class="mem" style="margin-left:33mm;width:127mm">';
                foreach ($g['members'] as $j => $mb) $h .= '<tr><td style="width:70mm">' . $T(($j + 1) . ') ' . $mb['name']) . '</td><td>' . $T($mb['role']) . '</td></tr>';
                $h .= '</table>';
            }
        } else {
            $h .= '<table class="mem">';
            foreach ($u['members'] as $j => $mb) $h .= '<tr><td style="width:78mm">' . $T($n . '.' . ($j + 1) . ' ' . $mb['name']) . '</td><td>' . $T($mb['role']) . '</td></tr>';
            $h .= '</table>';
            foreach ($u['sports'] ?? [] as $k => $g) {
                $h .= '<p style="margin-left:25mm;margin-top:1mm">' . $T($n . '.' . (count($u['members']) + $k + 1) . ' กรรมการตัดสิน' . $g['sport']) . '</p>';
                $h .= '<table class="mem" style="margin-left:33mm;width:127mm">';
                foreach ($g['members'] as $j => $mb) $h .= '<tr><td style="width:70mm">' . $T(($j + 1) . ') ' . $mb['name']) . '</td><td>' . $T($mb['role']) . '</td></tr>';
                $h .= '</table>';
            }
        }
        if ($u['duty'] !== '') $h .= '<p class="duty">มีหน้าที่&nbsp;&nbsp;' . $T($u['duty']) . '</p>';
    }
    $h .= '<div style="margin-top:4mm">' . $para($p['closing']) . '</div>';
    // ท้ายคำสั่งตามคู่มือการพิมพ์: “สั่ง” ตรงกับคำ “ตั้งแต่” ในบรรทัด ทั้งนี้ ตั้งแต่… · ชื่อเต็มอยู่ Enter ที่ 4 จาก สั่ง ณ วันที่
    // ชื่อกับตำแหน่งกึ่งกลางกันใต้บรรทัดวันที่ · ผู้มียศ พิมพ์ยศเต็มไว้หน้าลายมือชื่อ (บรรทัดเหนือชื่อ) ชื่อในวงเล็บไม่มียศ
    $lines = array_values(array_filter(array_map('trim', preg_split('/\R/u', $p['closing'])), 'strlen'));
    $last = $lines ? end($lines) : '';
    $offS = 25 + (preg_match('/^(ทั้งนี้\s+)/u', $last, $mm) ? $W($mm[1]) : 0);
    [$rank, $plain] = split_rank($p['signer']);
    $nameText = '(' . ($plain !== '' ? preg_replace('/\s+/u', '  ', $plain, 1) : str_repeat(' ', 40)) . ')';
    $C = $offS + $W($dateText) / 2;
    $clamp = fn(float $left, float $w) => max(0, min($left, 160 - $w));
    $nameL = $clamp($C - $W($nameText) / 2, $W($nameText));
    $posL = $clamp($C - $W($p['signerPos']) / 2, $W($p['signerPos']));
    $rankL = max(0, $nameL - $W($rank) - 2);
    $row = fn(float $left, string $html) => '<tr><td style="padding:0 0 0 ' . round($left, 1) . 'mm">' . ($html !== '' ? $html : '&nbsp;') . '</td></tr>';
    $h .= '<table style="width:160mm;margin-top:' . ($lines ? '0' : '4mm') . ';page-break-inside:avoid;border-collapse:collapse">'
        . $row(0, '')
        . $row($offS, $T($dateText))
        . $row(0, '') . $row(0, '')
        . $row($rankL, $T($rank))
        . $row($nameL, str_replace('  ', '&nbsp;&nbsp;', $T($nameText)))
        . $row($posL, $T($p['signerPos']))
        . '</table>';

    pdf_write($m, $h);
    return $m;
}
