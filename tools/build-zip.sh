#!/bin/sh
# สร้าง kilasi.zip สำหรับอัปโหลดขึ้นโฮสต์ (File Manager → Upload & Extract ใน /htdocs)
#   ใช้: sh tools/build-zip.sh /path/to/composer.phar
# ไม่รวม storage/ (ฐานข้อมูลบนโฮสต์) config.php README LICENSE .git และฟอนต์ mPDF ที่ไม่ได้ใช้
set -e
cd "$(dirname "$0")/.."
COMPOSER=${1:-composer}
if [ -f "$COMPOSER" ]; then php "$COMPOSER" install --no-dev --no-interaction --no-progress --optimize-autoloader; else $COMPOSER install --no-dev --no-interaction --no-progress --optimize-autoloader; fi
# mPDF มาพร้อมฟอนต์ ~87MB เก็บไว้แค่ DejaVu Sans Condensed (สำรองสัญลักษณ์) ใช้ Sarabun/Chonburi จาก fonts/
find vendor/mpdf/mpdf/ttfonts -type f ! -name 'DejaVuSansCondensed*' -delete
printf 'Require all denied\n' > vendor/.htaccess
cd ..
rm -f ../kilasi.zip
zip -qr -X ../kilasi.zip kilasi -x "*.DS_Store" "kilasi/.git/*" "kilasi/.gitignore" "kilasi/storage/*" "kilasi/storage/" \
  "kilasi/config.php" "kilasi/README.md" "kilasi/LICENSE" "kilasi/tools/*" "kilasi/composer.json" "kilasi/composer.lock"
ls -la ../kilasi.zip
