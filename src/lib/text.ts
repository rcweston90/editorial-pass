/* Shared text measures. The diff and the local pass both need to decide whether
   two paragraphs are the same paragraph, so they decide it the same way. */

/** Lowercase, collapse whitespace, drop punctuation except apostrophes inside words. */
export function normalize(s: string): string {
  const words = s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]+/gu, ' ')
    .split(/\s+/)
  const out: string[] = []
  for (const w of words) {
    const t = w.replace(/^'+|'+$/g, '')
    if (t) out.push(t)
  }
  return out.join(' ')
}

export const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'been', 'before', 'being', 'between', 'both',
  'came', 'could', 'does', 'doing', 'down', 'each', 'even', 'ever', 'every', 'from', 'have',
  'having', 'here', 'into', 'just', 'like', 'made', 'make', 'many', 'more', 'most', 'much',
  'must', 'never', 'only', 'other', 'over', 'said', 'same', 'shall', 'should', 'since', 'some',
  'still', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
  'this', 'those', 'through', 'under', 'very', 'want', 'were', 'what', 'when', 'where', 'which',
  'while', 'will', 'with', 'would', 'your', "you're", "it's", "that's", "don't", "doesn't",
])

/** Words worth comparing: long enough to carry meaning. */
export function contentWords(s: string, dropStopwords = false): Set<string> {
  const out = new Set<string>()
  for (const w of normalize(s).split(' ')) {
    if (w.length < 4) continue
    if (dropStopwords && STOPWORDS.has(w)) continue
    out.add(w)
  }
  return out
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return shared / (a.size + b.size - shared)
}

/**
 * 1 when the paragraphs are the same paragraph; 0.85 when one swallowed the
 * other; otherwise how much vocabulary they hold in common.
 */
export function similarity(a: string, b: string): number {
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return 1
  if (!na || !nb) return 0
  const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length)
  if (ratio > 0.6 && (na.includes(nb) || nb.includes(na))) return 0.85
  return jaccard(contentWords(a), contentWords(b))
}

export const MATCH = 0.55

export function sentences(text: string): string[] {
  const out: string[] = []
  const re = /[^.!?]+[.!?]*\s*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const s = m[0]
    if (s.trim()) out.push(s)
  }
  return out.length ? out : [text]
}

export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Word-boundary phrase matcher that tolerates hard-wrapped whitespace. The
 * boundaries are only added where the phrase actually starts or ends on a word,
 * so a phrase ending in a full stop still matches.
 */
export function phraseRe(phrase: string): RegExp {
  const trimmed = phrase.trim()
  const body = trimmed.split(/\s+/).map(escapeRe).join('\\s+')
  const head = /^[\p{L}\p{N}]/u.test(trimmed) ? '\\b' : ''
  const tail = /[\p{L}\p{N}]$/u.test(trimmed) ? '\\b' : ''
  return new RegExp(`${head}${body}${tail}`, 'giu')
}
