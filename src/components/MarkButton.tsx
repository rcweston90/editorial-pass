import type { ChangeType, Decision, Track } from '../types'
import { KEEP_MINE, KEEP_MINE_WHY, KEEP_THIS, KEEP_THIS_WHY, TYPE_LABEL } from '../lib/labels'
import { MarkShape } from './Marks'

/**
 * The mark in the margin, and the next step standing on it.
 *
 * The glyph and the two words under it are the whole vocabulary: the type is
 * what the pass did to this passage, the track is which pass wrote it. Each is
 * said with the name of the thing it is — Type beside cut / compressed /
 * rewritten, Track beside Voice / Skeptic / Cut / HN — the same way the slip
 * says them, so the mark needs no legend and no panel opened to be read. Keep
 * this and Keep mine sit directly beneath them, because deciding is what you do
 * next, and each one says whose sentence survives it.
 * The mark itself still opens the slip, which is where the other version is.
 */
export function MarkButton({
  id,
  type,
  track,
  where,
  decision,
  open,
  focused,
  onToggle,
  onDecide,
}: {
  id: string
  type: ChangeType
  /** Which pass wrote it: Voice, Skeptic, Cut, HN. Named here, not in a legend. */
  track: Track
  where: string
  decision: Decision
  open: boolean
  focused: boolean
  onToggle: (id: string) => void
  onDecide: (id: string, decision: Decision) => void
}) {
  const cls = ['mark']
  if (open) cls.push('is-open')
  if (focused) cls.push('is-focused')
  if (decision === 'rejected') cls.push('is-rejected')
  if (decision === 'accepted') cls.push('is-accepted')
  const place = where || 'this passage'

  return (
    <div className={cls.join(' ')}>
      <button
        type="button"
        className="mark-btn"
        data-id={id}
        data-type={type}
        aria-label={`Type ${TYPE_LABEL[type]}, track ${track}: ${place}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(id)
        }}
      >
        <MarkShape type={type} className="shape" />
        {/* The name of the thing, said beside the thing. Same pattern as the
            slip term, on the mark, so nothing has to be opened to read it. */}
        <span className="lbl">
          <span className="mark-term">Type</span>{` ${TYPE_LABEL[type]}`}
        </span>
        <span className="lbl trk">
          <span className="mark-term">Track</span>{` ${track}`}
        </span>
      </button>
      {/* Keep this keeps the pass's delta on the working copy; Keep mine keeps
          what you wrote for this one mark. Pressed again, either one puts the
          mark back in play. */}
      <span className="mark-acts">
        <button
          type="button"
          className="mark-act"
          aria-pressed={decision === 'accepted'}
          aria-label={`${KEEP_THIS}: ${KEEP_THIS_WHY.toLowerCase()} — ${place}`}
          title={KEEP_THIS_WHY}
          onClick={(e) => {
            e.stopPropagation()
            onDecide(id, decision === 'accepted' ? 'pending' : 'accepted')
          }}
        >
          {KEEP_THIS}
        </button>
        <button
          type="button"
          className="mark-act"
          aria-pressed={decision === 'rejected'}
          aria-label={`${KEEP_MINE}: ${KEEP_MINE_WHY.toLowerCase()} — ${place}`}
          title={KEEP_MINE_WHY}
          onClick={(e) => {
            e.stopPropagation()
            onDecide(id, decision === 'rejected' ? 'pending' : 'rejected')
          }}
        >
          {KEEP_MINE}
        </button>
      </span>
    </div>
  )
}
