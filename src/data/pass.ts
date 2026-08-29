// The example corpus: the five marks a person made on this manuscript, and the
// section spine the flow view drew from. Ported verbatim from the prototype's
// script#pass-data; src/lib/example.ts turns it into a session.

import type { Block, ChangeType, Inline, Track } from '../types'

export const em = (...content: Inline[]): Inline => ({ tag: 'em', content })
export const strong = (...content: Inline[]): Inline => ({ tag: 'strong', content })

export interface ExampleChange {
  id: string
  type: ChangeType
  track: Track
  section: string
  sectionTitle: string
  note: string
  /** What stood in the original manuscript. */
  original: Block[]
  /** What replaced it, or null when nothing did. */
  altered: Block[] | null
}

export const CHANGES: ExampleChange[] = [
  {
    id: "hedge",
    type: "rewritten",
    track: "Voice",
    section: "lede",
    sectionTitle: "Opening",
    note: "Opening hedge dropped.",
    original: [
      { tag: "p", content: ["That's the job now. Not everywhere, not for everyone — but if you've done it this month, you already know which sentence in this essay is about you."] },
    ],
    altered: [
      { tag: "p", content: ["That's the job now. If you've done it this month, you already know which sentence in this essay is about you."] },
    ],
  },
  {
    id: "instrument",
    type: "compressed",
    track: "Cut",
    section: "instrument",
    sectionTitle: "The instrument",
    note: "Kept the history open, the book/letter graf, and “Then we deleted it…”. These three grafs came out.",
    original: [
      { tag: "p", content: ["Nobody taught you that. There was no class. Delay showed up pre-loaded with meaning, and you spent it without noticing, the way you spend depth perception."] },
      { tag: "p", content: ["We have been attacking that delay since we could walk. Land bridges. Boats. Trading colonies pinned to the edge of the known map. Distance was the hill that taunted and rewarded and punished us in turn, and every century we took another bite out of it."] },
      { tag: "p", content: ["Distance did double duty the whole time. It told you what a thing would cost to reach. It also told you what a thing had cost to reach you."] },
    ],
    altered: null,
  },
  {
    id: "mail",
    type: "cut",
    track: "Cut",
    section: "wouldnt",
    sectionTitle: "I wouldn't go back",
    note: "The edited section now opens on “The speed is real.”",
    original: [
      { tag: "p", content: ["The cheap version of this essay is a man missing the mail. Let me kill that now."] },
    ],
    altered: null,
  },
  {
    id: "hired",
    type: "cut",
    track: "Cut",
    section: "hired",
    sectionTitle: "Why design got hired in the first place",
    note: "Whole section removed. In the flow it sits as a ghost between “Only one half collapsed” and “The thing that used to catch it”.",
    original: [
      { tag: "p", content: ["Nobody woke up one morning and decided product teams needed design."] },
      { tag: "p", content: ["Design got hired because there was a gap. Somebody had a thing in their head — or didn't, which was more often the case — and a canvas in front of them, and the distance between those two never got crossed. That failed often enough, in enough companies, that it turned into a role."] },
      { tag: "p", content: [strong("Design is the profession of that interval."), " It exists because of a distance. Its entire claim is that somebody should be paid to cross it on purpose."] },
      { tag: "p", content: ["So when the interval collapses, design has a problem engineering doesn't. Not an existential one. A structural one."] },
    ],
    altered: null,
  },
  {
    id: "taste",
    type: "rewritten",
    track: "HN",
    section: "generation",
    sectionTitle: "“Every generation says this”",
    note: "“Selection installs nothing” comes out. A closing claim about art direction comes in.",
    original: [
      { tag: "p", content: ["AI moved designers from generating to selecting. Selection installs nothing. You can scroll past ten thousand options and arrive with exactly the taste you walked in with."] },
    ],
    altered: [
      { tag: "p", content: ["AI moved designers from generating to selecting. You can scroll past ten thousand options and arrive with exactly the taste you walked in with. Art direction comes after the bad ones, not instead of them."] },
    ],
  },
]

/** The hand-authored lane labels; live weights come off the document. */
export interface ExampleSection {
  id: string
  title: string
  short: string
  origWeight: number
  editWeight: number
  changeId: string | null
}

export const SECTIONS: ExampleSection[] = [
  { id: "lede", title: "Opening", short: "Opening", origWeight: 5, editWeight: 5, changeId: "hedge" },
  { id: "instrument", title: "The instrument", short: "Instrument", origWeight: 6, editWeight: 3, changeId: "instrument" },
  { id: "wouldnt", title: "I wouldn't go back", short: "Wouldn't go back", origWeight: 6, editWeight: 5, changeId: "mail" },
  { id: "half", title: "Only one half collapsed", short: "One half", origWeight: 8, editWeight: 8, changeId: null },
  { id: "hired", title: "Why design got hired in the first place", short: "Why hired", origWeight: 4, editWeight: 0, changeId: "hired" },
  { id: "catch", title: "The thing that used to catch it", short: "The catch", origWeight: 6, editWeight: 6, changeId: null },
  { id: "finished", title: "Why you reach for the finished one", short: "Finished one", origWeight: 7, editWeight: 7, changeId: null },
  { id: "generation", title: "“Every generation says this”", short: "Every generation", origWeight: 7, editWeight: 7, changeId: "taste" },
  { id: "latency", title: "Latency was the curriculum", short: "Latency", origWeight: 10, editWeight: 10, changeId: null },
]

/** Where each mark sits, for the margin button's accessible name. */
export const MARK_WHERE: Record<string, string> = {
  hedge: 'opening hedge',
  instrument: 'The instrument',
  mail: "under I wouldn't go back",
  hired: 'Why design got hired in the first place',
  taste: 'near the end of Every generation says this',
}
