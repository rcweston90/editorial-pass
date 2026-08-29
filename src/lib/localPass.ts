/* The local editorial engine. It is a real editor with a small vocabulary: it
   deletes, it compresses, it drops phrases the author already wrote. It never
   invents a sentence, and it never claims a model wrote it. Altered prose is
   always a subset of the original plus whitespace and capitalisation glue.

   It also refuses to come back empty-handed. Ordinary prose — no hedges, no
   headings, nobody clearing their throat — still has long paragraphs, stalls
   and vocabulary it has already spent, so the pass ends with reserves that are
   deletions of real sentences rather than a shrug. */

import type { DocumentModel, Graf, Inline, Mark, SectionDoc, Track } from '../types'
import { grafsToBlocks, plain, wordCount } from './markdown'
import { contentWords, escapeRe, jaccard, phraseRe, sentences } from './text'

const MAX_MARKS = 12

/**
 * A pass that says nothing is a bug, not modesty. Four marks is the floor for
 * anything with a draft's worth of prose in it; a long draft owes more.
 */
function floorFor(words: number): number {
  if (words < 220) return 2
  if (words < 1000) return 4
  return Math.min(8, 4 + Math.round((words - 1000) / 700))
}

interface Candidate {
  confidence: number
  order: number
  type: 'cut' | 'compressed' | 'rewritten'
  track: Track
  section: SectionDoc
  grafs: Graf[]
  note: string
  altered: Inline[][] | null
}

interface Site {
  section: SectionDoc
  graf: Graf
  words: number
  /** Position in the manuscript, and in its own section. */
  order: number
  index: number
  last: number
}

/* ---------------- prose surgery ---------------- */

function hasStrong(content: Inline[]): boolean {
  for (const node of content) {
    if (typeof node === 'string') continue
    if (node.tag === 'strong') return true
    if (hasStrong(node.content)) return true
  }
  return false
}

/** Whitespace and capitalisation glue after a deletion. Adds no words. */
function tidy(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([.!?])\s+[—–-]\s*(but|and|yet|though|so|still)\s+/gi, '$1 ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([.!?]\s+)(\p{Ll})/gu, (_m, lead: string, ch: string) => lead + ch.toUpperCase())
}

interface Surgery {
  content: Inline[]
  hits: string[]
}

/** Removes each pattern wherever it appears, keeping em/strong structure intact. */
function excise(content: Inline[], patterns: RegExp[]): Surgery {
  const hits: string[] = []
  let touched = false

  const walk = (nodes: Inline[]): Inline[] =>
    nodes.map((node) => {
      if (typeof node !== 'string') return { tag: node.tag, content: walk(node.content) }
      let text = node
      for (const re of patterns) {
        re.lastIndex = 0
        text = text.replace(re, (m: string) => {
          hits.push(m.trim())
          touched = true
          return ''
        })
      }
      return text
    })

  const stripped = walk(content)
  if (!touched) return { content, hits }

  const glued = stripped.map((node, i) => {
    if (typeof node !== 'string') return node
    let text = tidy(node)
    if (i === 0) text = text.replace(/^\s+/, '')
    return text
  })
  const first = glued[0]
  if (typeof first === 'string') {
    glued[0] = first.replace(/^(\p{Ll})/u, (c) => c.toUpperCase())
  }
  const last = glued.length - 1
  if (typeof glued[last] === 'string') glued[last] = (glued[last] as string).replace(/\s+$/, '')

  return { content: glued.filter((n) => n !== ''), hits }
}

function quote(s: string): string {
  return `“${s.replace(/\s+/g, ' ').trim().replace(/[,;:—–-]+$/, '')}”`
}

/** A phrase that only counts when it opens a sentence. */
function openerRe(phrase: string): RegExp {
  const body = phrase.trim().split(/\s+/).map(escapeRe).join('\\s+')
  return new RegExp(`(?<=^|[.!?—:]\\s{1,2})${body}[,:]?\\s+`, 'giu')
}

/** Drops whole sentences from a paragraph. Null when the cut would not be clean. */
function withoutSentences(graf: Graf, drop: string[]): Inline[] | null {
  if (drop.length === 0) return null
  const { content, hits } = excise(graf.content, drop.map((s) => phraseRe(s)))
  if (hits.length < drop.length) return null
  const left = plain(content).trim()
  if (wordCount(left) < 5) return null
  if (left === graf.text.trim()) return null
  return content
}

/** How much a sentence is carrying: content words, stopwords discounted. */
function density(sentence: string): number {
  return contentWords(sentence, true).size
}

/* ---------------- Voice: hedges and throat-clearing ---------------- */

const HEDGES = [
  'not everywhere, not for everyone',
  'I think',
  'I believe',
  'perhaps',
  'maybe',
  'sort of',
  'kind of',
  'a bit',
  'a little',
  'somewhat',
  'in some sense',
  'it seems',
  'it appears',
  'I would argue',
  'I suppose',
  'to some extent',
]

const HEDGE_RES = HEDGES.map((h) => phraseRe(h))

/** Adverbial run-ups: the sentence stands without them. */
const THROAT_OPENERS = [
  'Look',
  'Honestly',
  'Frankly',
  'Basically',
  'Essentially',
  'Obviously',
  'Of course',
  'That said',
  'To be fair',
  'In many ways',
  'In a sense',
  'For what it is worth',
  "For what it's worth",
  'At the end of the day',
  'The truth is',
  'Here is the thing',
  "Here's the thing",
  'Simply put',
  'To put it another way',
  'In other words',
  'It is worth noting that',
  "It's worth noting that",
  'It is important to note that',
  "It's important to note that",
  'I want to be clear',
  'Let me be clear',
  'First of all',
]

const OPENER_RES = THROAT_OPENERS.map((p) => openerRe(p))

/** Announcing stems: they swallow a whole sentence, so the sentence goes. */
const THROAT_STEMS = [
  /\bin this (piece|essay|post|article)\b/i,
  /\bi want to talk about\b/i,
  /\bthe point of this (essay|piece|post|article)\b/i,
  /\bwhat i want to say\b/i,
  /\bthis is a story about\b/i,
  /\bthis (essay|piece|post) is about\b/i,
  /\bi'?m going to (argue|explain|walk you through)\b/i,
  /\bbefore i (begin|start|get into)\b/i,
  /\blet me start by\b/i,
  /\bin this section\b/i,
]

function voiceMarks(sites: Site[]): Candidate[] {
  const out: Candidate[] = []
  for (const site of sites) {
    const { content, hits } = excise(site.graf.content, HEDGE_RES)
    if (hits.length === 0) continue
    const left = plain(content).trim()
    if (wordCount(left) < 4) continue
    if (left === site.graf.text.trim()) continue
    const seen: string[] = []
    for (const h of hits) if (!seen.some((s) => s.toLowerCase() === h.toLowerCase())) seen.push(h)
    out.push({
      confidence: 0.86,
      order: site.order,
      type: 'rewritten',
      track: 'Voice',
      section: site.section,
      grafs: [site.graf],
      note: `Hedge dropped: ${seen.map(quote).join(', ')}. The sentence is not less true without it.`,
      altered: [content],
    })
  }
  return out
}

/** The run-up before the sentence starts, and the essay announcing itself. */
function throatMarks(sites: Site[]): Candidate[] {
  const out: Candidate[] = []
  for (const site of sites) {
    const parts = sentences(site.graf.text)
    const stem = parts.findIndex((s) => THROAT_STEMS.some((re) => re.test(s)))

    if (stem >= 0) {
      if (parts.length > 1) {
        const altered = withoutSentences(site.graf, [parts[stem].trim()])
        if (altered) {
          out.push({
            confidence: 0.82,
            order: site.order,
            type: 'rewritten',
            track: 'Voice',
            section: site.section,
            grafs: [site.graf],
            note: `Throat-clearing: ${quote(parts[stem])} announces the piece instead of writing it. The paragraph starts at its next sentence.`,
            altered: [altered],
          })
          continue
        }
      } else if (site.words <= 45 && site.index < site.last) {
        out.push({
          confidence: 0.82,
          order: site.order,
          type: 'cut',
          track: 'Voice',
          section: site.section,
          grafs: [site.graf],
          note: `Throat-clearing: the paragraph tells the reader what the piece is about instead of being it. Cut, and the piece starts one paragraph sooner.`,
          altered: null,
        })
        continue
      }
    }

    const { content, hits } = excise(site.graf.content, OPENER_RES)
    if (hits.length === 0) continue
    const left = plain(content).trim()
    if (wordCount(left) < 5) continue
    if (left === site.graf.text.trim()) continue
    const seen: string[] = []
    for (const h of hits) if (!seen.some((s) => s.toLowerCase() === h.toLowerCase())) seen.push(h)
    out.push({
      confidence: 0.78,
      order: site.order,
      type: 'rewritten',
      track: 'Voice',
      section: site.section,
      grafs: [site.graf],
      note: `Run-up dropped: ${seen.map(quote).join(', ')}. The sentence was already starting.`,
      altered: [content],
    })
  }
  return out
}

/* ---------------- Skeptic: workshop moves ---------------- */

const DISCLAIMERS: Array<{ re: RegExp; why: string }> = [
  { re: /\bcheap version of this (essay|piece|argument)\b/i, why: 'names the weak reading of itself' },
  { re: /\blet me kill that now\b/i, why: 'announces its own housekeeping' },
  { re: /\bi'?m not going to tell you they can'?t\b/i, why: 'pre-empts an objection nobody made yet' },
  { re: /\bbefore you (say|object|write|tell me)\b/i, why: 'pre-empts an objection nobody made yet' },
  { re: /\bthe flattering version\b/i, why: 'apologises for the argument mid-argument' },
  { re: /\bsome (will|might) say\b/i, why: 'argues with a reader who has not spoken' },
  { re: /\byou (might|may) (think|say|object|be wondering)\b/i, why: 'puts words in the reader’s mouth' },
  { re: /\bi'?ll admit\b/i, why: 'concedes before it has been asked to' },
  { re: /\byour mileage may vary\b/i, why: 'takes the claim back as it makes it' },
  { re: /\bthis (is|might be) (an )?unpopular opinion\b/i, why: 'flatters the argument instead of making it' },
  { re: /\bi'?m not (saying|claiming|arguing|suggesting)\b/i, why: 'defends against a reading nobody offered' },
  { re: /\bi am not (saying|claiming|arguing|suggesting)\b/i, why: 'defends against a reading nobody offered' },
  { re: /\b(the )?(obvious )?objection (is|here is|would be|to all this)\b/i, why: 'argues with a reader who has not spoken' },
]

/** A graf long enough that the disclaimer is a sentence in it, not the whole of it. */
const DISCLAIMER_KEEP = 50

/** Workshop second person: the graf addresses the room rather than the reader. */
const WORKSHOP = [
  'as you can see',
  'needless to say',
  'it goes without saying',
  'as we all know',
  'as I said above',
  'as mentioned earlier',
  'believe it or not',
  'let us be honest',
  "let's be honest",
  'you have to admit',
  'make no mistake',
]

const WORKSHOP_RES = WORKSHOP.map((p) => phraseRe(p))

function skepticMarks(sites: Site[]): Candidate[] {
  const out: Candidate[] = []
  for (const site of sites) {
    const parts = sentences(site.graf.text).map((s) => s.trim()).filter(Boolean)
    let why = ''
    let at = -1
    for (const rule of DISCLAIMERS) {
      const i = parts.findIndex((s) => rule.re.test(s))
      if (i >= 0) {
        why = rule.why
        at = i
        break
      }
    }
    // A bare "I know." only reads as a pre-rebuttal when it is short.
    if (!why && /^i know[.,!]/i.test(site.graf.text.trim()) && site.words < 30) {
      why = 'concedes the objection before making the point'
      at = 0
    }
    if (why) {
      // A long paragraph is not a disclaimer; it contains one. Take the sentence.
      const altered =
        site.words > DISCLAIMER_KEEP && parts.length > 1
          ? withoutSentences(site.graf, [parts[at]])
          : null
      if (altered) {
        out.push({
          confidence: 0.88,
          order: site.order,
          type: 'rewritten',
          track: 'Skeptic',
          section: site.section,
          grafs: [site.graf],
          note: `Workshop disclaimer — ${quote(parts[at])} ${why}. The paragraph keeps its argument without it.`,
          altered: [altered],
        })
        continue
      }
      out.push({
        confidence: 0.92,
        order: site.order,
        type: 'cut',
        track: 'Skeptic',
        section: site.section,
        grafs: [site.graf],
        note: `Workshop disclaimer — ${why}. The argument survives it being gone.`,
        altered: null,
      })
      continue
    }

    const { content, hits } = excise(site.graf.content, WORKSHOP_RES)
    if (hits.length === 0) continue
    const seen: string[] = []
    for (const h of hits) if (!seen.some((s) => s.toLowerCase() === h.toLowerCase())) seen.push(h)

    // A short graf that is mostly the workshop move is the move; it goes.
    const left = plain(content).trim()
    if (site.words <= 22 || wordCount(left) < 5) {
      out.push({
        confidence: 0.74,
        order: site.order,
        type: 'cut',
        track: 'Skeptic',
        section: site.section,
        grafs: [site.graf],
        note: `Workshop aside — ${seen.map(quote).join(', ')} talks to the room, not the reader. The paragraph is the aside.`,
        altered: null,
      })
      continue
    }
    out.push({
      confidence: 0.74,
      order: site.order,
      type: 'rewritten',
      track: 'Skeptic',
      section: site.section,
      grafs: [site.graf],
      note: `Workshop aside dropped: ${seen.map(quote).join(', ')}. If it goes without saying, it goes.`,
      altered: [content],
    })
  }
  return out
}

/* ---------------- HN: selection versus structure ---------------- */

/**
 * The thesis stays. What comes out is the unsupported aphorism about selection
 * that a sharp reader would stop on and ask what the verb means.
 */
const APHORISM = /\b(selection|selecting|curation|choosing|picking|scrolling|browsing)\b[^.!?]{0,40}\bnothing\b/i

function hnMarks(sites: Site[]): Candidate[] {
  const out: Candidate[] = []
  for (const site of sites) {
    if (site.words < 22) continue
    const parts = sentences(site.graf.text)
    if (parts.length < 2) continue
    for (let i = 1; i < parts.length; i++) {
      const sentence = parts[i].trim()
      if (wordCount(sentence) > 8) continue
      if (!APHORISM.test(sentence)) continue
      const { content, hits } = excise(site.graf.content, [phraseRe(sentence)])
      if (hits.length === 0) continue
      out.push({
        confidence: 0.8,
        order: site.order,
        type: 'rewritten',
        track: 'HN',
        section: site.section,
        grafs: [site.graf],
        note: `Aphorism dropped: ${quote(sentence)} It asserts what the rest of the graf shows.`,
        altered: [content],
      })
      break
    }
  }
  return out
}

/* ---------------- Cut: claims already made ---------------- */

const REPEAT_MATCH = 0.38
const REPEAT_CAP = 3

function repeatMarks(sites: Site[]): Candidate[] {
  const out: Candidate[] = []
  const vocab = sites.map((s) => contentWords(s.graf.text, true))
  for (let later = 1; later < sites.length && out.length < REPEAT_CAP; later++) {
    if (vocab[later].size < 6) continue
    for (let earlier = 0; earlier < later; earlier++) {
      if (vocab[earlier].size < 6) continue
      const overlap = jaccard(vocab[earlier], vocab[later])
      if (overlap < REPEAT_MATCH) continue
      const home = sites[earlier].section.heading ?? 'the opening'
      out.push({
        confidence: 0.55 + Math.min(0.12, (overlap - REPEAT_MATCH) / 2),
        order: sites[later].order,
        type: 'cut',
        track: 'Cut',
        section: sites[later].section,
        grafs: [sites[later].graf],
        note: `Repeats a claim already made in ${quote(home)} — ${Math.round(overlap * 100)}% of its vocabulary is already on the page. Said once, it lands harder.`,
        altered: null,
      })
      break
    }
  }
  return out
}

/* ---------------- Cut: long paragraphs ---------------- */

const LONG_WORDS = 80

/** Keeps the opening and the landing; the middle comes out. */
function compressLong(site: Site, confidence: number, minWords: number): Candidate | null {
  if (site.words < minWords) return null
  const parts = sentences(site.graf.text).map((s) => s.trim()).filter(Boolean)
  if (parts.length < 3) return null

  let keep: number[]
  if (parts.length >= 4) {
    keep = [0, parts.length - 1]
  } else {
    const ranked = parts.map((s, i) => ({ i, d: density(s) })).sort((a, b) => b.d - a.d || a.i - b.i)
    keep = [ranked[0].i, ranked[1].i].sort((a, b) => a - b)
  }
  const dropIdx = parts.map((_, i) => i).filter((i) => !keep.includes(i))
  const drop = dropIdx.map((i) => parts[i])
  let gone = 0
  for (const s of drop) gone += wordCount(s)
  if (gone < 12) return null

  const altered = withoutSentences(site.graf, drop)
  if (!altered) return null

  const kept = keep.length === 2 && keep[0] === 0 && keep[1] === parts.length - 1
    ? 'the opening and the landing'
    : 'the two sentences carrying the most'
  return {
    confidence,
    order: site.order,
    type: 'compressed',
    track: 'Cut',
    section: site.section,
    grafs: [site.graf],
    note: `${site.words} words in one paragraph, ${parts.length} sentences. Kept ${kept}; ${drop.length === 1 ? 'the sentence between them comes' : `the ${drop.length} in between come`} out — ${gone} words.`,
    altered: [altered],
  }
}

function longGrafMarks(sites: Site[]): Candidate[] {
  const out: Candidate[] = []
  for (const site of sites) {
    const c = compressLong(site, 0.62, LONG_WORDS)
    if (c) out.push(c)
  }
  return out
}

/* ---------------- Cut: stalls ---------------- */

const STALL_WORDS = 28

/** Runs of short paragraphs in a row: the essay stops moving. */
function stallMarks(doc: DocumentModel, order: Map<string, number>): Candidate[] {
  const out: Candidate[] = []
  for (const section of doc.sections) {
    if (section.grafs.length < 3) continue
    const headingWords = contentWords(section.heading ?? '', true)
    const thin = section.grafs.map((g, i) => {
      if (i === 0) return false
      if (wordCount(g.text) > STALL_WORDS) return false
      if (g.tag === 'h3') return false
      if (hasStrong(g.content)) return false
      for (const w of contentWords(g.text, true)) if (headingWords.has(w)) return false
      return true
    })
    let run: Graf[] = []
    const flush = () => {
      // A run that is the whole section is the section, not a stall.
      if (run.length >= 2 && run.length < section.grafs.length) {
        let gone = 0
        for (const g of run) gone += wordCount(g.text)
        if (gone >= 20) {
          out.push({
            confidence: run.length >= 3 ? 0.6 : 0.52,
            order: order.get(run[0].id) ?? 0,
            type: 'compressed',
            track: 'Cut',
            section,
            grafs: run,
            note: `${run.length} short paragraphs in a row carrying ${gone} words. The passage stalls here; it reads faster without the stepping stones.`,
            altered: null,
          })
        }
      }
      run = []
    }
    section.grafs.forEach((g, i) => {
      if (thin[i]) run.push(g)
      else flush()
    })
    flush()
  }
  return out
}

/* ---------------- reserves: honest marks when nothing else fires ---------------- */

/**
 * Ordinary prose with no tics still has its longest paragraph and its least
 * load-bearing one. These are real deletions with real reasons, ranked last so
 * a sharper rule always wins the paragraph first.
 */
function reserves(sites: Site[]): Candidate[] {
  const out: Candidate[] = []

  const byLength = sites.slice().sort((a, b) => b.words - a.words || a.order - b.order)
  for (const site of byLength) {
    const c = compressLong(site, 0.34, 45) ?? compressLong(site, 0.3, 30)
    if (c) out.push(c)
  }

  // Novelty: how much of a paragraph's vocabulary the essay has not spent yet.
  const seen = new Set<string>()
  const weak: Array<{ site: Site; novelty: number; size: number }> = []
  for (const site of sites) {
    const words = contentWords(site.graf.text, true)
    let fresh = 0
    for (const w of words) if (!seen.has(w)) fresh++
    for (const w of words) seen.add(w)
    const interior = site.index > 0 && site.index < site.last
    if (interior && words.size >= 5) {
      weak.push({ site, novelty: fresh / words.size, size: words.size })
    }
  }
  weak.sort((a, b) => a.novelty - b.novelty || a.site.words - b.site.words)
  for (const w of weak) {
    // The reason has to match the number it quotes. A paragraph that is half
    // vocabulary the draft has already spent is repeating itself; one that is a
    // fifth is only the weakest thing left, and the note says so instead.
    const spent = Math.round((1 - w.novelty) * 100)
    const why =
      spent >= 45
        ? 'It restates its neighbours instead of moving past them.'
        : 'It is the least new paragraph left, and the ones around it carry the argument without it.'
    out.push({
      confidence: 0.28 - Math.min(0.1, w.novelty / 10),
      order: w.site.order,
      type: 'cut',
      track: 'Cut',
      section: w.site.section,
      grafs: [w.site.graf],
      note: `Interior paragraph, ${w.site.words} words, ${spent}% of its vocabulary already on the page. ${why}`,
      altered: null,
    })
  }

  // Last resort for a very short draft: drop the weaker of two sentences.
  for (const site of sites) {
    const parts = sentences(site.graf.text).map((s) => s.trim()).filter(Boolean)
    if (parts.length !== 2) continue
    const weaker = density(parts[0]) <= density(parts[1]) ? 0 : 1
    const altered = withoutSentences(site.graf, [parts[weaker]])
    if (!altered) continue
    out.push({
      confidence: 0.2,
      order: site.order,
      type: 'compressed',
      track: 'Cut',
      section: site.section,
      grafs: [site.graf],
      note: `Two sentences doing one sentence's work. ${quote(parts[weaker])} says what the other one already says.`,
      altered: [altered],
    })
  }

  return out
}

/* ---------------- the pass ---------------- */

export function localPass(doc: DocumentModel, layerId: string): Mark[] {
  const sites: Site[] = []
  const order = new Map<string, number>()
  let n = 0
  for (const section of doc.sections) {
    section.grafs.forEach((graf, index) => {
      order.set(graf.id, n)
      sites.push({
        section,
        graf,
        words: wordCount(graf.text),
        order: n,
        index,
        last: section.grafs.length - 1,
      })
      n++
    })
  }

  const candidates = [
    ...skepticMarks(sites),
    ...voiceMarks(sites),
    ...throatMarks(sites),
    ...hnMarks(sites),
    ...longGrafMarks(sites),
    ...stallMarks(doc, order),
    ...repeatMarks(sites),
  ]

  // Sharpest first, then one mark per paragraph: a graf claimed by a confident
  // rule is not also compressed by a hesitant one.
  candidates.sort((a, b) => b.confidence - a.confidence || a.order - b.order)
  const claimed = new Set<string>()
  const kept: Candidate[] = []
  const take = (c: Candidate) => {
    if (kept.length >= MAX_MARKS) return
    if (c.grafs.some((g) => claimed.has(g.id))) return
    for (const g of c.grafs) claimed.add(g.id)
    kept.push(c)
  }
  for (const c of candidates) take(c)

  // Never come back empty. The reserves are deletions of sentences the author
  // wrote, with reasons that name what is being taken and why.
  let words = 0
  for (const site of sites) words += site.words
  const floor = floorFor(words)
  if (kept.length < floor) {
    const spare = reserves(sites).sort((a, b) => b.confidence - a.confidence || a.order - b.order)
    for (const c of spare) {
      if (kept.length >= floor) break
      take(c)
    }
  }

  kept.sort((a, b) => a.order - b.order)

  return kept.map((c, i) => ({
    id: `${layerId}-${c.section.id}-${i}`,
    type: c.type,
    track: c.track,
    sectionId: c.section.id,
    sectionTitle: c.section.heading ?? 'Opening',
    grafIds: c.grafs.map((g) => g.id),
    note: c.note,
    original: grafsToBlocks(c.grafs),
    altered: c.altered ? c.altered.map((content) => ({ tag: 'p' as const, content })) : null,
    source: 'local' as const,
    layerId,
  }))
}
