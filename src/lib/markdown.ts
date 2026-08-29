/* Enough CommonMark to round-trip an essay: title, byline, epigraph, ## sections,
   blank-line paragraphs, *em* and **strong**. Zero dependencies, and nothing is
   sanitised — em-dashes, curly quotes and profanity all survive the trip. */

import type { Block, DocumentModel, Graf, Inline, SectionDoc } from '../types'

export function plain(content: Inline[]): string {
  let out = ''
  for (const node of content) out += typeof node === 'string' ? node : plain(node.content)
  return out
}

export function wordCount(text: string): number {
  let n = 0
  for (const w of text.split(/\s+/)) if (w) n++
  return n
}

export function slug(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return out || 'section'
}

/* ---------------- inline ---------------- */

/**
 * Walks the string rather than running regexes over it, so a `*` only opens a
 * span when a matching close exists. Em-dashes are ordinary characters here and
 * are never touched.
 */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  let i = 0

  const flush = () => {
    if (buf) {
      out.push(buf)
      buf = ''
    }
  }

  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\' && i + 1 < src.length && '*_\\`'.includes(src[i + 1])) {
      buf += src[i + 1]
      i += 2
      continue
    }
    if (ch === '*') {
      const double = src[i + 1] === '*'
      const width = double ? 2 : 1
      const close = findClose(src, i + width, double)
      // A marker with nothing behind it, or opening on a space, is just an asterisk.
      if (close > i + width && !/\s/.test(src[i + width])) {
        flush()
        out.push({
          tag: double ? 'strong' : 'em',
          content: parseInline(src.slice(i + width, close)),
        })
        i = close + width
        continue
      }
    }
    buf += ch
    i++
  }
  flush()
  return out
}

function findClose(src: string, from: number, double: boolean): number {
  let i = from
  while (i < src.length) {
    if (src[i] === '\\') {
      i += 2
      continue
    }
    if (src[i] === '*') {
      const isDouble = src[i + 1] === '*'
      if (double && isDouble) return i
      if (!double && !isDouble) return i
      // A `**` inside an *em* span belongs to a nested strong; step over it.
      i += isDouble ? 2 : 1
      continue
    }
    i++
  }
  return -1
}

export function serializeInline(content: Inline[]): string {
  let out = ''
  for (const node of content) {
    if (typeof node === 'string') out += node
    else if (node.tag === 'em') out += `*${serializeInline(node.content)}*`
    else out += `**${serializeInline(node.content)}**`
  }
  return out
}

/* ---------------- document ---------------- */

/** Past this, a line was never wrapped by a text editor. */
const WRAP_COLUMN = 140

/**
 * A run of lines with no blank line between them is normally one hard-wrapped
 * paragraph, and joining it is right. But a draft pasted out of a plain-text
 * editor, a mail client or a doc arrives with its blank lines eaten, and then
 * every paragraph is its own line — and reading that as a single paragraph is
 * how a whole draft collapses into one block with nothing to say about it.
 *
 * The two are told apart by shape: a hard wrap is capped near a column and
 * breaks mid-sentence, while pasted paragraphs run past any column and land on
 * a full stop.
 */
function separateParagraphs(run: string[]): boolean {
  if (run.length < 2) return false
  let longest = 0
  let landed = 0
  for (const line of run) {
    const t = line.trim()
    if (t.length > longest) longest = t.length
    if (/[.!?][)"'’”]*$/.test(t)) landed++
  }
  if (longest > WRAP_COLUMN) return true
  // Nothing long enough to be sure, but every line ends a sentence: paragraphs.
  return run.length >= 3 && landed / run.length >= 0.85
}

/**
 * Split into blank-line separated chunks, keeping hard wraps inside a chunk —
 * unless the run is a paste whose blank lines went missing, in which case each
 * line is its own paragraph.
 */
function chunks(src: string): string[] {
  const out: string[] = []
  let buf: string[] = []
  const flush = () => {
    if (!buf.length) return
    if (separateParagraphs(buf)) for (const line of buf) out.push(line)
    else out.push(buf.join('\n'))
    buf = []
  }
  for (const line of src.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') flush()
    else buf.push(line)
  }
  flush()
  return out
}

/** A whole chunk wrapped in a single `*…*` — the byline line under a title. */
function isBylineChunk(chunk: string): boolean {
  if (chunk.includes('\n')) return false
  const t = chunk.trim()
  if (!t.startsWith('*') || t.startsWith('**') || !t.endsWith('*') || t.length < 4) return false
  const inner = t.slice(1, -1)
  return !inner.includes('*')
}

export function parseMarkdown(src: string): DocumentModel {
  const sections: SectionDoc[] = []
  const taken = new Set<string>()
  let title = ''
  let byline: Inline[] | null = null
  let epigraph: string | null = null
  let current: SectionDoc | null = null
  let body = false

  const openSection = (heading: string | null) => {
    const base = heading === null ? 'lede' : slug(heading)
    let id = base
    let n = 2
    while (taken.has(id)) id = `${base}-${n++}`
    taken.add(id)
    const section: SectionDoc = {
      id,
      heading,
      headingInline: heading === null ? null : parseInline(heading),
      grafs: [],
    }
    sections.push(section)
    current = section
    return section
  }

  const addGraf = (text: string, tag?: 'p' | 'h3') => {
    const section = current ?? openSection(null)
    const content = parseInline(text)
    const graf: Graf = { id: `${section.id}-g${section.grafs.length}`, text: plain(content), content }
    if (tag === 'h3') graf.tag = 'h3'
    section.grafs.push(graf)
    body = true
  }

  for (const chunk of chunks(src)) {
    const first = chunk.split('\n')[0]

    if (!title && !body && /^#\s+/.test(first)) {
      title = chunk.replace(/^#\s+/, '').replace(/\s*#*\s*$/, '').trim()
      continue
    }
    if (/^##\s+/.test(first)) {
      openSection(first.replace(/^##\s+/, '').replace(/\s*#*\s*$/, '').trim())
      continue
    }
    if (/^###\s+/.test(first)) {
      addGraf(first.replace(/^###\s+/, '').trim(), 'h3')
      continue
    }
    if (/^>\s?/.test(first)) {
      const quoted = chunk
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n')
        .trim()
      if (!epigraph && !body) {
        epigraph = quoted
        continue
      }
      addGraf(quoted)
      continue
    }
    if (!byline && !body && title && isBylineChunk(chunk)) {
      byline = parseInline(chunk.trim())
      continue
    }
    addGraf(chunk)
  }

  // A draft with no h1 still deserves a name in the chrome — but the name is
  // borrowed, not written, so nothing downstream may print it as a heading.
  if (!title) {
    const firstGraf = sections[0]?.grafs[0]
    const borrowed = firstGraf
      ? firstGraf.text.split(/(?<=[.!?])\s/)[0].slice(0, 64).trim()
      : 'Untitled draft'
    return { title: borrowed, derivedTitle: true, byline, epigraph, sections }
  }
  return { title, byline, epigraph, sections }
}

export function documentToMarkdown(doc: DocumentModel): string {
  const parts: string[] = []
  if (doc.title && !doc.derivedTitle) parts.push(`# ${doc.title}`)
  if (doc.byline) parts.push(serializeInline(doc.byline))
  if (doc.epigraph) parts.push(doc.epigraph.split('\n').map((l) => `> ${l}`).join('\n'))
  for (const section of doc.sections) {
    if (section.heading) parts.push(`## ${section.heading}`)
    for (const graf of section.grafs) {
      const text = serializeInline(graf.content)
      parts.push(graf.tag === 'h3' ? `### ${text}` : text)
    }
  }
  return `${parts.join('\n\n')}\n`
}

/* ---------------- conversions ---------------- */

export function grafsToBlocks(grafs: Graf[]): Block[] {
  return grafs.map((g) => ({ tag: g.tag ?? 'p', content: g.content }))
}

export function blocksToGrafs(blocks: Block[], idPrefix: string): Graf[] {
  return blocks.map((b, i) => {
    const graf: Graf = { id: `${idPrefix}-${i}`, text: plain(b.content), content: b.content }
    if (b.tag === 'h3') graf.tag = 'h3'
    return graf
  })
}

export function sectionWords(section: SectionDoc): number {
  let n = 0
  for (const g of section.grafs) n += wordCount(g.text)
  return n
}

export function documentWords(doc: DocumentModel): number {
  let n = 0
  for (const s of doc.sections) n += sectionWords(s)
  return n
}

const LEADING = /^(the|a|an|why|how|what|i|it|on|in|of)\s+/i

/** A flow-lane label short enough to sit under a bar. */
export function shortLabel(heading: string | null): string {
  if (heading === null) return 'Opening'
  const stripped = heading.replace(/^["“']+|["”']+$/g, '').trim()
  const trimmed = stripped.replace(LEADING, '') || stripped
  if (trimmed.length <= 18) return trimmed
  const words = trimmed.split(/\s+/)
  let out = words[0]
  for (const w of words.slice(1)) {
    if (`${out} ${w}`.length > 18) break
    out += ` ${w}`
  }
  return out
}
