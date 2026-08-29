import { Fragment } from 'react'
import type { MouseEvent } from 'react'
import type { Decision, DocHead, Mark, SplitRow } from '../types'
import { NOTHING } from '../lib/labels'
import { DeltaBlocks, InlineText } from './RichText'
import { MarkButton } from './MarkButton'
import { PaperNote } from './PaperNote'
import { Slip } from './Slip'

type Register = (id: string, el: HTMLElement | null) => void

export interface SplitProps {
  head: DocHead
  rows: SplitRow[]
  changed: Array<{ changeId: string; label: string }>
  marks: Map<string, Mark>
  markCount: number
  openId: string | null
  focusedId: string | null
  where: Map<string, string>
  onToggle: (id: string) => void
  onDecide: (id: string, decision: Decision) => void
  onCloseSlip: () => void
  onboard: boolean
  sample: boolean
  onDraft: () => void
  notice?: string | null
  footNote?: string | null
  onDismissNotice?: () => void
  onExport?: () => void
  registerHost: Register
  registerAnchor: Register
}

function cellClass(base: string, open: boolean, focused: boolean, decision: Decision) {
  const cls = [base]
  if (open) cls.push('is-open')
  if (focused) cls.push('is-focused')
  if (decision === 'rejected') cls.push('is-rejected')
  if (decision === 'accepted') cls.push('is-accepted')
  return cls.join(' ')
}

export function SplitSheet(props: SplitProps) {
  const {
    head,
    rows,
    changed,
    marks,
    markCount,
    openId,
    focusedId,
    onToggle,
    onDecide,
    onCloseSlip,
    sample,
    registerHost,
    registerAnchor,
  } = props

  const open = openId ? (marks.get(openId) ?? null) : null
  const stop = (id: string) => (e: MouseEvent) => {
    e.stopPropagation()
    onToggle(id)
  }

  return (
    <div className="stage">
      <article className="sheet split-sheet" id="sheet">
        {sample ? (
          <p className="stamp" aria-label="This is the sample manuscript">
            Sample
          </p>
        ) : null}
        {props.notice ? (
          <PaperNote text={props.notice} onDismiss={props.onDismissNotice} />
        ) : null}
        {props.onboard ? (
          <p className="paper-yours">
            Reading the sample.{' '}
            <button type="button" className="foot-draft" onClick={props.onDraft}>
              Paste your own draft
            </button>{' '}
            to replace it.
          </p>
        ) : null}
        <header className="essay-head split-doc-head">
          {head.derivedTitle ? null : <h1>{head.title}</h1>}
          {head.byline ? (
            <p className="byline">
              <InlineText content={head.byline} />
            </p>
          ) : null}
        </header>

        <div className="split-changed">
          <span className="split-changed-lab">Changed</span>
          {changed.length === 0 ? (
            <span className="split-changed-none">nothing on this pass</span>
          ) : (
            changed.map((c, i) => (
              <Fragment key={c.changeId}>
                {i > 0 ? (
                  <span className="sep" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                <button type="button" onClick={() => onToggle(c.changeId)}>
                  {c.label}
                </button>
              </Fragment>
            ))
          )}
        </div>

        <div className="split-grid">
          <div className="split-lab">Original</div>
          <div className="split-gutter split-lab-gut" aria-hidden="true" />
          <div className="split-lab split-lab-right">Edited</div>

          {rows.map((row) => {
            if (row.kind === 'heading') {
              return (
                <Fragment key={row.id}>
                  <div className="split-cell is-head" ref={(el) => registerAnchor(row.anchorId, el)}>
                    <h2>
                      <InlineText content={row.heading} />
                    </h2>
                  </div>
                  <div className="split-gutter" />
                  <div
                    className={
                      row.gone ? 'split-cell is-head is-right is-gone' : 'split-cell is-head is-right'
                    }
                  >
                    <h2>
                      <InlineText content={row.heading} />
                    </h2>
                  </div>
                </Fragment>
              )
            }

            if (row.kind === 'kept') {
              return (
                <Fragment key={row.id}>
                  <div className="split-cell" ref={(el) => registerAnchor(row.anchorId, el)}>
                    <p className={row.className}>
                      <InlineText content={row.content} />
                    </p>
                  </div>
                  <div className="split-gutter" />
                  <div className="split-cell is-right">
                    <p className={row.className}>
                      <InlineText content={row.content} />
                    </p>
                  </div>
                </Fragment>
              )
            }

            const isOpen = openId === row.changeId
            const focused = focusedId === row.changeId
            const beat = props.where.get(row.changeId) ?? marks.get(row.changeId)?.sectionTitle
            const wash = row.decision === 'rejected' ? '' : ` wash-${row.type === 'rewritten' ? 'compressed' : row.type}`

            return (
              <Fragment key={row.id}>
                <div
                  className={`${cellClass('split-cell is-change', isOpen, focused, row.decision)}${wash}`}
                  data-change={row.changeId}
                  data-type={row.type}
                  onClick={stop(row.changeId)}
                  ref={(el) => {
                    registerHost(row.changeId, el)
                    registerAnchor(row.anchorId, el)
                  }}
                >
                  <DeltaBlocks blocks={row.left} kind="del" />
                </div>
                <div className="split-gutter">
                  <MarkButton
                    id={row.changeId}
                    type={row.type}
                    track={marks.get(row.changeId)?.track ?? 'Cut'}
                    where={beat ?? 'this passage'}
                    decision={row.decision}
                    open={isOpen}
                    focused={focused}
                    onToggle={onToggle}
                    onDecide={onDecide}
                  />
                </div>
                <div
                  className={cellClass('split-cell is-change is-right', isOpen, focused, row.decision)}
                  onClick={stop(row.changeId)}
                >
                  {row.right ? (
                    <DeltaBlocks blocks={row.right} kind="ins" />
                  ) : (
                    <p className="split-none">
                      {row.whole ? 'Removed in this pass. ' : ''}
                      {NOTHING[row.type === 'compressed' ? 'compressed' : 'cut']}
                    </p>
                  )}
                </div>
                {open && open.id === row.changeId ? (
                  <div className="split-slip">
                    <Slip
                      change={open}
                      where={beat}
                      mode="original"
                      decision={row.decision}
                      onDecide={onDecide}
                      onClose={onCloseSlip}
                      showCopy={false}
                    />
                  </div>
                ) : null}
              </Fragment>
            )
          })}
        </div>

        {props.footNote ? (
          <PaperNote foot text={props.footNote} onDismiss={props.onDismissNotice} />
        ) : null}
        <div className="sheet-foot">
          <span id="foot-mode">
            {markCount === 1 ? 'One mark' : `${markCount} marks`} on this pass. Your original is
            the spine; this pass is the Edited column beside it.
            {props.onExport ? (
              <>
                {' · '}
                <button
                  type="button"
                  className="foot-draft"
                  id="foot-export"
                  onClick={props.onExport}
                >
                  Export
                </button>
              </>
            ) : null}
          </span>
          <span className="keyhint">
            a keep this · r keep mine · u undo · j k step · enter inspect · 1-4 screens
          </span>
        </div>
      </article>
    </div>
  )
}
