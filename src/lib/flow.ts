/* The spine the flow view draws.

   An essay with headings has its beats already: one per `##` section. A draft
   with no headings — which is most drafts, most of the time — used to collapse
   into a single Opening node, which told you nothing. So the beats arrive with
   the prose instead: they are read off the blank-line groups, filled to a share
   of the draft, broken where it turns (a bold line, a one-line paragraph, a
   question, a heading), and each one is named after the phrase it opens with. */

import type { Decision, DocumentModel, FlowSection, Graf, Mark, SectionDoc } from '../types'
import { grafWordsAfter } from './apply'
import { shortLabel, wordCount } from './markdown'

export interface Beat {
  id: string
  title: string
  short: string
  sectionId: string
  /** Section id for a headed beat, graf id for an arrival beat. */
  anchorId: string
  grafs: Graf[]
}

/** A beat carries at least this much prose before the next one can start. */
const MIN_WORDS = 30
/** No beat runs past this many paragraphs, however short they are. */
const MAX_GRAFS = 5
/** Roughly one beat per this much prose, held inside the bounds below. */
const BEAT_WORDS = 170
const MIN_BEATS = 4
const MAX_BEATS = 8
/** A tail lighter than this trails the beat before it instead of standing alone. */
const STRAY_WORDS = 22
/** A paragraph this short is a turn in the prose, not a paragraph. */
const HINGE_WORDS = 12
/** Two headings are a structure; one is a title with a draft under it. */
const HEADED = 2

function hasStrong(graf: Graf): boolean {
  const only = graf.content.length === 1 ? graf.content[0] : null
  return only !== null && typeof only !== 'string' && only.tag === 'strong'
}

function isHinge(graf: Graf): boolean {
  if (graf.tag === 'h3') return true
  if (hasStrong(graf)) return true
  if (/\?\s*$/.test(graf.text.trim())) return true
  return wordCount(graf.text) <= HINGE_WORDS
}

function weigh(grafs: Graf[]): number {
  let n = 0
  for (const g of grafs) n += wordCount(g.text)
  return n
}

/** The first distinctive phrase: enough of the opening line to recognise it. */
function phrase(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim().replace(/^["“”'’(]+/, '')
  const first = clean.split(/(?<=[.!?])\s/)[0] ?? clean
  const body = first.replace(/[.!?,;:]+$/, '')
  if (body.length <= max) return body
  const words = body.split(' ')
  let out = words[0] ?? body.slice(0, max)
  for (const w of words.slice(1)) {
    if (`${out} ${w}`.length > max) break
    out += ` ${w}`
  }
  return `${out}…`
}

/**
 * A headed draft beats out on its headings. The run of prose before the first
 * one is a beat too, and it is named after the line it opens with — calling it
 * Opening tells you nothing, and on a draft whose sections are all unheaded it
 * would name every beat the same word.
 */
function sectionBeats(doc: DocumentModel): Beat[] {
  const taken = new Set<string>()
  return doc.sections.map((section) => {
    const head = section.grafs[0]
    const title = section.heading ?? (head ? phrase(head.text, 60) : 'Untitled beat')
    let short = section.heading
      ? section.short ?? shortLabel(section.heading)
      : head
        ? phrase(head.text, 20)
        : 'Untitled beat'
    // Two beats that read the same in the lane are not two beats you can tell
    // apart, so the second one takes more of the line it opens with.
    if (taken.has(short.toLowerCase()) && head) short = phrase(head.text, 38)
    taken.add(short.toLowerCase())
    return {
      id: section.id,
      title,
      short,
      sectionId: section.id,
      anchorId: section.id,
      grafs: section.grafs,
    }
  })
}

/**
 * Where the beats fall when there are no headings to fall on. The draft is
 * filled into runs of paragraphs: a run closes once it carries its share of the
 * prose, at a turn in the writing, or at the paragraph cap — never mid-turn,
 * and never on a scrap too light to be a beat of its own.
 */
function arrivalRuns(grafs: Graf[], opens: Set<string>): Graf[][] {
  const total = weigh(grafs)
  const want = Math.min(MAX_BEATS, Math.max(MIN_BEATS, Math.round(total / BEAT_WORDS)))
  const target = Math.max(MIN_WORDS, Math.ceil(total / want))

  const runs: Graf[][] = []
  let run: Graf[] = []
  let acc = 0
  for (const graf of grafs) {
    // Stop at whichever side of the target this paragraph lands nearer to:
    // filling until the run is over it makes every beat one paragraph too long,
    // and four paragraphs of even weight have to come out as four beats.
    const w = wordCount(graf.text)
    const heavy = run.length >= MAX_GRAFS || (acc >= MIN_WORDS && acc + w / 2 > target)
    const turn = acc >= MIN_WORDS && isHinge(graf)
    if (run.length && (heavy || turn || opens.has(graf.id))) {
      runs.push(run)
      run = []
      acc = 0
    }
    run.push(graf)
    acc += w
  }
  if (run.length) runs.push(run)

  // A stray last paragraph belongs to the beat it trails, not to itself.
  if (runs.length > 1) {
    const tail = runs[runs.length - 1]
    if (weigh(tail) < STRAY_WORDS && !opens.has(tail[0].id)) {
      runs[runs.length - 2] = runs[runs.length - 2].concat(tail)
      runs.pop()
    }
  }
  return runs
}

function arrivalBeats(doc: DocumentModel): Beat[] {
  const grafs: Graf[] = []
  const sectionOf = new Map<string, SectionDoc>()
  // A heading, where there is one, is an arrival like any other — it just comes
  // with its own name.
  const opens = new Set<string>()
  for (const section of doc.sections) {
    if (section.grafs[0]) opens.add(section.grafs[0].id)
    for (const graf of section.grafs) {
      grafs.push(graf)
      sectionOf.set(graf.id, section)
    }
  }
  if (grafs.length === 0) return sectionBeats(doc)

  const taken = new Set<string>()
  return arrivalRuns(grafs, opens).map((run, i) => {
    const head = run[0]
    const section = sectionOf.get(head.id) as SectionDoc
    const heading = opens.has(head.id) ? section.heading : null
    const title = heading ?? phrase(head.text, 60)
    let short = heading ? section.short ?? shortLabel(heading) : phrase(head.text, 20)
    // Two beats that open the same way are told apart by more of the sentence,
    // and only numbered when even that repeats.
    if (taken.has(short.toLowerCase())) short = phrase(head.text, 38)
    if (taken.has(short.toLowerCase())) short = `${short} (${i + 1})`
    taken.add(short.toLowerCase())
    return {
      id: `beat-${head.id}`,
      title,
      short,
      sectionId: section.id,
      anchorId: head.id,
      grafs: run,
    }
  })
}

/**
 * Headings when the draft is built on them, arrivals when it is not. One
 * heading over a whole draft is a title, not a structure, so it beats out with
 * the prose the same way a headingless draft does.
 */
export function beatsOf(doc: DocumentModel): Beat[] {
  const headings = doc.sections.filter((s) => s.heading !== null).length
  if (headings >= HEADED) return sectionBeats(doc)
  return arrivalBeats(doc)
}

export interface FlowModel {
  flow: FlowSection[]
  /** Which beat a paragraph landed in, so an open mark can light its beat. */
  beatOfGraf: Map<string, string>
  /** What to call where a mark is: the beat it sits in, not the section id. */
  whereOfMark: Map<string, string>
}

export function buildFlow(
  doc: DocumentModel,
  marks: Mark[],
  shown: Mark[],
  decisions: Record<string, Decision>,
): FlowModel {
  const beats = beatsOf(doc)
  const beatOfGraf = new Map<string, string>()
  const named = new Map<string, string>()
  for (const beat of beats) {
    named.set(beat.id, beat.short)
    for (const graf of beat.grafs) beatOfGraf.set(graf.id, beat.id)
  }

  const whereOfMark = new Map<string, string>()
  for (const mark of marks) {
    const beat = beatOfGraf.get(mark.grafIds[0])
    const name = beat ? named.get(beat) : undefined
    if (name) whereOfMark.set(mark.id, name)
  }

  const flow = beats.map((beat) => {
    // The flow measures the whole pass, not the filtered view of it: a lane
    // that changed length when you flipped a filter would be lying.
    const origWeight = Math.max(1, weigh(beat.grafs))
    const editWeight = grafWordsAfter(beat.grafs, marks, decisions)
    const here = shown.find((m) => beatOfGraf.get(m.grafIds[0]) === beat.id)
    return {
      id: beat.id,
      title: beat.title,
      short: beat.short,
      origWeight,
      editWeight: Math.min(origWeight, editWeight),
      changeId: here?.id ?? null,
      anchorId: beat.anchorId,
    }
  })
  return { flow, beatOfGraf, whereOfMark }
}
