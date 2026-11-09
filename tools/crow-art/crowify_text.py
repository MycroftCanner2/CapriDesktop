"""Crow Companion: rename Capri to Tallow and drop the Edgerunners slang in user-facing text.

The same substitution runs over the code and src/shared/lines/*.json, so the line catalog (keyed by
the English text) still matches. Game adapters keep their game vocabulary; only the name changes.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
NICK = {'de': 'Kumpel', 'fr': 'mon pote', 'it': 'amico', 'pt': 'parceiro', 'es': 'amigo', 'zh': '朋友'}
COMMON = [
    (r'Capri Desktop', 'Crow Companion'),
    (r'CAPRI DESKTOP', 'CROW COMPANION'),
    (r'\bCAPRICORN\b', 'TALLOW'),
    (r'\bCapri\b', 'Tallow'),
    (r'\bCAPRI\b', 'TALLOW'),
    (r'Glitch in the Net', 'Ruffled feathers'),
]
FLAVOR = [
    (r'Target terminated, choomba! Cyberspace dusted!', 'Kaw! Gone. Carried it off, nothing left but a feather.'),
    (r'Jacking out of cyberspace\.\.\. Catch you on the other side, \{name\}!', 'Tucking my beak under my wing... see you at dawn, {name}!'),
]

def nick(lang: str):
    word = NICK.get(lang)
    if lang == 'en' or not word:
        return [(r'\bChoomba\b', 'Friend'), (r'\bchoomba\b', 'friend'), (r'\bchoombas\b', 'friends')]
    return [(r'\b[Cc]hoomba\b', word)]

def main() -> None:
    changed = 0
    files = [p for p in (ROOT / 'src').rglob('*') if p.suffix in {'.ts', '.tsx', '.json'} and 'tallow' not in p.parts]
    for p in files:
        text = p.read_text(encoding='utf-8')
        lang = p.stem if p.parent.name in ('lines', 'i18n') else 'en'
        rules = FLAVOR + COMMON + nick(lang)
        new = text
        for pat, rep in rules:
            new = re.sub(pat, rep, new)
        if new != text:
            p.write_text(new, encoding='utf-8')
            changed += 1
            print(p.relative_to(ROOT))
    print(f'{changed} files', file=sys.stderr)

if __name__ == '__main__':
    main()
