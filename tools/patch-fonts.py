# -*- coding: utf-8 -*-
"""เพิ่มอักขระ U+200B (zero-width space) แบบว่างและกว้าง 0 ให้ฟอนต์ใน fonts/

mPDF แทรก U+200B เป็นจุดตัดคำภาษาไทย (เช่นหลังจุดใน พ.ศ. ป.4 ด.ช.) ถ้าฟอนต์ไม่มีอักขระนี้
PDF จะแสดงเป็นกล่องสี่เหลี่ยม · Sarabun และ Chonburi (OFL ไม่มี Reserved Font Name) ไม่มี U+200B
ใช้: python3 tools/patch-fonts.py   (ต้องมี fonttools: pip install fonttools)
"""
import glob
import os
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph

ZWSP = 0x200B
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fonts')
for path in sorted(glob.glob(os.path.join(here, '*.ttf'))):
    f = TTFont(path)
    cmap = f.getBestCmap()
    if ZWSP in cmap:
        print('มีแล้ว', os.path.basename(path))
        continue
    name = 'uni200B'
    order = f.getGlyphOrder()
    if name not in order:
        f.setGlyphOrder(order + [name])
        f['glyf'].glyphs[name] = Glyph()          # ไม่มีเส้น
        f['hmtx'].metrics[name] = (0, 0)          # กว้าง 0
        f['maxp'].numGlyphs = len(f.getGlyphOrder())
    for t in f['cmap'].tables:
        if t.isUnicode():
            t.cmap[ZWSP] = name
    if 'DSIG' in f:                               # ลายเซ็นเดิมใช้ไม่ได้หลังแก้ไฟล์
        del f['DSIG']
    f.save(path)
    print('เพิ่ม U+200B', os.path.basename(path))
