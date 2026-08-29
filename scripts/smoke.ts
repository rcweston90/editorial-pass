/* Not a test framework — a run-it-and-look harness for the parts that are easy
   to get wrong: the markdown round trip, the five gold diff sites, what the
   local engine actually marks, and whether Export reproduces the edited pass.
   Run with: npm run smoke */

import originalMd from '../original.md?raw'
import plainDraft from './plain-draft.md?raw'
import editedMd from '../edited.md?raw'
import { documentToMarkdown, parseMarkdown, plain as plainOf, wordCount } from '../src/lib/markdown'
import { diffToMarks } from '../src/lib/diff'
import { localPass } from '../src/lib/localPass'
import { exportMarkdown, passStats } from '../src/lib/apply'
import { exampleOriginalMd, examplePassMd, exampleSession } from '../src/lib/example'
import { emptySession, isEmptyDesk } from '../src/lib/draft'
import { clearSession, loadSession, saveSession } from '../src/lib/persist'
import { sentences } from '../src/lib/text'
import { buildRender, walkOrder } from '../src/lib/session'
import { beatsOf } from '../src/lib/flow'
import { buildSplit, changedBeats } from '../src/lib/split'
import { wordDelta } from '../src/lib/delta'
import type { Mark } from '../src/types'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

function show(marks: Mark[]) {
  for (const m of marks) {
    console.log(`      · [${m.type}/${m.track}] ${m.sectionTitle} :: ${m.note}`)
  }
}

console.log('\n— markdown round trip —')
const doc = parseMarkdown(originalMd)
check('title', doc.title === 'The Most Finished One', doc.title)
check('byline parsed', doc.byline !== null && doc.byline.length === 1)
check('epigraph', doc.epigraph === 'the wait was the curriculum', String(doc.epigraph))
check('9 sections', doc.sections.length === 9, String(doc.sections.length))
check('lede has no heading', doc.sections[0].heading === null && doc.sections[0].id === 'lede')
const round = documentToMarkdown(doc)
check('serializes back byte-for-byte', round.trim() === originalMd.trim())
if (round.trim() !== originalMd.trim()) {
  const a = round.trim().split('\n')
  const b = originalMd.trim().split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log(`      line ${i}\n        got: ${JSON.stringify(a[i])}\n        exp: ${JSON.stringify(b[i])}`)
      break
    }
  }
}

console.log('\n— structural diff: the five gold sites —')
const edited = parseMarkdown(editedMd)
const diff = diffToMarks(doc, edited, 'compare-1')
show(diff)
check('five marks', diff.length === 5, String(diff.length))
check('1 lede rewritten', diff[0]?.type === 'rewritten' && diff[0]?.sectionId === 'lede')
check('  hedge named in the reason', /Not everywhere/i.test(diff[0]?.note ?? ''))
check('  track Voice', diff[0]?.track === 'Voice')
check('2 instrument compressed x3', diff[1]?.type === 'compressed' && diff[1]?.grafIds.length === 3)
check('3 cheap-version cut', diff[2]?.type === 'cut' && diff[2]?.grafIds.length === 1)
check('4 whole section cut', diff[3]?.wholeSection === true && diff[3]?.type === 'cut')
check('5 taste rewritten', diff[4]?.type === 'rewritten' && diff[4]?.track === 'HN')
check('every mark has a reason', diff.every((m) => m.note.trim().length > 0))

console.log('\n— diff working copy reproduces the edited draft —')
const rebuilt = exportMarkdown(doc, diff, {})
check('export === edited.md', rebuilt.trim() === editedMd.trim())
if (rebuilt.trim() !== editedMd.trim()) {
  const a = rebuilt.trim().split('\n')
  const b = editedMd.trim().split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.log(`      line ${i}\n        got: ${JSON.stringify(a[i])}\n        exp: ${JSON.stringify(b[i])}`)
      break
    }
  }
}

console.log('\n— local pass —')
const local = localPass(doc, 'pass-1')
show(local)
check('between 4 and 12 marks', local.length >= 4 && local.length <= 12, String(local.length))
check('catches the opening hedge', local.some((m) => m.type === 'rewritten' && m.sectionId === 'lede'))
check(
  'catches the cheap version / kill that now',
  local.some((m) => m.type === 'cut' && /cheap version/i.test(m.original[0].content.join(''))),
)
check('every mark has a reason', local.every((m) => m.note.trim().length > 0))
const hedge = local.find((m) => m.sectionId === 'lede')
if (hedge?.altered) {
  const before = hedge.original[0].content.join('')
  const after = hedge.altered[0].content.join('')
  console.log(`      before: ${before}`)
  console.log(`      after:  ${after}`)
  check(
    '  altered text adds no new words',
    after.split(/\s+/).every((w) => before.toLowerCase().includes(w.toLowerCase().replace(/^\W+|\W+$/g, ''))),
  )
}
check('no two marks claim the same paragraph', (() => {
  const seen = new Set<string>()
  for (const m of local) for (const id of m.grafIds) {
    if (seen.has(id)) return false
    seen.add(id)
  }
  return true
})())

console.log('\n— local pass on an ordinary heading-less draft —')
const plainDoc = parseMarkdown(plainDraft)
check('one heading-less section', plainDoc.sections.length === 1 && plainDoc.sections[0].heading === null)
const plainMarks = localPass(plainDoc, 'pass-2')
show(plainMarks)
check('four or more marks', plainMarks.length >= 4, String(plainMarks.length))
check('twelve at most', plainMarks.length <= 12, String(plainMarks.length))
check('every mark has a reason', plainMarks.every((m) => m.note.trim().length > 0))
check(
  'no altered text invents a word',
  plainMarks.every((m) => {
    if (!m.altered) return true
    const before = m.original.map((b) => plainOf(b.content)).join(' ').toLowerCase()
    return m.altered
      .flatMap((b) => plainOf(b.content).split(/\s+/))
      .every((w) => before.includes(w.toLowerCase().replace(/^\W+|\W+$/g, '')))
  }),
)
check('no two marks claim the same paragraph', (() => {
  const seen = new Set<string>()
  for (const m of plainMarks) for (const id of m.grafIds) {
    if (seen.has(id)) return false
    seen.add(id)
  }
  return true
})())

console.log('\n— the desk example: the two files in comparison/ —')
const session = exampleSession()
const exMarks = session.layers[0].marks
check('the example is a real pass over a real draft', exMarks.length >= 3, String(exMarks.length))
check('original.md is the Original', session.originalMd.trim() === exampleOriginalMd.trim())
check('pass.md is the Edited version', session.editedMd.trim() === examplePassMd.trim())
check('  and they are not the same file', session.originalMd.trim() !== session.editedMd.trim())
check('the paper is stamped sample', session.sample === true)
check('the layer is stamped example, which is what keeps it out of the store',
  session.layers[0].source === 'example' && exMarks.every((m) => m.source === 'example'))
check('the document is the original, read', session.docMd === session.originalMd)
check('every mark resolves to real grafs', exMarks.every((m) => m.grafIds.length > 0))
const exGrafIds = new Set(session.document.sections.flatMap((s) => s.grafs.map((g) => g.id)))
check('grafIds exist in the document', exMarks.every((m) => m.grafIds.every((id) => exGrafIds.has(id))))
check('the example document serializes back to comparison/original.md',
  documentToMarkdown(session.document).trim() === exampleOriginalMd.trim())
check('every mark has a reason', exMarks.every((m) => m.note.trim().length > 0))
check('the pass cut a whole section', exMarks.some((m) => m.wholeSection === true))
show(exMarks)
const exBeats = beatsOf(session.document)
console.log(`      ${exBeats.map((b) => b.short).join(' · ')}`)
check('the example beats out into its sections', exBeats.length === session.document.sections.length,
  String(exBeats.length))
check('  more than one of them', exBeats.length > 1, String(exBeats.length))
check('  and not one of them is called Opening',
  exBeats.every((b) => b.short !== 'Opening' && b.title !== 'Opening'),
  exBeats.map((b) => b.title).join(' · '))

console.log('\n— stats, render model, filters —')
/* The five gold marks over original.md: the same pass the diff section read,
   now stood up as a session so the counts, the spine and the split can be
   checked against a corpus whose every site is known by hand. */
const marks = diff
const goldRewrite = marks.find((m) => m.type === 'rewritten') as Mark
const goldWhole = marks.find((m) => m.wholeSection) as Mark
const goldCut = marks.find((m) => m.type === 'cut' && !m.wholeSection) as Mark
check('the three sites the rest of this section leans on',
  goldRewrite !== undefined && goldWhole !== undefined && goldCut !== undefined)
const stats = passStats(doc, marks, {})
console.log(`      ${stats.wordsIn} → ${stats.wordsTaken} · ${stats.pctTaken}% cut · ${stats.pending} open · ${stats.wordsOut} if kept`)
check('words fall', stats.wordsOut < stats.wordsIn)
check('counts', stats.cut === 2 && stats.compressed === 1 && stats.rewritten === 2)
check('nothing decided yet, so nothing is cut yet', stats.wordsTaken === stats.wordsIn && stats.pctTaken === 0)

// Keeping a mark has to move the bar, or the bar is reporting the pass, not you.
const oneTaken = passStats(doc, marks, { [goldRewrite.id]: 'accepted' })
console.log(`      one rewrite kept → ${oneTaken.wordsIn} → ${oneTaken.wordsTaken} · ${oneTaken.pctTaken}%`)
check('a rewrite kept moves the count', oneTaken.wordsTaken < stats.wordsTaken,
  `${stats.wordsTaken} → ${oneTaken.wordsTaken}`)
check('  and the ledger with it', oneTaken.accepted === 1 && oneTaken.pending === marks.length - 1)
const cutTaken = passStats(doc, marks, { [goldRewrite.id]: 'accepted', [goldWhole.id]: 'accepted' })
check('a section cut kept moves it further', cutTaken.wordsTaken < oneTaken.wordsTaken,
  `${oneTaken.wordsTaken} → ${cutTaken.wordsTaken}`)
check('  and the percent with it', cutTaken.pctTaken > oneTaken.pctTaken,
  `${oneTaken.pctTaken}% → ${cutTaken.pctTaken}%`)
const allTaken = passStats(doc, marks, Object.fromEntries(marks.map((m) => [m.id, 'accepted' as const])))
check('keeping everything lands on the working copy', allTaken.wordsTaken === stats.wordsOut,
  `${allTaken.wordsTaken} / ${stats.wordsOut}`)
check('keeping mine everywhere puts the draft back', passStats(doc, marks,
  Object.fromEntries(marks.map((m) => [m.id, 'rejected' as const]))).wordsOut === stats.wordsIn)
const all = { type: 'all' as const, track: 'all' as const }
const render = buildRender(doc, marks, {}, all)
check('nine beats', render.flow.length === 9, String(render.flow.length))
check('the cut section flows to zero',
  render.flow.find((f) => f.id === goldWhole.sectionId)?.editWeight === 0)
check('walk order is manuscript order',
  walkOrder(doc, marks, all).join(',') === marks.map((m) => m.id).join(','))
const cutsOnly = buildRender(doc, marks, {}, { type: 'cut', track: 'all' })
const cutSection = cutsOnly.sections.find((s) => s.id === 'lede')
check('filtered rewrite renders as plain prose', cutSection?.nodes.every((n) => n.kind === 'p') === true)
check('filtered walk', walkOrder(doc, marks, { type: 'all', track: 'Cut' }).join(',') ===
  marks.filter((m) => m.track === 'Cut').map((m) => m.id).join(','))

console.log('\n— keeping mine keeps the original —')
const rejected = exportMarkdown(doc, marks, { [goldWhole.id]: 'rejected', [goldCut.id]: 'rejected' })
check('a section you kept stays', rejected.includes('Why design got hired in the first place'))
check('a cut you kept stays', rejected.includes('The cheap version of this essay'))
check('the marks you did keep still go', !rejected.includes('Nobody taught you that.'))


console.log('\n— the desk opens empty, and a reload keeps what was pasted —')
const cold = emptySession()
check('cold Original is empty', cold.originalMd === '')
check('cold Edited is blank', cold.editedMd === '')
check('cold paper has nothing on it', isEmptyDesk(cold) && cold.layers.length === 0)
check('cold desk is not the sample', cold.sample === false)
check('the example is still there when asked for', exampleSession().layers[0].marks.length > 0)

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

check('an empty desk survives a reload', (() => {
  saveSession(cold)
  const back = loadSession()
  return back !== null && back.originalMd === '' && back.editedMd === '' && isEmptyDesk(back)
})())
check('a pasted draft survives a reload, unread', (() => {
  saveSession({ ...cold, originalMd: plainDraft })
  const back = loadSession()
  return back !== null && back.originalMd === plainDraft && back.editedMd === ''
})(), 'no pass run yet')
check('a marked-up draft survives a reload', (() => {
  const passed = { ...cold, originalMd: plainDraft, docMd: plainDraft, document: plainDoc,
    layers: [{ id: 'pass-1', label: 'Local pass', source: 'local' as const, marks: plainMarks }],
    activeLayerId: 'pass-1', title: plainDoc.title }
  saveSession(passed)
  const back = loadSession()
  return back !== null && back.layers[0].marks.length === plainMarks.length && back.editedMd === ''
})())
check('the reload never fills the Edited box', (() => {
  saveSession({ ...cold, originalMd: plainDraft, editedMd: '' })
  return loadSession()?.editedMd === ''
})())

/* The blocking one. The example is a thing you ask for out loud, every time:
   it is never written down, never read back, and never what a cold load opens
   on — whatever a store left behind by an older desk happens to be holding. */
check('the example is never written down', (() => {
  store.clear()
  saveSession(exampleSession())
  return store.size === 0
})())
check('a sample blob left in the store is ignored', (() => {
  const ex = exampleSession()
  store.set('editorial-pass:v3', JSON.stringify({ v: 3, ...ex }))
  return loadSession() === null
})())
check('so is one with the stamp scrubbed off it', (() => {
  const ex = exampleSession()
  store.set('editorial-pass:v3', JSON.stringify({ v: 3, ...ex, sample: false }))
  return loadSession() === null
})(), 'the example layer gives it away')
check('an old store is not read at all', (() => {
  store.clear()
  store.set('editorial-pass:v2', JSON.stringify({ v: 2, ...exampleSession() }))
  return loadSession() === null
})())
check('  and it is dropped, not left lying there', store.size === 0, String(store.size))
check('a v1 blob is not resurrected', (() => {
  store.set('editorial-pass:v1', JSON.stringify({ v: 1, originalMd, editedMd, layers: [] }))
  store.delete('editorial-pass:v2')
  return loadSession() === null
})())
check('starting over empties the store', (() => {
  saveSession({ ...cold, originalMd: plainDraft })
  clearSession()
  return store.size === 0 && loadSession() === null
})())
store.clear()

console.log('\n— compare: a trim is not a rewrite —')
const paras = plainDraft.trim().split(/\n\n+/)
const trimAt = paras.findIndex((t) => sentences(t).length >= 4 && wordCount(t) >= 60)
const rewordAt = paras.findIndex((t, i) => i !== trimAt && /\bdocument\b/.test(t) && wordCount(t) < 60)
const trimmed = paras.map((t, i) => {
  if (i === trimAt) {
    const parts = sentences(t)
    return parts.filter((_, k) => k !== 1).join('').trim()
  }
  if (i === rewordAt) return t.replace(/\bdocument\b/, 'file')
  return t
})
const shaped = diffToMarks(plainDoc, parseMarkdown(trimmed.join('\n\n')), 'compare-2')
show(shaped)
check('the pass is read', shaped.length >= 2, String(shaped.length))
check('a dropped sentence reads as compressed', shaped.some((m) => m.type === 'compressed'))
check('  on the Cut track', shaped.every((m) => m.type !== 'compressed' || m.track === 'Cut'))
check('  and says what came out', shaped.every((m) => m.type !== 'compressed' || /out\.$|out, \d+ in\.$/.test(m.note)))
check('a swapped word still reads as rewritten', shaped.some((m) => m.type === 'rewritten'))
check('not every delta is Rewritten', new Set(shaped.map((m) => m.type)).size > 1,
  shaped.map((m) => m.type).join(','))
check('the five gold marks keep their kinds', diff.map((m) => m.type).join(',') === 'rewritten,compressed,cut,cut,rewritten',
  diff.map((m) => m.type).join(','))

console.log('\n— flow beats: arrivals, not a heading parse —')
const headed = beatsOf(doc)
check('headed draft keeps its headings', headed.length === 9, String(headed.length))
check('  beats are the sections', headed.every((b, i) => b.id === doc.sections[i].id && b.anchorId === doc.sections[i].id))
const plainBeats = beatsOf(plainDoc)
console.log(`      ${plainBeats.map((b) => b.short).join(' · ')}`)
check('heading-less draft arrives in four beats or more', plainBeats.length >= 4, String(plainBeats.length))
check('  not one bar, and not two', plainBeats.length > 2, String(plainBeats.length))
check('  every beat is anchored to a graf', plainBeats.every((b) => b.anchorId.includes('-g')))
check('  ids are unique', new Set(plainBeats.map((b) => b.id)).size === plainBeats.length)
check('  labels are distinctive', new Set(plainBeats.map((b) => b.short)).size === plainBeats.length)
check('  no beat is called Opening', plainBeats.every((b) => b.short !== 'Opening' && b.title !== 'Opening'))
check('  every label is the prose it opens with', plainBeats.every((b) => plainDraft.includes(b.short.replace(/…$/, ''))))
check('  beats hold one to five paragraphs', plainBeats.every((b) => b.grafs.length >= 1 && b.grafs.length <= 5))
check(
  '  every paragraph lands in exactly one beat',
  plainBeats.flatMap((b) => b.grafs.map((g) => g.id)).join(',') ===
    plainDoc.sections[0].grafs.map((g) => g.id).join(','),
)

// Four blank-line groups, no headings anywhere: four arrivals, four names.
