import type { ChangeType, Track } from '../types'

export const TYPE_LABEL: Record<ChangeType, string> = {
  cut: 'Cut',
  compressed: 'Compressed',
  rewritten: 'Rewritten',
}

export const TRACKS: Track[] = ['Voice', 'Skeptic', 'Cut', 'HN']

/** Shown in place of the other version when the pass put nothing back. */
export const NOTHING: Record<'cut' | 'compressed', string> = {
  cut: 'Nothing takes its place. The section closes over the gap.',
  compressed: 'Nothing takes its place. The passage runs straight on.',
}

/* The two decisions, in the desk's own words. Keep this keeps the pass's delta
   on the working copy; Keep mine keeps what you wrote for that one mark. They
   are the same two words on the mark, in the slip, in the bulk row and in the
   keyhint, because a decision that is named two ways is two decisions. */
export const KEEP_THIS = 'Keep this'
export const KEEP_MINE = 'Keep mine'
export const KEEP_THIS_WHY = 'Keep this delta on the working copy'
export const KEEP_MINE_WHY = 'Keep the original for this mark'

export const DECISION_WORD: Record<'accepted' | 'rejected', string> = {
  accepted: 'keeping this',
  rejected: 'keeping mine',
}
