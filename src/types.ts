/* The whole app is built from these. A session is a document, a stack of
   pass layers over it, and one decision per mark. Everything the sheet and
   the flow draw is derived from that. */

export type Mode = 'original' | 'edited'
/**
 * The four screens, in the order you meet them: paste a draft, read what the
 * pass marked, stand the two versions side by side, then look at the shape.
 * There is no fifth thing and no drawer — everything on the desk is on one of
 * these, which is why a refresh lands on a screen and not on a long blotter.
 */
export type Screen = 'draft' | 'marks' | 'split' | 'beats'
export type ChangeType = 'cut' | 'compressed' | 'rewritten'
export type Track = 'Voice' | 'Skeptic' | 'Cut' | 'HN'
export type Decision = 'pending' | 'accepted' | 'rejected'
export type PassSource = 'example' | 'diff' | 'local' | 'llm'

/** Prose is structured, not HTML strings — em/strong survive without innerHTML. */
export type Inline = string | { tag: 'em' | 'strong'; content: Inline[] }

export interface Block {
  tag: 'p' | 'h3'
  content: Inline[]
}

export interface Graf {
  id: string
  /** Plain text, for word counts and similarity. */
  text: string
  content: Inline[]
  tag?: 'p' | 'h3'
}

export interface SectionDoc {
  id: string
  heading: string | null
  headingInline: Inline[] | null
  /** Hand-authored label for the flow lane; derived when absent. */
  short?: string
  grafs: Graf[]
}

export interface DocumentModel {
  title: string
  /** True when the draft had no `#` line and the title is the opening sentence. */
  derivedTitle?: boolean
  byline: Inline[] | null
  epigraph: string | null
  sections: SectionDoc[]
}

export interface Mark {
  id: string
  type: ChangeType
  track: Track
  sectionId: string
  sectionTitle: string
  /** The original grafs this mark stands over, in document order. */
  grafIds: string[]
  wholeSection?: boolean
  note: string
  original: Block[]
  /** What replaces the passage, or null when nothing does. */
  altered: Block[] | null
  source: PassSource
  layerId: string
}

export interface Layer {
  id: string
  label: string
  source: PassSource
  marks: Mark[]
}

export interface SessionState {
  originalMd: string
  editedMd: string
  /**
   * The markdown `document` was parsed from, or null for the hand-built
   * example. A pass over a document whose source has moved on rebuilds the
   * document first, which is what keeps every layer's grafIds resolvable.
   */
  docMd: string | null
  document: DocumentModel
  layers: Layer[]
  activeLayerId: string
  decisions: Record<string, Decision>
  title: string
  /**
   * The paper is the shipped example, not a draft of your own. It stamps the
   * sheet SAMPLE, and it is only ever true because someone asked for it.
   */
  sample: boolean
}

/* ---------- authored corpus: the example essay, as a person wrote it ---------- */

/** src/data/essay.ts is prose, not a render model: no ids the parser would mint. */
export type CorpusNode =
  | { kind: 'p'; className?: string; content: Inline[] }
  | { kind: 'rewritten'; changeId: string; orig: Inline[]; edit: Inline[] }
  | {
      kind: 'change-block'
      changeId: string
      type: 'cut' | 'compressed'
      blocks: Block[]
      altered: Block[] | null
    }

export interface CorpusSection {
  id: string
  heading?: Inline[]
  nodes: CorpusNode[]
  wholeCut?: { changeId: string; heading: Inline[]; blocks: Block[] }
}

/* ---------- render model: what the four screens draw ---------- */

export interface Para {
  kind: 'p'
  className?: string
  content: Inline[]
  /** The graf this node stands for; the flow scrolls to it. */
  anchorId: string
}

/** A line the pass rewrote; the mode decides which version is on the page. */
export interface RewrittenGraf {
  kind: 'rewritten'
  changeId: string
  anchorId: string
  orig: Inline[]
  edit: Inline[]
}

/** A passage the pass cut or compressed; a scar rule stands in for it when edited. */
export interface ChangeBlock {
  kind: 'change-block'
  changeId: string
  anchorId: string
  type: 'cut' | 'compressed'
  blocks: Block[]
  /** Surviving replacement prose, when the pass put something back. */
  altered: Block[] | null
}

export type EssayNode = Para | RewrittenGraf | ChangeBlock

/** A section the pass removed outright; a ghost stands in for it when edited. */
export interface WholeCut {
  changeId: string
  anchorId: string
  heading: Inline[]
  blocks: Block[]
}

export interface EssaySection {
  id: string
  heading?: Inline[]
  nodes: EssayNode[]
  wholeCut?: WholeCut
}

/**
 * One beat of the manuscript. Headed drafts get one beat per section; a draft
 * with no headings gets beats where its paragraphs arrive, so the spine never
 * collapses into a single Opening node.
 */
export interface FlowSection {
  id: string
  title: string
  short: string
  origWeight: number
  editWeight: number
  changeId: string | null
  /** Section or graf id to scroll to when the beat is clicked. */
  anchorId: string
}

/* ---------- split view: the two columns and the gutter between them ---------- */

/** A block plus one flag per whitespace-separated word: what moved. */
export interface DeltaBlock {
  tag: 'p' | 'h3'
  content: Inline[]
  flags: boolean[]
}

export type SplitRow =
  | { kind: 'heading'; id: string; anchorId: string; heading: Inline[]; gone: boolean }
  | { kind: 'kept'; id: string; anchorId: string; className?: string; content: Inline[] }
  | {
      kind: 'change'
      id: string
      anchorId: string
      changeId: string
      type: ChangeType
      /** A whole section came out; the left column still holds all of it. */
      whole: boolean
      decision: Decision
      left: DeltaBlock[]
      /** Null when nothing takes its place. */
      right: DeltaBlock[] | null
    }

export interface DocHead {
  title: string
  derivedTitle?: boolean
  byline: Inline[] | null
  epigraph: string | null
}

export interface PassStats {
  wordsIn: number
  /** The draft with the marks you have actually taken. Moves on every decision. */
  wordsTaken: number
  pctTaken: number
  /** The working copy: taken plus still-open marks. What Export writes. */
  wordsOut: number
  pctCut: number
  cut: number
  compressed: number
  rewritten: number
  accepted: number
  rejected: number
  pending: number
  total: number
}

export interface Filters {
  type: ChangeType | 'all'
  track: Track | 'all'
}
