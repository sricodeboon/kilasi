<?php
// หน้าแอปกีฬาสี (หน้าเดียว) ข้อมูลโหลดผ่าน api.php
require __DIR__ . '/lib/bootstrap.php';
header('Content-Type: text/html; charset=utf-8');
$cfg = docs_load()['config'];
$title = trim(($cfg['eventName'] ?? 'กีฬาสีภายใน') . ' ' . ($cfg['year'] ?? ''));
?><!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="csrf-token" content="<?= h(csrf_token()) ?>">
<meta name="robots" content="noindex">
<title><?= h($title) ?></title>
<meta name="description" content="ตารางคะแนนกีฬาสีภายใน <?= h($cfg['school'] ?? '') ?>">
<?php
$https = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
$base = ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
?>
<link rel="icon" type="image/svg+xml" href="<?= h(asset_v('assets/logo.svg')) ?>">
<link rel="icon" type="image/png" sizes="512x512" href="<?= h(asset_v('assets/icon-512.png')) ?>">
<link rel="apple-touch-icon" href="<?= h(asset_v('assets/apple-touch-icon.png')) ?>">
<meta name="theme-color" content="#8C1B20">
<link rel="manifest" href="manifest.webmanifest" crossorigin="use-credentials">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ช้างเผือกเกมส์">
<meta property="og:type" content="website">
<meta property="og:title" content="<?= h($title) ?>">
<meta property="og:description" content="ตารางคะแนนกีฬาสีภายใน <?= h($cfg['school'] ?? '') ?>">
<meta property="og:image" content="<?= h($base . '/assets/og.png') ?>">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Chonburi&family=Sarabun:wght@400;500;600&display=swap">
<link rel="stylesheet" href="<?= h(asset_v('assets/app.css')) ?>">
</head>
<body data-sw="<?= h(asset_v('sw.js')) ?>">
<header class="hero">
  <div class="hero-in">
    <div class="hero-text">
      <div class="affil" id="hdr-affil">กองบังคับการตำรวจตระเวนชายแดนภาค 2</div>
      <h1 id="hdr-event">กีฬาสีภายใน</h1>
      <div class="hero-sub" id="hdr-sub">โรงเรียนของเรา · ปีการศึกษา 2569</div>
      <div class="mode" id="hdr-mode"><span class="dot"></span>กำลังเชื่อมต่อ…</div>
    </div>
    <svg class="mascot" viewBox="0 0 220 150" role="img" aria-label="ช้างเผือกเตะลูกฟุตบอล">
      <defs>
        <clipPath id="ballclip"><circle cx="24" cy="128" r="14"/></clipPath>
      </defs>
      <!-- ขาหลังฝั่งไกล -->
      <rect x="150" y="96" width="19" height="46" rx="7" fill="#E7DECB"/>
      <rect x="92" y="98" width="19" height="44" rx="7" fill="#E7DECB"/>
      <!-- หาง -->
      <path d="M186 70 C196 80 196 96 192 106" stroke="#FBF7EC" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M190 104 l5 9 l-8 -3 z" fill="#3A2A20"/>
      <!-- ลำตัว -->
      <ellipse cx="130" cy="78" rx="60" ry="40" fill="#FBF7EC"/>
      <!-- ขาใกล้ -->
      <rect x="80" y="96" width="21" height="48" rx="7" fill="#FBF7EC"/>
      <rect x="160" y="96" width="21" height="48" rx="7" fill="#FBF7EC"/>
      <path d="M80 138 h21 M160 138 h21" stroke="#E7DECB" stroke-width="2"/>
      <!-- ผ้าทรง -->
      <path d="M100 44 Q132 30 168 44 L164 86 Q132 96 104 86 Z" fill="#C9A03A"/>
      <path d="M104 80 Q132 90 164 80 L164 86 Q132 96 104 86 Z" fill="#8C1B20"/>
      <path d="M112 50 l8 12 l-8 12 l-8 -12 z M134 45 l8 13 l-8 13 l-8 -13 z M156 50 l8 12 l-8 12 l-8 -12 z" fill="#8C1B20" opacity=".85"/>
      <g fill="#F4DC8C"><circle cx="112" cy="90" r="2.4"/><circle cx="124" cy="92.5" r="2.4"/><circle cx="136" cy="93" r="2.4"/><circle cx="148" cy="92" r="2.4"/><circle cx="160" cy="89" r="2.4"/></g>
      <!-- หัว -->
      <circle cx="72" cy="62" r="31" fill="#FBF7EC"/>
      <!-- หู -->
      <path d="M80 38 C104 36 108 70 96 84 C90 90 80 86 78 78 Z" fill="#EFE6D3"/>
      <!-- เครื่องประดับหน้า -->
      <path d="M56 34 Q70 26 84 34 L80 44 Q70 38 60 44 Z" fill="#C9A03A"/>
      <circle cx="70" cy="46" r="3.2" fill="#8C1B20"/>
      <!-- ตา -->
      <circle cx="62" cy="58" r="3" fill="#2A1E17"/>
      <!-- งวง -->
      <path d="M50 70 C34 86 30 104 38 118" stroke="#FBF7EC" stroke-width="14" fill="none" stroke-linecap="round"/>
      <!-- งา -->
      <path d="M56 84 Q46 96 36 94" stroke="#FFFFFF" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <!-- ลูกฟุตบอล -->
      <g class="ball">
        <circle cx="24" cy="128" r="14" fill="#FFFFFF" stroke="#1B1C18" stroke-width="1.6"/>
        <g clip-path="url(#ballclip)" fill="#1B1C18">
          <polygon points="24,122.5 29.2,126.3 27.2,132.4 20.8,132.4 18.8,126.3"/>
          <polygon points="24,111 28.5,114.3 26.8,119.6 21.2,119.6 19.5,114.3"/>
          <polygon points="40.2,122.6 38.5,128 33,128 31.3,122.7 36,119.4" transform="rotate(0 24 128)"/>
          <polygon points="36,139 30.5,139.8 28.7,134.6 33.2,131.3 37.7,134.5"/>
          <polygon points="12,139 7.5,134.5 11.9,131.3 16.5,134.6 14.7,139.8"/>
          <polygon points="7.8,122.6 12,119.4 16.7,122.7 15,128 9.5,128"/>
        </g>
        <path d="M24 122.5 V119.6 M29.2 126.3 L31.3 122.7 M27.2 132.4 L28.7 134.6 M20.8 132.4 L16.5 134.6 M18.8 126.3 L16.7 122.7" stroke="#1B1C18" stroke-width="1.2"/>
      </g>
      <!-- พื้น -->
      <path d="M0 147 H220" stroke="#C9A03A" stroke-width="2" opacity=".6"/>
    </svg>
  </div>
</header>

<div class="wrap">
  <nav class="tabs" aria-label="เมนู"><div class="row" role="tablist" id="tabs"></div></nav>
  <main id="view"><div class="panel empty">กำลังโหลดข้อมูล…</div></main>
</div>
<div id="ov" hidden></div>
<div class="toast" id="toast" hidden></div>
<noscript><p style="padding:16px">ต้องเปิด JavaScript เพื่อใช้งานระบบกีฬาสี</p></noscript>
<script src="<?= h(asset_v('assets/app.js')) ?>"></script>
<script src="<?= h(asset_v('assets/games.js')) ?>"></script>
<script src="<?= h(asset_v('assets/judge.js')) ?>"></script>
<script src="<?= h(asset_v('assets/report.js')) ?>"></script>
<script src="<?= h(asset_v('assets/order.js')) ?>"></script>
<script src="<?= h(asset_v('assets/judges.js')) ?>"></script>
</body>
</html>
