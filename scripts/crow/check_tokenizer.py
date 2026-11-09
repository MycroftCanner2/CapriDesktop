#!/usr/bin/env python3
"""Fuzz the app's TypeScript tokenizer + text tricks against sentencepiece and tallow.py.

usage: check_tokenizer.py <hf_dir> <node_cli.js>
"""
import importlib.util, json, random, subprocess, sys
from pathlib import Path

hf = Path(sys.argv[1]); cli = sys.argv[2]
spec = importlib.util.spec_from_file_location("tallow_ref", hf / "tallow.py")
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
import sentencepiece as spm
sp = spm.SentencePieceProcessor(model_file=str(hf / "tallow_tok.model"))

rng = random.Random(7)
base = [l for l in (hf / "README.md").read_text(encoding="utf-8").splitlines()]
base += ["*tosses a peanut onto the grass*", "*grabs at him*", "kaw", "KAW KAW KAW", "krrr-tk-tk-tk", "mmrrr...",
         "[caution min] *lands on the fence* *watches the peanut with one eye* kaw.", "  leading spaces", "trailing  ",
         "tab\there", "line one\nline two", "<nl>", "a<nl>b", "emoji 🐦‍⬛ crow 🥜", "ünïcödé çrøw", "日本語のカラス", "123456 7890",
         "*[*[nested]*]*", "**", "*", "[", "", " ", "you: hi", "tallow:", "\u00a0nbsp", "\x1cfs", "*\x1c*"]
alphabet = list("abcdefghijklmnopqrstuvwxyz ABCKW*[]<>.,!?'\"-:\n\t0123456789") + ["🥜", "é", "ß", "\u2581", "<nl>"]
for _ in range(1500):
    n = rng.randint(1, 60)
    base.append("".join(rng.choice(alphabet) for _ in range(n)))
cases = []
for t in base:
    hist = [{"role": "user", "text": t}, {"role": "tallow", "text": "[joy min] *hops* kaw."}, {"role": "user", "text": t[::-1]}]
    cases.append({"text": t, "history": hist})
# a long history to exercise trimming
long_hist = []
for i in range(120):
    long_hist.append({"role": "user", "text": f"*tosses peanut number {i}*"})
    long_hist.append({"role": "tallow", "text": "[caution min] *lands on the fence* *eyes the peanut* kaw."})
cases.append({"text": "long", "history": long_hist})

inp = "\n".join(json.dumps(c) for c in cases) + "\n"
res = subprocess.run(["node", cli, str(hf / "tallow_tok.model")], input=inp, capture_output=True, text=True, check=True)
outs = [json.loads(l) for l in res.stdout.splitlines()]
assert len(outs) == len(cases), (len(outs), len(cases))
bad = 0
for c, o in zip(cases, outs):
    t = c["text"]
    exp = {
        "ids": sp.encode(t),
        "tosp": mod.to_sp(t),
        "fromsp": mod.from_sp(mod.to_sp(t)),
        "decode": sp.decode(sp.encode(t)),
        "render": mod.render(sp, c["history"]),
    }
    hist = list(c["history"])
    while len(hist) > 1 and len(mod.render(sp, hist)) > 1900:
        hist = hist[2:]
    ids = mod.render(sp, hist) + sp.encode(mod.to_sp("tallow:"))
    exp["prompt"] = ids[-2048:]
    for k, v in exp.items():
        if o.get(k) != v:
            bad += 1
            if bad <= 10:
                print("MISMATCH", k, repr(t)[:80], "\n  py", repr(v)[:200], "\n  ts", repr(o.get(k))[:200])
            break
print(f"{len(cases)} cases, {bad} mismatches")
sys.exit(1 if bad else 0)
