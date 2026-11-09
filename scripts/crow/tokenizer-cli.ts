// Reads JSON lines {text} on stdin, prints {ids, sp, render} using the app's TypeScript port.
import * as fs from 'fs'
import * as readline from 'readline'
import { SentencePieceBpe } from '../../src/main/tallow/spm'
import { toSp, fromSp, render, promptIds, selfCheck } from '../../src/main/tallow/text'

selfCheck()
const sp = new SentencePieceBpe(new Uint8Array(fs.readFileSync(process.argv[2])))
const rl = readline.createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const { text, history } = JSON.parse(line)
  const out: Record<string, unknown> = { ids: sp.encode(text), tosp: toSp(text), fromsp: fromSp(toSp(text)), decode: sp.decode(sp.encode(text)) }
  if (history) {
    out.render = render(sp, history)
    out.prompt = promptIds(sp, history).ids
  }
  process.stdout.write(JSON.stringify(out) + '\n')
})
