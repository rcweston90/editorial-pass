import type { Decision, Mark, Mode } from '../types'
import {
  DECISION_WORD,
  KEEP_MINE,
  KEEP_MINE_WHY,
  KEEP_THIS,
  KEEP_THIS_WHY,
  NOTHING,
  TYPE_LABEL,
} from '../lib/labels'
import { BlockText } from './RichText'
import { MarkShape } from './Marks'

/**
 * The page always holds one version of the passage. The slip holds the other,
 * opened directly beneath it so the two can be read against each other in place.
 */
export function Slip({
  change,
  where,
  mode,
  decision,
  onDecide,
  onClose,
  showCopy = true,
}: {
  change: Mark
  /** The beat this mark sits in — the same name the flow and the split use. */
  where?: string
  mode: Mode
  decision: Decision
  onDecide: (id: string, decision: Decision) => void
  onClose: () => void
  /** The split view already has both versions on the page; the slip is the note. */
  showCopy?: boolean
}) {
  const showingOriginal = mode === 'original'
  const label = showingOriginal ? 'In the edited pass' : 'In the original'
  const copy = showingOriginal ? change.altered : change.original
  const none = copy == null

  return (
    <div className="slip" id="slip">
      <div className="slip-top">
        {/* The two words, each said with the name of the thing it is: what the
            mark did, and which pass wrote it. No legend anywhere else. */}
        <span className="slip-type">
          <MarkShape type={change.type} width={13} height={12} />
          <span className="slip-term">Type</span>
          {TYPE_LABEL[change.type]}
          <span className="slip-track">
            <span className="slip-term">Track</span>
            {change.track}
          </span>
        </span>
        <span className="slip-where">{where ?? change.sectionTitle}</span>
        <button type="button" className="slip-close" onClick={onClose}>
          close
        </button>
      </div>
      {change.note ? <p className="slip-note">{change.note}</p> : null}
      {showCopy ? (
        <>
          <div className="slip-lab">{label}</div>
          <div className={none ? 'slip-copy is-none' : 'slip-copy'}>
            {none ? (
              <p>{NOTHING[change.type === 'compressed' ? 'compressed' : 'cut']}</p>
            ) : (
              <BlockText blocks={copy} />
            )}
          </div>
        </>
      ) : null}
      <div className="slip-actions">
        <button
          type="button"
          className="slip-act"
          aria-pressed={decision === 'accepted'}
          title={KEEP_THIS_WHY}
          onClick={() => onDecide(change.id, decision === 'accepted' ? 'pending' : 'accepted')}
        >
          [ {KEEP_THIS.toLowerCase()} ]
        </button>
        <button
          type="button"
          className="slip-act"
          aria-pressed={decision === 'rejected'}
          title={KEEP_MINE_WHY}
          onClick={() => onDecide(change.id, decision === 'rejected' ? 'pending' : 'rejected')}
        >
          [ {KEEP_MINE.toLowerCase()} ]
        </button>
        {decision !== 'pending' ? (
          <span className="slip-state">{DECISION_WORD[decision]}</span>
        ) : null}
      </div>
    </div>
  )
}
