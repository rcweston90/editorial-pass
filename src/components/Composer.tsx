import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { isDraftFile } from '../lib/draft'

const ACCEPT = '.md,.markdown,.mdown,.txt,.text,text/markdown,text/plain'

type Field = 'original' | 'edited'

/**
 * The body of screen one. Not a drawer and not a modal: on this screen the
 * draft box is the paper — paste or drop anywhere and it lands there — and the
 * compare box is a slip pinned beside it, because comparing two versions is the
 * rarer thing.
 *
 * That second box stays empty unless you put something in it. Run pass reads
 * the paper alone; a comparison is a thing you ask for by giving it two drafts.
 * Either one marks the draft up and hands you to screen two.
 */
export function Composer({
  originalMd,
  editedMd,
  onOriginal,
  onEdited,
  onLoadExample,
  onCompare,
  onRunPass,
  busy,
  notice,
  marked,
}: {
  originalMd: string
  editedMd: string
  onOriginal: (v: string) => void
  onEdited: (v: string) => void
  onLoadExample: () => void
  onCompare: () => void
  onRunPass: () => void
  busy: boolean
  notice: string | null
  /** Something is already marked up on the paper: loading over it asks first. */
  marked: boolean
}) {
  const [hover, setHover] = useState<Field | null>(null)
  const [dropped, setDropped] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const pickers = {
    original: useRef<HTMLInputElement | null>(null),
    edited: useRef<HTMLInputElement | null>(null),
  }

  /** Two files read as a comparison; one lands in the field it arrived on. */
  const read = useCallback(
    async (list: FileList | File[] | null | undefined, field: Field) => {
      const files = Array.from(list ?? []).filter(isDraftFile)
      if (files.length === 0) return false
      if (files.length > 1) {
        const [a, b] = await Promise.all([files[0].text(), files[1].text()])
        onOriginal(a)
        onEdited(b)
        setDropped(`${files[0].name} → original, ${files[1].name} → edited`)
        return true
      }
      const text = await files[0].text()
      if (field === 'edited') onEdited(text)
      else onOriginal(text)
      setDropped(`${files[0].name} → ${field === 'edited' ? 'edited' : 'original'}`)
      return true
    },
    [onOriginal, onEdited],
  )

  const take = useCallback(
    async (e: DragEvent, field: Field) => {
      e.preventDefault()
      e.stopPropagation()
      setHover(null)
      const took = await read(e.dataTransfer?.files, field)
      if (took) return
      const text = e.dataTransfer?.getData('text/plain')
      if (text) (field === 'edited' ? onEdited : onOriginal)(text)
    },
    [read, onOriginal, onEdited],
  )

  const pick = useCallback(
    (e: ChangeEvent<HTMLInputElement>, field: Field) => {
      void read(e.target.files, field)
      e.target.value = ''
    },
    [read],
  )

  const over = (field: Field) => (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setHover(field)
  }

  const field = (
    name: Field,
    label: string,
    value: string,
    onChange: (v: string) => void,
    hint: string,
    placeholder: string,
  ) => (
    <div
      className={`ms-field ms-${name}${hover === name ? ' drop-hover' : ''}`}
      onDragOver={over(name)}
      onDragLeave={() => setHover(null)}
      onDrop={(e) => void take(e, name)}
    >
      <label className="ms-lab" htmlFor={`ms-${name}`}>
        {label}
      </label>
      <p className="ms-hint">{hint}</p>
      <textarea
        id={`ms-${name}`}
        className="ms"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="drop-zone">
        <button
          type="button"
          className="drop-open"
          onClick={() => pickers[name].current?.click()}
        >
          <span className="drop-glyph" aria-hidden="true">
            ↓
          </span>
          <span className="drop-text">{hover === name ? 'Release to read it' : 'Drop a .md'}</span>
        </button>
        <input
          ref={pickers[name]}
          className="drop-input"
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(e) => pick(e, name)}
        />
      </div>
    </div>
  )

  const empty = originalMd.trim().length === 0
  const noEdit = editedMd.trim().length === 0
  // Nothing to lose, nothing to ask about: a blank desk just takes the sample.
  const wouldOverwrite = !empty || !noEdit || marked

  return (
    <section
      className="blotter"
      aria-label="Draft"
      onDragOver={over('original')}
      onDragLeave={() => setHover(null)}
      onDrop={(e) => void take(e, 'original')}
    >
      <div className="blotter-head">
        <h2>Draft</h2>
        {/* The first instruction is the whole instruction: paste, then Run pass. */}
        <p className="blotter-hint">
          <b>Paste a draft here, then Run pass.</b> A <code>.md</code> dropped anywhere on the
          desk lands on this paper too. The marks come back on screen two.
        </p>
      </div>
      <div className="blotter-body">
        {field(
          'original',
          'Original draft',
          originalMd,
          onOriginal,
          'Run pass reads this paper alone.',
          'Paste your draft here, then Run pass.',
        )}
        {/* The compare box is the exception, not the second half of the desk:
            it keeps the margin, and stays empty until someone asks for it. */}
        <aside className="blotter-side" aria-label="Compare versions">
          {field(
            'edited',
            'Edited version (optional)',
            editedMd,
            onEdited,
            'Only for Compare versions. Left empty, nothing is compared.',
            'Paste a second version to compare.',
          )}
        </aside>
      </div>
      <div className="blotter-acts">
        {/* A desk action, not a modal: the question stands in the row it came from. */}
        {confirming ? (
          <span className="blotter-confirm">
            <span className="confirm-copy">This replaces what is on the paper.</span>
            <button
              type="button"
              className="confirm-yes"
              onClick={() => {
                setConfirming(false)
                onLoadExample()
              }}
            >
              Load the example
            </button>
            <span className="sep" aria-hidden="true">
              ·
            </span>
            <button type="button" onClick={() => setConfirming(false)}>
              Keep my draft
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => (wouldOverwrite ? setConfirming(true) : onLoadExample())}
          >
            Load example
          </button>
        )}
        <span className="sep" aria-hidden="true">
          ·
        </span>
        <button type="button" onClick={onCompare} disabled={empty || noEdit}>
          Compare versions
        </button>
        <span className="sep" aria-hidden="true">
          ·
        </span>
        <button type="button" onClick={onRunPass} disabled={empty || busy}>
          {busy ? 'Reading…' : 'Run pass'}
        </button>
      </div>
      {notice ? <p className="blotter-note">{notice}</p> : null}
      {dropped ? <p className="blotter-drop">Read {dropped}.</p> : null}
    </section>
  )
}
