/* The split reading: the original in the left column, the working copy in the
   right, the marks in the gutter between them. Rows are built off the same
   render model the unified spine uses, so the original is always the spine —
   a whole-section cut takes the right column, never the left. */

import type {
  Block,
  ChangeType,
  Decision,
  DeltaBlock,
  EssaySection,
  Mark,
  SplitRow,
} from '../types'
import { decisionOf } from './apply'
import { wordDelta, words } from './delta'
import { plain } from './markdown'

function blockWords(block: Block): number {
  return words(plain(block.content)).length
}

function flatten(blocks: Block[]): string {
  return blocks.map((b) => plain(b.content)).join(' ')
}

function unmarked(blocks: Block[]): DeltaBlock[] {
  return blocks.map((b) => ({
    tag: b.tag,
    content: b.content,
    flags: new Array<boolean>(blockWords(b)).fill(false),
  }))
}

/** Cuts one flat flags array back up along the block boundaries it came from. */
function spread(blocks: Block[], flags: boolean[]): DeltaBlock[] {
  let at = 0
  return blocks.map((b) => {
    const n = blockWords(b)
    const slice = flags.slice(at, at + n)
    at += n
    while (slice.length < n) slice.push(false)
    return { tag: b.tag, content: b.content, flags: slice }
  })
}

interface Sides {
  left: DeltaBlock[]
  right: DeltaBlock[] | null
}

/** Both versions, each word flagged with what happened to it. */
function sides(original: Block[], altered: Block[] | null, rejected: boolean): Sides {
  // A rejection puts the original back: the working copy is the original, and
  // there is no delta to draw.
  if (rejected) return { left: unmarked(original), right: unmarked(original) }
  if (!altered) return { left: unmarked(original), right: null }
  const delta = wordDelta(flatten(original), flatten(altered))
  return { left: spread(original, delta.aFlags), right: spread(altered, delta.bFlags) }
}

export function buildSplit(
  sections: EssaySection[],
  decisions: Record<string, Decision>,
): SplitRow[] {
  const rows: SplitRow[] = []

  for (const section of sections) {
    const cut = section.wholeCut
    const heading = section.heading ?? (cut ? cut.heading : undefined)
    const cutDecision = cut ? decisionOf(decisions, cut.changeId) : 'pending'

    if (heading) {
      rows.push({
        kind: 'heading',
        id: `${section.id}-h`,
        anchorId: section.id,
        heading,
        gone: cut !== undefined && cutDecision !== 'rejected',
      })
    }

    if (cut) {
      rows.push({
        kind: 'change',
        id: `${section.id}-whole`,
        anchorId: cut.anchorId,
        changeId: cut.changeId,
        type: 'cut',
        whole: true,
        decision: cutDecision,
        // The section still stands in the left column. That is the point of it.
        left: unmarked(cut.blocks),
        right: cutDecision === 'rejected' ? unmarked(cut.blocks) : null,
      })
      continue
    }

    for (const node of section.nodes) {
      if (node.kind === 'p') {
        const row: SplitRow = {
          kind: 'kept',
          id: node.anchorId,
          anchorId: node.anchorId,
          content: node.content,
        }
        if (node.className) row.className = node.className
        rows.push(row)
        continue
      }

      const decision = decisionOf(decisions, node.changeId)
      const rejected = decision === 'rejected'
      const type: ChangeType = node.kind === 'rewritten' ? 'rewritten' : node.type
      const original: Block[] =
        node.kind === 'rewritten' ? [{ tag: 'p', content: node.orig }] : node.blocks
      const altered: Block[] | null =
        node.kind === 'rewritten' ? [{ tag: 'p', content: node.edit }] : node.altered
      const { left, right } = sides(original, altered, rejected)

      rows.push({
        kind: 'change',
        id: node.anchorId,
        anchorId: node.anchorId,
        changeId: node.changeId,
        type,
        whole: false,
        decision,
        left,
        right,
      })
    }
  }

  return rows
}

/**
 * The files-changed strip above the columns: which beats the pass touched. The
 * names are the render model's — the same ones the flow bars and the margin
 * marks carry, so a draft with no headings never lists five Openings.
 */
export function changedBeats(
  marks: Mark[],
  where: Map<string, string>,
): Array<{ changeId: string; label: string }> {
  const out: Array<{ changeId: string; label: string }> = []
  const seen = new Set<string>()
  for (const mark of marks) {
    const name = where.get(mark.id) ?? mark.sectionTitle
    if (seen.has(name)) continue
    seen.add(name)
    out.push({ changeId: mark.id, label: name })
  }
  return out
}
