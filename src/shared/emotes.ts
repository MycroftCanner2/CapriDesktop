/**
 * Tallow talks in *emotes* ("*lands on the fence* kaw."), like the proof of concept: the screen shows
 * them in italics, a voice never reads them. Mood tags ("[caution min]") only drive the animation, and
 * caws are played as sound effects, never spoken. Used by the renderer and by the main-process TTS.
 */

/** Tallow's mood tag (same moods as src/main/tallow/text.ts) */
export const MOOD_TAG_RE = /\[(?:calm|curiosity|caution|joy|play|love|sadness|anger)\s+(?:min|max)\]/gi
export const EMOTE_RE = /\*([^*\n]+)\*/g
const CAW_RE = /\b(?:k+a+w+|krr+r*(?:-?tk)*|tk(?:-tk)+|mmrr+r*\.*)\b/gi

/** What may be shown: the mood tag removed, everything else kept */
export function visibleText(text: string): string {
  return (text || '').replace(MOOD_TAG_RE, ' ').replace(/[ \t]+/g, ' ').trim()
}

/**
 * The part of a line a voice may say: no mood tags, no *emotes* (also an unclosed one), no caws.
 * Empty when the line is only actions and sounds, which is most of what Tallow says.
 */
export function spokenText(text: string | null | undefined): string {
  let s = (text || '').replace(MOOD_TAG_RE, ' ')
  s = s.replace(EMOTE_RE, ' ')
  s = s.replace(/\*[^*]*$/g, ' ').replace(/\*/g, ' ')
  s = s.replace(CAW_RE, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  // Only punctuation left ("kaw." -> ".")
  if (!/[\p{L}\p{N}]/u.test(s)) return ''
  return s.replace(/^[\s.,;:!?-]+/, '').trim()
}
