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
const fourBeats = beatsOf(parseMarkdown(
  [
    'The team shipped the thing on a Tuesday, and by Thursday nobody could say what it had cost, which is the part of shipping that never makes the retrospective and never stops mattering to the people who paid for it in evenings.',
    'Estimates are a story told about a future nobody has visited yet, and the story gets better every time it is retold, because the retelling drops whatever was inconvenient about the last one and keeps only the parts that made everybody feel capable.',
    'What we do now is smaller and duller. We write down the last five things of roughly this size, we look at how long each of them actually took from first commit to the day it stopped needing attention, and we say the range out loud.',
    'Nobody enjoys the range. The range is wide, and a wide range reads as a lack of confidence rather than as an honest account of a process that has never once been narrow, and so the meeting always wants a single number instead.',
  ].join('\n\n'),
))
console.log(`      ${fourBeats.map((b) => b.short).join(' · ')}`)
check('four groups, four arrivals', fourBeats.length === 4, String(fourBeats.length))
check('  each with its own name', new Set(fourBeats.map((b) => b.short)).size === 4)

// One heading over a whole draft is a title, not a structure.
const titled = beatsOf(parseMarkdown(`## On documents\n\n${plainDraft}`))
check('a single heading does not collapse the draft', titled.length >= 4, String(titled.length))
check('  and the heading still names its first beat', titled[0].title === 'On documents', titled[0].title)
const plainFlow = buildRender(plainDoc, plainMarks, {}, all).flow
check('flow draws every beat', plainFlow.length === plainBeats.length, String(plainFlow.length))
check('marked beats carry their mark', plainFlow.some((f) => f.changeId !== null))
check('flow weights fall where the pass cut', plainFlow.some((f) => f.editWeight < f.origWeight))

console.log('\n— split: two columns, and a section change does not eat the original —')
const splitRows = buildSplit(render.sections, {})
const wholeRow = splitRows.find((r) => r.kind === 'change' && r.whole)
check('the whole-section cut is one row', wholeRow !== undefined)
if (wholeRow && wholeRow.kind === 'change') {
  const left = wholeRow.left.map((b) => plainOf(b.content)).join(' ')
  check('  the original still stands on the left', left.includes('Design got hired'), left.slice(0, 60))
  check('  the working copy has nothing there', wholeRow.right === null)
}
const headingRow = splitRows.find((r) => r.kind === 'heading' && r.gone)
check('its heading is struck on the right', headingRow !== undefined)
const rewriteRow = splitRows.find((r) => r.kind === 'change' && r.changeId === goldRewrite.id)
if (rewriteRow && rewriteRow.kind === 'change') {
  check('rewrite rows carry both versions', rewriteRow.right !== null)
  check('  the delta marks the dropped words', rewriteRow.left.some((b) => b.flags.some(Boolean)))
  check('  and marks nothing that did not move', rewriteRow.left[0].flags.filter(Boolean).length < rewriteRow.left[0].flags.length)
  check('  flags line up with the words', rewriteRow.left.every((b) => b.flags.length === plainOf(b.content).split(/\s+/).filter(Boolean).length))
}
const kept = splitRows.filter((r) => r.kind === 'kept')
check('untouched prose is in both columns', kept.length > 10, String(kept.length))
check('a cut you kept mine on stands in the working copy', (() => {
  const rows = buildSplit(
    buildRender(doc, marks, { [goldWhole.id]: 'rejected' }, all).sections,
    { [goldWhole.id]: 'rejected' },
  )
  const row = rows.find((r) => r.kind === 'change' && r.whole)
  return row !== undefined && row.kind === 'change' && row.right !== null
})())
const changedList = changedBeats(marks, render.whereOfMark)
check('changed list names the touched beats', changedList.length === 5, changedList.map((c) => c.label).join(' · '))
const plainRender = buildRender(plainDoc, plainMarks, {}, all)
const plainChanged = changedBeats(plainMarks, plainRender.whereOfMark)
check(
  'a heading-less draft gets beat names, not five Openings',
  plainChanged.length > 1 && plainChanged.every((c) => c.label !== 'Opening'),
  plainChanged.map((c) => c.label).join(' · '),
)
check(
  '  and every mark carries the same name in the margin',
  plainMarks.every((m) => (plainRender.whereOfMark.get(m.id) ?? 'Opening') !== 'Opening'),
  [...plainRender.whereOfMark.values()].join(' · '),
)

console.log('\n— a draft with no # does not grow one —')
check('title is borrowed', plainDoc.derivedTitle === true)
check('export writes no heading', !exportMarkdown(plainDoc, [], {}).startsWith('#'))
check('the essay still round-trips', exportMarkdown(plainDoc, [], {}).trim() === plainDraft.trim())
check('a titled draft keeps its heading', documentToMarkdown(doc).startsWith('# The Most Finished One'))

console.log('\n— word delta —')
const d = wordDelta('the cat sat on the mat', 'the cat sat on the hat')
check('one word out, one in', d.droppedWords === 1 && d.addedWords === 1, `${d.dropped.join('|')} / ${d.added.join('|')}`)
check('flags are per word', d.aFlags.length === 6 && d.bFlags.length === 6)
check('only the changed word is flagged', d.aFlags.filter(Boolean).length === 1 && d.aFlags[5])

console.log('\n— screen one renders: cold —')
try {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const App = (await import('../src/App')).default
  const { EssaySheet } = await import('../src/components/EssaySheet')
  const { SplitSheet } = await import('../src/components/SplitSheet')
  const { BeatsSheet } = await import('../src/components/BeatsSheet')
  const noop = () => undefined
  const html = renderToStaticMarkup(createElement(App))

  const tabs = [...html.matchAll(/class="screen-name">([^<]+)</g)].map((m) => m[1])
  check('four screens in the chrome, in order',
    tabs.join(' · ') === 'Draft · Marks · Original vs this pass · Beats', tabs.join(' · '))
  check('a refresh lands on screen one', /id="screen-draft"[^>]*aria-current="page"/.test(html))
  check('  and only one screen is current', (html.match(/aria-current="page"/g) ?? []).length === 1)
  check('the other three wait for a pass',
    (html.match(/class="screen-tab"[^>]*disabled/g) ?? []).length === 3,
    String((html.match(/class="screen-tab"[^>]*disabled/g) ?? []).length))
  check('screen one is paper', html.includes('class="sheet draft-sheet"'))
  check('the paper is blank', html.includes('Nothing on the paper yet'))
  check('no marks on a cold load', (html.match(/class="mark-btn/g) ?? []).length === 0)
  check('the example is not loaded', !html.includes('The Most Finished One'))
  check('no sample stamp', !html.includes('class="stamp"'))
  check('the draft box is the paper', html.includes('class="ms-field ms-original"'))
  check('the compare box is the sidebar, and only that', html.includes('class="blotter-side"') &&
    html.split('class="blotter-side"')[1].split('</aside>')[0].includes('ms-field ms-edited') &&
    !html.split('class="blotter-side"')[1].split('</aside>')[0].includes('ms-original'))
  check('both boxes are empty', (html.match(/<textarea[^>]*><\/textarea>/g) ?? []).length === 2,
    String((html.match(/<textarea/g) ?? []).length))
  check('load example is on the desk', html.includes('Load example'))
  check('the first instruction is paste, then Run pass',
    html.includes('Paste a draft here, then Run pass.'))
  check('nothing to start over from yet', !html.includes('id="start-over"'))
  check('no stats bar over blank paper', !html.includes('class="stats'))
  check('chrome kicker', html.includes('Editorial pass'))
  check('Export is always on the desk', html.includes('id="export-btn"'))
  check('export writes through a real anchor', html.includes('class="export-anchor"'))

  // The drawers the screens replaced. None of them come back.
  check('no mode row', !html.includes('id="btn-split"') && !html.includes('class="read-toggle"'))
  check('no Flow chrome', !html.includes('id="flow-toggle"') && !html.includes('id="flow-grid"') &&
    !html.includes('class="flow'))
  check('no Draft drawer toggle', !html.includes('id="draft-toggle"'))
  check('no About, no tour', !html.includes('data-about') && !html.includes('class="about'))
  check('no glossary page', !html.includes('glossary'))
  check('no Take, no Leave', !html.includes('>Take<') && !html.includes('>Leave<') &&
    !html.includes('Take all') && !html.includes('Leave all'))

  console.log('\n— screen one renders: a cold load over an old store —')
  const seeded = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => seeded.get(k) ?? null,
    setItem: (k: string, v: string) => void seeded.set(k, v),
    removeItem: (k: string) => void seeded.delete(k),
    clear: () => seeded.clear(),
    key: (i: number) => [...seeded.keys()][i] ?? null,
    get length() {
      return seeded.size
    },
  } as Storage
  /* Everything a desk that shipped before this one could have left lying about:
     an old blob and a fresh one, both holding the sample. First paint owes them
     nothing — it is empty paper, and the way in is paste a draft, then Run pass. */
  seeded.set('editorial-pass:v2', JSON.stringify({ v: 2, ...exampleSession() }))
  seeded.set('editorial-pass:v3', JSON.stringify({ v: 3, ...exampleSession() }))
  const overOld = renderToStaticMarkup(createElement(App))
  check('a leftover example does not paint', !overOld.includes('The Most Finished One'))
  check('  the paper is empty instead', overOld.includes('Nothing on the paper yet'))
  check('  and it asks for a draft', overOld.includes('Paste a draft here, then Run pass.'))
  check('  no sample stamp on a cold load', !overOld.includes('class="stamp"'))
  check('  still screen one', /id="screen-draft"[^>]*aria-current="page"/.test(overOld))
  check('  nothing to start over from yet', !overOld.includes('id="start-over"'))
  check('  and the old blob is dropped, not kept', !seeded.has('editorial-pass:v2'))

  console.log('\n— screen one renders: a draft you pasted, marked —')
  seeded.clear()
  saveSession({
    ...cold,
    originalMd: plainDraft,
    docMd: plainDraft,
    document: plainDoc,
    layers: [{ id: 'pass-1', label: 'Local pass', source: 'local' as const, marks: plainMarks }],
    activeLayerId: 'pass-1',
    title: plainDoc.title,
  })
  const warm = renderToStaticMarkup(createElement(App))
  check('a refresh still shows screens, not one long blotter',
    /id="screen-draft"[^>]*aria-current="page"/.test(warm) && warm.includes('class="sheet draft-sheet"'))
  check('the pass opens the other three screens',
    (warm.match(/class="screen-tab"[^>]*disabled/g) ?? []).length === 0,
    String((warm.match(/class="screen-tab"[^>]*disabled/g) ?? []).length))
  check('the draft came back in the box', warm.includes(plainDraft.slice(0, 40)))
  check('no sample stamp over a draft of your own', !warm.includes('class="stamp"'))
  check('the marks are not dumped under the draft box',
    (warm.match(/class="mark-btn/g) ?? []).length === 0)
  check('no stats bar on screen one', !warm.includes('class="stats'))
  // The way home is one desk action, on the paper you arrive on.
  check('Start over is on the paper', warm.includes('id="start-over"'))
  check('  one of it, not a settings page', (warm.match(/id="start-over"/g) ?? []).length === 1)
  seeded.clear()

  /* Screens two, three and four, drawn from the same render model the app hands
     them. The app itself always opens on screen one, so these are rendered
     directly rather than clicked into. */
  const warmRender = buildRender(plainDoc, plainMarks, {}, all)
  const paper = {
    marks: new Map(plainMarks.map((m) => [m.id, m])),
    markCount: plainMarks.length,
    openId: null,
    focusedId: null,
    where: warmRender.whereOfMark,
    onToggle: noop,
    onDecide: noop,
    onCloseSlip: noop,
    onboard: false,
    sample: false,
    onDraft: noop,
    onExport: noop,
    registerHost: noop,
    registerAnchor: noop,
  }
  const docHead = { title: plainDoc.title, derivedTitle: plainDoc.derivedTitle,
    byline: plainDoc.byline, epigraph: plainDoc.epigraph }

  console.log('\n— screen two: the marks —')
  const two = renderToStaticMarkup(createElement(EssaySheet, {
    ...paper, head: docHead, sections: warmRender.sections, decisions: {},
    mode: 'original' as const, onMode: noop,
  }))
  check('a mark in the margin for every mark',
    (two.match(/class="mark-btn/g) ?? []).length === plainMarks.length,
    String((two.match(/class="mark-btn/g) ?? []).length))
  check('two decisions on every mark',
    (two.match(/class="mark-act"/g) ?? []).length === plainMarks.length * 2)
  check('  Keep this keeps this delta on the working copy',
    two.includes('>Keep this</button>') && two.includes('title="Keep this delta on the working copy"'))
  check('  Keep mine keeps the original for that mark',
    two.includes('>Keep mine</button>') && two.includes('title="Keep the original for this mark"'))
  check('  and Take and Leave are gone from the mark',
    !two.includes('>Take</button>') && !two.includes('>Leave</button>'))
  check('the original is still there under the marks', two.includes('class="essay"'))
  check('the reading toggle is on the paper, not in the chrome',
    two.includes('class="reading"') && two.includes('id="btn-orig"') && two.includes('id="btn-edit"'))
  // Type and Track are named where they are used, and nowhere else.
  check('the mark says Type beside what the pass did',
    /class="lbl"><span class="mark-term">Type<\/span> (Cut|Compressed|Rewritten)</.test(two))
  check('  and Track beside which pass wrote it',
    (two.match(/class="lbl trk"><span class="mark-term">Track<\/span> (Voice|Skeptic|Cut|HN)</g) ?? [])
      .length === plainMarks.length)
  check('no About on the paper', !two.includes('data-about'))
  check('the keyhint speaks the decisions the marks speak',
    two.includes('a keep this · r keep mine'))

  console.log('\n— screen three: original vs this pass —')
  const three = renderToStaticMarkup(createElement(SplitSheet, {
    ...paper, head: docHead,
    rows: buildSplit(warmRender.sections, {}),
    changed: changedBeats(plainMarks, warmRender.whereOfMark),
  }))
  check('the original is the spine', three.includes('<div class="split-lab">Original</div>'))
  check('this pass is the Edited column',
    three.includes('<div class="split-lab split-lab-right">Edited</div>'))
  check('  and it is not called the working copy', !three.includes('>Working copy<'))
  check('a mark in the gutter for every mark',
    (three.match(/class="mark-btn/g) ?? []).length === plainMarks.length)
  check('the changed strip names beats, not five Openings',
    three.includes('class="split-changed"') && !three.includes('>Opening</button>'))
  check('no About on the split', !three.includes('data-about'))

  console.log('\n— screen four: beats —')
  const four = renderToStaticMarkup(createElement(BeatsSheet, {
    beats: warmRender.flow,
    typeOf: (id: string | null) => (id ? plainMarks.find((m) => m.id === id)?.type ?? null : null),
    activeSection: null,
    onJump: noop,
    markCount: plainMarks.length,
    sample: false,
  }))
  const beatNames = [...four.matchAll(/class="txt">([^<]+)</g)].map((m) => m[1])
  check('one row per beat',
    (four.match(/class="beat-row"/g) ?? []).length === warmRender.flow.length,
    String((four.match(/class="beat-row"/g) ?? []).length))
  check('  more than one beat: it does not collapse',
    warmRender.flow.length > 1, String(warmRender.flow.length))
  check('  and not one of them is called Opening',
    beatNames.every((n) => n !== 'Opening'), beatNames.join(' · '))
  check('  every beat is named after its own prose',
    beatNames.length === warmRender.flow.length && new Set(beatNames).size === beatNames.length)
  check('each beat draws what the pass left of it',
    (four.match(/class="beat-bar"/g) ?? []).length === warmRender.flow.length)
  check('no Flow chrome on it',
    !four.includes('class="flow') && !four.includes('id="flow-grid"') &&
    !four.includes('class="lane') && !four.includes('Flow'))
  check('the screen says what the drawing means, once',
    (four.match(/class="beats-hint"/g) ?? []).length === 1)
} catch (err) {
  check('renders without throwing', false, String(err))
}

console.log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILING`}\n`)
 if (failures > 0) process.exitCode = 1
