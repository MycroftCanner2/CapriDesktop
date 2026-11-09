// node gguf-cli.js <hf_dir> <out.gguf>: the app's TypeScript converter, for the build-time byte check
import * as fs from 'fs'
import * as path from 'path'
import { convertTallowToGguf } from '../../src/main/tallow/gguf'
const [hf, out] = process.argv.slice(2)
const bytes = convertTallowToGguf(
  fs.readFileSync(path.join(hf, 'config.json'), 'utf-8'),
  new Uint8Array(fs.readFileSync(path.join(hf, 'model.safetensors'))),
  new Uint8Array(fs.readFileSync(path.join(hf, 'tallow_tok.model')))
)
fs.writeFileSync(out, bytes)
console.log(`wrote ${out} (${bytes.length} bytes)`)
