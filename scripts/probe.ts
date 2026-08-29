import { readFileSync, readdirSync } from 'node:fs'
import { parseMarkdown, wordCount, plain } from '../src/lib/markdown'
import { localPass } from '../src/lib/localPass'
import { beatsOf } from '../src/lib/flow'
const dir = '/tmp/probe'
for (const f of readdirSync(dir).sort()) {
  const doc = parseMarkdown(readFileSync(`${dir}/${f}`, 'utf8'))
  const grafs = doc.sections.flatMap(s => s.grafs)
  const words = grafs.reduce((n, g) => n + wordCount(g.text), 0)
  const marks = localPass(doc, 'probe')
  const beats = beatsOf(doc)
  console.log(`${f.padEnd(26)} ${String(words).padStart(4)}w ${String(grafs.length).padStart(3)} grafs -> ${String(marks.length).padStart(2)} MARKS, ${beats.length} beats`)
  for (const m of marks) console.log(`      · [${m.type}/${m.track}] ${m.note.slice(0,95)}`)
  void plain
}
