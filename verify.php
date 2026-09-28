<?php
// หน้าตรวจสอบเอกสารจาก QR: รายงานผลการแข่งขัน (?r=รหัส) และเกียรติบัตรรายใบ (?r=รหัส&n=ลำดับ)
// เปิดได้โดยไม่ต้องล็อกอิน แสดงเฉพาะสิ่งที่พิมพ์อยู่บนเอกสารนั้นอยู่แล้ว
require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/report.php';
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');

$id = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) ($_GET['r'] ?? '')));
$n = isset($_GET['n']) && ctype_digit((string) $_GET['n']) ? (int) $_GET['n'] : null;
$rec = strlen($id) === 10 ? db_one('SELECT * FROM reports WHERE id = ?', [$id]) : null;
$data = $rec ? (json_decode($rec['data'], true) ?: []) : [];
$cfg = docs_load()['config'];
$same = $rec ? hash_equals($rec['results_hash'], results_hash()) : false;
$item = null;
if ($rec && $rec['kind'] === 'certs' && $n !== null) $item = $data['items'][$n] ?? null;
if (!$rec || ($rec['kind'] === 'certs' && $n !== null && !$item)) http_response_code(404);

$code = $rec ? implode('-', str_split($id, 4)) : '';
$title = $rec ? ($rec['kind'] === 'certs' ? 'ตรวจสอบเกียรติบัตร' : 'ตรวจสอบรายงานผลการแข่งขัน') : 'ไม่พบเอกสาร';
?><!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title><?= h($title) ?> · <?= h($cfg['eventName'] ?? 'กีฬาสีภายใน') ?></title>
<link rel="icon" type="image/svg+xml" href="assets/logo.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Chonburi&family=Sarabun:wght@400;500;600&display=swap">
<style>
:root{--ink:#1B1C18;--muted:#5E6259;--line:#D8DBD2;--red:#8C1B20;--gold:#C9A03A}
*{box-sizing:border-box}
body{margin:0;background:#F2F3EF;color:var(--ink);font:16px/1.6 "Sarabun",system-ui,sans-serif}
header{background:var(--red);border-bottom:5px solid var(--gold);color:#fff;padding:18px 16px}
.in{max-width:760px;margin:0 auto;padding-inline:16px}
header .in{display:flex;align-items:center;gap:14px;padding:0}
header img{width:56px;height:56px;flex:none}
header small{display:block;font:600 12px "Chakra Petch",sans-serif;letter-spacing:.08em;color:#F1D27F}
header b{display:block;font:400 24px/1.3 "Chonburi",serif}
header span{font-size:14px;opacity:.9}
main{padding-block:20px 40px;display:grid;gap:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}
h1{font:600 22px/1.3 "Chakra Petch",sans-serif;margin:0 0 6px}
h2{font:600 18px "Chakra Petch",sans-serif;margin:0 0 8px}
.ok,.warn,.bad{display:flex;gap:12px;align-items:flex-start;border-radius:12px;padding:14px 16px}
.ok{background:#DDF1E6;color:#1F5E3E}.warn{background:#FBEBCF;color:#7A4A00}.bad{background:#FDE2DF;color:#8A1F14}
.ok b,.warn b,.bad b{display:block;font:600 17px "Chakra Petch",sans-serif}
.ic{font-size:26px;line-height:1}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0}
dt{color:var(--muted)}dd{margin:0;font-weight:500}
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{padding:7px 10px;border-bottom:1px solid #ECEEE8;text-align:left;white-space:nowrap}
th{font-size:13px;color:var(--muted);font-weight:500;background:#F2F3EF}
td.r,th.r{text-align:right}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.cert{text-align:center;border:2px solid var(--gold);border-radius:14px;padding:22px;background:#FBF7EC}
.cert .nm{font:400 28px/1.3 "Chonburi",serif;margin:6px 0}
.cert .aw{font:600 20px "Chakra Petch",sans-serif;color:var(--red)}
.btn{display:inline-block;background:var(--red);color:#fff;text-decoration:none;border-radius:10px;padding:10px 16px;font:600 15px "Chakra Petch",sans-serif}
.muted{color:var(--muted);font-size:14px}
</style>
</head>
<body>
<header><div class="in">
<img src="assets/logo.svg" alt="">
<div><small><?= h($cfg['affiliation'] ?? '') ?></small><b><?= h($cfg['eventName'] ?? 'กีฬาสีภายใน') ?> <?= h(thai_digits((string) ($cfg['year'] ?? ''))) ?></b><span><?= h($cfg['school'] ?? '') ?></span></div>
</div></header>
<main class="in">
<?php if (!$rec || ($rec['kind'] === 'certs' && $n !== null && !$item)): ?>
  <div class="bad"><span class="ic">✕</span><div><b>ไม่พบเอกสารนี้ในระบบ</b>รหัสอาจพิมพ์ผิด หรือเอกสารนี้ไม่ได้ออกจากระบบกีฬาสีของโรงเรียน</div></div>
  <p><a class="btn" href="./#score">ดูตารางคะแนนล่าสุด</a></p>
<?php else: ?>
  <div class="ok"><span class="ic">✓</span><div><b>เอกสารนี้ออกจากระบบกีฬาสีของโรงเรียนจริง</b>รหัสเอกสาร <?= h($code) ?><?= $n !== null ? ' · ใบที่ ' . ($n + 1) : '' ?></div></div>
  <?php if ($same): ?>
    <div class="ok"><span class="ic">✓</span><div><b>ผลการแข่งขันยังตรงกับระบบปัจจุบัน</b>ไม่มีการแก้ไขผลหลังพิมพ์เอกสารนี้</div></div>
  <?php else: ?>
    <div class="warn"><span class="ic">!</span><div><b>มีการแก้ไขผลการแข่งขันหลังพิมพ์เอกสารนี้</b>ข้อมูลด้านล่างคือสิ่งที่พิมพ์ไว้ ณ เวลาที่ออกเอกสาร ดูผลล่าสุดได้ที่ตารางคะแนน</div></div>
  <?php endif; ?>
  <div class="card"><dl>
    <dt>ประเภท</dt><dd><?= $rec['kind'] === 'certs' ? 'เกียรติบัตร' : 'รายงานผลการแข่งขัน' ?></dd>
    <dt>ออกเมื่อ</dt><dd><?= h(thai_dt($rec['created_at'])) ?></dd>
    <dt>ผู้ออกเอกสาร</dt><dd><?= h($rec['created_by']) ?></dd>
    <?php if ($rec['kind'] === 'certs'): ?><dt>จำนวน</dt><dd><?= count($data['items'] ?? []) ?> ใบ</dd><?php endif; ?>
  </dl></div>

  <?php if ($item): ?>
    <div class="cert">
      <div class="muted">เกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า</div>
      <div class="nm"><?= h($item['name'] ?? '') ?></div>
      <?php if (!empty($item['sub'])): ?><div class="muted"><?= h($item['sub']) ?></div><?php endif; ?>
      <div class="aw"><?= h($item['award'] ?? '') ?></div>
      <div><?= h($item['what'] ?? '') ?></div>
    </div>
  <?php elseif ($rec['kind'] === 'report'): ?>
    <div class="card">
      <h2>สรุปคะแนนรวม</h2>
      <div class="tw"><table>
        <tr><th>อันดับ</th><th>สี</th><th class="r">ทอง</th><th class="r">เงิน</th><?php if (!empty($data['bronze'])): ?><th class="r">ทองแดง</th><?php endif; ?><th class="r">คะแนน</th></tr>
        <?php foreach ($data['standings'] ?? [] as $s): ?>
        <tr><td><?= (int) ($s['rank'] ?? 0) ?></td><td><span class="sw" style="background:<?= h(preg_match('/^#[0-9a-fA-F]{6}$/', $s['hex'] ?? '') ? $s['hex'] : '#999') ?>"></span><?= h($s['name'] ?? '') ?></td><td class="r"><?= (int) ($s['g'] ?? 0) ?></td><td class="r"><?= (int) ($s['s'] ?? 0) ?></td><?php if (!empty($data['bronze'])): ?><td class="r"><?= (int) ($s['b'] ?? 0) ?></td><?php endif; ?><td class="r"><b><?= (int) ($s['pts'] ?? 0) ?></b></td></tr>
        <?php endforeach; ?>
      </table></div>
    </div>
    <div class="card">
      <h2>ผลรายการแข่งขัน (<?= (int) ($data['done'] ?? 0) ?> จาก <?= (int) ($data['total'] ?? 0) ?> รายการ)</h2>
      <div class="tw"><table>
        <tr><th>รายการ</th><th>ระดับชั้น</th><th>ชนะเลิศ</th><th>รองชนะเลิศ</th><?php if (!empty($data['bronze'])): ?><th>อันดับ 3</th><?php endif; ?><th>ผล</th></tr>
        <?php foreach ($data['results'] ?? [] as $r): ?>
        <tr><td><?= h($r['name'] ?? '') ?></td><td><?= h($r['level'] ?? '') ?></td><td><?= h($r['g'] ?? '–') ?></td><td><?= h($r['s'] ?? '–') ?></td><?php if (!empty($data['bronze'])): ?><td><?= h($r['b'] ?? '–') ?></td><?php endif; ?><td><?= h($r['score'] ?? '') ?></td></tr>
        <?php endforeach; ?>
      </table></div>
    </div>
  <?php endif; ?>
  <p><a class="btn" href="./#score">ดูตารางคะแนนล่าสุด</a></p>
<?php endif; ?>
<p class="muted">ระบบกีฬาสีภายใน · <?= h($cfg['school'] ?? '') ?></p>
</main>
</body>
</html>
