import React, { useEffect, useState } from 'react'
import { Bird, FolderOpen, KeyRound, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useT } from '../utils/useUiLang'
import type { TallowStatus } from '../../../preload/index.d'

/** First-run download, the optional HF_TOKEN prompt and the llama-server state for Tallow */
export const TallowStatusPanel: React.FC<{ compact?: boolean; autoStart?: boolean }> = ({ compact = false, autoStart = false }) => {
  const t = useT()
  const [status, setStatus] = useState<TallowStatus | null>(null)
  const [token, setToken] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const api = window.api?.tallow
    if (!api) return
    api.getStatus().then((s) => {
      setStatus(s)
      if (autoStart && (s.phase === 'idle' || s.phase === 'stopped')) api.start().then(setStatus)
    })
    return api.onStatus(setStatus)
  }, [autoStart])

  if (!status) return null
  const pct = Math.round((status.progress || 0) * 100)
  const busy = status.phase === 'downloading' || status.phase === 'converting' || status.phase === 'starting'
  const text = (() => {
    switch (status.phase) {
      case 'downloading':
        return t('tallow_phase_downloading', { pct })
      case 'converting':
        return t('tallow_phase_converting')
      case 'starting':
        return t('tallow_phase_starting')
      case 'ready':
        return t('tallow_phase_ready', { port: status.port ?? '' })
      case 'needs-token':
        return t('tallow_phase_needsToken')
      case 'error':
        return t('tallow_phase_error', { error: status.error || '?' })
      case 'stopped':
        return t('tallow_phase_stopped')
      default:
        return t('tallow_phase_idle')
    }
  })()

  const submitToken = async (): Promise<void> => {
    if (!token.trim()) return
    setSending(true)
    const next = await window.api.tallow.setToken(token.trim())
    setToken('')
    setSending(false)
    setStatus(next)
  }

  return (
    <div className={`cp-frame px-3 py-3 space-y-2.5 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
      <div className="flex items-center gap-2 text-[var(--cp-text)]">
        {busy ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Bird size={14} className="shrink-0 text-[var(--cp-red-hi)]" />}
        <span className="font-bold uppercase tracking-[0.06em] text-[var(--cp-red-hi)]">{t('tallow_title')}</span>
        <span className="text-[var(--cp-muted)] truncate" title={text}>
          {text}
        </span>
      </div>

      {status.phase === 'downloading' && (
        <div className="h-1.5 w-full bg-black/40 rounded overflow-hidden">
          <div className="h-full bg-[var(--cp-red)] transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      )}

      {status.phase === 'needs-token' && (
        <div className="space-y-2">
          <p className="leading-snug text-[var(--cp-muted)]">{t('tallow_tokenHelp')}</p>
          <div className="flex gap-2">
            <div className="cp-frame flex-1 min-w-0">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitToken()}
                autoComplete="off"
                spellCheck={false}
                placeholder={t('tallow_tokenPlaceholder')}
                className="cp-input w-full px-3 py-2 text-[14px] cp-mono select-text"
              />
            </div>
            <button type="button" onClick={submitToken} disabled={sending || !token.trim()} className="cp-frame cp-btn-ghost flex items-center gap-1.5 px-3 text-[13px] shrink-0">
              {sending ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />} {t('tallow_tokenSubmit')}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {(status.phase === 'error' || status.phase === 'stopped' || status.phase === 'idle') && (
          <button type="button" onClick={() => window.api.tallow.start().then(setStatus)} className="cp-frame cp-btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-[12px]">
            <RotateCcw size={12} /> {t('tallow_retry')}
          </button>
        )}
        <button type="button" onClick={() => window.api.tallow.openDataFolder()} className="cp-plain flex items-center gap-1 text-[12px] text-[var(--cp-muted)] hover:text-[var(--cp-red)] underline cursor-pointer">
          <FolderOpen size={12} /> {t('tallow_openData')}
        </button>
        {!compact && (
          <button type="button" onClick={() => window.api.tallow.forget()} className="cp-plain flex items-center gap-1 text-[12px] text-[var(--cp-muted)] hover:text-[var(--cp-red)] underline cursor-pointer">
            <Trash2 size={12} /> {t('tallow_forget')}
          </button>
        )}
      </div>
      {!compact && <p className="text-[12px] leading-snug text-[var(--cp-muted)]">{t('tallow_note')}</p>}
    </div>
  )
}
