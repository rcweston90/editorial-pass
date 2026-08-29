/* The model pass, and the honest fallback. If /api/pass has a key we send the
   draft and map the excerpts it returns back onto real paragraphs; anything we
   can't find in the manuscript is dropped rather than guessed at. If there is no
   key, or the call fails, the local engine runs and the blotter says so. */

import type { ChangeType, DocumentModel, Graf, Mark, SectionDoc, Track } from '../types'
import { grafsToBlocks, parseInline } from './markdown'
import { MATCH, similarity } from './text'
import { localPass } from './localPass'

const ENDPOINT = '/api/pass'
const TYPES: ChangeType[] = ['cut', 'compressed', 'rewritten']
const TRACKS: Track[] = ['Voice', 'Skeptic', 'Cut', 'HN']

export interface PassResult {
  marks: Mark[]
  label: string
  source: 'local' | 'llm'
  notice: string | null
}

interface ApiMark {
  type?: string
  track?: string
  note?: string
  originalExcerpts?: unknown
  alteredExcerpts?: unknown
}

/** Asked once on load; a dev server with no function just answers with HTML. */
export async function probePass(): Promise<boolean> {
  try {
    const res = await fetch(ENDPOINT, { method: 'GET', headers: { accept: 'application/json' } })
    if (!res.ok) return false
    const body = (await res.json()) as { available?: unknown }
    return body.available === true
  } catch {
    return false
  }
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

interface Site {
  section: SectionDoc
  graf: Graf
  index: number
}

/** Excerpts come back as prose; the manuscript is the authority on where it sits. */
function locate(sites: Site[], excerpt: string): Site | null {
  let best: Site | null = null
  let score = MATCH
  for (const site of sites) {
    const s = similarity(site.graf.text, excerpt)
    if (s > score) {
      score = s
      best = site
    }
  }
  return best
}

function mapMarks(doc: DocumentModel, raw: ApiMark[], layerId: string): Mark[] {
  const sites: Site[] = []
  for (const section of doc.sections) {
    section.grafs.forEach((graf, index) => sites.push({ section, graf, index }))
  }

  const marks: Mark[] = []
  const claimed = new Set<string>()

  raw.forEach((entry, i) => {
    const type = TYPES.includes(entry.type as ChangeType) ? (entry.type as ChangeType) : null
    if (!type) return
    const excerpts = strings(entry.originalExcerpts)
    if (!excerpts.length) return

    const found: Site[] = []
    for (const excerpt of excerpts) {
      const site = locate(sites, excerpt)
      if (site && !found.some((f) => f.graf.id === site.graf.id)) found.push(site)
    }
    if (!found.length) return

    // One mark cannot straddle two sections, and its span has to be contiguous
    // or the sheet would render the paragraphs it skipped out of order.
    const section = found[0].section
    const inSection = found.filter((f) => f.section.id === section.id)
    const lo = Math.min(...inSection.map((f) => f.index))
    const hi = Math.max(...inSection.map((f) => f.index))
    if (hi - lo > 7) return
    const span = section.grafs.slice(lo, hi + 1)
    if (span.some((g) => claimed.has(g.id))) return

    const altered = type === 'rewritten' ? strings(entry.alteredExcerpts) : []
    if (type === 'rewritten' && (altered.length !== 1 || span.length !== 1)) return
    for (const g of span) claimed.add(g.id)

    const note = typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim() : ''
    marks.push({
      id: `${layerId}-${section.id}-${i}`,
      type: span.length > 1 && type === 'cut' ? 'compressed' : type,
      track: TRACKS.includes(entry.track as Track) ? (entry.track as Track) : 'Cut',
      sectionId: section.id,
      sectionTitle: section.heading ?? 'Opening',
      grafIds: span.map((g) => g.id),
      note: note || fallbackNote(type, span.length),
      original: grafsToBlocks(span),
      altered: altered.length ? [{ tag: 'p', content: parseInline(altered[0]) }] : null,
      source: 'llm',
      layerId,
    })
  })

  return marks
}

function fallbackNote(type: ChangeType, span: number): string {
  if (type === 'rewritten') return 'Tightened without changing the claim.'
  if (span > 1) return `${span} paragraphs taken out.`
  return 'This paragraph does not earn its place.'
}

const NO_KEY = 'Local pass — no model key on this deploy.'
const FAILED = 'Local pass — the model call did not come back.'
const THIN = 'Local pass — the model returned nothing that matched the manuscript.'

const EMPTY = 'There is not enough draft here to mark. Paste more of it.'

function local(doc: DocumentModel, layerId: string, notice: string | null): PassResult {
  const marks = localPass(doc, layerId)
  // A pass that comes back with nothing says so out loud rather than looking
  // like it worked and found a perfect draft.
  const said = marks.length === 0 ? [notice, EMPTY].filter(Boolean).join(' ') : notice
  return { marks, label: 'Local pass', source: 'local', notice: said }
}

export async function runPass(
  doc: DocumentModel,
  originalMd: string,
  layerId: string,
  available: boolean,
): Promise<PassResult> {
  if (!available) return local(doc, layerId, NO_KEY)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ original: originalMd }),
    })
    if (!res.ok) return local(doc, layerId, FAILED)
    const body = (await res.json()) as { marks?: unknown }
    const raw = Array.isArray(body.marks) ? (body.marks as ApiMark[]) : []
    const marks = mapMarks(doc, raw, layerId)
    if (!marks.length) return local(doc, layerId, THIN)
    return { marks, label: 'Editorial pass', source: 'llm', notice: null }
  } catch {
    return local(doc, layerId, FAILED)
  }
}
