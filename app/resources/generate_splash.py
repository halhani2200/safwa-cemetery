"""Generate splash screen images for Capacitor app.

Outputs:
- splash.png (2732x2732) — source used by Capacitor assets tool
- icon.png (1024x1024) — source app icon used by Capacitor assets tool

Run from app/ directory:
  python resources/generate_splash.py
  npx @capacitor/assets generate
"""
from PIL import Image, ImageDraw, ImageFont
import os
import arabic_reshaper
from bidi.algorithm import get_display


def ar(text):
    """Reshape + bidi-reorder Arabic so PIL renders it connected and right-to-left."""
    return get_display(arabic_reshaper.reshape(text))

OUT = os.path.dirname(os.path.abspath(__file__))
PRIMARY = (14, 77, 63, 255)
GOLD = (212, 169, 58, 255)
CREAM = (250, 246, 238, 255)


def find_arabic_font():
    for c in [
        r'C:\Windows\Fonts\arial.ttf',
        r'C:\Windows\Fonts\tahoma.ttf',
        r'C:\Windows\Fonts\segoeui.ttf',
    ]:
        if os.path.exists(c):
            return c
    return None


def draw_logo(draw, cx, cy, scale):
    # Outer gold ring
    ring_r = int(scale * 0.35)
    draw.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                 outline=GOLD, width=max(3, int(scale * 0.012)))

    # Crescent moon inside
    crescent_r = int(ring_r * 0.7)
    draw.ellipse([cx - crescent_r, cy - crescent_r, cx + crescent_r, cy + crescent_r],
                 fill=GOLD)
    cut_offset = int(crescent_r * 0.32)
    draw.ellipse([cx - crescent_r + cut_offset, cy - crescent_r,
                  cx + crescent_r + cut_offset, cy + crescent_r],
                 fill=PRIMARY)


def make_splash(size=2732):
    img = Image.new('RGBA', (size, size), PRIMARY)
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2

    # Subtle radial gradient overlay for depth
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for r in range(int(size * 0.6), 0, -50):
        alpha = int(20 * (1 - r / (size * 0.6)))
        odraw.ellipse([cx - r, cy - r, cx + r, cy + r],
                      fill=(255, 255, 255, alpha))
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)

    # Logo (slightly above center for text below)
    draw_logo(draw, cx, cy - int(size * 0.06), size)

    # App name
    font_path = find_arabic_font()
    if font_path:
        try:
            font_size = int(size * 0.06)
            font = ImageFont.truetype(font_path, font_size)
            text = ar('مقبرة صفوى')
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            draw.text((cx - tw // 2, cy + int(size * 0.18)), text,
                      font=font, fill=CREAM)

            sub_size = int(size * 0.025)
            sub_font = ImageFont.truetype(font_path, sub_size)
            sub_text = 'Safwa Cemetery'
            sbb = draw.textbbox((0, 0), sub_text, font=sub_font)
            sw = sbb[2] - sbb[0]
            draw.text((cx - sw // 2, cy + int(size * 0.26)), sub_text,
                      font=sub_font, fill=GOLD)
        except Exception as e:
            print(f'Font error: {e}')

    return img


def make_icon(size=1024):
    """Standalone app icon — OPAQUE square (no alpha / no rounded corners).
    App Store rejects icons with transparency; iOS & Android apply their own
    corner masking, so the source must be a flat opaque square."""
    img = Image.new('RGB', (size, size), PRIMARY[:3])
    draw = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2

    draw_logo(draw, cx, cy - int(size * 0.08), size)

    font_path = find_arabic_font()
    if font_path:
        try:
            font = ImageFont.truetype(font_path, int(size * 0.08))
            text = ar('مقبرة صفوى')
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            draw.text((cx - tw // 2, cy + int(size * 0.22)), text,
                      font=font, fill=CREAM)
        except Exception as e:
            print(f'Font error: {e}')

    return img


splash = make_splash(2732)
splash_path = os.path.join(OUT, 'splash.png')
splash.save(splash_path, 'PNG', optimize=True)
print(f'Wrote {splash_path} ({splash.size[0]}x{splash.size[1]})')

icon = make_icon(1024)
icon_path = os.path.join(OUT, 'icon.png')
icon.save(icon_path, 'PNG', optimize=True)
print(f'Wrote {icon_path} ({icon.size[0]}x{icon.size[1]})')

# Also a dark variant for splash (some Android themes need it)
print('Done!')
