/**
 * What happens around Tallow, given to his model the way the proof of concept does it
 * (app/crow_companion/window.py, observe.py). He has no preset lines: these are only *actions*,
 * and whatever he answers is his own.
 *  - The first time his server is ready with no past conversation: "*sits down nearby, not too close*".
 *    With a past conversation, his last line is shown again, silently.
 *  - Now and then he glances at the window the user is in and gets a crow-world description of it.
 */
import { agentManager } from '../agents/agent-manager'
import { IPC_CHANNELS } from '../ipc/channels'
import { isTallowMode } from '../services/llm-gateway'
import { activeWindowService } from '../services/active-window-service'
import { windowManager } from '../windows/window-manager'
import { splitMoodTag } from './text'
import { tallowService } from './tallow-service'

const SENSITIVE = ['keepass', 'bitwarden', '1password', 'password', 'credential', 'consent.exe', 'lockapp']

/** Same scenes as the PoC, with the Windows process names added */
const SCENES: [string[], string][] = [
  [['steam', 'epicgames', 'heroic', 'lutris', 'gamescope', 'battle.net', 'riotclient', 'leagueclient'], '*the human is playing a game on the glowing box*'],
  [['windowsterminal', 'powershell', 'pwsh', 'cmd', 'konsole', 'kitty', 'alacritty', 'wezterm', 'ptyxis', 'ghostty'], '*the human pecks at a dark window full of little marks*'],
  [['code', 'codium', 'cursor', 'notepad', 'devenv', 'idea', 'kate', 'nvim', 'emacs'], '*the human stares at rows of tiny marks and pecks them*'],
  [['firefox', 'chrome', 'msedge', 'chromium', 'brave', 'opera', 'vivaldi', 'librewolf'], '*the human stares into a bright window*'],
  [['vlc', 'mpv', 'spotify', 'wmplayer', 'music.ui', 'video.ui', 'haruna'], '*sounds and moving pictures come from the glowing box*'],
  [['discord', 'telegram', 'signal', 'element', 'teams', 'slack', 'whatsapp', 'zoom'], '*the human is talking to someone far away*'],
  [['explorer', 'dolphin', 'nautilus', 'thunar'], '*the human is rummaging through piles of things*'],
  [['systemsettings', 'systemsettingsadminflows', 'control', 'mmc'], '*the human is poking at the walls of the room*']
]

const GLANCE_MS = 10_000
/** Don't talk over someone who just typed, and don't narrate every flicker */
const QUIET_AFTER_USER_MS = 60_000
const MIN_BETWEEN_GLANCES_MS = 120_000

function describe(title: string, proc: string): string | null {
  const blob = `${proc} ${title}`.toLowerCase()
  if (!blob.trim() || /crow ?companion/.test(blob) || SENSITIVE.some((w) => blob.includes(w))) return null
  const name = proc.toLowerCase().replace(/\.exe$/, '')
  for (const [needles, action] of SCENES) if (needles.some((n) => name === n || name.startsWith(n))) return action
  return '*the human is busy at the glowing box*'
}

class TallowPresence {
  private booted = false
  private timer: NodeJS.Timeout | null = null
  private sawKey = ''
  private lastScene = ''
  private lastGlanceAt = 0

  start(): void {
    tallowService.on('status', (s: { phase: string }) => {
      if (s.phase === 'ready' && !this.booted) {
        this.booted = true
        setTimeout(() => this.boot(), 1200)
      }
    })
    this.timer = setInterval(() => void this.glance(), GLANCE_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private boot(): void {
    if (!isTallowMode()) return
    const last = tallowService.lastLine()
    if (!last) {
      agentManager.tallowStimulus('*sits down nearby, not too close*')
      return
    }
    // His own earlier words, from the model: shown again without voice
    const text = splitMoodTag(last).rest || last
    windowManager.broadcast(IPC_CHANNELS.COMPANION_SPEECH_CHANGED, { text, durationMs: 6000, speakVoice: false, fromModel: true })
  }

  private async glance(): Promise<void> {
    if (!this.booted || !isTallowMode() || !tallowService.isReady()) return
    if (windowManager.isGamingModeActive() || agentManager.getStatus().isRunning) return
    const win = await activeWindowService.getActiveOrTopWindow().catch(() => null)
    if (!win) return
    const key = (win.process || win.title || '').toLowerCase()
    if (!key || key === this.sawKey) return
    this.sawKey = key
    const action = describe(win.title || '', win.process || '')
    if (!action || action === this.lastScene) return
    const now = Date.now()
    if (now - agentManager.lastUserPromptAt < QUIET_AFTER_USER_MS || now - this.lastGlanceAt < MIN_BETWEEN_GLANCES_MS) return
    this.lastScene = action
    this.lastGlanceAt = now
    agentManager.tallowStimulus(action)
  }
}

export const tallowPresence = new TallowPresence()
