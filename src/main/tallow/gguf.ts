/**
 * Turns the official digi-the-robot/Tallow files (config.json, model.safetensors, tallow_tok.model)
 * into the f32 GGUF llama-server loads, on the user's machine, without Python.
 *
 * It writes exactly what the proof of concept's pipeline writes:
 *   scripts/prepare_hf.py (repack to the HF Llama layout) + llama.cpp's convert_hf_to_gguf.py
 *   --outtype f32 --model-name Tallow, at the llama.cpp commit in packaging/llama.cpp.pin.
 * That includes the converter's Q/K permute, which bridges Tallow's half-split RoPE and llama.cpp's
 * pair RoPE. The release build checks this output byte-for-byte against the Python pipeline and
 * runs the logit check (greedy replies from tallow.py == llama-server) on it.
 */

import { PieceType, parseSpmModel } from './spm'

export interface TallowConfig {
  vocab: number
  ctx: number
  d: number
  layers: number
  heads: number
  hidden: number
}

interface StTensor {
  dtype: string
  shape: number[]
  data: Uint8Array
}

const ALIGN = 32

export function readSafetensors(buf: Uint8Array): Map<string, StTensor> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const headerLen = Number(view.getBigUint64(0, true))
  if (headerLen <= 0 || headerLen > buf.length - 8) throw new Error('model.safetensors: bad header')
  const header = JSON.parse(new TextDecoder().decode(buf.subarray(8, 8 + headerLen))) as Record<
    string,
    { dtype: string; shape: number[]; data_offsets: [number, number] }
  >
  const base = 8 + headerLen
  const out = new Map<string, StTensor>()
  for (const [name, info] of Object.entries(header)) {
    if (name === '__metadata__') continue
    const [a, b] = info.data_offsets
    out.set(name, { dtype: info.dtype, shape: info.shape, data: buf.subarray(base + a, base + b) })
  }
  return out
}

/** gguf.utility.model_weight_count_rounded_notation(n, min_digits=2) */
function sizeLabel(n: number): string {
  let scaled: number
  let suffix: string
  if (n > 1e12) [scaled, suffix] = [n * 1e-12, 'T']
  else if (n > 1e9) [scaled, suffix] = [n * 1e-9, 'B']
  else if (n > 1e6) [scaled, suffix] = [n * 1e-6, 'M']
  else [scaled, suffix] = [n * 1e-3, 'K']
  const digits = String(Math.round(scaled)).replace(/^0+/, '').length
  const fix = Math.max(2 - digits, 0)
  return `${scaled.toFixed(fix)}${suffix}`
}

/** convert_hf_to_gguf LlamaModel.permute: half-split rows -> interleaved pairs, per head */
function permuteRows(src: Uint8Array, rows: number, cols: number, heads: number): Uint8Array {
  const out = new Uint8Array(src.length)
  const rowBytes = cols * 4
  const hd = rows / heads
  const half = hd / 2
  for (let h = 0; h < heads; h++) {
    for (let s = 0; s < 2; s++) {
      for (let j = 0; j < half; j++) {
        const from = h * hd + s * half + j
        const to = h * hd + 2 * j + s
        out.set(src.subarray(from * rowBytes, (from + 1) * rowBytes), to * rowBytes)
      }
    }
  }
  return out
}

class Writer {
  private chunks: Uint8Array[] = []
  length = 0
  private push(b: Uint8Array): void {
    this.chunks.push(b)
    this.length += b.length
  }
  u32(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setUint32(0, v, true)
    this.push(b)
  }
  i32(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setInt32(0, v, true)
    this.push(b)
  }
  u64(v: number): void {
    const b = new Uint8Array(8)
    new DataView(b.buffer).setBigUint64(0, BigInt(v), true)
    this.push(b)
  }
  f32(v: number): void {
    const b = new Uint8Array(4)
    new DataView(b.buffer).setFloat32(0, v, true)
    this.push(b)
  }
  u8(v: number): void {
    this.push(new Uint8Array([v]))
  }
  str(s: string): void {
    const b = new TextEncoder().encode(s)
    this.u64(b.length)
    this.push(b)
  }
  raw(b: Uint8Array): void {
    this.push(b)
  }
  pad(): void {
    const n = (ALIGN - (this.length % ALIGN)) % ALIGN
    if (n) this.push(new Uint8Array(n))
  }
  concat(): Uint8Array {
    const out = new Uint8Array(this.length)
    let o = 0
    for (const c of this.chunks) {
      out.set(c, o)
      o += c.length
    }
    return out
  }
}

const enum VT {
  UINT32 = 4,
  INT32 = 5,
  FLOAT32 = 6,
  BOOL = 7,
  STRING = 8,
  ARRAY = 9
}

type KV =
  | [string, VT.UINT32 | VT.FLOAT32 | VT.BOOL, number]
  | [string, VT.STRING, string]
  | [string, VT.ARRAY, VT.STRING, string[]]
  | [string, VT.ARRAY, VT.FLOAT32 | VT.INT32, number[]]

export function convertTallowToGguf(configJson: string, safetensors: Uint8Array, tokenizer: Uint8Array): Uint8Array {
  const cfg = JSON.parse(configJson) as TallowConfig
  for (const k of ['vocab', 'ctx', 'd', 'layers', 'heads', 'hidden'] as const) {
    if (!Number.isInteger(cfg[k]) || cfg[k] <= 0) throw new Error(`config.json: bad ${k}`)
  }
  const st = readSafetensors(safetensors)
  const get = (name: string, shape: number[]): Uint8Array => {
    const t = st.get(name)
    if (!t) throw new Error(`model.safetensors: missing ${name}`)
    if (t.dtype !== 'F32') throw new Error(`model.safetensors: ${name} is ${t.dtype}, expected F32`)
    if (t.shape.join('x') !== shape.join('x')) throw new Error(`model.safetensors: ${name} has shape ${t.shape}, expected ${shape}`)
    return t.data
  }
  const { d, heads, hidden, layers, vocab } = cfg
  const sp = parseSpmModel(tokenizer)
  if (sp.pieces.length !== vocab) throw new Error(`tokenizer has ${sp.pieces.length} pieces, config says ${vocab}`)

  // Tensors in the order convert_hf_to_gguf.py writes them (the HF layout's sorted names)
  const tensors: { name: string; ne: number[]; data: Uint8Array }[] = []
  tensors.push({ name: 'token_embd.weight', ne: [d, vocab], data: get('embed.weight', [vocab, d]) })
  for (let i = 0; i < layers; i++) {
    const p = `blocks.${i}`
    const qkv = get(`${p}.attn.qkv.weight`, [3 * d, d])
    const part = (k: number) => qkv.subarray(k * d * d * 4, (k + 1) * d * d * 4)
    const b = `blk.${i}`
    tensors.push({ name: `${b}.attn_norm.weight`, ne: [d], data: get(`${p}.norm1.weight`, [d]) })
    tensors.push({ name: `${b}.ffn_down.weight`, ne: [hidden, d], data: get(`${p}.mlp.down.weight`, [d, hidden]) })
    tensors.push({ name: `${b}.ffn_gate.weight`, ne: [d, hidden], data: get(`${p}.mlp.gate.weight`, [hidden, d]) })
    tensors.push({ name: `${b}.ffn_up.weight`, ne: [d, hidden], data: get(`${p}.mlp.up.weight`, [hidden, d]) })
    tensors.push({ name: `${b}.ffn_norm.weight`, ne: [d], data: get(`${p}.norm2.weight`, [d]) })
    tensors.push({ name: `${b}.attn_k.weight`, ne: [d, d], data: permuteRows(part(1), d, d, heads) })
    tensors.push({ name: `${b}.attn_output.weight`, ne: [d, d], data: get(`${p}.attn.out.weight`, [d, d]) })
    tensors.push({ name: `${b}.attn_q.weight`, ne: [d, d], data: permuteRows(part(0), d, d, heads) })
    tensors.push({ name: `${b}.attn_v.weight`, ne: [d, d], data: part(2) })
  }
  tensors.push({ name: 'output_norm.weight', ne: [d], data: get('norm.weight', [d]) })

  const params = tensors.reduce((n, t) => n + t.ne.reduce((a, b) => a * b, 1), 0)
  const tokenType = (t: PieceType): number =>
    t === PieceType.UNKNOWN ? 2 : t === PieceType.CONTROL ? 3 : t === PieceType.UNUSED ? 5 : t === PieceType.BYTE ? 6 : 1

  const kvs: KV[] = [
    ['general.architecture', VT.STRING, 'llama'],
    ['general.type', VT.STRING, 'model'],
    ['general.name', VT.STRING, 'Tallow'],
    ['general.size_label', VT.STRING, sizeLabel(params)],
    ['llama.block_count', VT.UINT32, layers],
    ['llama.context_length', VT.UINT32, cfg.ctx],
    ['llama.embedding_length', VT.UINT32, d],
    ['llama.feed_forward_length', VT.UINT32, hidden],
    ['llama.attention.head_count', VT.UINT32, heads],
    ['llama.attention.head_count_kv', VT.UINT32, heads],
    ['llama.rope.freq_base', VT.FLOAT32, 10000.0],
    ['llama.attention.layer_norm_rms_epsilon', VT.FLOAT32, 1e-5],
    ['llama.attention.key_length', VT.UINT32, d / heads],
    ['llama.attention.value_length', VT.UINT32, d / heads],
    ['general.file_type', VT.UINT32, 0],
    ['llama.vocab_size', VT.UINT32, vocab],
    ['llama.rope.dimension_count', VT.UINT32, d / heads],
    ['general.quantization_version', VT.UINT32, 2],
    ['tokenizer.ggml.model', VT.STRING, 'llama'],
    ['tokenizer.ggml.pre', VT.STRING, 'default'],
    ['tokenizer.ggml.tokens', VT.ARRAY, VT.STRING, sp.pieces.map((p) => p.piece)],
    ['tokenizer.ggml.scores', VT.ARRAY, VT.FLOAT32, sp.pieces.map((p) => p.score)],
    ['tokenizer.ggml.token_type', VT.ARRAY, VT.INT32, sp.pieces.map((p) => tokenType(p.type))],
    ['tokenizer.ggml.bos_token_id', VT.UINT32, sp.bosId],
    ['tokenizer.ggml.eos_token_id', VT.UINT32, sp.eosId],
    ['tokenizer.ggml.unknown_token_id', VT.UINT32, sp.unkId],
    ['tokenizer.ggml.add_bos_token', VT.BOOL, 0],
    ['tokenizer.ggml.add_eos_token', VT.BOOL, 0]
  ]

  const w = new Writer()
  w.raw(new TextEncoder().encode('GGUF'))
  w.u32(3)
  w.u64(tensors.length)
  w.u64(kvs.length)
  for (const kv of kvs) {
    w.str(kv[0])
    w.u32(kv[1])
    if (kv[1] === VT.STRING) w.str(kv[2])
    else if (kv[1] === VT.UINT32) w.u32(kv[2])
    else if (kv[1] === VT.FLOAT32) w.f32(kv[2])
    else if (kv[1] === VT.BOOL) w.u8(kv[2] ? 1 : 0)
    else {
      const elem = kv[2] as VT
      const values = kv[3] as (string | number)[]
      w.u32(elem)
      w.u64(values.length)
      for (const v of values) {
        if (elem === VT.STRING) w.str(v as string)
        else if (elem === VT.FLOAT32) w.f32(v as number)
        else w.i32(v as number)
      }
    }
  }
  let offset = 0
  for (const t of tensors) {
    w.str(t.name)
    w.u32(t.ne.length)
    for (const n of t.ne) w.u64(n)
    w.u32(0) // GGML_TYPE_F32
    w.u64(offset)
    offset += t.data.length
    offset += (ALIGN - (offset % ALIGN)) % ALIGN
  }
  w.pad()
  for (const t of tensors) {
    // Copy: a subarray of the safetensors buffer may not be 4-byte aligned for later readers
    w.raw(new Uint8Array(t.data))
    w.pad()
  }
  return w.concat()
}
