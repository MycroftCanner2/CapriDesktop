/**
 * Tallow talks in *emotes* ("*lands on the fence* kaw."), like the proof of concept's bubble_html:
 * on screen each *emote* is shown in italics without its asterisks; the TTS voice never reads them.
 * Mood tags ("[caution min]") are for the animation only, and caws are played as sounds, not spoken.
 */
import React from 'react'

import { EMOTE_RE, spokenText, visibleText } from '../../../shared/emotes'

export { spokenText, visibleText }

/** *emotes* as italics, without the asterisks */
export function renderEmotes(text: string | null | undefined): React.ReactNode {
  const shown = visibleText(text || '')
  if (!shown.includes('*')) return shown
  const out: React.ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of shown.matchAll(EMOTE_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push(shown.slice(last, at))
    out.push(
      <em key={key++} className="italic opacity-90">
        {m[1].trim()}
      </em>
    )
    last = at + m[0].length
  }
  if (last < shown.length) out.push(shown.slice(last))
  return out
}
