import { scriptPlayer } from '../services/script/script-player'
import { getLlmSettings, isTallowMode, usesOllama } from '../services/llm-gateway'
import { personalize } from '../services/user-profile'
import { consciousnessService } from '../services/consciousness-service'
import { localizeLine } from '../../shared/lines'
import { EventEmitter } from 'events'
import { CapriLocalAgent } from './capri-local-agent'
import {
  AgentEventPayload,
  AgentMode,
  AgentConfigPayload,
  CompanionEmotionState,
  IPC_CHANNELS
} from '../ipc/channels'
import { windowManager } from '../windows/window-manager'
import { ollamaService } from '../services/ollama-service'
import { roamingManager } from '../roaming/roaming-manager'
import { activeWindowService } from '../services/active-window-service'
import { hasPendingResult, openPendingResult } from '../services/pending-result'

/** Dev Mode tasks shorter than this finish quietly instead of popping Tallow up with the wake-up line */
const DEV_WAKEUP_MIN_MS = 20000

export class AgentManager extends EventEmitter {
  /** Tallow's own local agent is the only engine */
  private capriLocal = new CapriLocalAgent()

  private currentCompanionState: CompanionEmotionState = 'standing'
  private isRunning = false
  private isClosedActionActive = false
  private activePromptSource: 'pet' | 'editor' = 'editor'
  /** A Dev Mode task is in progress (its end triggers the wake-up even if the user did something else) */
  private devTaskRunning = false
  private devTaskStartedAt = 0
  private devTaskErrored = false
  private devTaskCancelled = false

  private config: AgentConfigPayload = {
    mode: 'capri-local',
    endpoint: 'http://localhost:11434/v1',
    model: 'capri',
    apiKey: ''
  }

  constructor() {
    super()
    this.setupListeners(this.capriLocal)
  }

  private setupListeners(adapter: EventEmitter): void {
    adapter.on('event', (event: AgentEventPayload) => {
      this.handleAgentEvent(event)
    })
  }

  private handleAgentEvent(event: AgentEventPayload): void {
    // Attach prompt source ('pet' vs 'editor')
    event.source = this.activePromptSource
    // Fill the {name} placeholder with how the user wants to be called
    if (event.text) event.text = personalize(event.text)
    if (event.error) event.error = personalize(event.error)

    // Broadcast agent event to Dev Deck and Companion
    windowManager.broadcast(IPC_CHANNELS.AGENT_EVENT, event)

    // In Editor mode, check if task is finished and if user switched away to another app
    if (this.activePromptSource === 'editor') {
      if (event.type === 'session.started') this.isRunning = true
      if (event.type === 'session.finished' || event.type === 'session.error') {
        this.isRunning = false
        if (this.devTaskRunning) {
          // The wake-up is decided only when the Dev Mode prompt itself returns (sendPrompt),
          // never by whatever session happens to finish here
          if (event.type === 'session.error') this.devTaskErrored = true
        } else {
          openPendingResult()
        }
      }
      return
    }

    // Pet mode: the user is already looking at Tallow, open the result right away
    if (event.type === 'session.finished' || event.type === 'session.error') openPendingResult()

    // Automate Tallow emotion transitions only for Pet mode (Do not overwrite assistant speech with canned quotes!):
    switch (event.type) {
      case 'session.started':
        this.isRunning = true
        break

      case 'tool.started':
        this.setCompanionState('curious')
        break

      case 'tool.finished':
        if (event.toolName === 'close_application' || event.toolName === 'delete_path') {
          this.isClosedActionActive = true
          this.setCompanionState('closed')
          setTimeout(() => {
            this.isClosedActionActive = false
            if (!this.isRunning) {
              this.setCompanionState('standing')
            }
          }, 2000)
        }
        break

      case 'permission.requested':
        this.setCompanionState('curious')
        break

      case 'session.finished':
        this.isRunning = false
        if (this.isClosedActionActive) {
          // Keep 'closed' avatar active for the requested 2 seconds
          break
        }
        if (!roamingManager.isEyeModeActive()) {
          if (roamingManager.getStatus().isTabMode) {
            this.setCompanionState('idle')
          }
        }
        break

      case 'session.error':
        this.isRunning = false
        this.setCompanionState('sleep')
        setTimeout(() => {
          if (!this.isRunning) {
            this.setCompanionState('standing')
          }
        }, 4000)
        break
    }
  }

  /** If a Dev Mode task finishes while the user is in another window, Tallow pops up to tell them. */
  private async handleDevTaskFinishedWakeup(): Promise<void> {
    // Telling a player to get back to work would also steal focus from the game
    if (windowManager.isGamingModeActive()) return

    const deckWin = windowManager.getDeckWindow()
    const isDeckOpen = deckWin && !deckWin.isDestroyed() && deckWin.isVisible()
    const isDeckUnfocused = !isDeckOpen || !deckWin.isFocused() || deckWin.isMinimized()

    if (!isDeckUnfocused) {
      // User is actively focused on Tallow's dev deck window. She remains in the editor.
      openPendingResult()
      return
    }

    try {
      // Detect the user's active/top window before switching window focus.
      // Any finished result (e.g. the new landing page) is still unopened at this point,
      // so the phrase names what the user was really doing.
      const activeApp = await activeWindowService.getActiveOrTopWindow()
      const hasResult = hasPendingResult()
      const wakeupPhrase = activeWindowService.generateWakeupPhrase(activeApp, hasResult)

      // Leave dev mode and restore desktop companion
      windowManager.hideDeck()

      // Make Tallow appear right in front of everything on screen
      const companionWin = windowManager.getCompanionWindow()
      if (companionWin && !companionWin.isDestroyed()) {
        companionWin.show()
        companionWin.setAlwaysOnTop(true, 'screen-saver')
        companionWin.moveTop()
        companionWin.focus()
      }

      // No preset wake-up line: what he does about it comes from his model
      void wakeupPhrase
      setTimeout(() => this.tallowStimulus('*the long job on the screen finally finishes*'), 250)

      // Only after she has told the user to drop what they're doing, open the result
      if (hasResult) setTimeout(() => openPendingResult(), 4500)
    } catch (err) {
      console.warn('[AgentManager] handleDevTaskFinishedWakeup error:', err)
      openPendingResult()
    }
  }

  public getCompanionState(): CompanionEmotionState {
    return this.currentCompanionState
  }

  public setCompanionState(state: CompanionEmotionState): void {
    if (windowManager.isGamingModeActive() && (state === 'standing' || state === 'walking' || state === 'idle')) {
      state = 'ojos'
    }
    this.currentCompanionState = state
    if (state === 'ojos') {
      roamingManager.setEyeMode(true)
    } else if (state === 'standing' || state === 'walking' || state === 'idle') {
      if (roamingManager.isEyeModeActive()) {
        roamingManager.setEyeMode(false)
      }
    }
    windowManager.broadcast(IPC_CHANNELS.COMPANION_STATE_CHANGED, state)
  }

  /** `why` is what led her to say it, so she can answer if she's asked about it later */
  public setCompanionSpeech(text: string, durationMs = 4000, speakVoice = false, why?: string): void {
    if (scriptPlayer.isPlaying()) return
    const line = personalize(localizeLine(text, consciousnessService.getPreferredLanguage()))
    this.capriLocal.noteOwnLine(line, why)
    windowManager.broadcast(IPC_CHANNELS.COMPANION_SPEECH_CHANGED, { text: line, durationMs, speakVoice })
  }

  public getConfig(): AgentConfigPayload {
    return { ...this.config }
  }

  public setConfig(newConfig: Partial<AgentConfigPayload>): AgentConfigPayload {
    this.config = { ...this.config, ...newConfig, mode: 'capri-local' }
    return { ...this.config }
  }

  public async detectOllama(): Promise<{ running: boolean; models: string[] }> {
    if (isTallowMode()) return { running: true, models: ['tallow'] }
    if (!usesOllama()) return { running: true, models: [getLlmSettings().model] }
    return await ollamaService.ensureRunning()
  }

  public clearHistory(): void {
    this.capriLocal.clearHistory()
  }

  public async sendPrompt(
    prompt: string,
    projectPath: string,
    _mode?: AgentMode,
    source: 'pet' | 'editor' = 'editor'
  ): Promise<void> {
    // A desktop prompt that arrives while a Dev Mode task is still running must not relabel
    // that task: otherwise its end was treated as a desktop answer, the result opened right
    // away and the "sleepy head" wake-up never happened
    const isDevTask = source === 'editor'
    if (!this.stimulusRunning) this.lastUserPromptAt = Date.now()
    if (isDevTask) {
      this.devTaskRunning = true
      this.devTaskStartedAt = Date.now()
      this.devTaskErrored = false
      this.devTaskCancelled = false
    }
    if (isDevTask || !this.devTaskRunning) this.activePromptSource = source
    this.isRunning = true
    try {
      await this.capriLocal.runPrompt(prompt, projectPath, {
        provider: 'local-llm',
        endpoint: this.config.endpoint,
        model: this.config.model,
        apiKey: this.config.apiKey
      })
    } finally {
      this.isRunning = false
      // Desktop prompts never wake the user up: only the end of a prompt sent from Dev Mode,
      // decided here when that very prompt returns (some agent paths emit no session.finished)
      if (isDevTask) {
        this.devTaskRunning = false
        // Quick answers don't need it: the wake-up is for long jobs the user walked away from
        const tookLong = Date.now() - this.devTaskStartedAt >= DEV_WAKEUP_MIN_MS
        if (tookLong && !this.devTaskErrored && !this.devTaskCancelled) {
          void this.handleDevTaskFinishedWakeup()
        } else {
          openPendingResult()
        }
      }
    }
  }

  /**
   * Something that happens around Tallow ("*sits down nearby, not too close*", "*the human stares
   * into a bright window*"). It goes to his model like a typed action; whatever he does is his own.
   * Skipped while he is already answering, and outside Tallow mode.
   */
  public tallowStimulus(action: string): void {
    if (!isTallowMode() || this.isRunning || this.stimulusRunning) return
    this.stimulusRunning = true
    this.sendPrompt(action, '', undefined, 'pet')
      .catch(() => {})
      .finally(() => {
        this.stimulusRunning = false
        this.isRunning = false
      })
  }
  private stimulusRunning = false
  /** When the user last typed, said or did something to him (not his own glances) */
  public lastUserPromptAt = 0

  /** Kept for the IPC contract: Tallow's local agent never asks for tool permissions */
  public respondPermission(_requestId: string, _approved: boolean): void {}

  public cancel(): void {
    this.isRunning = false
    if (this.devTaskRunning) this.devTaskCancelled = true
    this.capriLocal.cancel()
    this.setCompanionState('idle')
  }

  public getStatus(): { isRunning: boolean; mode: string } {
    return {
      isRunning: this.isRunning,
      mode: 'capri-local'
    }
  }
}

export const agentManager = new AgentManager()
