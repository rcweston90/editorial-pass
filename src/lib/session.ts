/* The render model. A document, the active layer's marks and the current
   decisions go in; the section spine the sheet draws and the two-track flow
   come out. Nothing below this line knows where the marks came from. */

import type {
  ChangeBlock,
  Decision,
  DocumentModel,
  EssayNode,
  EssaySection,
  Filters,
  FlowSection,
  Graf,
  Mark,
  Para,
  RewrittenGraf,
  SectionDoc,
} from '../types'
import { grafsToBlocks } from './markdown'
import { decisionOf } from './apply'
import { buildFlow } from './flow'

export function markVisible(mark: Mark, filters: Filters): boolean {
  if (filters.type !== 'all' && mark.type !== filters.type) return false
  if (filters.track !== 'all' && mark.track !== filters.track) return false
  return true
}

export function visibleMarks(marks: Mark[], filters: Filters): Mark[] {
  return marks.filter((m) => markVisible(m, filters))
}

/** A paragraph that is nothing but a bold line is the essay's drumbeat, not a graf. */
function paraFor(graf: Graf): Para {
  const only = graf.content.length === 1 ? graf.content[0] : null
  const kicker = only !== null && typeof only !== 'string' && only.tag === 'strong'
  const node: Para = { kind: 'p', content: graf.content, anchorId: graf.id }
  if (kicker) node.className = 'kicker'
  return node
}

function nodesFor(
  section: SectionDoc,
  marks: Mark[],
  decisions: Record<string, Decision>,
): EssayNode[] {
  const heads = new Map<string, Mark>()
  const inside = new Set<string>()
  for (const mark of marks) {
    heads.set(mark.grafIds[0], mark)
    for (const id of mark.grafIds.slice(1)) inside.add(id)
  }

  const nodes: EssayNode[] = []
  for (const graf of section.grafs) {
    if (inside.has(graf.id)) continue
    const mark = heads.get(graf.id)
    if (!mark) {
      nodes.push(paraFor(graf))
      continue
    }
    const rejected = decisionOf(decisions, mark.id) === 'rejected'
    const span = section.grafs.filter((g) => mark.grafIds.includes(g.id))

    if (mark.type === 'rewritten' && mark.altered) {
      const node: RewrittenGraf = {
        kind: 'rewritten',
        changeId: mark.id,
        anchorId: graf.id,
        orig: graf.content,
        // A rejected rewrite reverts: the original stands in both readings.
        edit: rejected ? graf.content : mark.altered[0].content,
      }
      nodes.push(node)
      continue
    }
    const node: ChangeBlock = {
      kind: 'change-block',
      changeId: mark.id,
      anchorId: graf.id,
      type: mark.type === 'rewritten' ? 'compressed' : mark.type,
      blocks: grafsToBlocks(span),
      altered: mark.altered,
    }
    nodes.push(node)
  }
  return nodes
}

export interface RenderModel {
  sections: EssaySection[]
  flow: FlowSection[]
  /** Which flow beat a paragraph landed in. */
  beatOfGraf: Map<string, string>
  /** Where a mark is, in the words of the beat it sits in. */
  whereOfMark: Map<string, string>
}

export function buildRender(
  doc: DocumentModel,
  marks: Mark[],
  decisions: Record<string, Decision>,
  filters: Filters,
): RenderModel {
  const shown = visibleMarks(marks, filters)
  const sections: EssaySection[] = []

  for (const section of doc.sections) {
    const here = shown.filter((m) => m.sectionId === section.id)
    const whole = here.find((m) => m.wholeSection)
    const heading = section.headingInline ?? undefined

    if (whole) {
      sections.push({
        id: section.id,
        heading,
        nodes: [],
        wholeCut: {
          changeId: whole.id,
          anchorId: section.grafs[0]?.id ?? section.id,
          heading: section.headingInline ?? [section.heading ?? 'Opening'],
          blocks: grafsToBlocks(section.grafs),
        },
      })
    } else {
      sections.push({
        id: section.id,
        heading,
        nodes: nodesFor(section, here, decisions),
      })
    }
  }

  const { flow, beatOfGraf, whereOfMark } = buildFlow(doc, marks, shown, decisions)
  return { sections, flow, beatOfGraf, whereOfMark }
}

/** j/k walks these, in manuscript order. */
export function walkOrder(doc: DocumentModel, marks: Mark[], filters: Filters): string[] {
  const rank = new Map<string, number>()
  doc.sections.forEach((s, si) => {
    rank.set(s.id, si * 1000)
    s.grafs.forEach((g, gi) => rank.set(g.id, si * 1000 + gi))
  })
  return visibleMarks(marks, filters)
    .slice()
    .sort((a, b) => (rank.get(a.grafIds[0]) ?? 0) - (rank.get(b.grafIds[0]) ?? 0))
    .map((m) => m.id)
}

export function markIndex(marks: Mark[]): Map<string, Mark> {
  return new Map(marks.map((m) => [m.id, m]))
}
