/* Session construction. Layers are only comparable when they mark the same
   document, so any pass over a draft that has moved on reparses first and starts
   the stack clean. Re-running a pass replaces its own layer instead of piling
   another copy on top. */

import type { Decision, Layer, SessionState } from '../types'
import { parseMarkdown } from './markdown'

export const EMPTY_TITLE = 'Nothing on the paper yet'

/** What counts as a draft when one lands on the desk. */
export function isDraftFile(file: File): boolean {
  if (/\.(md|markdown|mdown|txt|text)$/i.test(file.name)) return true
  return file.type === 'text/markdown' || file.type === 'text/plain'
}

/**
 * How the desk opens: blank paper, an empty Original, a blank Edited. The
 * example is a thing you ask for, not the thing you land in, so nothing here
 * pretends to be your draft and the first Run pass cannot be a comparison.
 */
export function emptySession(): SessionState {
  return {
    originalMd: '',
    editedMd: '',
    docMd: '',
    document: {
      title: EMPTY_TITLE,
      derivedTitle: true,
      byline: null,
      epigraph: null,
      sections: [],
    },
    layers: [],
    activeLayerId: '',
    decisions: {},
    title: EMPTY_TITLE,
    sample: false,
  }
}

export function isEmptyDesk(session: SessionState): boolean {
  return session.document.sections.length === 0
}

/** Reparse when the draft has changed under the layers, otherwise leave it be. */
export function ensureDocument(session: SessionState, originalMd: string): SessionState {
  if (session.docMd === originalMd) return session
  const document = parseMarkdown(originalMd)
  return {
    ...session,
    originalMd,
    docMd: originalMd,
    document,
    layers: [],
    activeLayerId: '',
    decisions: {},
    title: document.title,
  }
}

export function nextLayerId(session: SessionState, kind: string): string {
  let n = 1
  while (session.layers.some((l) => l.id === `${kind}-${n}`)) n++
  return `${kind}-${n}`
}

/** Same label means the same pass run again: swap it, and drop its decisions. */
export function withLayer(session: SessionState, layer: Layer): SessionState {
  const previous = session.layers.find((l) => l.label === layer.label)
  const decisions: Record<string, Decision> = { ...session.decisions }
  if (previous) for (const mark of previous.marks) delete decisions[mark.id]
  const layers = previous
    ? session.layers.map((l) => (l.id === previous.id ? layer : l))
    : [...session.layers, layer]
  return { ...session, layers, activeLayerId: layer.id, decisions }
}

export function activeLayer(session: SessionState): Layer | null {
  return session.layers.find((l) => l.id === session.activeLayerId) ?? session.layers[0] ?? null
}

export function activeMarks(session: SessionState) {
  return activeLayer(session)?.marks ?? []
}
