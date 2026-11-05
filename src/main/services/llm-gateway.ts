/**
 * Decides who processes Capri's thinking: the local Ollama or any OpenAI-compatible API.
 * Every LLM request in the app goes through llmFetch(), so the code that builds prompts, parses
 * answers and runs tools is the same in both modes. In cloud mode the requests are translated to
 * /chat/completions and the answers are shaped back to what the caller expects.
 *
 * The API key is encrypted with the OS keychain (safeStorage) and never reaches the renderer.
 *
 * Grok can also be reached with "Sign in with Grok" (authMode 'oauth'): the user's SuperGrok /
 * X Premium subscription instead of an API key. Those requests go to xAI's Responses API with a
 * short-lived OAuth token from xai-oauth.ts, and are shaped back to /chat/completions answers.
 */

import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { scriptPath } from './app-paths'
import { personalize } from './user-profile'
import { XAI_API_BASE, XAI_DEFAULT_MODEL, XaiAuthError, getXaiAccessToken, getXaiAuthStatus, type XaiAuthStatus } from './xai-oauth'

export type LlmProvider = 'local' | 'cloud'
/** 'key': API key (any OpenAI-compatible server). 'oauth': Sign in with Grok (xAI subscription) */
export type LlmAuthMode = 'key' | 'oauth'
export type LlmErrorCode = 'auth' | 'quota' | 'model' | 'network' | 'insecure' | 'other' | 'signin' | 'entitlement'

export interface LlmPublicSettings {
  provider: LlmProvider
  preset: string
  baseUrl: string
  model: string
  hasKey: boolean
  authMode: LlmAuthMode
  /** Sign in with Grok state; never contains tokens */
  xai: XaiAuthStatus
}

export interface LlmSettingsUpdate {
  provider?: LlmProvider
  preset?: string
  baseUrl?: string
  model?: string
  authMode?: LlmAuthMode
  /** undefined keeps the saved key, '' removes it */
  apiKey?: string
}

interface StoredSettings {
  provider: LlmProvider
  preset: string
  baseUrl: string
  model: string
  authMode: LlmAuthMode
  encryptedKey?: string
}

/** A fresh install thinks with Grok through the user's own xAI subscription; Ollama stays one click away */
const DEFAULTS: StoredSettings = { provider: 'cloud', preset: 'xai', baseUrl: XAI_API_BASE, model: XAI_DEFAULT_MODEL, authMode: 'oauth' }

/** Where Sign in with Grok requests go. Overridable only for testing another xAI route */
const oauthBase = (): string => (process.env.CAPRI_XAI_OAUTH_BASE || XAI_API_BASE).replace(/\/+$/, '')

/** The callers ask for these local models by name; in cloud mode all of them mean the chosen model */
const LOCAL_MODEL_ALIASES = ['capri:latest', 'qwen2.5-coder:7b', 'qwen2.5-vl:latest', 'llava:latest']

let cached: StoredSettings | null = null

const settingsPath = (): string => path.join(app.getPath('userData'), 'capri_llm.json')

function load(): StoredSettings {
  if (cached) return cached
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) as Partial<StoredSettings>
    // Settings saved before Sign in with Grok existed always meant an API key (or local Ollama)
    cached = { ...DEFAULTS, ...saved, authMode: saved.authMode === 'oauth' ? 'oauth' : 'key' }
  } catch {
    cached = { ...DEFAULTS }
  }
  return cached as StoredSettings
}

function persist(next: StoredSettings): void {
  cached = next
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8')
}

function savedKey(): string {
  const enc = load().encryptedKey
  if (!enc) return ''
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    return ''
  }
}

function normalizeBase(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '')
}

function parseHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  } catch {
    return null
  }
}

const sameOrigin = (a: string, b: string): boolean => parseHttpUrl(a)?.origin === parseHttpUrl(b)?.origin

/** A key is never sent in clear text, except to this very machine */
function keyWouldLeakInClear(baseUrl: string, key: string): boolean {
  const parsed = parseHttpUrl(baseUrl)
  if (!parsed || !key || parsed.protocol === 'https:') return false
  return !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
}

const isOauth = (s: StoredSettings = load()): boolean => s.provider === 'cloud' && s.authMode === 'oauth'

export function isCloudMode(): boolean {
  const s = load()
  return s.provider === 'cloud' && !!s.baseUrl && !!s.model
}

export function getLlmSettings(): LlmPublicSettings {
  const { provider, preset, baseUrl, model, encryptedKey, authMode } = load()
  return { provider, preset, baseUrl, model, hasKey: !!encryptedKey, authMode, xai: getXaiAuthStatus() }
}

export function setLlmSettings(update: LlmSettingsUpdate): { success: boolean; error?: string; settings: LlmPublicSettings } {
  const current = load()
  const next: StoredSettings = { ...current }
  if (update.provider === 'local' || update.provider === 'cloud') next.provider = update.provider
  if (typeof update.preset === 'string') next.preset = update.preset
  if (typeof update.model === 'string') next.model = update.model.trim()
  if (typeof update.baseUrl === 'string') next.baseUrl = normalizeBase(update.baseUrl)
  if (update.authMode === 'key' || update.authMode === 'oauth') next.authMode = update.authMode

  if (next.provider === 'cloud' && next.authMode === 'oauth') {
    // Subscription tokens only ever go to xAI
    next.preset = 'xai'
    next.baseUrl = oauthBase()
    if (!next.model) next.model = XAI_DEFAULT_MODEL
    if (!getXaiAuthStatus().signedIn) return { success: false, error: 'signin', settings: getLlmSettings() }
  }

  if (next.provider === 'cloud') {
    if (!parseHttpUrl(next.baseUrl)) return { success: false, error: 'invalid-url', settings: getLlmSettings() }
    if (!next.model) return { success: false, error: 'missing-model', settings: getLlmSettings() }
  }

  // A saved key belongs to the server it was typed for: never hand it to a different one
  if (current.encryptedKey && current.baseUrl && !sameOrigin(current.baseUrl, next.baseUrl)) delete next.encryptedKey

  if (update.apiKey === '') {
    delete next.encryptedKey
  } else if (update.apiKey) {
    if (!safeStorage.isEncryptionAvailable()) return { success: false, error: 'no-encryption', settings: getLlmSettings() }
    next.encryptedKey = safeStorage.encryptString(update.apiKey.trim()).toString('base64')
  }

  const key = update.apiKey ?? (next.encryptedKey === current.encryptedKey ? savedKey() : '')
  if (next.provider === 'cloud' && next.authMode !== 'oauth' && keyWouldLeakInClear(next.baseUrl, key)) {
    return { success: false, error: 'insecure', settings: getLlmSettings() }
  }

  persist(next)
  return { success: true, settings: getLlmSettings() }
}

/** The typed key if there is one, otherwise the saved key only if it belongs to that same server */
function keyFor(baseUrl: string, typedKey?: string): string {
  if (typedKey) return typedKey.trim()
  const saved = sameOrigin(load().baseUrl, baseUrl) ? savedKey() : ''
  if (saved) return saved
  // XAI_API_KEY in the environment (or Capri's .env) works for xAI without typing it in the app
  return sameOrigin(baseUrl, XAI_API_BASE) ? (process.env.XAI_API_KEY || '').trim() : ''
}

interface Credential {
  key: string
  oauth: boolean
}

/** The bearer for a request: a fresh Grok OAuth token in subscription mode, otherwise the API key */
async function credentialFor(baseUrl: string, typedKey?: string, mode?: LlmAuthMode): Promise<Credential> {
  const oauth = mode ? mode === 'oauth' : isOauth()
  if (oauth) return { key: await getXaiAccessToken(), oauth: true }
  return { key: keyFor(baseUrl, typedKey), oauth: false }
}

function authHeaders(key: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) headers.Authorization = `Bearer ${key}`
  return headers
}

function classify(status: number, oauth = isOauth()): LlmErrorCode {
  // With Sign in with Grok, 401 means the session ended and 403 means xAI does not let this plan use it
  if (oauth && status === 401) return 'signin'
  if (oauth && status === 403) return 'entitlement'
  if (status === 401 || status === 403) return 'auth'
  if (status === 402 || status === 429) return 'quota'
  if (status === 400 || status === 404 || status === 422) return 'model'
  return 'other'
}

export async function listCloudModels(
  baseUrlRaw: string,
  typedKey?: string,
  mode?: LlmAuthMode
): Promise<{ ok: boolean; models: string[]; error?: LlmErrorCode }> {
  const oauthMode = mode ? mode === 'oauth' : isOauth()
  const baseUrl = oauthMode ? oauthBase() : normalizeBase(baseUrlRaw)
  if (!parseHttpUrl(baseUrl)) return { ok: false, models: [], error: 'other' }
  let cred: Credential
  try {
    cred = await credentialFor(baseUrl, typedKey, oauthMode ? 'oauth' : 'key')
  } catch (err) {
    return { ok: false, models: [], error: authFailure(err) }
  }
  if (!cred.oauth && keyWouldLeakInClear(baseUrl, cred.key)) return { ok: false, models: [], error: 'insecure' }
  try {
    const res = await fetch(`${baseUrl}/models`, { headers: authHeaders(cred.key), signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { ok: false, models: [], error: classify(res.status, cred.oauth) }
    const data = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string; name?: string }[] }
    const models = (data.data || data.models || [])
      .map((m) => String(m.id || (m as { name?: string }).name || '').replace(/^models\//, ''))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return { ok: true, models }
  } catch {
    return { ok: false, models: [], error: 'network' }
  }
}

export async function testCloudConnection(
  baseUrlRaw: string,
  model: string,
  typedKey?: string,
  mode?: LlmAuthMode
): Promise<{ ok: boolean; error?: LlmErrorCode }> {
  const oauthMode = mode ? mode === 'oauth' : isOauth()
  const baseUrl = oauthMode ? oauthBase() : normalizeBase(baseUrlRaw)
  if (!parseHttpUrl(baseUrl)) return { ok: false, error: 'other' }
  let cred: Credential
  try {
    cred = await credentialFor(baseUrl, typedKey, oauthMode ? 'oauth' : 'key')
  } catch (err) {
    return { ok: false, error: authFailure(err) }
  }
  if (!cred.oauth && keyWouldLeakInClear(baseUrl, cred.key)) return { ok: false, error: 'insecure' }
  try {
    const res = await postChat(
      baseUrl,
      cred,
      { model, messages: [{ role: 'user', content: 'Reply with: ok' }], max_tokens: 16 },
      AbortSignal.timeout(30000)
    )
    return res.ok ? { ok: true } : { ok: false, error: classify(res.status, cred.oauth) }
  } catch {
    return { ok: false, error: 'network' }
  }
}

type Body = Record<string, unknown>

/** Providers disagree on optional parameters: drops or renames the one the error complains about */
function relaxBody(body: Body, errorText: string): Body | null {
  const text = errorText.toLowerCase()
  const next = { ...body }
  if (text.includes('max_output_tokens') && (next.max_tokens !== undefined || next.max_completion_tokens !== undefined)) {
    delete next.max_tokens
    delete next.max_completion_tokens
    return next
  }
  if (next.max_tokens !== undefined && text.includes('max_tokens')) {
    next.max_completion_tokens = next.max_tokens
    delete next.max_tokens
    return next
  }
  for (const param of ['temperature', 'top_p', 'presence_penalty', 'frequency_penalty', 'stop', 'response_format']) {
    if (next[param] !== undefined && text.includes(param)) {
      delete next[param]
      return next
    }
  }
  if (next.tools !== undefined && /\btools?\b|tool_choice|function call/.test(text)) {
    delete next.tools
    delete next.tool_choice
    next.messages = normalizeMessages(next.messages as Body[], false)
    return next
  }
  return null
}

async function postChat(baseUrl: string, cred: Credential, payload: Body, signal?: AbortSignal | null): Promise<Response> {
  if (cred.oauth) return postResponses(baseUrl, cred, payload, signal)
  let body = payload
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: authHeaders(cred.key),
      body: JSON.stringify(body),
      signal: signal || undefined
    })
    if (res.ok || attempt >= 4 || ![400, 404, 422].includes(res.status)) return res
    const relaxed = relaxBody(body, await res.clone().text())
    if (!relaxed) return res
    body = relaxed
  }
}

/** Chat message content (string or OpenAI parts) -> Responses content parts */
function responsesContent(content: unknown, role: string): unknown {
  const textType = role === 'assistant' ? 'output_text' : 'input_text'
  if (!Array.isArray(content)) return String(content ?? '')
  return (content as Body[]).map((part) => {
    if (part?.type === 'image_url') {
      const img = part.image_url as { url?: string } | string | undefined
      return { type: 'input_image', image_url: typeof img === 'string' ? img : img?.url || '' }
    }
    return { type: textType, text: String(part?.text ?? '') }
  })
}

/** /chat/completions request -> xAI Responses API request (what subscription tokens are served on) */
function toResponsesBody(chat: Body): Body {
  const input: Body[] = []
  for (const msg of normalizeMessages((chat.messages || []) as Body[])) {
    const role = String(msg.role || 'user')
    if (role === 'tool') {
      input.push({ type: 'function_call_output', call_id: String(msg.tool_call_id || ''), output: String(msg.content ?? '') })
      continue
    }
    const content = msg.content
    const hasText = Array.isArray(content) ? content.length > 0 : String(content ?? '').trim() !== ''
    if (hasText) input.push({ role, content: responsesContent(content, role) })
    if (role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const call of msg.tool_calls as Body[]) {
        const fn = (call.function || {}) as Body
        input.push({
          type: 'function_call',
          call_id: String(call.id || ''),
          name: String(fn.name || ''),
          arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {})
        })
      }
    }
  }
  const body: Body = { model: chat.model, input, store: false }
  const maxTokens = chat.max_completion_tokens ?? chat.max_tokens
  if (typeof maxTokens === 'number' && maxTokens > 0) body.max_output_tokens = Math.max(16, maxTokens)
  if (chat.temperature !== undefined) body.temperature = chat.temperature
  if (chat.top_p !== undefined) body.top_p = chat.top_p
  if ((chat.response_format as Body | undefined)?.type === 'json_object') body.text = { format: { type: 'json_object' } }
  if (Array.isArray(chat.tools) && chat.tools.length > 0) {
    body.tools = (chat.tools as Body[]).map((tool) => {
      const fn = (tool.function || tool) as Body
      return { type: 'function', name: fn.name, description: fn.description, parameters: fn.parameters }
    })
    if (chat.tool_choice !== undefined) body.tool_choice = chat.tool_choice
  }
  return body
}

/** xAI Responses API answer -> the /chat/completions shape every caller already understands */
function fromResponses(data: Body): Body {
  let text = ''
  const toolCalls: Body[] = []
  for (const item of (data.output || []) as Body[]) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const part of item.content as Body[]) if (part.type === 'output_text' || part.type === 'text') text += String(part.text ?? '')
    } else if (item.type === 'function_call') {
      toolCalls.push({
        id: String(item.call_id || item.id || ''),
        type: 'function',
        function: { name: String(item.name || ''), arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {}) }
      })
    }
  }
  if (!text && typeof data.output_text === 'string') text = data.output_text
  const message: Body = { role: 'assistant', content: text }
  if (toolCalls.length) message.tool_calls = toolCalls
  return {
    id: data.id,
    object: 'chat.completion',
    model: data.model,
    choices: [{ index: 0, message, finish_reason: toolCalls.length ? 'tool_calls' : 'stop' }],
    usage: data.usage
  }
}

/** Subscription route: same retries as postChat, plus one token refresh if xAI says it expired */
async function postResponses(baseUrl: string, cred: Credential, payload: Body, signal?: AbortSignal | null): Promise<Response> {
  let body = payload
  let key = cred.key
  let refreshed = false
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(toResponsesBody(body)),
      signal: signal || undefined
    })
    if (res.ok) return jsonResponse(fromResponses((await res.json()) as Body))
    if (res.status === 401 && !refreshed) {
      refreshed = true
      try {
        key = await getXaiAccessToken(true)
        continue
      } catch {
        return res
      }
    }
    if (attempt >= 4 || ![400, 404, 422].includes(res.status)) return res
    const relaxed = relaxBody(body, await res.clone().text())
    if (!relaxed) return res
    body = relaxed
  }
}

/** Not signed in to Grok (or the session could not be renewed) vs. no connection at all */
function authFailure(err: unknown): LlmErrorCode {
  if (err instanceof XaiAuthError) return err.code === 'network' ? 'network' : 'signin'
  return 'other'
}

/**
 * Strict APIs reject tool results without their matching call (and calls without results), which
 * local models tolerate. Those turns keep their information as plain conversation.
 */
function normalizeMessages(messages: Body[], keepTools = true): Body[] {
  const out: Body[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      const calls = msg.tool_calls as Body[]
      const answered = new Set<unknown>()
      for (let j = i + 1; j < messages.length && messages[j].role === 'tool'; j++) answered.add(messages[j].tool_call_id)
      if (keepTools && calls.length > 0 && calls.every((c) => answered.has(c.id))) {
        out.push({
          ...msg,
          tool_calls: calls.map((c) => {
            const fn = c.function as Body
            return { ...c, type: 'function', function: { ...fn, arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {}) } }
          })
        })
        for (let j = i + 1; j < messages.length && messages[j].role === 'tool'; j++) out.push(messages[j])
        while (i + 1 < messages.length && messages[i + 1].role === 'tool') i++
        continue
      }
      const { tool_calls: _dropped, ...plain } = msg
      out.push({ ...plain, content: plain.content ?? '' })
      continue
    }
    if (msg.role === 'tool') {
      out.push({ role: 'user', content: `[Result of ${String(msg.name || 'tool')}] ${String(msg.content ?? '')}` })
      continue
    }
    // Some providers reject a system message in the middle: it joins the first one
    if (msg.role === 'system' && out.length > 0 && out[0].role === 'system') {
      out[0] = { ...out[0], content: `${String(out[0].content ?? '')}\n${String(msg.content ?? '')}` }
      continue
    }
    out.push(msg)
  }
  return out
}

let personaCache: string | null | undefined

/** The "capri" Ollama model carries its persona in the Modelfile: a cloud model needs it in the request */
function capriPersona(): string | null {
  if (personaCache === undefined) {
    try {
      const match = fs.readFileSync(scriptPath('Modelfile.capri'), 'utf-8').match(/SYSTEM\s+"""([\s\S]*?)"""/)
      personaCache = match ? match[1].trim() : null
    } catch {
      personaCache = null
    }
  }
  return personaCache ? personalize(personaCache) : null
}

function imageUrl(base64: string): string {
  const mime = base64.startsWith('/9j/') ? 'image/jpeg' : base64.startsWith('R0lG') ? 'image/gif' : base64.startsWith('UklG') ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${base64}`
}

function ollamaMessage(msg: Body): Body {
  const images = msg.images as string[] | undefined
  if (!images?.length) return msg
  const { images: _images, ...rest } = msg
  return {
    ...rest,
    content: [{ type: 'text', text: String(msg.content ?? '') }, ...images.map((b) => ({ type: 'image_url', image_url: { url: imageUrl(b) } }))]
  }
}

/** Ollama /api/chat or /api/generate request -> OpenAI chat request */
function fromOllama(req: Body, messages: Body[]): Body {
  const options = (req.options || {}) as Body
  const body: Body = { messages }
  if (options.temperature !== undefined) body.temperature = options.temperature
  if (options.top_p !== undefined) body.top_p = options.top_p
  if (options.stop !== undefined) body.stop = options.stop
  if (typeof options.num_predict === 'number' && options.num_predict > 0) body.max_tokens = options.num_predict
  if (req.format) body.response_format = { type: 'json_object' }
  if (req.tools) body.tools = req.tools

  // Same rule as Ollama: a system message in the request wins over the Modelfile's persona
  if (/^capri/i.test(String(req.model || '')) && !messages.some((m) => m.role === 'system')) {
    const persona = capriPersona()
    if (persona) body.messages = [{ role: 'system', content: persona }, ...messages]
    if (body.temperature === undefined) body.temperature = 0.7
  }
  return body
}

function answerText(data: { choices?: { message?: { content?: unknown } }[] }): string {
  const content = data.choices?.[0]?.message?.content
  const text = Array.isArray(content)
    ? content.map((part: { text?: string }) => part?.text || '').join('')
    : String(content ?? '')
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim()
}

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

/** Same shape as the API it replaces. A streaming caller simply gets the whole answer in one chunk */
async function ollamaAnswer(res: Response, stream: boolean, kind: 'chat' | 'generate'): Promise<Response> {
  if (!res.ok) return res
  const data = (await res.json()) as { choices?: { message?: { content?: unknown; tool_calls?: unknown } }[] }
  const text = answerText(data)
  const answer =
    kind === 'chat'
      ? { message: { role: 'assistant', content: text, tool_calls: data.choices?.[0]?.message?.tool_calls }, done: true }
      : { response: text, done: true }
  if (stream) return new Response(`${JSON.stringify(answer)}\n`, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
  return jsonResponse(answer)
}

/** Drop-in replacement for fetch() on every LLM call */
export async function llmFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!isCloudMode()) return fetch(input, init)

  const settings = load()
  const { model } = settings
  const baseUrl = isOauth(settings) ? oauthBase() : settings.baseUrl
  const route = new URL(input).pathname
  if (route.endsWith('/api/tags')) {
    return jsonResponse({ models: [...LOCAL_MODEL_ALIASES, model].map((name) => ({ name })) })
  }
  if (route.endsWith('/models')) {
    return jsonResponse({ data: [...LOCAL_MODEL_ALIASES, model].map((id) => ({ id })) })
  }
  let cred: Credential
  try {
    cred = await credentialFor(baseUrl)
  } catch (err) {
    const code = authFailure(err)
    return jsonResponse({ error: code === 'signin' ? 'Sign in with Grok first (HTTP 401)' : String((err as Error)?.message || err) }, code === 'signin' ? 401 : 503)
  }
  if (!cred.oauth && keyWouldLeakInClear(baseUrl, cred.key)) return jsonResponse({ error: 'insecure' }, 403)
  const signal = init?.signal
  const req: Body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}

  if (route.endsWith('/chat/completions')) {
    const body = { ...req, model, messages: normalizeMessages((req.messages || []) as Body[]) }
    const res = await postChat(baseUrl, cred, body, signal)
    if (!res.ok) return res
    const data = (await res.json()) as { choices?: { message?: Body }[] }
    const message = data.choices?.[0]?.message
    if (message) message.content = answerText(data as { choices?: { message?: { content?: unknown } }[] })
    return jsonResponse(data)
  }
  if (route.endsWith('/api/chat')) {
    const messages = normalizeMessages(((req.messages || []) as Body[]).map(ollamaMessage))
    const res = await postChat(baseUrl, cred, { ...fromOllama(req, messages), model }, signal)
    return ollamaAnswer(res, !!req.stream, 'chat')
  }
  if (route.endsWith('/api/generate')) {
    // An empty prompt only preloads a local model into memory: there is nothing to do remotely
    if (!String(req.prompt || '').trim()) return jsonResponse({ response: '', done: true })
    const messages: Body[] = []
    if (req.system) messages.push({ role: 'system', content: req.system })
    messages.push(ollamaMessage({ role: 'user', content: req.prompt, images: req.images }))
    const res = await postChat(baseUrl, cred, { ...fromOllama(req, messages), model }, signal)
    return ollamaAnswer(res, !!req.stream, 'generate')
  }
  return fetch(input, init)
}

/** Status of the error a cloud request failed with, if the message carries one */
export function cloudErrorCode(err: unknown): LlmErrorCode {
  const text = String((err as Error)?.message || err)
  const status = Number((text.match(/HTTP (\d{3})/) || [])[1])
  if (status) return classify(status)
  const name = String((err as Error)?.name || '')
  const cause = String((err as { cause?: { code?: string } })?.cause?.code || '')
  if (name === 'AbortError' || name === 'TimeoutError' || /fetch failed|network|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket|certificate/i.test(`${text} ${cause}`)) return 'network'
  return 'other'
}

/** What actually went wrong, short enough for a bubble and with anything that looks like a key removed */
export function cloudErrorDetail(err: unknown): string {
  const cause = (err as { cause?: { message?: string } })?.cause?.message
  return String(cause || (err as Error)?.message || err)
    .replace(/\b(?:sk|gsk|xai|key|AIza)[-_A-Za-z0-9]{12,}/g, '***')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}
