/**
 * A small SentencePiece BPE encoder for Tallow's tokenizer (tallow_tok.model).
 *
 * Tallow's tokenizer is BPE with byte fallback, an identity normalizer, a dummy "▁" prefix and one
 * user-defined piece (<nl>). This reads the .model protobuf directly and reproduces
 * SentencePieceProcessor.encode() for that configuration, so the desktop app can send llama-server
 * the exact token ids tallow.py would. scripts/crow/check_tokenizer.py fuzzes it against the real
 * sentencepiece library at build time.
 */

const WS = '\u2581'

/** sentencepiece ModelProto.SentencePiece.Type */
export const enum PieceType {
  NORMAL = 1,
  UNKNOWN = 2,
  CONTROL = 3,
  USER_DEFINED = 4,
  UNUSED = 5,
  BYTE = 6
}

export interface Piece {
  piece: string
  score: number
  type: PieceType
}

export interface SpmModel {
  pieces: Piece[]
  addDummyPrefix: boolean
  escapeWhitespaces: boolean
  removeExtraWhitespaces: boolean
  normalizerName: string
  byteFallback: boolean
  modelType: number
  unkId: number
  bosId: number
  eosId: number
  padId: number
}

class Reader {
  pos = 0
  constructor(
    private buf: Uint8Array,
    private end = buf.length
  ) {}
  done(): boolean {
    return this.pos >= this.end
  }
  varint(): number {
    let result = 0
    let shift = 0
    for (;;) {
      if (this.pos >= this.end) throw new Error('truncated varint')
      const b = this.buf[this.pos++]
      result += (b & 0x7f) * 2 ** shift
      if (!(b & 0x80)) return result
      shift += 7
      if (shift > 63) throw new Error('bad varint')
    }
  }
  float(): number {
    const v = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4).getFloat32(0, true)
    this.pos += 4
    return v
  }
  bytes(): Uint8Array {
    const len = this.varint()
    const out = this.buf.subarray(this.pos, this.pos + len)
    this.pos += len
    return out
  }
  skip(wire: number): void {
    if (wire === 0) this.varint()
    else if (wire === 1) this.pos += 8
    else if (wire === 2) {
      // Read the length first: "this.pos += this.varint()" would lose the varint's own bytes
      const len = this.varint()
      this.pos += len
    }
    else if (wire === 5) this.pos += 4
    else throw new Error(`unsupported wire type ${wire}`)
  }
}

const utf8 = new TextDecoder('utf-8')

function parsePiece(buf: Uint8Array): Piece {
  const r = new Reader(buf)
  const p: Piece = { piece: '', score: 0, type: PieceType.NORMAL }
  while (!r.done()) {
    const tag = r.varint()
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (field === 1 && wire === 2) p.piece = utf8.decode(r.bytes())
    else if (field === 2 && wire === 5) p.score = r.float()
    else if (field === 3 && wire === 0) p.type = r.varint() as PieceType
    else r.skip(wire)
  }
  return p
}

/** Parses the fields of ModelProto that encoding needs */
export function parseSpmModel(data: Uint8Array): SpmModel {
  const model: SpmModel = {
    pieces: [],
    addDummyPrefix: true,
    escapeWhitespaces: true,
    removeExtraWhitespaces: true,
    normalizerName: 'nmt_nfkc',
    byteFallback: false,
    modelType: 1,
    unkId: 0,
    bosId: 1,
    eosId: 2,
    padId: -1
  }
  const r = new Reader(data)
  while (!r.done()) {
    const tag = r.varint()
    const field = Math.floor(tag / 8)
    const wire = tag & 7
    if (field === 1 && wire === 2) {
      model.pieces.push(parsePiece(r.bytes()))
    } else if (field === 2 && wire === 2) {
      // TrainerSpec
      const t = new Reader(r.bytes())
      while (!t.done()) {
        const tt = t.varint()
        const f = Math.floor(tt / 8)
        const w = tt & 7
        if (f === 3 && w === 0) model.modelType = t.varint()
        else if (f === 35 && w === 0) model.byteFallback = t.varint() !== 0
        else if (f === 40 && w === 0) model.unkId = t.varint()
        else if (f === 41 && w === 0) model.bosId = toInt32(t.varint())
        else if (f === 42 && w === 0) model.eosId = toInt32(t.varint())
        else if (f === 43 && w === 0) model.padId = toInt32(t.varint())
        else t.skip(w)
      }
    } else if (field === 3 && wire === 2) {
      // NormalizerSpec
      const n = new Reader(r.bytes())
      while (!n.done()) {
        const nt = n.varint()
        const f = Math.floor(nt / 8)
        const w = nt & 7
        if (f === 1 && w === 2) model.normalizerName = utf8.decode(n.bytes())
        else if (f === 3 && w === 0) model.addDummyPrefix = n.varint() !== 0
        else if (f === 4 && w === 0) model.removeExtraWhitespaces = n.varint() !== 0
        else if (f === 5 && w === 0) model.escapeWhitespaces = n.varint() !== 0
        else n.skip(w)
      }
    } else {
      r.skip(wire)
    }
  }
  return model
}

function toInt32(v: number): number {
  // Negative int32 values are sign-extended to 64-bit varints
  return v >= 2 ** 63 ? v - 2 ** 64 : v > 0x7fffffff ? v - 2 ** 32 : v
}

interface Sym {
  piece: string
  prev: number
  next: number
  alive: boolean
}

export class SentencePieceBpe {
  readonly model: SpmModel
  private pieceToId = new Map<string, number>()
  /** Pieces BPE may merge into: NORMAL, USER_DEFINED and UNUSED, like sentencepiece's pieces_ map */
  private mergeable = new Map<string, number>()
  private userDefined: string[] = []

  constructor(data: Uint8Array) {
    this.model = parseSpmModel(data)
    if (this.model.modelType !== 2) throw new Error(`Tallow's tokenizer should be BPE (type 2), got ${this.model.modelType}`)
    if (this.model.normalizerName !== 'identity') throw new Error(`unsupported normalizer ${this.model.normalizerName}`)
    if (this.model.removeExtraWhitespaces) throw new Error('remove_extra_whitespaces is not supported')
    this.model.pieces.forEach((p, id) => {
      if (!this.pieceToId.has(p.piece)) this.pieceToId.set(p.piece, id)
      if (p.type === PieceType.NORMAL || p.type === PieceType.USER_DEFINED || p.type === PieceType.UNUSED) this.mergeable.set(p.piece, id)
      if (p.type === PieceType.USER_DEFINED) this.userDefined.push(p.piece)
    })
    // Longest match first
    this.userDefined.sort((a, b) => b.length - a.length)
  }

  get vocabSize(): number {
    return this.model.pieces.length
  }

  pieceId(piece: string): number {
    return this.pieceToId.get(piece) ?? -1
  }

  idToPiece(id: number): string {
    return this.model.pieces[id]?.piece ?? ''
  }

  get eosId(): number {
    return this.model.eosId
  }

  get bosId(): number {
    return this.model.bosId
  }

  private normalize(text: string): string {
    let s = text
    if (this.model.escapeWhitespaces) s = s.replace(/ /g, WS)
    if (this.model.addDummyPrefix && s.length > 0) s = WS + s
    return s
  }

  /** Same as SentencePieceProcessor.encode(text) (no bos/eos) */
  encode(text: string): number[] {
    const norm = this.normalize(text)
    if (!norm) return []

    // 1. Characters, with user-defined pieces kept whole
    const syms: Sym[] = []
    let i = 0
    while (i < norm.length) {
      let piece = ''
      for (const ud of this.userDefined) {
        if (norm.startsWith(ud, i)) {
          piece = ud
          break
        }
      }
      if (!piece) {
        const cp = norm.codePointAt(i) as number
        piece = String.fromCodePoint(cp)
      }
      syms.push({ piece, prev: syms.length - 1, next: syms.length + 1, alive: true })
      i += piece.length
    }
    if (syms.length) syms[syms.length - 1].next = -1

    // 2. Merge the best-scoring adjacent pair until none is in the vocabulary.
    // Ties go to the leftmost pair, as in sentencepiece's agenda.
    const userDefinedSet = new Set(this.userDefined)
    for (;;) {
      let bestLeft = -1
      let bestScore = -Infinity
      let bestPiece = ''
      for (let l = 0; l !== -1 && l < syms.length; l = syms[l].next) {
        const r = syms[l].next
        if (r === -1) break
        // A user-defined piece is never merged with its neighbours
        if (userDefinedSet.has(syms[l].piece) || userDefinedSet.has(syms[r].piece)) continue
        const merged = syms[l].piece + syms[r].piece
        const id = this.mergeable.get(merged)
        if (id === undefined) continue
        const score = this.model.pieces[id].score
        if (score > bestScore) {
          bestScore = score
          bestLeft = l
          bestPiece = merged
        }
      }
      if (bestLeft < 0) break
      const l = bestLeft
      const r = syms[l].next
      syms[l].piece = bestPiece
      syms[l].next = syms[r].next
      if (syms[r].next !== -1) syms[syms[r].next].prev = l
      syms[r].alive = false
    }

    // 3. Pieces -> ids, with byte fallback for anything unknown
    const ids: number[] = []
    const enc = new TextEncoder()
    for (let l = 0; l !== -1 && l < syms.length; l = syms[l].next) {
      const s = syms[l]
      const id = this.mergeable.get(s.piece)
      if (id !== undefined) {
        ids.push(id)
        continue
      }
      if (this.model.byteFallback) {
        for (const b of enc.encode(s.piece)) {
          const hex = b.toString(16).toUpperCase().padStart(2, '0')
          const bid = this.pieceToId.get(`<0x${hex}>`)
          ids.push(bid ?? this.model.unkId)
        }
      } else {
        ids.push(this.model.unkId)
      }
    }
    return ids
  }

  /** Same as SentencePieceProcessor.decode(ids) for this tokenizer */
  decode(ids: number[]): string {
    const bytes: number[] = []
    const enc = new TextEncoder()
    for (const id of ids) {
      const p = this.model.pieces[id]
      if (!p) continue
      if (p.type === PieceType.CONTROL || p.type === PieceType.UNKNOWN) {
        if (p.type === PieceType.UNKNOWN) bytes.push(...enc.encode(' \u2047 '))
        continue
      }
      const m = p.type === PieceType.BYTE ? /^<0x([0-9A-Fa-f]{2})>$/.exec(p.piece) : null
      if (m) bytes.push(parseInt(m[1], 16))
      else bytes.push(...enc.encode(p.piece))
    }
    let text = new TextDecoder('utf-8').decode(new Uint8Array(bytes)).replace(new RegExp(WS, 'g'), ' ')
    if (this.model.addDummyPrefix && text.startsWith(' ')) text = text.slice(1)
    return text
  }
}
