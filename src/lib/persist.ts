/* One key, one versioned blob, and every read is defensive. A refresh must not
   cost you a draft; a corrupt blob must not cost you the app.

   What is saved is a draft you put on the paper yourself: layers may be empty,
   the document may have no sections, and both of those restore. Two things a
   reload may never do — put text back in a box you left empty, and hand you the
   example. The sample is a thing you ask for out loud, every time; it is never
   what a cold load opens on, so it is never written down at all. */

import type { SessionState } from '../types'

const KEY = 'editorial-pass:v3'
const VERSION = 3
/* Every desk that shipped before this one, including any still holding the
   example. They are dropped on first read, not read and filtered. */
const LEGACY = ['editorial-pass:v1', 'editorial-pass:v2']

interface Blob {
  v: number
  originalMd: string
  editedMd: string
  docMd: string | null
  document: SessionState['document']
  layers: SessionState['layers']
  activeLayerId: string
  decisions: SessionState['decisions']
  title: string
  sample: boolean
}

export function saveSession(session: SessionState): void {
  // The example on the paper is a session in progress, never a session to come
  // back to: it takes the store with it rather than lying in wait in one.
  if (session.sample || session.layers.some((l) => l.source === 'example')) {
    clearSession()
    return
  }
  try {
    const blob: Blob = { v: VERSION, ...session }
    localStorage.setItem(KEY, JSON.stringify(blob))
  } catch {
    // Private mode, full quota, no storage at all — the draft is still on screen.
  }
}

export function loadSession(): SessionState | null {
  let raw: string | null = null
  try {
    for (const old of LEGACY) localStorage.removeItem(old)
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const blob = JSON.parse(raw) as Partial<Blob>
    if (blob.v !== VERSION) return null
    if (typeof blob.originalMd !== 'string') return null
    if (!blob.document || !Array.isArray(blob.document.sections)) return null
    if (!Array.isArray(blob.layers)) return null
    // Belt to the brace above: a sample blob from anywhere is not a draft of
    // yours, so first paint ignores it and opens on empty paper instead.
    if (blob.sample === true) return null
    if (blob.layers.some((l) => l?.source === 'example')) return null
    const activeLayerId = blob.layers.some((l) => l.id === blob.activeLayerId)
      ? (blob.activeLayerId as string)
      : (blob.layers[0]?.id ?? '')
    return {
      originalMd: blob.originalMd,
      editedMd: typeof blob.editedMd === 'string' ? blob.editedMd : '',
      docMd: typeof blob.docMd === 'string' ? blob.docMd : null,
      document: blob.document,
      layers: blob.layers,
      activeLayerId,
      decisions: blob.decisions ?? {},
      title: blob.title || blob.document.title || 'Untitled draft',
      sample: false,
    }
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY)
    for (const old of LEGACY) localStorage.removeItem(old)
  } catch {
    // Nothing to clear if storage was never available.
  }
}
