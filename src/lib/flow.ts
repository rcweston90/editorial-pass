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
  anchorId: string
  grafs: Graf[]
}

const MIN_WORDS = 30
const MAX_GRAFS = 5
const BEAT_WORDS = 170
const MIN_BEATS = 4
const MAX_BEATS = 8
const STRAY_WORDS = 22
const HINGE_WORDS = 12
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

function arrivalRuns(grafs: Graf[], opens: Set<string>): Graf[][] {
  const total = weigh(grafs)
  const want = Math.min(MAX_BEATS, Math.max(MIN_BEATS, Math.round(total / BEAT_WORDS)))
  const target = Math.max(MIN_WORDS, Math.ceil(total / want))

  const runs: Graf[][] = []
  let run: Graf[] = []
  let acc = 0
  for (const graf of grafs) {
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

export function beatsOf(doc: DocumentModel): Beat[] {
  const headings = doc.sections.filter((s) => s.heading !== null).length
  if (headings >= HEADED) return sectionBeats(doc)
  return arrivalBeats(doc)
}

export interface FlowModel {
  flow: FlowSection[]
  beatOfGraf: Map<string, string>
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
