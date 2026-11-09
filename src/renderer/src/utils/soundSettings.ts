/** His volumes. Read every time a sound plays, so a change applies at once in every window. */

function read(key: string, fallback: number): number {
  try {
    const value = parseFloat(localStorage.getItem(key) ?? '')
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

/** The slider values, whatever the mute state */
export const rawVoiceVolume = (): number => read('capri.voiceVolume', 1)
export const rawEffectsVolume = (): number => read('capri.effectsVolume', 1)

export const voiceVolume = (): number => (allMuted() ? 0 : read('capri.voiceVolume', 1))
export const setVoiceVolume = (value: number): void => write('capri.voiceVolume', String(value))

/**
 * The mute toggle (speaker button / hotkey) silences every sound: voice, caws, wing flaps, alarm
 * caws, the dialogue blip and voice tests. localStorage is shared by all windows, so the deck and
 * the companion agree at once.
 */
export const MUTE_KEY = 'capri_voice_muted'
export const allMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

export const effectsVolume = (): number => (allMuted() ? 0 : read('capri.effectsVolume', 1))
export const setEffectsVolume = (value: number): void => write('capri.effectsVolume', String(value))

/** The wing-flap and alarm caws when he changes animation (off while muted) */
export const glitchSoundOn = (): boolean => {
  try {
    return !allMuted() && localStorage.getItem('capri.glitchSound') !== '0'
  } catch {
    return true
  }
}
export const setGlitchSoundOn = (on: boolean): void => write('capri.glitchSound', on ? '1' : '0')
