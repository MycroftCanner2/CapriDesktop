import React, { useState } from 'react'
import { renderEmotes } from '../utils/emotes'
import { useCompanionStore } from '../stores/useCompanionStore'
import { useAgentStore } from '../stores/useAgentStore'
import { AgentChat } from './AgentChat'
import { useT } from '../utils/useUiLang'
import { Eye, Sliders, MessageSquarePlus } from 'lucide-react'
import capri2Webp from '../assets/crow/capri2/capri2.webp'
import ojosGif from '../assets/crow/ojos/ojos.gif'
import ojosWebp from '../assets/crow/ojos/ojos.webp'

export const CapriCommandCenter: React.FC = () => {
  const t = useT()
  const { emotion, speech, setEmotion } = useCompanionStore()
  const { isRunning, resetChat } = useAgentStore()
  const [bgDimLevel, setBgDimLevel] = useState<'low' | 'medium' | 'high'>('medium')


  // Calculate overlay opacity based on user setting
  const overlayClass = {
    low: 'bg-black/30', // Very transparent: eyes pop out vividly
    medium: 'bg-black/55', // Balanced: clear eyes + high text contrast
    high: 'bg-black/75' // Darker: subtle eyes in background
  }[bgDimLevel]

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      {/* =========================================================================
          BACKGROUND LAYER: TALLOW FULL-SCREEN VISION FEED (OJOS2 / CAPRI2)
         ========================================================================= */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden bg-black pointer-events-none select-none">
        {/* Tallow's close-up stare (or a wing flap when he is excited) */}
        <img
          key={emotion === 'capri2' ? 'crow-flap' : 'crow-stare'}
          src={emotion === 'capri2' ? capri2Webp : ojosWebp || ojosGif}
          alt="Tallow"
          draggable={false}
          className="w-full h-full object-contain object-center transition-opacity duration-500"
          onLoad={() => {
            if (emotion === 'capri2') {
              window.setTimeout(() => {
                setEmotion('ojos')
                if (window.api) window.api.companion.setState('ojos')
              }, 2600)
            }
          }}
        />

        {/* Cyberpunk Scanlines & Vignette */}
        <div className={`absolute inset-0 transition-colors duration-300 ${overlayClass}`} />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(0, 0, 0,0.8)_95%)]" />
      </div>

      {/* =========================================================================
          FOREGROUND LAYER: NETWATCH / CROW SEMI-TRANSPARENT TERMINAL
         ========================================================================= */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {/* Netwatch Style Top Sub-Bar */}
        <div className="h-8 bg-black/60 border-b border-[#29241f] px-3 flex items-center justify-between text-[13px] text-stone-300 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-none ${
                emotion === 'capri2'
                  ? 'bg-yellow-400 animate-ping'
                  : isRunning
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-cyan-400'
              }`}
            />
            <span className="text-stone-200 font-semibold tracking-wide flex items-center gap-1.5">
              <Eye size={12} className="text-cyan-400" />
              <span>TALLOW</span>
              <span className="text-stone-500 font-normal">{isRunning ? t('cc_working') : t('cc_online')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-stone-400">
            <button
              onClick={resetChat}
              disabled={isRunning}
              className="flex items-center gap-1 bg-[#1a1713]/80 border border-[#332c25] rounded-none px-1.5 py-0.5 text-stone-300 hover:text-white hover:border-cp-500/50 disabled:opacity-40 cursor-pointer"
              title={t('cc_newChatTitle')}
            >
              <MessageSquarePlus size={11} />
              <span className="text-[11px]">{t('cc_newChat')}</span>
            </button>
            {/* Opacity Control for terminal transparency */}
            <div className="flex items-center gap-1 bg-[#1a1713]/80 border border-[#332c25] rounded-none px-1.5 py-0.5">
              <Sliders size={10} className="text-stone-400" />
              <span className="text-stone-500 text-[11px]">{t('cc_backdrop')}:</span>
              <button
                onClick={() => setBgDimLevel('low')}
                className={`px-1.5 py-0.2 rounded-none text-[11px] transition-colors ${
                  bgDimLevel === 'low'
                    ? 'bg-cp-600/40 text-cp-300 font-bold border border-cp-500/50'
                    : 'text-stone-400 hover:text-white'
                }`}
                title={t('cc_light')}
              >
                {t('cc_light')}
              </button>
              <button
                onClick={() => setBgDimLevel('medium')}
                className={`px-1.5 py-0.2 rounded-none text-[11px] transition-colors ${
                  bgDimLevel === 'medium'
                    ? 'bg-cp-600/40 text-cp-300 font-bold border border-cp-500/50'
                    : 'text-stone-400 hover:text-white'
                }`}
                title={t('cc_medium')}
              >
                {t('cc_medium')}
              </button>
              <button
                onClick={() => setBgDimLevel('high')}
                className={`px-1.5 py-0.2 rounded-none text-[11px] transition-colors ${
                  bgDimLevel === 'high'
                    ? 'bg-cp-600/40 text-cp-300 font-bold border border-cp-500/50'
                    : 'text-stone-400 hover:text-white'
                }`}
                title={t('cc_dark')}
              >
                {t('cc_dark')}
              </button>
            </div>
          </div>
        </div>

        {/* Live Speech / Subtitle Line */}
        <div className="bg-black/40 border-b border-[#29241f]/70 px-3 py-1 flex items-center justify-between text-[14px] backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 text-stone-300 truncate max-w-[80%]">
            <span className="text-cp-400 font-bold text-[14px]">&gt;</span>
            <span className="text-[13px] truncate">
              {(speech && renderEmotes(speech)) ||
                (emotion === 'capri2'
                  ? t('cc_lineDone')
                  : isRunning
                  ? t('cc_lineWorking')
                  : t('cc_lineIdle'))}
            </span>
          </div>

        </div>

        {/* Full-Screen Semi-Transparent Chat Terminal over Tallow's Eyes */}
        <div className="flex-1 w-full h-full flex flex-col overflow-hidden">
          <AgentChat transparent={true} />
        </div>
      </div>
    </div>
  )
}
