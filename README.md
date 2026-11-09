# Crow Companion (Tallow)

Crow Companion is a desktop pet for Windows. **Tallow**, a crow (he/him), lives on your screen. He
hops, perches, peers, fluffs up and caws, and everything he says and does comes from his own small
local language model: [digi-the-robot/Tallow](https://huggingface.co/digi-the-robot/Tallow), served
by llama.cpp's `llama-server` on `127.0.0.1`. Nothing he says is scripted.

This is a fork of [Capri Desktop](docs/CAPRI_DESKTOP_UPSTREAM_README.md) (branch `feat/crow-companion`).
The app keeps the same features: desktop pet, chat window, animations, tray, onboarding, voice
input, Dev Deck and the portable build. Only the companion is different.

## How Tallow talks

- **He speaks crow.** A typical reply is `[caution min] *lands on the fence* *watches the peanut with
  one eye* kaw.`
  - The mood tag picks his animation.
  - The `*emotes*` show in italics in his bubble and in the chat, without the asterisks.
  - Caws play as sound effects.
- **No text-to-speech for emotes.** Mood tags, `*emotes*` and caws are never read out. If a reply has
  plain words outside the emotes, only those words are spoken.
- **Every line comes from the model.** There are no preset greetings, quips, fallbacks or
  "done, friend!" lines.
  - When you pet him (Shift + right-click), grab him, or carry him to a new spot, the app sends
    that *action* to his model ("*strokes the top of his head*"), and his reply is his own.
  - When his server first starts with no past conversation, the app sends "*sits down nearby, not
    too close*", the same as the proof of concept. If there is a past conversation, his last line is
    shown again without being spoken.
  - Now and then he glances at the app you are in and gets a crow-world description, such as
    "*the human stares into a bright window*". The proof of concept does the same. Password
    managers and similar windows are ignored.
  - If the model is still downloading or fails, an app status appears instead, marked ⚙ (for
    example "⚙ Tallow's model is not ready yet (downloading 40%)"). He never makes up a crow line.
  - Commands such as opening an app or playing music still run. Their result shows as a tool
    event, and Tallow's own model reacts to what you said.
- **Mute** (the speaker button) silences every sound in every window: voice, caws, wing flaps, alarm
  caws, the dialogue blip, voice tests and anything else that plays audio.

## First open

1. Tallow downloads `config.json`, `model.safetensors` and `tallow_tok.model` from Hugging Face. The
   revision is pinned to `e4618ddc`, and the files go into `CrowCompanion-Data/tallow/` next to the
   exe.
2. If Hugging Face asks for a token, a password box for `HF_TOKEN` appears. The token is kept in
   memory only and never written to disk or logs.
3. The files are converted in-app to `tallow-f32.gguf` (SHA-256 `dde9a541…`). The result is
   byte-identical to the proof of concept's converter.
4. The bundled `llama-server.exe` starts with `-c 2048 -ngl 0 -ctk f32 -ctv f32 -fa off
   --no-warmup`. If the AVX2 build can't start, an SSE4.2 fallback build is used.

The weights are never in the zip.

## Prompting

Prompting follows the proof of concept exactly (`src/main/tallow/`):
- SentencePiece token ids are sent to `/completion`, using `to_sp`/`from_sp`.
- The history is `you:`/`tallow:` turns joined with `<nl>`.
- Sampling is `temperature 0.8, top_k 50, samplers [top_k, temperature], n_predict 80, stop ["<nl>",
  "<nl> "]`.
- An empty completion is sampled again up to twice. If it is still empty, Tallow stays quiet.

## Moods, animations and voice

- **Moods to animations:** idle, hop → happy, lean, droop, peer → curious, love, fluff and alarm, with
  the proof of concept's caw sounds.
- **Voice:** if his reply has plain words, they are spoken with a male voice by default (Edge-TTS
  `en-US-GuyNeural`, with matching voices in the other languages). No voice effect is applied by
  default. You can change the voice in the voice settings.
- **Languages:** the interface is in English, Spanish, Portuguese, French, German, Italian, Russian,
  Chinese, Japanese and Korean.

## Other brains

Advanced users can pick Ollama or any OpenAI-compatible cloud provider in Settings > Brain, for the
tool and coding features. Tallow himself only speaks crow.

## Build (Linux host, no CI)

```bash
npm ci
npm run llama:win          # cross-compiles llama-server at llama.cpp 12e9084d with mingw-w64
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:win:portable   # needs Wine
# then zip release/win-unpacked (plus NOTICE.md and README-FIRST.txt)
```

Releases are built locally and published by hand as GitHub prereleases tagged `v*-crow`. There is
no CI.

## Credits

Credits and licenses are in [NOTICE.md](NOTICE.md). The original Capri Desktop documentation is in
[docs/CAPRI_DESKTOP_UPSTREAM_README.md](docs/CAPRI_DESKTOP_UPSTREAM_README.md).
