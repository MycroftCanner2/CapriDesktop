import React, { useState, useEffect } from 'react'
import { CapriCommandCenter } from './CapriCommandCenter'
import { CodeEditorView } from './CodeEditorView'
import { AgentSettingsModal } from './AgentSettingsModal'
import { VoiceSettingsModal } from '../companion/VoiceSettingsModal'
import { LanguageSettingsModal } from './LanguageSettingsModal'
import { useCompanionStore } from '../stores/useCompanionStore'
import { useAgentStore } from '../stores/useAgentStore'
import { useT } from '../utils/useUiLang'
import {
  Minus,
  X,
  Settings,
  Cpu,
  MessageSquare,
  Code2,
  FolderGit2,
  FolderOpen,
  Volume2,
  VolumeX,
  Sliders,
  Languages
} from 'lucide-react'

type DeckTab = 'chat' | 'editor'

const TALLOW_OPTION = 'Tallow (local crow)'

export const DevDeckView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DeckTab>('chat')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false)
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false)
  const { setEmotion, setSpeech } = useCompanionStore()
  const t = useT()
  const [cloudModel, setCloudModel] = useState<string | null>(null)
  // Tallow (the local crow) is the default brain: shown from the first paint, before the settings load
  const [brainProvider, setBrainProvider] = useState<'tallow' | 'local' | 'cloud'>('tallow')
  const {
    isRunning,
    projectPath,
    setProjectPath,
    llmModel,
    ollamaModels,
    isDevVoiceEnabled,
    setDevVoiceEnabled,
    setLlmConfig,
    setOllamaStatus
  } = useAgentStore()

  // On mount: scan for local Ollama models and ensure Tallow is in eyes mode in Dev Deck
  useEffect(() => {
    if (window.api) {
      window.api.agent.detectOllama().then((res) => {
        if (res) setOllamaStatus(res)
      })
    }
  }, [setOllamaStatus])

  // A cloud model is chosen in the settings: the top bar only shows it
  useEffect(() => {
    if (isSettingsOpen) return
    window.api?.agent.getLlmSettings().then((s) => {
      setBrainProvider(s.provider)
      setCloudModel(s.provider === 'cloud' ? s.model : null)
    })
    window.api?.agent.detectOllama().then((res) => res && setOllamaStatus(res))
  }, [isSettingsOpen, setOllamaStatus])

  const handleMinimize = async () => {
    if (window.api) await window.api.window.minimize()
  }

  const handleClose = async () => {
    if (window.api) await window.api.window.close()
  }

  const handleModelChange = (modelName: string) => {
    setLlmConfig({ model: modelName })
    window.api?.agent.setConfig({ model: modelName })
  }

  // Only real, installed Ollama models (plus the current one if it isn't listed yet)
  const currentModel = llmModel
  const modelOptions = Array.from(new Set([...(ollamaModels || []), currentModel].filter(Boolean))).filter(
    (m) => !/llava|vision|-vl\b/i.test(m) || m === currentModel
  )

  return (
    <div className="cp-vars cp-root w-screen h-screen flex flex-col bg-[#0d0b09] text-stone-200 border border-[#2f2923] overflow-hidden select-none">
      {/* Top bar */}
      <div
        className="h-10 bg-[#13110e] border-b border-[#29241f] flex items-center justify-between px-3 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: App title, status, and Project/Repo selector */}
        <div className="flex items-center gap-2 text-[14px]">
          <span
            className={`w-2 h-2 rounded-none ${
              isRunning ? 'bg-yellow-400 animate-ping' : 'bg-cyan-400'
            }`}
          />
          <span className="cp-title text-[16px] text-cp-500">Tallow</span>
          <span className="cp-label">// dev</span>
          
          {/* Clickable Project / Repository Selector */}
          <button
            onClick={async () => {
              if (window.api) {
                const dir = await window.api.system.selectDirectory()
                if (dir) {
                  setProjectPath(dir)
                  setSpeech(`⚙ Workspace: ${dir.split(/[\\/]/).filter(Boolean).pop()}`, 3000)
                }
              }
            }}
            className="cp-cut flex items-center gap-1.5 px-2 py-0.5 rounded-none bg-[#211d18] hover:bg-[#302a24] border border-[#3c352d] text-[13px] text-stone-300 hover:text-white transition-all cursor-pointer group"
            title={t('deck_workspaceTitle', { path: projectPath || t('deck_noFolderSel') })}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <FolderGit2 size={12} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="truncate max-w-[160px] cp-mono text-[12px] text-stone-200">
              {projectPath ? (projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath) : t('deck_selectRepo')}
            </span>
            <FolderOpen size={10} className="text-cp-400 opacity-70 group-hover:opacity-100" />
          </button>
        </div>

        {/* Center: Developer Mode only has Code Editor and Chat */}
        <div
          className="flex items-center gap-1 bg-[#1c1814] p-0.5 rounded-none border border-[#332c25]"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => setActiveTab('chat')}
            className={`cp-cut flex items-center gap-1.5 px-3 py-1 rounded-none text-[14px] transition-colors ${
              activeTab === 'chat'
                ? 'bg-[#332c25] text-white font-semibold border border-[#52493e]'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title={t('deck_tabChatTitle')}
          >
            <MessageSquare size={13} className={activeTab === 'chat' ? 'text-cp-400' : 'text-stone-400'} />
            <span>{t('deck_tabChat')}</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('editor')
            }}
            className={`cp-cut flex items-center gap-1.5 px-3 py-1 rounded-none text-[14px] transition-colors ${
              activeTab === 'editor'
                ? 'bg-[#332c25] text-white font-semibold border border-[#52493e]'
                : 'text-stone-400 hover:text-stone-200'
            }`}
            title={t('deck_tabEditor')}
          >
            <Code2 size={13} className={activeTab === 'editor' ? 'text-cyan-400' : 'text-stone-400'} />
            <span>{t('deck_tabEditor')}</span>
          </button>
        </div>

        {/* Right: Local Model Selector, Engine Selector & Window Controls */}
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {/* Local Model Selector */}
          <div
            className="flex items-center gap-1.5 bg-[#1c1814] border border-[#332c25] rounded-none px-2 py-0.5 text-[14px] text-stone-300"
            title={t('deck_modelTitle')}
          >
            <Cpu size={12} className="text-cyan-400" />
            <span className="text-stone-500 text-[12px] uppercase">{t('deck_model')}:</span>
            <select
              value={brainProvider === 'tallow' ? TALLOW_OPTION : cloudModel || currentModel}
              disabled={brainProvider !== 'local'}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-[#1c1814] text-stone-100 font-semibold text-[14px] outline-none cursor-pointer max-w-[180px] truncate"
              style={{ colorScheme: 'dark' }}
            >
              {(brainProvider === 'tallow' ? [TALLOW_OPTION] : cloudModel ? [cloudModel] : modelOptions).map((m) => (
                <option key={m} value={m} className="bg-[#13110e] text-stone-200">
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* LLM settings */}
          <div className="flex items-center gap-1 bg-[#1c1814] border border-[#332c25] rounded-none px-2 py-0.5 text-[14px] text-stone-300">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-0.5 text-stone-400 hover:text-stone-100 transition-colors ml-1"
              title={t('deck_settingsTitle')}
            >
              <Settings size={12} />
            </button>
          </div>

          {/* Language Settings Button */}
          <button
            type="button"
            onClick={() => setIsLanguageModalOpen(true)}
            className="cp-cut flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[14px] font-semibold border border-[#332c25] bg-[#1c1814] text-stone-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all cursor-pointer"
            title={t('deck_languageTitle')}
          >
            <Languages size={12} className="text-cyan-400" />
            <span className="text-[12px] uppercase font-bold text-stone-300">{t('deck_language')}</span>
          </button>

          {/* Voice Engine Settings Button */}
          <button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            className="cp-cut flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[14px] font-semibold border border-[#332c25] bg-[#1c1814] text-stone-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all cursor-pointer"
            title={t('deck_voiceConfigTitle')}
          >
            <Sliders size={12} className="text-cyan-400" />
            <span className="text-[12px] uppercase font-bold text-stone-300">{t('deck_voiceConfig')}</span>
          </button>

          {/* User Option: Tallow Voice in Dev Mode */}
          <button
            type="button"
            onClick={() => setDevVoiceEnabled(!isDevVoiceEnabled)}
            className={`cp-cut flex items-center gap-1.5 px-2 py-0.5 rounded-none text-[14px] font-semibold border transition-all cursor-pointer ${
              isDevVoiceEnabled
                ? 'bg-[#e0af67]/20 border-[#e0af67] text-cp-300'
                : 'bg-[#1c1814] border-[#332c25] text-stone-500 hover:text-stone-300'
            }`}
            title={isDevVoiceEnabled ? t('deck_voiceOnTitle') : t('deck_voiceOffTitle')}
          >
            {isDevVoiceEnabled ? (
              <>
                <Volume2 size={12} className="text-[#e0af67] animate-pulse" />
                <span className="text-[12px] uppercase font-bold text-cp-200">{t('deck_voiceOn')}</span>
              </>
            ) : (
              <>
                <VolumeX size={12} className="text-stone-500" />
                <span className="text-[12px] uppercase text-stone-500">{t('deck_voiceOff')}</span>
              </>
            )}
          </button>

          <button
            onClick={handleMinimize}
            className="p-1 text-stone-400 hover:text-white hover:bg-stone-800 rounded-none transition-colors"
            title={t('deck_minimize')}
          >
            <Minus size={13} />
          </button>

          <button
            onClick={handleClose}
            className="p-1 text-stone-400 hover:text-red-400 hover:bg-red-950/40 rounded-none transition-colors"
            title={t('close')}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Main Workspace Panels (Only Code Editor and Full-Screen Chat) */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'chat' && <CapriCommandCenter />}
        {activeTab === 'editor' && <CodeEditorView />}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <AgentSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}

      <LanguageSettingsModal isOpen={isLanguageModalOpen} onClose={() => setIsLanguageModalOpen(false)} />

      {/* Voice TTS Settings Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </div>
  )
}
