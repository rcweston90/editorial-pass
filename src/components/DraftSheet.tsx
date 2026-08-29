import type { ReactNode } from 'react'
import { PaperTop } from './PaperTop'

/**
 * Screen one: the paper you arrive on. Cold it is empty, and the only thing on
 * it is the draft box and Run pass. Warm it holds whatever you last put there.
 *
 * The blotter is not a drawer any more — it does not slide out over a
 * manuscript, because on this screen it *is* the manuscript. Start over stands
 * at the head of it, which is where the way home has always been, and the way
 * on is Run pass, which lands you on screen two.
 */
export function DraftSheet({
  sample,
  words,
  ready,
  canReset,
  onStartOver,
  onMarks,
  children,
}: {
  sample: boolean
  /** Words on the paper right now, read or not. */
  words: number
  /** A pass has been read onto this draft, so there is something to go and see. */
  ready: boolean
  /** Something to clear: a draft, a pass, or a store holding one. */
  canReset: boolean
  onStartOver: () => void
  onMarks: () => void
  children: ReactNode
}) {
  return (
    <div className="stage">
      <article className="sheet draft-sheet" id="sheet">
        {sample ? (
          <p className="stamp" aria-label="This is the sample manuscript">
            Sample
          </p>
        ) : null}
        {canReset ? <PaperTop onStartOver={onStartOver} /> : null}
        {children}
        <div className="sheet-foot">
          <span id="foot-mode">
            {words === 0 ? (
              'Empty paper. Nothing leaves this page unless you run a pass or export.'
            ) : (
              <>
                {words.toLocaleString('en-US')} words on the paper.{' '}
                {ready ? (
                  <>
                    They have been read —{' '}
                    <button type="button" className="foot-draft" onClick={onMarks}>
                      the marks are on screen two
                    </button>
                    .
                  </>
                ) : (
                  'Run pass reads them and marks them up.'
                )}
              </>
            )}
          </span>
          <span className="keyhint">1-4 screens · d draft · esc close</span>
        </div>
      </article>
    </div>
  )
}
