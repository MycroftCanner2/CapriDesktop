"""Crop every state to one shared box, add a soft light outline and small cue glyphs, write frames."""
import os, sys, math
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageChops
SRC = 'frames'; OUT = sys.argv[1]
SIZE = 320
states = sorted(os.listdir(SRC))
def frames(st):
    fs = sorted([f for f in os.listdir(os.path.join(SRC, st)) if f.startswith('raw_')], key=lambda f: int(f[4:-4]))
    return [Image.open(os.path.join(SRC, st, f)).convert('RGBA') for f in fs]
# shared box over every full-body state (ojos is a close-up and keeps its own framing)
box = None
for st in states:
    if st == 'ojos': continue
    for im in frames(st):
        bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bb: box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
pad = 14
w = box[2] - box[0]; h = box[3] - box[1]; side = max(w, h) + 2 * pad
cx = (box[0] + box[2]) / 2; bottom = box[3] + pad
crop = (int(cx - side / 2), int(bottom - side), int(cx + side / 2), int(bottom))
print('crop', crop)
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40)
except OSError:
    FONT = ImageFont.load_default()

def outline(im):
    a = im.getchannel('A')
    grown = a.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.6))
    halo = Image.new('RGBA', im.size, (236, 228, 210, 0)); halo.putalpha(grown.point(lambda v: int(v * 0.85)))
    out = Image.alpha_composite(halo, im)
    return out

def heart(d, x, y, s, col):
    d.polygon([(x, y + s * 0.3), (x + s * 0.5, y + s), (x + s, y + s * 0.3)], fill=col)
    d.ellipse([x, y, x + s * 0.52, y + s * 0.52], fill=col); d.ellipse([x + s * 0.48, y, x + s, y + s * 0.52], fill=col)

def cue(st, im, i, n):
    d = ImageDraw.Draw(im)
    t = i / max(1, n)
    if st == 'love':
        for k, (x0, y0) in enumerate([(205, 70), (240, 40), (180, 30)]):
            yy = y0 - 18 * ((t + k * 0.33) % 1)
            a = int(255 * (1 - ((t + k * 0.33) % 1)))
            heart(d, x0, yy, 26 - 4 * k, (226, 70, 96, a))
    elif st == 'sleep':
        for k in range(3):
            p = (t + k / 3) % 1
            f = ImageFont.truetype(FONT.path, 22 + 8 * k) if hasattr(FONT, 'path') else FONT
            d.text((200 + 22 * k + 6 * p, 90 - 30 * k - 20 * p), 'z', font=f, fill=(196, 210, 255, int(255 * (1 - p))), stroke_width=2, stroke_fill=(30, 30, 50, int(200 * (1 - p))))
    elif st == 'curious':
        d.text((215, 30 + 4 * math.sin(t * math.tau)), '?', font=FONT, fill=(255, 214, 120, 255), stroke_width=3, stroke_fill=(40, 30, 20, 255))
    elif st in ('alarm', 'asustada'):
        d.text((222, 22 + 3 * math.sin(t * math.tau * 2)), '!', font=FONT, fill=(255, 92, 70, 255), stroke_width=3, stroke_fill=(40, 20, 20, 255))
        d.text((250, 34 - 3 * math.sin(t * math.tau * 2)), '!', font=FONT, fill=(255, 92, 70, 255), stroke_width=3, stroke_fill=(40, 20, 20, 255))
    elif st in ('fluff', 'closed'):
        for k in range(3):
            ang = -0.9 + 0.5 * k
            r0, r1 = 120, 140 + 6 * math.sin(t * math.tau * 2)
            c = (240, 170, 60, 230)
            d.line([(160 + r0 * math.cos(ang) * 0.6 + 40, 120 + r0 * math.sin(ang) * 0.6), (160 + r1 * math.cos(ang) * 0.6 + 40, 120 + r1 * math.sin(ang) * 0.6)], fill=c, width=5)
    return im

for st in states:
    fs = frames(st)
    os.makedirs(os.path.join(OUT, st), exist_ok=True)
    for i, im in enumerate(fs):
        if st != 'ojos':
            im = im.crop(crop)
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        im = outline(im)
        im = cue(st, im, i, len(fs))
        name = f'{st}.png' if st == 'idle_front' else f'frame_{i}.png'
        im.save(os.path.join(OUT, st, name), optimize=True)
    print(st, len(fs))
