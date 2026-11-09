/**
 * Tallow, the local crow brain.
 *
 * On first open it clones the official digi-the-robot/Tallow files from Hugging Face into the data
 * folder (next to the portable exe), turns them into a GGUF on this machine (gguf.ts, checked
 * byte-for-byte against the proof of concept's Python pipeline), starts the bundled llama.cpp
 * llama-server on 127.0.0.1 and talks to it in Tallow's own token ids (text.ts + spm.ts), exactly
 * like tallow.py and the Crow Companion proof of concept.
 *
 * An HF token is only needed if the model is ever gated. It is kept in memory for the download and
 * never written to disk or to a log.
 */

import { app } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as net from 'net'
import * as os from 'os'
import * as path from 'path'
import { SentencePieceBpe } from './spm'
import { convertTallowToGguf } from './gguf'
import { fromSp, promptIds, selfCheck, type TallowTurn } from './text'

export const TALLOW_REPO = 'digi-the-robot/Tallow'
/** The Hugging Face commit this release was verified against (main on 2026-11-07, model v2) */
export const TALLOW_REVISION = 'e4618ddcc674e78e444b1bee97102039a9b8bea6'
/** sha256 of the files at TALLOW_REVISION, and of the GGUF the verified pipeline makes from them */
const PINNED_SHA256: Record<string, string> = {
  'config.json': 'f34df65bf549e0a2da07871a6173e3df92fd4ad109b98941e7cf8675181bf60e',
  'model.safetensors': '857bcc71dd620f971364cfb47ad9e92d03cbf68084b45b9b724520a1c6de5dc8',
  'tallow_tok.model': '8743bed3f6b676fb9fc8d8a3e5eeeaaf879ffcbb7a2154fd9716b68d344ef164',
  'tallow.py': 'd503c2d9406b0f71ae8188a24ce0bdf42bf9ab27d44688247d7fae54be816d90'
}
export const VERIFIED_GGUF_SHA256 = 'dde9a54113f258013c37c09bba1acf0eee94f1bc75b4b1c81166e19e615fe7bf'

/** The files the proof of concept downloads. The model itself needs the first three */
const HF_FILES = ['config.json', 'model.safetensors', 'tallow_tok.model', 'tallow.py', 'README.md', 'tallow.png']
const REQUIRED = new Set(['config.json', 'model.safetensors', 'tallow_tok.model'])

const CTX = 2048
const MAX_NEW = 80

export type TallowPhase = 'idle' | 'downloading' | 'converting' | 'starting' | 'ready' | 'needs-token' | 'error' | 'stopped'

export interface TallowStatus {
  phase: TallowPhase
  /** 0..1 over the whole download */
  progress: number
  file?: string
  receivedBytes?: number
  totalBytes?: number
  message?: string
  error?: string
  revision: string
  modelDir: string
  verified?: boolean
  port?: number
}

class NeedsTokenError extends Error {
  constructor(public status: number) {
    super(`Hugging Face answered HTTP ${status}`)
  }
}

const sha256File = (file: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject)
  })

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })

/** Never let a token reach a log line */
function redact(text: string, token?: string | null): string {
  let out = text.replace(/hf_[A-Za-z0-9]{8,}/g, 'hf_***')
  if (token) out = out.split(token).join('***')
  return out
}

class TallowService extends EventEmitter {
  private status: TallowStatus = { phase: 'idle', progress: 0, revision: this.revision(), modelDir: '' }
  private proc: ChildProcess | null = null
  private port = 0
  private sp: SentencePieceBpe | null = null
  private history: TallowTurn[] = []
  private token: string | null = null
  private starting: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private stopping = false

  revision(): string {
    return (process.env.TALLOW_REVISION || TALLOW_REVISION).trim()
  }

  private pinned(): boolean {
    return this.revision() === TALLOW_REVISION
  }

  /** Everything Tallow keeps lives in the app's data folder (next to the exe in the portable build) */
  dataDir(): string {
    const dir = path.join(app.getPath('userData'), 'tallow')
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  modelDir(): string {
    const dir = path.join(this.dataDir(), 'hf', this.revision().replace(/[^A-Za-z0-9._-]/g, '_'))
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  private ggufPath(): string {
    return path.join(this.modelDir(), 'tallow-f32.gguf')
  }

  private logPath(): string {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    return path.join(dir, 'llama-server.log')
  }

  private historyPath(): string {
    return path.join(this.dataDir(), 'history.json')
  }

  getStatus(): TallowStatus {
    return { ...this.status, modelDir: this.status.modelDir || this.safeModelDir() }
  }

  private safeModelDir(): string {
    try {
      return this.modelDir()
    } catch {
      return ''
    }
  }

  isReady(): boolean {
    return this.status.phase === 'ready' && !!this.proc && this.proc.exitCode === null
  }

  private set(update: Partial<TallowStatus>): void {
    this.status = { ...this.status, ...update, revision: this.revision() }
    this.emit('status', this.getStatus())
  }

  private log(line: string): void {
    const clean = redact(line, this.token)
    console.log(`[Tallow] ${clean}`)
    try {
      const dir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(dir, { recursive: true })
      fs.appendFileSync(path.join(dir, 'tallow.log'), `[${new Date().toISOString()}] ${clean}\n`)
    } catch {
      // logging is best effort
    }
  }

  /** The user typed an HF token in the app: keep it in memory only and try again */
  async provideToken(token: string): Promise<TallowStatus> {
    const t = (token || '').trim()
    this.token = t || null
    await this.ensureStarted(true)
    return this.getStatus()
  }

  /** Download (first open), convert, start llama-server. Safe to call many times */
  ensureStarted(force = false): Promise<void> {
    if (this.isReady()) return Promise.resolve()
    if (this.starting && !force) return this.starting
    this.stopping = false
    this.starting = this.start().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async start(): Promise<void> {
    try {
      selfCheck()
      await this.ensureModel()
      await this.startServer()
      this.loadHistory()
      this.set({ phase: 'ready', message: 'Tallow is on the fence.', error: undefined, port: this.port })
    } catch (err) {
      if (err instanceof NeedsTokenError) {
        this.set({ phase: 'needs-token', error: `Hugging Face needs a token for ${TALLOW_REPO} (HTTP ${err.status}).` })
        return
      }
      const msg = redact(String((err as Error)?.message || err), this.token)
      this.log(`start failed: ${msg}`)
      this.set({ phase: 'error', error: msg })
    }
  }

  // ---------------------------------------------------------------- model files

  private async ensureModel(): Promise<void> {
    const dir = this.modelDir()
    this.set({ modelDir: dir })
    const gguf = this.ggufPath()
    const tok = path.join(dir, 'tallow_tok.model')
    if (fs.existsSync(gguf) && fs.existsSync(tok)) {
      if (!this.pinned() || (await sha256File(gguf)) === VERIFIED_GGUF_SHA256) {
        this.set({ verified: this.pinned() })
        return
      }
      this.log('cached GGUF does not match the verified build; rebuilding it')
      fs.rmSync(gguf, { force: true })
    }
    await this.download(dir)
    this.set({ phase: 'converting', message: 'Teaching llama.cpp to read Tallow…', progress: 1 })
    const bytes = convertTallowToGguf(
      fs.readFileSync(path.join(dir, 'config.json'), 'utf-8'),
      new Uint8Array(fs.readFileSync(path.join(dir, 'model.safetensors'))),
      new Uint8Array(fs.readFileSync(tok))
    )
    const digest = crypto.createHash('sha256').update(bytes).digest('hex')
    if (this.pinned() && digest !== VERIFIED_GGUF_SHA256) {
      throw new Error(`the GGUF made on this PC (${digest.slice(0, 12)}…) does not match the verified build. Refusing to load a wrong crow.`)
    }
    fs.writeFileSync(gguf + '.part', bytes)
    fs.renameSync(gguf + '.part', gguf)
    this.set({ verified: this.pinned() })
    this.log(`GGUF ready (${bytes.length} bytes, sha256 ${digest})`)
  }

  private async download(dir: string): Promise<void> {
    const base = `https://huggingface.co/${TALLOW_REPO}/resolve/${encodeURIComponent(this.revision())}`
    const sizes = new Map<string, number>()
    // Sizes first, for one progress bar over every file
    for (const name of HF_FILES) {
      try {
        const res = await fetch(`${base}/${name}`, { method: 'HEAD', headers: this.authHeaders(), redirect: 'follow', signal: AbortSignal.timeout(20000) })
        if (res.status === 401 || res.status === 403) throw new NeedsTokenError(res.status)
        const len = Number(res.headers.get('x-linked-size') || res.headers.get('content-length') || 0)
        if (len) sizes.set(name, len)
      } catch (err) {
        if (err instanceof NeedsTokenError) throw err
      }
    }
    const total = [...sizes.values()].reduce((a, b) => a + b, 0) || 66_000_000
    let done = 0
    for (const name of HF_FILES) {
      const out = path.join(dir, name)
      const want = this.pinned() ? PINNED_SHA256[name] : undefined
      if (fs.existsSync(out) && fs.statSync(out).size > 0 && (!want || (await sha256File(out)) === want)) {
        done += fs.statSync(out).size
        continue
      }
      this.set({ phase: 'downloading', file: name, message: `Cloning ${TALLOW_REPO} from Hugging Face…`, progress: done / total, error: undefined })
      try {
        await this.fetchFile(`${base}/${name}`, out, (n) => {
          this.set({ receivedBytes: done + n, totalBytes: total, progress: Math.min(1, (done + n) / total) })
        })
      } catch (err) {
        if (err instanceof NeedsTokenError) throw err
        if (!REQUIRED.has(name)) {
          this.log(`optional file ${name} skipped: ${(err as Error).message}`)
          continue
        }
        throw err
      }
      if (want) {
        const got = await sha256File(out)
        if (got !== want) {
          fs.rmSync(out, { force: true })
          throw new Error(`${name} from Hugging Face does not match the verified revision (sha256 ${got.slice(0, 12)}…)`)
        }
      }
      done += fs.statSync(out).size
    }
    this.set({ progress: 1, receivedBytes: total, totalBytes: total })
  }

  private authHeaders(): Record<string, string> {
    const token = this.token || (process.env.HF_TOKEN || '').trim()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  private async fetchFile(url: string, out: string, onProgress: (n: number) => void): Promise<void> {
    let lastErr: unknown
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { headers: this.authHeaders(), redirect: 'follow', signal: AbortSignal.timeout(10 * 60 * 1000) })
        if (res.status === 401 || res.status === 403) throw new NeedsTokenError(res.status)
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${path.basename(out)}`)
        const part = out + '.part'
        const fh = fs.openSync(part, 'w')
        let n = 0
        try {
          const reader = res.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            fs.writeSync(fh, value)
            n += value.length
            onProgress(n)
          }
        } finally {
          fs.closeSync(fh)
        }
        fs.renameSync(part, out)
        return
      } catch (err) {
        if (err instanceof NeedsTokenError) throw err
        lastErr = err
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
    }
    throw new Error(`could not download ${path.basename(out)} from Hugging Face: ${redact(String((lastErr as Error)?.message || lastErr), this.token)}`)
  }

  // ---------------------------------------------------------------- llama-server

  /** The llama-server builds that ship with the app, best first */
  private serverCandidates(): string[] {
    const env = process.env.CROW_LLAMA_SERVER
    if (env) return [env]
    const exe = process.platform === 'win32' ? '.exe' : ''
    const root = app.isPackaged ? path.join(process.resourcesPath, 'llama') : path.join(app.getAppPath(), 'vendor', 'llama', `${process.platform}-x64`)
    return [path.join(root, `llama-server${exe}`), path.join(root, `llama-server-compat${exe}`)].filter((p) => fs.existsSync(p))
  }

  private async startServer(): Promise<void> {
    if (this.proc && this.proc.exitCode === null) return
    const dir = this.modelDir()
    this.sp = new SentencePieceBpe(new Uint8Array(fs.readFileSync(path.join(dir, 'tallow_tok.model'))))
    if (this.sp.pieceId('<nl>') < 0) throw new Error('tokenizer has no <nl> piece')
    const candidates = this.serverCandidates()
    if (!candidates.length) throw new Error('llama-server is missing from this build')
    let lastErr: unknown
    for (const bin of candidates) {
      try {
        await this.launch(bin)
        return
      } catch (err) {
        lastErr = err
        this.log(`${path.basename(bin)} failed: ${(err as Error).message}`)
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  private async launch(bin: string): Promise<void> {
    this.set({ phase: 'starting', message: 'Tallow is landing…', file: undefined })
    this.port = await freePort()
    const threads = Math.max(1, Math.min(4, os.cpus().length || 2))
    // The flags that keep him faithful: f32 KV cache and Flash Attention off (f16 makes him drift)
    const args = [
      '-m', this.ggufPath(),
      '--host', '127.0.0.1',
      '--port', String(this.port),
      '-c', String(CTX),
      '-t', String(threads),
      '-ngl', '0',
      '-ctk', 'f32',
      '-ctv', 'f32',
      '-fa', 'off',
      '--no-warmup',
      '--no-webui'
    ]
    const log = fs.openSync(this.logPath(), 'w')
    const proc = spawn(bin, args, { stdio: ['ignore', log, log], windowsHide: true, cwd: path.dirname(bin) })
    fs.closeSync(log)
    this.proc = proc
    proc.on('exit', (code) => {
      if (this.proc === proc) {
        this.proc = null
        if (!this.stopping && this.status.phase === 'ready') {
          this.log(`llama-server exited (${code}); will restart on the next message`)
          this.set({ phase: 'stopped', message: 'Tallow flew off. He will come back when you talk to him.' })
        }
      }
    })
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      if (proc.exitCode !== null) {
        // 0xC000001D: illegal instruction (a CPU without AVX2): the compat build is tried next
        throw new Error(`llama-server exited with code ${proc.exitCode}. ${this.logTail()}`)
      }
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`, { signal: AbortSignal.timeout(1000) })
        if (res.ok) {
          this.log(`llama-server ready on 127.0.0.1:${this.port} (${path.basename(bin)})`)
          return
        }
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    proc.kill()
    throw new Error(`llama-server did not become ready. ${this.logTail()}`)
  }

  private logTail(): string {
    try {
      return fs.readFileSync(this.logPath(), 'utf-8').split(/\r?\n/).filter(Boolean).slice(-8).join(' | ')
    } catch {
      return ''
    }
  }

  // ---------------------------------------------------------------- talking to him

  /** One line from Tallow. Calls are queued so a glance and a typed line never talk over each other */
  reply(userText: string): Promise<string> {
    const run = async (): Promise<string> => {
      await this.ensureStarted()
      if (!this.isReady() || !this.sp) {
        const s = this.getStatus()
        throw new Error(s.error || `Tallow is not ready (${s.phase})`)
      }
      this.history.push({ role: 'user', text: userText })
      const { ids, history } = promptIds(this.sp, this.history, CTX)
      this.history = history
      let line = await this.complete(ids)
      if (!line) line = '*tilts his head* kaw.'
      this.history.push({ role: 'tallow', text: line })
      this.saveHistory()
      return line
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    return next
  }

  private async complete(ids: number[]): Promise<string> {
    const body = {
      prompt: ids,
      n_predict: MAX_NEW,
      temperature: 0.8,
      top_k: 50,
      top_p: 1.0,
      min_p: 0.0,
      typical_p: 1.0,
      repeat_penalty: 1.0,
      presence_penalty: 0.0,
      frequency_penalty: 0.0,
      mirostat: 0,
      samplers: ['top_k', 'temperature'],
      stop: ['<nl>', '<nl> '],
      cache_prompt: true
    }
    let payload: { content?: string; tokens?: number[] }
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      payload = (await res.json()) as { content?: string; tokens?: number[] }
    } catch (err) {
      throw new Error(`llama-server did not answer (${(err as Error).message}). ${this.logTail()}`)
    }
    // This llama.cpp build puts the reply in "content"; fromSp undoes the spaces after opening * and [
    const content = payload.content || ''
    if (content.trim()) return fromSp(content).trim()
    const kept: number[] = []
    for (const t of payload.tokens || []) {
      if (t === this.sp!.pieceId('<nl>') || t === this.sp!.eosId) break
      kept.push(t)
    }
    return kept.length ? fromSp(this.sp!.decode(kept)).trim() : ''
  }

  getHistory(): TallowTurn[] {
    return [...this.history]
  }

  /** He treats you as a stranger again */
  forget(): void {
    this.history = []
    this.saveHistory()
  }

  private loadHistory(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.historyPath(), 'utf-8'))
      if (Array.isArray(raw)) {
        this.history = raw.filter(
          (t) => t && (t.role === 'user' || t.role === 'tallow') && typeof t.text === 'string'
        ) as TallowTurn[]
      }
    } catch {
      this.history = []
    }
  }

  private saveHistory(): void {
    try {
      fs.writeFileSync(this.historyPath(), JSON.stringify(this.history, null, 2), 'utf-8')
    } catch (err) {
      this.log(`could not save history: ${(err as Error).message}`)
    }
  }

  stop(): void {
    this.stopping = true
    const proc = this.proc
    this.proc = null
    if (proc && proc.exitCode === null) {
      try {
        proc.kill()
      } catch {
        // already gone
      }
    }
    if (this.status.phase === 'ready') this.set({ phase: 'stopped' })
  }
}

export const tallowService = new TallowService()
