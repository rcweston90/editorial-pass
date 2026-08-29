/* A structural diff, not a word-diff soup. Sections align by heading, paragraphs
   align inside a matched pair by similarity, and every gap in that alignment
   becomes one mark with a reason a person would actually write. */

import type { ChangeType, DocumentModel, Graf, Mark, SectionDoc, Track } from '../types'
import type { WordDelta } from './delta'
import { wordDelta, words } from './delta'
import { grafsToBlocks, wordCount } from './markdown'
import { MATCH, normalize, similarity } from './text'

const NUMBERS = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve',
]

function count(n: number): string {
  return NUMBERS[n] ?? String(n)
}

function headingKey(heading: string | null): string {
  if (heading === null) return '~lede'
  return normalize(heading.replace(/["“”'’]/g, ' '))
}

/* ---------------- reason lines, off the shared word delta ---------------- */

function longest(runs: string[]): string {
  let best = ''
  for (const r of runs) if (r.length > best.length) best = r
  return best
}

function quote(phrase: string, max = 11): string {
  const words = phrase.trim().replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/g, '').split(/\s+/)
  const clipped = words.length > max ? `${words.slice(0, max).join(' ')}…` : words.join(' ')
  // The reason sentence supplies its own full stop.
  return `“${clipped.replace(/\.$/, '')}”`
}

const HEDGE_HINT =
  /\b(not everywhere|not for everyone|i think|i believe|perhaps|maybe|sort of|kind of|a bit|somewhat|it seems|it appears|i would argue|i suppose|to some extent|of course|obviously|arguably|apolog\w*|sorry)\b/i
const HN_HINT = /\b(select\w*|taste|structur\w*|judgment|judgement|curat\w*|installs?)\b/i

function rewriteTrack(delta: WordDelta): Track {
  const moved = `${delta.dropped.join(' ')} ${delta.added.join(' ')}`
  if (HEDGE_HINT.test(moved)) return 'Voice'
  if (HN_HINT.test(moved)) return 'HN'
  return 'Voice'
}

function rewriteNote(delta: WordDelta): string {
  const out = longest(delta.dropped)
  const inn = longest(delta.added)
  const tally =
    delta.addedWords > 0
      ? `${delta.droppedWords} words out, ${delta.addedWords} in.`
      : `${delta.droppedWords} words out.`
  if (out && inn) return `Dropped ${quote(out)}; added ${quote(inn)}. ${tally}`
  if (out) return `Dropped ${quote(out)}. ${tally}`
  if (inn) return `Added ${quote(inn)}. ${delta.addedWords} words in.`
  return `Reworded without cutting. ${tally}`
}

function trimNote(delta: WordDelta, origWords: number): string {
  const out = longest(delta.dropped)
  const tally =
    delta.addedWords > 0
      ? `${delta.droppedWords} of ${origWords} words out, ${delta.addedWords} in.`
      : `${delta.droppedWords} of ${origWords} words out.`
  return out ? `Trimmed in place: ${quote(out)} comes out. ${tally}` : `Trimmed in place. ${tally}`
}

/* ---------------- what kind of change it is ---------------- */

/** Enough of a deletion to read as a deletion rather than a tightened line. */
const TRIM_WORDS = 6
const TRIM_SHARE = 0.3
/** A run that swallowed a sentence end, and is long enough to have been one. */
const SENTENCE_END = /[.!?]["”’']?(\s|$)/
const SENTENCE_WORDS = 6

/**
 * Not every delta is a rewrite. A paragraph that lost a sentence, or a third of
 * itself, was cut down — the mark should say so and carry the Cut track — while
 * a swapped phrase or a dropped hedge is the line being rewritten. Everything
 * here reads off the same word delta the reason quotes from.
 */
function isTrim(delta: WordDelta, origWords: number): boolean {
  const net = delta.droppedWords - delta.addedWords
  if (net < TRIM_WORDS) return false
  // Words traded for other words is a rewrite however long it runs.
  if (delta.addedWords > delta.droppedWords / 2) return false
  if (net / Math.max(1, origWords) >= TRIM_SHARE) return true
  // A deletion that carries a full stop across with it took a sentence, not a phrase.
  return delta.dropped.some(
    (run) => words(run).length >= SENTENCE_WORDS && SENTENCE_END.test(run.trim()),
  )
}

interface Shape {
  type: ChangeType
  track: Track
  note: string
}

function shapeOf(delta: WordDelta, origWords: number, replaced: boolean): Shape {
  if (isTrim(delta, origWords)) {
    return { type: 'compressed', track: 'Cut', note: trimNote(delta, origWords) }
  }
  const note = rewriteNote(delta)
  return {
    type: 'rewritten',
    track: rewriteTrack(delta),
    note: replaced ? `Replaced outright. ${note}` : note,
  }
}

/* ---------------- paragraph alignment ---------------- */

interface Pair {
  o: number
  e: number
  sim: number
}

/**
 * Weighted LCS over the similarity matrix. Sections are a dozen paragraphs at
 * most, so the full table is cheaper than a hand-tuned lookahead and it never
 * strands a paragraph behind a run of insertions.
 */
function alignGrafs(orig: Graf[], edit: Graf[]): Pair[] {
  const n = orig.length
  const m = edit.length
  const sim: number[][] = Array.from({ length: n }, () => new Array<number>(m).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) sim[i][j] = similarity(orig[i].text, edit[j].text)
  }
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const take = sim[i][j] >= MATCH ? sim[i][j] + dp[i + 1][j + 1] : -1
      dp[i][j] = Math.max(take, dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs: Pair[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    const take = sim[i][j] >= MATCH ? sim[i][j] + dp[i + 1][j + 1] : -1
    if (take >= dp[i + 1][j] && take >= dp[i][j + 1]) {
      pairs.push({ o: i, e: j, sim: sim[i][j] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return pairs
}

/* ---------------- marks ---------------- */

function sectionTitle(section: SectionDoc): string {
  return section.heading ?? 'Opening'
}

export function diffToMarks(
  original: DocumentModel,
  edited: DocumentModel,
  layerId: string,
): Mark[] {
  const marks: Mark[] = []
  let seq = 0
  const id = (sectionId: string) => `${layerId}-${sectionId}-${seq++}`

  // Sections align by heading; anything the edited pass inserted is ignored,
  // because the original is the spine the reader is standing on.
  const editedByKey = new Map<string, number[]>()
  edited.sections.forEach((s, index) => {
    const key = headingKey(s.heading)
    const list = editedByKey.get(key)
    if (list) list.push(index)
    else editedByKey.set(key, [index])
  })

  let floor = -1
  for (const section of original.sections) {
    const candidates = editedByKey.get(headingKey(section.heading)) ?? []
    let paired = -1
    for (const index of candidates) {
      if (index > floor) {
        paired = index
        break
      }
    }

    if (paired < 0) {
      marks.push({
        id: id(section.id),
        type: 'cut',
        track: 'Cut',
        sectionId: section.id,
        sectionTitle: sectionTitle(section),
        grafIds: section.grafs.map((g) => g.id),
        wholeSection: true,
        note: 'Whole section removed in the edited pass.',
        original: grafsToBlocks(section.grafs),
        altered: null,
        source: 'diff',
        layerId,
      })
      continue
    }
    floor = paired
    const editSection = edited.sections[paired]
    const pairs = alignGrafs(section.grafs, editSection.grafs)

    // Gaps between anchors are where the pass actually did something.
    const bounds: Array<{ o: number; e: number }> = [
      { o: -1, e: -1 },
      ...pairs.map((p) => ({ o: p.o, e: p.e })),
      { o: section.grafs.length, e: editSection.grafs.length },
    ]

    for (const pair of pairs) {
      if (pair.sim >= 1) continue
      const orig = section.grafs[pair.o]
      const next = editSection.grafs[pair.e]
      const delta = wordDelta(orig.text, next.text)
      const shape = shapeOf(delta, wordCount(orig.text), false)
      marks.push({
        id: id(section.id),
        type: shape.type,
        track: shape.track,
        sectionId: section.id,
        sectionTitle: sectionTitle(section),
        grafIds: [orig.id],
        note: shape.note,
        original: grafsToBlocks([orig]),
        altered: grafsToBlocks([next]),
        source: 'diff',
        layerId,
      })
    }

    for (let b = 0; b < bounds.length - 1; b++) {
      const from = bounds[b]
      const to = bounds[b + 1]
      const origRun = section.grafs.slice(from.o + 1, to.o)
      const editRun = editSection.grafs.slice(from.e + 1, to.e)
      if (origRun.length === 0) continue

      let gone = 0
      for (const g of origRun) gone += wordCount(g.text)

      if (editRun.length === 0) {
        const single = origRun.length === 1
        marks.push({
          id: id(section.id),
          type: single ? 'cut' : 'compressed',
          track: 'Cut',
          sectionId: section.id,
          sectionTitle: sectionTitle(section),
          grafIds: origRun.map((g) => g.id),
          note: single
            ? 'This paragraph does not appear in the edited pass.'
            : `${count(origRun.length)} paragraphs taken out. ${gone} words gone.`,
          original: grafsToBlocks(origRun),
          altered: null,
          source: 'diff',
          layerId,
        })
        continue
      }

      let kept = 0
      for (const g of editRun) kept += wordCount(g.text)

      if (origRun.length === 1 && editRun.length === 1) {
        const delta = wordDelta(origRun[0].text, editRun[0].text)
        const shape = shapeOf(delta, wordCount(origRun[0].text), true)
        marks.push({
          id: id(section.id),
          type: shape.type,
          track: shape.track,
          sectionId: section.id,
          sectionTitle: sectionTitle(section),
          grafIds: [origRun[0].id],
          note: shape.note,
          original: grafsToBlocks(origRun),
          altered: grafsToBlocks(editRun),
          source: 'diff',
          layerId,
        })
        continue
      }

      marks.push({
        id: id(section.id),
        type: 'compressed',
        track: 'Cut',
        sectionId: section.id,
        sectionTitle: sectionTitle(section),
        grafIds: origRun.map((g) => g.id),
        note: `${count(origRun.length)} paragraphs down to ${count(editRun.length).toLowerCase()}. ${gone} words out, ${kept} in.`,
        original: grafsToBlocks(origRun),
        altered: grafsToBlocks(editRun),
        source: 'diff',
        layerId,
      })
    }
  }

  // Document order, so j/k walks the manuscript rather than the algorithm.
  const order = new Map<string, number>()
  original.sections.forEach((s, si) => {
    s.grafs.forEach((g, gi) => order.set(g.id, si * 1000 + gi))
  })
  marks.sort((a, b) => (order.get(a.grafIds[0]) ?? 0) - (order.get(b.grafIds[0]) ?? 0))
  return marks
}
