import { useState } from 'react'

/**
 * The head of a working paper. One thing lives here: the way home.
 *
 * Start over throws the desk away — the draft, the marks, and the store behind
 * them — and leaves empty paper. It is one desk action on the paper itself, not
 * a setting in a drawer, so it asks in the row it came from before it does it.
 *
 * There is no glossary under it any more. Type and Track are named on the mark
 * that carries them, the beats are named on the screen that draws them, and
 * Keep this / Keep mine are the two words on the mark itself — so nothing has
 * to be learned up here before the manuscript starts.
 */
export function PaperTop({ onStartOver }: { onStartOver: () => void }) {
  const [asking, setAsking] = useState(false)

  return (
    <div className="paper-top">
      {asking ? (
        <span className="paper-top-ask">
          <span className="paper-top-copy">This clears the paper and what is saved of it.</span>
          <button
            type="button"
            className="paper-start is-yes"
            onClick={() => {
              setAsking(false)
              onStartOver()
            }}
          >
            Start over
          </button>
          <span className="sep" aria-hidden="true">
            ·
          </span>
          <button type="button" className="paper-start is-quiet" onClick={() => setAsking(false)}>
            Keep working
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="paper-start"
          id="start-over"
          title="Clear the desk and go back to empty paper"
          onClick={() => setAsking(true)}
        >
          Start over
        </button>
      )}
    </div>
  )
}
