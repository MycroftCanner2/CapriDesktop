#!/usr/bin/env python3
"""Map Capri's neon cyberpunk palette onto Crow Companion's dusk palette.

Neon cyan -> bone, neon pink/red -> amber or ember, neon yellow -> straw, neon green -> moss,
purple -> dusk violet, and the dark red-tinted panels -> warm charcoal. Run once over the renderer.
"""
import colorsys, re, sys
from pathlib import Path

def hsl(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l

def rgb(h, s, l):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, l, s)
    return round(r * 255), round(g * 255), round(b * 255)

def remap(r, g, b):
    h, s, l = hsl(r, g, b)
    if s < 0.18:
        return r, g, b                     # greys stay
    if l < 0.32:                           # dark tinted panels -> warm charcoal / brown
        return rgb(32, min(s, 0.55) * 0.42, l)
    if l > 0.93:
        return r, g, b
    if 165 <= h < 230:                     # cyan / sky -> bone
        return rgb(40, 0.42, max(0.72, min(0.86, l + 0.12)))
    if 230 <= h < 290:                     # blue-violet / purple -> dusk violet
        return rgb(248, 0.33, max(0.55, l))
    if 70 <= h < 165:                      # neon green -> moss
        return rgb(88, 0.34, max(0.5, min(0.66, l)))
    if 45 <= h < 70:                       # neon yellow -> straw
        return rgb(44, 0.7, max(0.55, min(0.68, l)))
    if 20 <= h < 45:                       # amber/orange stays warm
        return rgb(36, min(s, 0.72), l)
    # pink / magenta / red -> amber (accents) or ember (alerts)
    if (h >= 345 or h < 8) and l < 0.6:
        return rgb(14, 0.66, max(0.48, min(0.6, l)))
    return rgb(36, 0.66, max(0.5, min(0.64, l)))

HEX = re.compile(r'#([0-9a-fA-F]{6})\b')
RGBA = re.compile(r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[0-9.]+\s*)?\)')

def fix_hex(m):
    v = m.group(1)
    r, g, b = int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16)
    return '#%02x%02x%02x' % remap(r, g, b)

def fix_rgba(m):
    r, g, b = (int(m.group(i)) for i in (1, 2, 3))
    nr, ng, nb = remap(r, g, b)
    alpha = m.group(4)
    return f'rgba({nr}, {ng}, {nb}{alpha})' if alpha else f'rgb({nr}, {ng}, {nb})'

# Tailwind palettes the UI uses for accents, re-pointed at the crow palette
TAILWIND = {
    'cyan': '#e8dcc0', 'sky': '#e8dcc0', 'teal': '#c9d3a8', 'pink': '#d99a3f', 'fuchsia': '#d99a3f',
    'rose': '#d9653f', 'purple': '#8f86c9', 'violet': '#8f86c9', 'emerald': '#a5c27a', 'green': '#a5c27a',
}

def main():
    files = [Path(p) for p in sys.argv[1:]]
    for f in files:
        s = f.read_text(encoding='utf-8')
        n = HEX.sub(fix_hex, s)
        n = RGBA.sub(fix_rgba, n)
        if n != s:
            f.write_text(n, encoding='utf-8')
            print('rethemed', f)

if __name__ == '__main__':
    main()
