# Crow Companion: notices and attributions

Crow Companion is a fork of **Capri Desktop** (MIT, Copyright (c) 2026 nunezValen, see LICENSE)
rethemed as a crow by MycroftCanner2. The Capri character art, videos and her Edgerunners look are
not part of Crow Companion; everything Tallow looks like comes from the open sources below.

## Tallow, the crow model (Apache-2.0)
- Model, weights and SentencePiece tokenizer: https://huggingface.co/digi-the-robot/Tallow
  (license: apache-2.0), revision `e4618ddcc674e78e444b1bee97102039a9b8bea6`.
- The weights are **not** bundled. On first open the app downloads `config.json`,
  `model.safetensors` and `tallow_tok.model` from Hugging Face into `CrowCompanion-Data/tallow/` and
  converts them on the user's PC into a GGUF file for llama.cpp (a format conversion of the Apache-2.0
  weights, no retraining). The converted file is checked against SHA-256
  `dde9a54113f258013c37c09bba1acf0eee94f1bc75b4b1c81166e19e615fe7bf`.
- The prompt format and the two text tricks (`to_sp` / `from_sp`, `<nl>`, `you:` / `tallow:`) in
  `src/main/tallow/text.ts` follow `tallow.py` from that repository and the Crow Companion proof of
  concept (https://github.com/MycroftCanner2/CrowCompanion, Apache-2.0, Copyright 2026 MycroftCanner2).
- The portrait on the Hugging Face page is not bundled.

## llama.cpp (MIT)
- `resources/llama/llama-server.exe` (AVX2) and `llama-server-compat.exe` (SSE4.2) are built from
  https://github.com/ggml-org/llama.cpp at commit `12e9084dc1c88fe73bdd2886723b4b8b7d790be8` with
  `scripts/crow/build-llama-server-win.sh`. Its license ships next to them as `LICENSE-llama.cpp.txt`.

## Crow art (CC0 1.0)
- The 3D crow is "Crow" from the Pixor library, https://pixor.art/library/creatures/crow/ (CC0 1.0,
  public domain). Made with Pixor. Thank you!
- Every pose, the icon and the wooden frame were rendered/drawn from it with Blender and the scripts in
  `tools/crow-art/` (render_crow.py, post.py, render_icon.py). The rendered frames are also CC0.

## Sounds (Apache-2.0)
- `kaw`, `mumble`, `flap`, `rattle` and `alarm` (`src/renderer/src/assets/sounds/*.wav`) are generated
  by `scripts/generate_assets.py` in the Crow Companion proof of concept (Apache-2.0).

## Everything else
- Capri Desktop's code and its remaining sounds and fonts keep their original licenses (MIT for the
  code, see LICENSE).
