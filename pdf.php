<?php
// สร้างไฟล์ PDF ที่เซิร์ฟเวอร์ด้วย mPDF (ครูที่ล็อกอินเท่านั้น)
//   POST {type: report}                              รายงานผลการแข่งขัน + QR ตรวจสอบ
//   POST {type: certs, events[], mode, team}         เกียรติบัตร + QR รายใบ
//   POST {type: entries, event}                      ใบรายชื่อผู้แข่งขัน + QR ตรวจสอบ
//   POST {type: roster, cls, color, q}               รายชื่อคณะครูและนักกีฬาตามตัวกรอง + QR ตรวจสอบ
//   POST {type: order}                               คำสั่งแต่งตั้งคณะกรรมการ (ตราครุฑ) + QR ตรวจสอบ
// ทุกเอกสารเก็บสำเนาในตาราง reports ให้สแกน QR ไปเทียบกับข้อมูลปัจจุบันที่ verify.php
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/report.php';
require __DIR__ . '/lib/pdf.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'ต้องใช้ POST'], 405);
csrf_check();
$t = require_teacher();
$b = json_decode((string) file_get_contents('php://input', false, null, 0, 65536), true);
if (!is_array($b)) $b = [];
@set_time_limit(120);
@ini_set('memory_limit', '256M');

try {
    $d = docs_load();
    $stamp = date('Ymd-His');
    switch ($b['type'] ?? '') {
        case 'report':
            if (!$d['events']) json_out(['error' => 'ยังไม่มีรายการแข่งขัน'], 422);
            $p = report_payload($d);
            $id = create_report('report', $p, $t);
            $m = pdf_report($d, $p, $id, $t);
            $name = "report-$stamp.pdf";
            break;

        case 'certs':
            $ids = array_values(array_filter(array_map('strval', (array) ($b['events'] ?? []))));
            $items = cert_items($d, $ids, ($b['mode'] ?? '') === 'all' ? 'all' : 'win', !empty($b['team']));
            if (!$items) json_out(['error' => 'ไม่มีเกียรติบัตรที่จะออก เลือกนักกีฬาในรายการก่อน'], 422);
            if (count($items) > 300) json_out(['error' => 'ออกได้ครั้งละไม่เกิน 300 ใบ เลือกรายการให้น้อยลง'], 422);
            $id = create_report('certs', ['items' => $items], $t);
            $m = pdf_certs($d, $items, $id);
            $name = "certificates-$stamp.pdf";
            break;

        case 'entries':
            $p = entries_payload($d, (string) ($b['event'] ?? ''));
            if (!$p) json_out(['error' => 'ไม่พบรายการแข่งขัน'], 404);
            $id = create_report('entries', $p, $t, payload_hash($p));
            $m = pdf_entries($d, $p, $id);
            $name = "entries-$stamp.pdf";
            break;

        case 'roster':
            $p = roster_payload($d, (string) ($b['cls'] ?? 'all'), (string) ($b['color'] ?? 'all'), mb_substr(trim((string) ($b['q'] ?? '')), 0, 60));
            if (!$p['staff'] && !$p['students']) json_out(['error' => 'ไม่มีรายชื่อตามตัวกรองนี้'], 422);
            $id = create_report('roster', $p, $t, payload_hash($p));
            $m = pdf_roster($d, $p, $id);
            $name = "roster-$stamp.pdf";
            break;

        case 'order':
            $p = order_payload($d);
            if (!$p) json_out(['error' => 'ยังไม่ได้ร่างคำสั่ง'], 422);
            $id = create_report('order', $p, $t, payload_hash($p));
            $m = pdf_order($d, $p, $id);
            $name = "order-$stamp.pdf";
            break;

        default:
            json_out(['error' => 'ไม่รู้จักชนิดเอกสาร'], 422);
    }
    while (ob_get_level()) ob_end_clean();
    header('Cache-Control: no-store');
    header('X-Thai-Linebreak: ' . (class_exists('IntlBreakIterator') ? 'icu' : 'mpdf-dict'));
    $m->Output($name, \Mpdf\Output\Destination::INLINE);
} catch (Throwable $e) {
    error_log('[kilasi pdf] ' . $e->getMessage());
    json_out(['error' => 'สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่'], 500);
}
