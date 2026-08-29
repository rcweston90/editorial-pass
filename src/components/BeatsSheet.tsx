import type { CSSProperties } from 'react'
import type { ChangeType, FlowSection } from '../types'
import { MarkShape } from './Marks'
import { PaperNote } from './PaperNote'

/**
 * Screen four: the draft as beats, in order, on paper.
 *
 * This is what the Flow strip used to draw from a drawer over the manuscript,
 * and it is not a strip any more. One row per beat, each named after its own
 * heading or its own opening line — never after the word Opening, because a
 * lane of Openings is a lane that tells you nothing. The dashed track is how
 * long the beat ran as you wrote it, drawn against the longest beat in the
 * draft; the filled bar is what this pass leaves of it. A beat the pass marked
 * carries its glyph, and clicking it opens that mark back on screen two.
 */
function fate(share: number): string {
  if (share <= 0) return 'removed'
  if (share >= 100) return 'kept whole'
  return `cut to ${share}%`
}

function BeatRow({
  beat,
  n,
  of,
  type,
  active,
  onJump,
}: {
  beat: FlowSection
  n: number
  /** This beat's length against the longest one, so the rows read as prose. */
  of: number
  type: ChangeType | null
  active: boolean
  onJump: (beat: FlowSection) => void
}) {
  const share = Math.round((beat.editWeight / beat.origWeight) * 100)
  const cls = ['beat']
  if (type) cls.push('has-change')
  if (share <= 0) cls.push('is-gone')
  if (active) cls.push('is-active')

  return (
    <li className="beat-row">
      <button
        type="button"
        className={cls.join(' ')}
        data-section={beat.id}
        data-target={beat.changeId ?? undefined}
        title={
          beat.changeId
            ? `${beat.title} — ${fate(share)}. Open the mark.`
            : `${beat.title} — ${fate(share)}. Read it on the paper.`
        }
        onClick={() => onJump(beat)}
      >
        <span className="beat-n" aria-hidden="true">
          {String(n).padStart(2, '0')}
        </span>
        <span className="beat-name">
          {type ? (
            <span className="glyph">
              <MarkShape type={type} width={13} height={12} />
            </span>
          ) : null}
          <span className="txt">{beat.title}</span>
        </span>
        <span className="beat-fate">{fate(share)}</span>
        <span className="beat-track" style={{ '--beat-of': `${of}%` } as CSSProperties}>
          <span className="beat-bar" style={{ width: `${Math.max(0, share)}%` }} />
        </span>
      </button>
    </li>
  )
}

export function BeatsSheet({
  beats,
  typeOf,
  activeSection,
  onJump,
  markCount,
  sample,
  notice,
  footNote,
  onDismissNotice,
  onExport,
}: {
  beats: FlowSection[]
  typeOf: (changeId: string | null) => ChangeType | null
  activeSection: string | null
  onJump: (beat: FlowSection) => void
  markCount: number
  sample: boolean
  notice?: string | null
  footNote?: string | null
  onDismissNotice?: () => void
  onExport?: () => void
}) {
  const longest = beats.reduce((n, b) => Math.max(n, b.origWeight), 1)

  return (
    <div className="stage">
      <article className="sheet beats-sheet" id="sheet">
        {sample ? (
          <p className="stamp" aria-label="This is the sample manuscript">
            Sample
          </p>
        ) : null}
        {notice ? <PaperNote text={notice} onDismiss={onDismissNotice} /> : null}
        <header className="beats-head">
          <h2>Beats</h2>
          {/* The one line that explains the drawing, standing on the drawing. */}
          <p className="beats-hint">
            The sections of the draft, in order. The dashed track is how far a beat ran as
            you wrote it; the filled bar is what this pass leaves of it.
          </p>
        </header>
        {beats.length === 0 ? (
          <p className="beats-none">No draft on the paper yet, so there are no beats to draw.</p>
        ) : (
          <ol className="beats-list">
            {beats.map((beat, i) => (
              <BeatRow
                key={beat.id}
                beat={beat}
                n={i + 1}
                of={Math.max(9, Math.round((beat.origWeight / longest) * 100))}
                type={typeOf(beat.changeId)}
                active={activeSection === beat.id}
                onJump={onJump}
              />
            ))}
          </ol>
        )}
        {footNote ? <PaperNote foot text={footNote} onDismiss={onDismissNotice} /> : null}
        <div className="sheet-foot">
          <span id="foot-mode">
            {beats.length === 1 ? 'One beat' : `${beats.length} beats`} ·{' '}
            {markCount === 1 ? 'one mark' : `${markCount} marks`} on this pass. A marked beat
            opens its mark.
            {onExport ? (
              <>
                {' · '}
                <button type="button" className="foot-draft" id="foot-export" onClick={onExport}>
                  Export
                </button>
              </>
            ) : null}
          </span>
          <span className="keyhint">
            a keep this · r keep mine · u undo · j k step · 1-4 screens · esc close
          </span>
        </div>
      </article>
    </div>
  )
}
