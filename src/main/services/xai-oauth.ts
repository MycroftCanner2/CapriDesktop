/**
 * "Sign in with Grok": lets Capri think with the user's own SuperGrok / X Premium subscription
 * instead of a paid xAI API key.
 *
 * xAI runs a standard OpenID Connect server at auth.x.ai. It supports the authorization-code flow
 * with PKCE (browser + loopback callback) and the device-code flow (short code typed in any
 * browser). xAI has no public console to register a third-party OAuth client, so — like the
 * integrations xAI itself announced (Hermes Agent, OpenClaw, OpenCode, Kilo Code) — Capri uses the
 * shared public Grok CLI client. `plan=generic` is required by that client; `referrer` only says
 * who is asking.
 *
 * Tokens are encrypted with the OS keychain (safeStorage), never reach the renderer, and are
 * refreshed shortly before they expire. xAI decides which subscriptions may use this surface: an
 * account that is not eligible signs in fine but gets HTTP 403 on requests.
 */

import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'

export const XAI_API_BASE = 'https://api.x.ai/v1'
export const XAI_DEFAULT_MODEL = 'grok-4.7'

const ISSUER = 'https://auth.x.ai'
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`
const CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'
const SCOPE = 'openid profile email offline_access grok-cli:access api:access'
const REFERRER = 'capridesktop'
const CALLBACK_HOST = '127.0.0.1'
const CALLBACK_PORT = 56121
const CALLBACK_PATH = '/callback'
const REDIRECT_URI = `http://${CALLBACK_HOST}:${CALLBACK_PORT}${CALLBACK_PATH}`
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const REFRESH_SKEW_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 30_000

export type XaiLoginMethod = 'browser' | 'device'

export interface XaiAuthStatus {
  signedIn: boolean
  email?: string
  expiresAt?: number
}

export interface XaiDeviceCodePrompt {
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
}

export class XaiAuthError extends Error {
  constructor(
    public code: 'signin' | 'cancelled' | 'timeout' | 'denied' | 'network' | 'port-busy' | 'other',
    message?: string
  ) {
    super(message || code)
    this.name = 'XaiAuthError'
  }
}

interface Discovery {
  authorization_endpoint: string
  token_endpoint: string
  device_authorization_endpoint?: string
}

interface StoredTokens {
  access: string
  refresh?: string
  expiresAt: number
  email?: string
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

const tokensPath = (): string => path.join(app.getPath('userData'), 'capri_xai_oauth.json')

let cachedTokens: StoredTokens | null | undefined
let discoveryCache: Discovery | null = null
let refreshing: Promise<StoredTokens> | null = null
let activeLogin: { cancel: () => void } | null = null

function loadTokens(): StoredTokens | null {
  if (cachedTokens !== undefined) return cachedTokens
  try {
    const raw = fs.readFileSync(tokensPath(), 'utf-8')
    const { encrypted } = JSON.parse(raw) as { encrypted?: string }
    cachedTokens = encrypted ? (JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64'))) as StoredTokens) : null
  } catch {
    cachedTokens = null
  }
  return cachedTokens
}

function saveTokens(tokens: StoredTokens | null): void {
  cachedTokens = tokens
  if (!tokens) {
    try {
      fs.rmSync(tokensPath(), { force: true })
    } catch {
      // nothing to remove
    }
    return
  }
  if (!safeStorage.isEncryptionAvailable()) throw new XaiAuthError('other', 'no-encryption')
  const encrypted = safeStorage.encryptString(JSON.stringify(tokens)).toString('base64')
  fs.writeFileSync(tokensPath(), JSON.stringify({ encrypted }, null, 2), 'utf-8')
}

async function discovery(): Promise<Discovery> {
  if (discoveryCache) return discoveryCache
  try {
    const res = await fetch(DISCOVERY_URL, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as Discovery
    discoveryCache = {
      authorization_endpoint: data.authorization_endpoint || `${ISSUER}/oauth2/authorize`,
      token_endpoint: data.token_endpoint || `${ISSUER}/oauth2/token`,
      device_authorization_endpoint: data.device_authorization_endpoint || `${ISSUER}/oauth2/device/code`
    }
  } catch {
    // The documented endpoints still work if discovery is briefly unavailable
    discoveryCache = {
      authorization_endpoint: `${ISSUER}/oauth2/authorize`,
      token_endpoint: `${ISSUER}/oauth2/token`,
      device_authorization_endpoint: `${ISSUER}/oauth2/device/code`
    }
  }
  return discoveryCache
}

const base64url = (buf: Buffer): string => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function pkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(48))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

/** Only for showing who is signed in: the token itself is never trusted from here */
function emailFromIdToken(idToken?: string): string | undefined {
  if (!idToken) return undefined
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf-8')) as { email?: string; preferred_username?: string; name?: string }
    return payload.email || payload.preferred_username || payload.name
  } catch {
    return undefined
  }
}

async function postForm(url: string, form: Record<string, string>): Promise<{ status: number; data: TokenResponse & Record<string, unknown> }> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (err) {
    throw new XaiAuthError('network', String((err as Error)?.message || err))
  }
  let data: TokenResponse & Record<string, unknown> = {}
  try {
    data = (await res.json()) as TokenResponse & Record<string, unknown>
  } catch {
    // empty or non-JSON body
  }
  return { status: res.status, data }
}

function storeTokenResponse(data: TokenResponse, previous?: StoredTokens | null): StoredTokens {
  if (!data.access_token) throw new XaiAuthError('other', data.error_description || data.error || 'no access token')
  const tokens: StoredTokens = {
    access: data.access_token,
    // xAI rotates refresh tokens: keep the new one, or the old one if none came back
    refresh: data.refresh_token || previous?.refresh,
    expiresAt: Date.now() + (data.expires_in && data.expires_in > 0 ? data.expires_in : 3600) * 1000,
    email: emailFromIdToken(data.id_token) || previous?.email
  }
  saveTokens(tokens)
  return tokens
}

async function refreshTokens(current: StoredTokens): Promise<StoredTokens> {
  if (!current.refresh) throw new XaiAuthError('signin', 'session expired')
  const { token_endpoint } = await discovery()
  const { status, data } = await postForm(token_endpoint, {
    grant_type: 'refresh_token',
    refresh_token: current.refresh,
    client_id: CLIENT_ID
  })
  if (status >= 200 && status < 300 && data.access_token) return storeTokenResponse(data, current)
  // A revoked or already-used refresh token can't recover: the user has to sign in again
  if (status >= 400 && status < 500) {
    saveTokens(null)
    throw new XaiAuthError('signin', data.error_description || data.error || `HTTP ${status}`)
  }
  throw new XaiAuthError('network', `HTTP ${status}`)
}

/** A valid access token, refreshed if it is about to expire. Throws XaiAuthError('signin') if signed out */
export async function getXaiAccessToken(forceRefresh = false): Promise<string> {
  const current = loadTokens()
  if (!current) throw new XaiAuthError('signin', 'not signed in to Grok')
  if (!forceRefresh && current.expiresAt - REFRESH_SKEW_MS > Date.now()) return current.access
  if (!refreshing) {
    refreshing = refreshTokens(current).finally(() => {
      refreshing = null
    })
  }
  return (await refreshing).access
}

export function getXaiAuthStatus(): XaiAuthStatus {
  const tokens = loadTokens()
  return tokens ? { signedIn: true, email: tokens.email, expiresAt: tokens.expiresAt } : { signedIn: false }
}

export function xaiSignOut(): XaiAuthStatus {
  activeLogin?.cancel()
  saveTokens(null)
  return { signedIn: false }
}

export function cancelXaiLogin(): void {
  activeLogin?.cancel()
}

const CALLBACK_PAGE = (ok: boolean): string =>
  `<!doctype html><meta charset="utf-8"><title>Capri Desktop</title><body style="background:#0b0b12;color:#e8e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="color:${ok ? '#4ef2ff' : '#ff4f6d'}">${ok ? 'Signed in to Grok' : 'Sign-in failed'}</h2><p>${ok ? 'You can close this tab and go back to Capri.' : 'Go back to Capri and try again.'}</p></div></body>`

/** Browser sign-in: PKCE with a one-shot loopback server on the redirect the shared client expects */
async function loginWithBrowser(): Promise<StoredTokens> {
  const { authorization_endpoint, token_endpoint } = await discovery()
  const { verifier, challenge } = pkce()
  const state = base64url(randomBytes(24))

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (err: Error | null, value?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      activeLogin = null
      server.close()
      if (err) reject(err)
      else resolve(value as string)
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', REDIRECT_URI)
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404).end()
        return
      }
      const error = url.searchParams.get('error')
      const gotCode = url.searchParams.get('code')
      const ok = !error && !!gotCode && url.searchParams.get('state') === state
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' }).end(CALLBACK_PAGE(ok))
      if (error) finish(new XaiAuthError(error === 'access_denied' ? 'denied' : 'other', url.searchParams.get('error_description') || error))
      else if (!ok) finish(new XaiAuthError('other', 'state mismatch'))
      else finish(null, gotCode as string)
    })

    const timer = setTimeout(() => finish(new XaiAuthError('timeout')), LOGIN_TIMEOUT_MS)
    activeLogin = { cancel: () => finish(new XaiAuthError('cancelled')) }

    server.once('error', (err: NodeJS.ErrnoException) => {
      finish(new XaiAuthError(err.code === 'EADDRINUSE' ? 'port-busy' : 'other', err.message))
    })
    server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
      const authorize = new URL(authorization_endpoint)
      const params: Record<string, string> = {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        nonce: base64url(randomBytes(16)),
        plan: 'generic',
        referrer: REFERRER
      }
      for (const [k, v] of Object.entries(params)) authorize.searchParams.set(k, v)
      shell.openExternal(authorize.toString()).catch((err) => finish(new XaiAuthError('other', String(err))))
    })
  })

  const { status, data } = await postForm(token_endpoint, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  })
  if (status < 200 || status >= 300) throw new XaiAuthError('other', data.error_description || data.error || `HTTP ${status}`)
  return storeTokenResponse(data)
}

/** Device-code sign-in (RFC 8628): no local server, works even if the callback port is taken */
async function loginWithDeviceCode(onPrompt: (prompt: XaiDeviceCodePrompt) => void): Promise<StoredTokens> {
  const { device_authorization_endpoint, token_endpoint } = await discovery()
  const start = await postForm(device_authorization_endpoint as string, { client_id: CLIENT_ID, scope: SCOPE })
  const d = start.data as Record<string, unknown>
  if (start.status < 200 || start.status >= 300 || !d.device_code) {
    throw new XaiAuthError('other', String(d.error_description || d.error || `HTTP ${start.status}`))
  }
  const prompt: XaiDeviceCodePrompt = {
    userCode: String(d.user_code || ''),
    verificationUri: String(d.verification_uri || d.verification_url || ''),
    verificationUriComplete: d.verification_uri_complete ? String(d.verification_uri_complete) : undefined
  }
  onPrompt(prompt)
  shell.openExternal(prompt.verificationUriComplete || prompt.verificationUri).catch(() => {})

  let interval = Math.max(1, Number(d.interval) || 5) * 1000
  const deadline = Date.now() + Math.min(LOGIN_TIMEOUT_MS * 3, (Number(d.expires_in) || 600) * 1000)
  let cancelled = false
  activeLogin = { cancel: () => (cancelled = true) }
  try {
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval))
      if (cancelled) throw new XaiAuthError('cancelled')
      const { status, data } = await postForm(token_endpoint, {
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: String(d.device_code),
        client_id: CLIENT_ID
      })
      if (status >= 200 && status < 300 && data.access_token) return storeTokenResponse(data)
      if (data.error === 'authorization_pending') continue
      if (data.error === 'slow_down') {
        interval += 5000
        continue
      }
      if (data.error === 'access_denied') throw new XaiAuthError('denied')
      if (data.error === 'expired_token') throw new XaiAuthError('timeout')
      throw new XaiAuthError('other', data.error_description || data.error || `HTTP ${status}`)
    }
    throw new XaiAuthError('timeout')
  } finally {
    activeLogin = null
  }
}

export async function xaiSignIn(
  method: XaiLoginMethod,
  onDeviceCode: (prompt: XaiDeviceCodePrompt) => void
): Promise<{ ok: boolean; status: XaiAuthStatus; error?: string }> {
  activeLogin?.cancel()
  try {
    try {
      if (method === 'device') await loginWithDeviceCode(onDeviceCode)
      else await loginWithBrowser()
    } catch (err) {
      // Something else holds the callback port: the code flow needs no local server
      if (method === 'browser' && err instanceof XaiAuthError && err.code === 'port-busy') await loginWithDeviceCode(onDeviceCode)
      else throw err
    }
    return { ok: true, status: getXaiAuthStatus() }
  } catch (err) {
    const code = err instanceof XaiAuthError ? err.code : 'other'
    console.warn('[xAI OAuth] Sign-in failed:', code, String((err as Error)?.message || err).slice(0, 200))
    return { ok: false, status: getXaiAuthStatus(), error: code }
  }
}
