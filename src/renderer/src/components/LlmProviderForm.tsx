import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Check, Cloud, Cpu, Key, List, Loader2, LogIn, LogOut, Server, ShieldAlert, X } from 'lucide-react'
import { MessageKey } from '../i18n'
import { useT } from '../utils/useUiLang'

/** Any OpenAI-compatible server works: these only save the user from looking up the address */
const PRESETS: { id: string; label: string; baseUrl: string }[] = [
  { id: 'xai', label: 'Grok (xAI)', baseUrl: 'https://api.x.ai/v1' },
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { id: 'google', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'mistral', label: 'Mistral', baseUrl: 'https://api.mistral.ai/v1' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { id: 'custom', label: '', baseUrl: '' }
]

const XAI_DEFAULT_MODEL = 'grok-4.7'

const ERROR_KEYS: Record<string, MessageKey> = {
  signin: 'llm_errSignIn',
  entitlement: 'llm_errEntitlement',
  denied: 'llm_errLoginDenied',
  cancelled: 'llm_errLoginFailed',
  timeout: 'llm_errLoginFailed',
  'port-busy': 'llm_errLoginFailed',
  auth: 'llm_errAuth',
  quota: 'llm_errQuota',
  model: 'llm_errModel',
  network: 'llm_errNetwork',
  insecure: 'llm_errInsecure',
  other: 'llm_errOther',
  'invalid-url': 'llm_errInvalidUrl',
  'missing-model': 'llm_errMissingModel',
  'no-encryption': 'llm_errNoEncryption'
}

export interface LlmProviderFormHandle {
  /** Validates and stores the choice; false if something needs fixing */
  save: () => Promise<boolean>
}

export const LlmProviderForm = forwardRef<LlmProviderFormHandle, { onProviderChange?: (provider: 'local' | 'cloud') => void }>(
  ({ onProviderChange }, ref) => {
    const t = useT()
    const [provider, setProvider] = useState<'local' | 'cloud'>('cloud')
    const [preset, setPreset] = useState('xai')
    const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl)
    const [model, setModel] = useState(XAI_DEFAULT_MODEL)
    const [authMode, setAuthMode] = useState<'oauth' | 'key'>('oauth')
    const [xai, setXai] = useState<{ signedIn: boolean; email?: string }>({ signedIn: false })
    const [signingIn, setSigningIn] = useState(false)
    const [deviceCode, setDeviceCode] = useState<{ userCode: string; verificationUri: string } | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [hasKey, setHasKey] = useState(false)
    const [models, setModels] = useState<string[]>([])
    const [busy, setBusy] = useState<'models' | 'test' | null>(null)
    const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

    useEffect(() => {
      window.api?.agent?.getLlmSettings?.().then((s) => {
        if (!s) return
        setProvider(s.provider)
        if (s.preset) setPreset(s.preset)
        if (s.baseUrl) setBaseUrl(s.baseUrl)
        setModel(s.model || XAI_DEFAULT_MODEL)
        setHasKey(s.hasKey)
        if (s.authMode) setAuthMode(s.authMode)
        if (s.xai) setXai(s.xai)
        onProviderChange?.(s.provider)
      })
      return window.api?.agent?.onXaiDeviceCode?.((prompt) => setDeviceCode(prompt))
    }, [])

    // Sign in with Grok only exists for xAI; any other provider keeps using an API key
    const usingOauth = provider === 'cloud' && preset === 'xai' && authMode === 'oauth'

    const signIn = async (method: 'browser' | 'device' = 'browser') => {
      setSigningIn(true)
      setDeviceCode(null)
      setNotice(null)
      const res = await window.api.agent.xaiSignIn(method)
      setSigningIn(false)
      setDeviceCode(null)
      setXai(res.status)
      if (!res.ok) return fail(res.error)
      if (!model.trim()) setModel(XAI_DEFAULT_MODEL)
    }

    const cancelSignIn = async () => {
      await window.api.agent.xaiCancelSignIn()
      setSigningIn(false)
      setDeviceCode(null)
    }

    const signOut = async () => {
      setXai(await window.api.agent.xaiSignOut())
      setNotice(null)
    }

    const choose = (next: 'local' | 'cloud') => {
      setProvider(next)
      setNotice(null)
      onProviderChange?.(next)
    }

    const choosePreset = (id: string) => {
      setPreset(id)
      setModels([])
      setNotice(null)
      const found = PRESETS.find((p) => p.id === id)
      if (found && id !== 'custom') setBaseUrl(found.baseUrl)
      if (id === 'xai' && !model.trim()) setModel(XAI_DEFAULT_MODEL)
    }

    const fail = (code?: string) => setNotice({ ok: false, text: t(ERROR_KEYS[code || 'other'] || 'llm_errOther') })

    const loadModels = async () => {
      setBusy('models')
      setNotice(null)
      const res = await window.api.agent.listLlmModels(baseUrl, apiKey || undefined, usingOauth ? 'oauth' : 'key')
      setBusy(null)
      if (!res.ok) return fail(res.error)
      setModels(res.models)
      if (res.models.length === 0) setNotice({ ok: false, text: t('llm_noModels') })
    }

    const test = async () => {
      if (!model.trim()) return fail('missing-model')
      setBusy('test')
      setNotice(null)
      const res = await window.api.agent.testLlm(baseUrl, model.trim(), apiKey || undefined, usingOauth ? 'oauth' : 'key')
      setBusy(null)
      if (res.ok) setNotice({ ok: true, text: t('llm_testOk') })
      else fail(res.error)
    }

    const removeKey = async () => {
      const res = await window.api.agent.setLlmSettings({ apiKey: '' })
      if (res.success) setHasKey(false)
    }

    useImperativeHandle(ref, () => ({
      save: async () => {
        const res = await window.api.agent.setLlmSettings(
          provider === 'local'
            ? { provider: 'local' }
            : usingOauth
              ? { provider: 'cloud', preset: 'xai', authMode: 'oauth', model: model.trim() || XAI_DEFAULT_MODEL }
              : { provider: 'cloud', preset, baseUrl, authMode: 'key', model: model.trim(), apiKey: apiKey || undefined }
        )
        if (!res.success) {
          fail(res.error)
          return false
        }
        setHasKey(res.settings.hasKey)
        setApiKey('')
        return true
      }
    }))

    const field = 'cp-input w-full px-3 py-2 text-[15px] select-text'

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ['local', 'llm_local', 'llm_localDesc', <Cpu size={16} key="i" />],
              ['cloud', 'llm_cloud', 'llm_cloudDesc', <Cloud size={16} key="i" />]
            ] as const
          ).map(([id, title, desc, icon]) => {
            const active = provider === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                className={`cp-frame cp-option cp-plain text-left px-3.5 py-3 cursor-pointer ${active ? 'is-active' : ''}`}
              >
                {active && <span className="cp-marker" />}
                <span className={`flex items-center gap-2 text-[15px] font-bold uppercase tracking-[0.06em] ${active ? 'text-[var(--cp-red-hi)]' : 'text-[var(--cp-red-dim)]'}`}>
                  {icon} {t(title)}
                </span>
                <span className="block mt-1.5 text-[13px] leading-snug text-[var(--cp-muted)]">{t(desc)}</span>
              </button>
            )
          })}
        </div>

        {provider === 'cloud' && (
          <div className="space-y-3">
            <label className="block">
              <span className="cp-label block mb-1.5">{t('llm_provider')}</span>
              <div className="cp-frame">
                <select value={preset} onChange={(e) => choosePreset(e.target.value)} className={`${field} cursor-pointer`} style={{ colorScheme: 'dark' }}>
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label || t('llm_custom')}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            {preset === 'xai' && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['oauth', 'llm_authOauth', <LogIn size={13} key="i" />],
                    ['key', 'llm_authKey', <Key size={13} key="i" />]
                  ] as const
                ).map(([id, label, icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setAuthMode(id)
                      setNotice(null)
                    }}
                    className={`cp-frame cp-option cp-plain flex items-center gap-1.5 px-3 py-2 text-[13px] cursor-pointer ${authMode === id ? 'is-active text-[var(--cp-red-hi)]' : 'text-[var(--cp-muted)]'}`}
                  >
                    {icon} {t(label)}
                  </button>
                ))}
              </div>
            )}

            {usingOauth && (
              <div className="cp-frame px-3 py-3 space-y-2.5">
                <p className="text-[13px] leading-snug text-[var(--cp-muted)]">{t('llm_grokSignInDesc')}</p>
                {xai.signedIn ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[14px] text-[var(--cp-cyan)]">
                      <Check size={14} /> {t('llm_grokSignedIn', { who: xai.email || 'Grok' })}
                    </span>
                    <button type="button" onClick={signOut} className="cp-frame cp-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-[13px] shrink-0">
                      <LogOut size={13} /> {t('llm_grokSignOut')}
                    </button>
                  </div>
                ) : signingIn ? (
                  <div className="space-y-2">
                    <span className="flex items-center gap-1.5 text-[14px] text-[var(--cp-text)]">
                      <Loader2 size={14} className="animate-spin" /> {t('llm_grokWaiting')}
                    </span>
                    {deviceCode && (
                      <p className="text-[14px] text-[var(--cp-yellow)] select-text">
                        {t('llm_grokDeviceCode', { code: deviceCode.userCode })} <span className="cp-mono text-[12px] text-[var(--cp-muted)]">({deviceCode.verificationUri})</span>
                      </p>
                    )}
                    <button type="button" onClick={cancelSignIn} className="cp-plain text-[12px] text-[var(--cp-muted)] hover:text-[var(--cp-red)] underline cursor-pointer">
                      {t('llm_grokCancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button type="button" onClick={() => signIn('browser')} className="cp-frame cp-btn-ghost flex items-center gap-1.5 px-3.5 py-2 text-[14px] font-bold shrink-0">
                      <LogIn size={14} /> {t('llm_grokSignIn')}
                    </button>
                    <button type="button" onClick={() => signIn('device')} className="cp-plain text-[12px] text-[var(--cp-muted)] hover:text-[var(--cp-red)] underline cursor-pointer">
                      {t('llm_grokUseCode')}
                    </button>
                  </div>
                )}
                <p className="text-[12px] leading-snug text-[var(--cp-muted)]">{t('llm_grokNote')}</p>
              </div>
            )}

            {!usingOauth && (
            <>
            <label className="block">
              <span className="cp-label flex items-center gap-1.5 mb-1.5">
                <Server size={12} /> {t('llm_baseUrl')}
              </span>
              <div className="cp-frame">
                <input
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value)
                    setPreset('custom')
                  }}
                  spellCheck={false}
                  placeholder="https://..."
                  className={`${field} cp-mono`}
                />
              </div>
            </label>

            <label className="block">
              <span className="cp-label flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Key size={12} /> {t('llm_apiKey')}
                </span>
                {hasKey && (
                  <button type="button" onClick={removeKey} className="cp-plain text-[12px] text-[var(--cp-muted)] hover:text-[var(--cp-red)] underline cursor-pointer normal-case tracking-normal">
                    {t('llm_removeKey')}
                  </button>
                )}
              </span>
              <div className="cp-frame">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={hasKey ? `•••••••• ${t('llm_apiKeySaved')}` : t('llm_apiKeyPlaceholder')}
                  className={`${field} cp-mono`}
                />
              </div>
            </label>
            </>
            )}

            <div className="block">
              <span className="cp-label block mb-1.5">{t('llm_model')}</span>
              <div className="flex gap-2">
                <div className="cp-frame flex-1 min-w-0">
                  <input
                    list="capri-llm-models"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    spellCheck={false}
                    placeholder={t('llm_modelPlaceholder')}
                    className={`${field} cp-mono`}
                  />
                  <datalist id="capri-llm-models">
                    {models.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <button type="button" onClick={loadModels} disabled={!!busy} className="cp-frame cp-btn-ghost flex items-center gap-1.5 px-3 text-[13px] shrink-0">
                  {busy === 'models' ? <Loader2 size={13} className="animate-spin" /> : <List size={13} />} {t('llm_loadModels')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={test} disabled={!!busy} className="cp-frame cp-btn-ghost flex items-center gap-1.5 px-3 py-2 text-[13px] shrink-0">
                {busy === 'test' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {busy === 'test' ? t('llm_testing') : t('llm_test')}
              </button>
              {notice && (
                <span className={`flex items-start gap-1.5 text-[14px] leading-snug ${notice.ok ? 'text-[var(--cp-cyan)]' : 'text-[var(--cp-yellow)]'}`}>
                  {notice.ok ? <Check size={14} className="mt-0.5 shrink-0" /> : <X size={14} className="mt-0.5 shrink-0" />} {notice.text}
                </span>
              )}
            </div>

            <div className="cp-frame is-warn flex gap-2 px-3 py-2.5 text-[13px] leading-snug text-[var(--cp-text)]">
              <ShieldAlert size={15} className="shrink-0 mt-0.5 text-[var(--cp-yellow)]" />
              <span>
                {t('llm_privacy')} {t('llm_voiceLocal')}
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }
)
LlmProviderForm.displayName = 'LlmProviderForm'
