/* Word-level delta between two versions of a passage. The diff reasons quote
   from it and the split view marks with it, so both are reading the same
   arithmetic: an LCS over normalized words, then a flag per word on each side. */

import { normalize } from './text'

export interface WordDelta {
  /** One flag per whitespace-separated word of a: dropped. */
  aFlags: boolean[]
  /** One flag per whitespace-separated word of b: added. */
  bFlags: boolean[]
  /** Contiguous runs, for a reason a person would write. */
  dropped: string[]
  added: string[]
  droppedWords: number
  addedWords: number
}

/** The tokenisation every flags array is indexed by. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** Above this the table is not worth building; the passage is wholly rewritten. */
const CELLS = 400_000

export function wordDelta(a: string, b: string): WordDelta {
  const aw = words(a)
  const bw = words(b)

  if (aw.length * bw.length > CELLS) {
    return {
      aFlags: aw.map(() => true),
      bFlags: bw.map(() => true),
      dropped: aw.length ? [aw.join(' ')] : [],
      added: bw.length ? [bw.join(' ')] : [],
      droppedWords: aw.length,
      addedWords: bw.length,
    }
  }

  const an = aw.map((w) => normalize(w))
  const bn = bw.map((w) => normalize(w))
  const n = aw.length
  const m = bw.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const aFlags = new Array<boolean>(n).fill(false)
  const bFlags = new Array<boolean>(m).fill(false)
  const dropped: string[] = []
  const added: string[] = []
  let runA: string[] = []
  let runB: string[] = []
  const flush = () => {
    if (runA.length) dropped.push(runA.join(' '))
    if (runB.length) added.push(runB.join(' '))
    runA = []
    runB = []
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (an[i] === bn[j]) {
      flush()
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      aFlags[i] = true
      runA.push(aw[i++])
    } else {
      bFlags[j] = true
      runB.push(bw[j++])
    }
  }
  while (i < n) {
    aFlags[i] = true
    runA.push(aw[i++])
  }
  while (j < m) {
    bFlags[j] = true
    runB.push(bw[j++])
  }
  flush()

  let droppedWords = 0
  for (const r of dropped) droppedWords += words(r).length
  let addedWords = 0
  for (const r of added) addedWords += words(r).length
  return { aFlags, bFlags, dropped, added, droppedWords, addedWords }
}
