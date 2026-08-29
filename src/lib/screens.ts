/* The four screens, and the order they come in. One table, read by the nav in
   the chrome and by the keyboard, so the numbers on the tabs, the 1–4 keys and
   the order of the desk can never drift apart. */

import type { Screen } from '../types'

export interface ScreenDef {
  id: Screen
  /** Its place in the order. Printed on the tab, and the key that goes there. */
  n: string
  label: string
  /** What the screen is for, said on the tab itself rather than in a tour. */
  why: string
}

export const SCREENS: ScreenDef[] = [
  { id: 'draft', n: '1', label: 'Draft', why: 'Paste a draft, then Run pass (1)' },
  { id: 'marks', n: '2', label: 'Marks', why: 'What the pass marked, one decision each (2)' },
  {
    id: 'split',
    n: '3',
    label: 'Original vs this pass',
    why: 'Your original as the spine, this pass beside it (3)',
  },
  { id: 'beats', n: '4', label: 'Beats', why: 'The beats of the draft, and what each one lost (4)' },
]

/**
 * Screen 1 is always live: empty paper is a place you can stand. The other
 * three are readings of a pass, so they arrive when there is one to read.
 */
export function screenLive(id: Screen, ready: boolean): boolean {
  return id === 'draft' || ready
}

export function screenAt(n: string, ready: boolean): Screen | null {
  const found = SCREENS.find((s) => s.n === n)
  return found && screenLive(found.id, ready) ? found.id : null
}
