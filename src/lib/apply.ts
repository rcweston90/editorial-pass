/* Working copy and counts. Pending reads as accepted — the pass is the proposal
   and a rejection is what pushes back — so the edited view and the export are
   the same document, and Export never surprises you. */

import type { Decision, DocumentModel, Graf, Mark, PassStats, SectionDoc } from '../types'
import { blocksToGrafs, documentToMarkdown, documentWords, wordCount } from './markdown'

export function decisionOf(decisions: Record<string, Decision>, id: string): Decision {
  return decisions[id] ?? 'pending'
}

/** Accepted and pending marks apply; rejected ones leave the original standing. */
export function isApplied(decisions: Record<string, Decision>, mark: Mark): boolean {
  return decisionOf(decisions, mark.id) !== 'rejected'
}

function applyToGrafs(grafs: Graf[], marks: Mark[], prefix: string): Graf[] {
  const removes = new Set<string>()
  const swaps = new Map<string, Graf[]>()
  for (const mark of marks) {
    const [head, ...rest] = mark.grafIds
    if (mark.altered) swaps.set(head, blocksToGrafs(mark.altered, `${prefix}-x${mark.id}`))
    else removes.add(head)
    for (const id of rest) removes.add(id)
  }

  const out: Graf[] = []
  for (const graf of grafs) {
    const swap = swaps.get(graf.id)
    if (swap) {
      out.push(...swap)
      continue
    }
    if (removes.has(graf.id)) continue
    out.push(graf)
  }
  return out
}

function applyToSection(section: SectionDoc, marks: Mark[]): SectionDoc {
  return { ...section, grafs: applyToGrafs(section.grafs, marks, section.id) }
}

/**
 * The manuscript as the pass would leave it: whole-section cuts drop out, spans
 * with a replacement are swapped, everything else is untouched original prose.
 */
export function workingDocument(
  doc: DocumentModel,
  marks: Mark[],
  decisions: Record<string, Decision>,
): DocumentModel {
  const live = marks.filter((m) => isApplied(decisions, m))
  const dropped = new Set<string>()
  const bySection = new Map<string, Mark[]>()
  for (const mark of live) {
    if (mark.wholeSection) {
      dropped.add(mark.sectionId)
      continue
    }
    const list = bySection.get(mark.sectionId)
    if (list) list.push(mark)
    else bySection.set(mark.sectionId, [mark])
  }

  const sections: SectionDoc[] = []
  for (const section of doc.sections) {
    if (dropped.has(section.id)) continue
    const marksHere = bySection.get(section.id)
    sections.push(marksHere ? applyToSection(section, marksHere) : section)
  }
  return { ...doc, sections }
}

/**
 * What a run of paragraphs weighs once the pass is applied to it. The flow
 * measures beats, which may be a section or part of one, so this takes the
 * grafs rather than the section they came from.
 */
export function grafWordsAfter(
  grafs: Graf[],
  marks: Mark[],
  decisions: Record<string, Decision>,
): number {
  const ids = new Set(grafs.map((g) => g.id))
  const live = marks.filter(
    (m) => isApplied(decisions, m) && m.grafIds.some((id) => ids.has(id)),
  )
  const after = live.length ? applyToGrafs(grafs, live, 'beat') : grafs
  let n = 0
  for (const g of after) n += wordCount(g.text)
  return n
}

/**
 * Two readings of the same pass. `wordsOut` is the working copy — open marks
 * read as taken, which is what the edited view shows and what Export writes.
 * `wordsTaken` is only what you have decided, so taking a mark moves it: a
 * count that sat still while you worked would be reporting the pass, not you.
 */
export function passStats(
  doc: DocumentModel,
  marks: Mark[],
  decisions: Record<string, Decision>,
): PassStats {
  const wordsIn = documentWords(doc)
  const wordsOut = documentWords(workingDocument(doc, marks, decisions))
  const taken = marks.filter((m) => decisionOf(decisions, m.id) === 'accepted')
  const wordsTaken = documentWords(workingDocument(doc, taken, decisions))
  const share = (words: number) => (wordsIn ? Math.round(((wordsIn - words) / wordsIn) * 100) : 0)
  const stats: PassStats = {
    wordsIn,
    wordsTaken,
    pctTaken: share(wordsTaken),
    wordsOut,
    pctCut: share(wordsOut),
    cut: 0,
    compressed: 0,
    rewritten: 0,
    accepted: 0,
    rejected: 0,
    pending: 0,
    total: marks.length,
  }
  for (const mark of marks) {
    stats[mark.type]++
    stats[decisionOf(decisions, mark.id)]++
  }
  return stats
}

export function exportMarkdown(
  doc: DocumentModel,
  marks: Mark[],
  decisions: Record<string, Decision>,
): string {
  return documentToMarkdown(workingDocument(doc, marks, decisions))
}

export function fileSlug(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return s || 'manuscript'
}
