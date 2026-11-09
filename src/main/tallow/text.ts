/**
 * Tokenizer text tricks from digi-the-robot/Tallow (Apache-2.0), ported from tallow.py and the
 * Crow Companion proof of concept (app/crow_companion/text.py).
 *
 * His SentencePiece file does not know these. tallow.py applies them before encode: a <nl> token
 * for line breaks, and a space after every opening '*' or '['. llama.cpp would otherwise feed him
 * text he was never trained on, so the app applies the same two tricks and sends token ids.
 */

export const NL = '<nl>'

export const MOODS = ['calm', 'curiosity', 'caution', 'joy', 'play', 'love', 'sadness', 'anger'] as const
export type TallowMood = (typeof MOODS)[number]
export type TallowLevel = 'min' | 'max'
export type TallowAction = 'idle' | 'hop' | 'lean' | 'droop' | 'peer' | 'love' | 'fluff' | 'alarm'
export type TallowSound = 'alarm' | 'rattle' | 'mumble' | 'kaw'

const MOOD_RE = /\[(calm|curiosity|caution|joy|play|love|sadness|anger)\s+(min|max)\]/i

/** Python's str.isspace() for the characters that can appear here */
const isSpace = (ch: string | undefined): boolean =>
  ch !== undefined && ((/^\s$/u.test(ch) && ch !== '\ufeff') || /^[\x1c-\x1f\x85]$/.test(ch))

/** Splits like Python's str.split('\n') */
const lines = (text: string): string[] => text.split('\n')

/** Iterates code points (Python indexes code points, JS strings index UTF-16 units) */
const chars = (s: string): string[] => Array.from(s)

/** Line breaks -> <nl>; a space after every OPENING '*' (1st, 3rd... on a line) and every '[' */
export function toSp(text: string): string {
  const out: string[] = []
  for (const line of lines(text)) {
    const cs = chars(line)
    let stars = 0
    let buf = ''
    cs.forEach((ch, i) => {
      buf += ch
      if (ch === '*') stars++
      const opener = ch === '[' || (ch === '*' && stars % 2 === 1)
      if (opener && i + 1 < cs.length && !isSpace(cs[i + 1])) buf += ' '
    })
    out.push(buf)
  }
  return out.join(NL + ' ')
}

export function fromSp(text: string): string {
  const joined = text.split(NL + ' ').join('\n').split(NL).join('\n')
  const out: string[] = []
  for (const line of lines(joined)) {
    const cs = chars(line)
    let stars = 0
    let skip = false
    let buf = ''
    cs.forEach((ch, i) => {
      if (skip) {
        skip = false
        return
      }
      buf += ch
      if (ch === '*') stars++
      const opener = ch === '[' || (ch === '*' && stars % 2 === 1)
      if (opener && cs[i + 1] === ' ' && i + 2 < cs.length && !isSpace(cs[i + 2])) skip = true
    })
    out.push(buf)
  }
  return out.join('\n')
}

export interface TallowTurn {
  role: 'user' | 'tallow'
  text: string
}

export interface Encoder {
  encode(text: string): number[]
  pieceId(piece: string): number
}

/** you: ...<nl>tallow: ...<nl>  (the exact format he was trained on) */
export function render(sp: Encoder, history: TallowTurn[]): number[] {
  const nl = sp.pieceId(NL)
  const ids: number[] = []
  for (const turn of history) {
    if (turn.role === 'user') {
      ids.push(...sp.encode(toSp(`you: ${turn.text}`)), nl)
    } else {
      ids.push(...sp.encode(toSp('tallow:')), ...sp.encode(toSp(turn.text)), nl)
    }
  }
  return ids
}

/** Trim the way tallow.py does, then append the bare 'tallow:' cue */
export function promptIds(sp: Encoder, history: TallowTurn[], ctx = 2048, memory = 1900): { ids: number[]; history: TallowTurn[] } {
  let hist = [...history]
  while (hist.length > 1 && render(sp, hist).length > memory) hist = hist.slice(2)
  let ids = [...render(sp, hist), ...sp.encode(toSp('tallow:'))]
  if (ids.length > ctx) ids = ids.slice(-ctx)
  return { ids, history: hist }
}

export function parseMood(line: string): { mood: TallowMood; level: TallowLevel } {
  const m = MOOD_RE.exec(line || '')
  if (!m) return { mood: 'calm', level: 'min' }
  return { mood: m[1].toLowerCase() as TallowMood, level: m[2].toLowerCase() as TallowLevel }
}

export function parseSound(line: string): TallowSound | null {
  if (!line) return null
  if (/KAAW|KAW(?:\s+KAW)+/.test(line)) return 'alarm'
  if (line.includes('krrr') || line.includes('tk-tk')) return 'rattle'
  if (line.toLowerCase().includes('mmrrr')) return 'mumble'
  if (/kaw/i.test(line)) return 'kaw'
  return null
}

export function actionHint(line: string): TallowAction {
  const { mood, level } = parseMood(line)
  const low = (line || '').toLowerCase()
  if (parseSound(line) === 'alarm' || low.includes('dive')) return 'alarm'
  if (mood === 'anger' && level === 'max') return 'fluff'
  if (mood === 'joy' || mood === 'play' || low.includes('hop')) return 'hop'
  if (mood === 'sadness') return 'droop'
  if (mood === 'caution') return 'lean'
  if (mood === 'love') return 'love'
  if (mood === 'curiosity') return 'peer'
  return 'idle'
}

/** Actions only, for an optional spoken reading. Caws are played, not spoken */
export function spokenGloss(line: string): string {
  let text = (line || '').replace(new RegExp(MOOD_RE.source, 'gi'), '')
  text = text.replace(/\*/g, ' ')
  text = text.replace(/\b(k+a+w+|krrr(?:-tk)+|mmrrr\.*)\b/gi, ' ')
  text = text.replace(/\s+/g, ' ')
  return text.replace(/^[ .,-]+|[ .,-]+$/g, '')
}

/** The mood tag, if any, and the rest of the line (actions and sounds) */
export function splitMoodTag(line: string): { tag: string | null; rest: string } {
  const m = MOOD_RE.exec(line || '')
  if (!m) return { tag: null, rest: (line || '').trim() }
  return { tag: m[0], rest: (line.slice(0, m.index) + line.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() }
}

export function selfCheck(): void {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`tallow text self-check failed: ${what}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`)
  }
  eq(toSp('*tosses a peanut*'), '* tosses a peanut*', 'toSp star')
  eq(toSp('[caution min]'), '[ caution min]', 'toSp bracket')
  const sample = '*lands on the fence* *watches the peanut with one eye* kaw.'
  eq(fromSp(toSp(sample)), sample, 'roundtrip')
  eq(fromSp(toSp('line one\nline two')), 'line one\nline two', 'roundtrip lines')
  eq(parseMood('[anger max] *dive-bombs* KAAW'), { mood: 'anger', level: 'max' }, 'mood')
  eq(parseSound('[anger max] KAAW KAAW KAAW'), 'alarm', 'alarm')
  eq(parseSound('kaw.'), 'kaw', 'kaw')
  eq(spokenGloss('[caution min] *lands on the fence* kaw.'), 'lands on the fence', 'gloss')
}
