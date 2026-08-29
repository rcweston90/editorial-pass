import { Fragment } from 'react'
import type { MouseEvent } from 'react'
import type {
  ChangeBlock,
  Decision,
  DocHead,
  EssayNode,
  EssaySection,
  Mark,
  Mode,
  Track,
  WholeCut,
} from '../types'
import { parseInline } from '../lib/markdown'
import { InlineText, BlockText } from './RichText'
import { MarkButton } from './MarkButton'
import { PaperNote } from './PaperNote'
import { Slip } from './Slip'

type Register = (id: string, el: HTMLElement | null) => void

export interface SheetProps {
  head: DocHead
  sections: EssaySection[]
  marks: Map<string, Mark>
  decisions: Record<string, Decision>
  markCount: number
  mode: Mode
  /** Which version the spine reads in. The marks stand in both. */
  onMode: (mode: Mode) => void
  openId: string | null
  focusedId: string | null
  /** Mark id → the beat it sits in, so every label for it agrees. */
  where: Map<string, string>
  onToggle: (id: string) => void
  onDecide: (id: string, decision: Decision) => void
  onCloseSlip: () => void
  /** Still reading the example: say where a draft of your own goes. */
  onboard: boolean
  /** The paper is the shipped sample, and says so in the corner. */
  sample: boolean
  /** No draft at all. The paper asks for one instead of pretending to be one. */
  empty?: boolean
  /** The way to screen one, where a draft goes on. */
  onDraft: () => void
  /** What the desk last said. It stands on the paper when the blotter is shut. */
  notice?: string | null
  /** The same word, when the tap that earned it was down in the footer. */
  footNote?: string | null
  onDismissNotice?: () => void
  /** Export, tapped from the footer: the answer comes back to the footer. */
  onExport?: () => void
  registerHost: Register
  /** Sections and paragraphs both register here; the flow scrolls to them. */
  registerAnchor: Register
}

function hostClass(base: string, open: boolean, focused: boolean, decision: Decision) {
  const cls = [base]
  if (open) cls.push('is-open')
  if (focused) cls.push('is-focused')
  if (decision === 'rejected') cls.push('is-rejected')
  if (decision === 'accepted') cls.push('is-accepted')
  return cls.join(' ')
}

/**
 * The marked passage itself is a target, in both versions: in the edited
 * reading the scar rule is all that is left of a cut, so it stays clickable.
 */
function passageProps(id: string, onToggle: (id: string) => void) {
  return {
    onClick: (e: MouseEvent) => {
      e.stopPropagation()
      onToggle(id)
    },
  }
}

function decisionOf(props: SheetProps, id: string): Decision {
  return props.decisions[id] ?? 'pending'
}

/** A mark is somewhere: the beat it landed in, named the way the flow names it. */
function whereFor(props: SheetProps, id: string, fallback: string): string {
  return props.where.get(id) ?? props.marks.get(id)?.sectionTitle ?? fallback
}

/** Which pass wrote this mark. It is named on the mark, never in a legend. */
function trackFor(props: SheetProps, id: string): Track {
  return props.marks.get(id)?.track ?? 'Cut'
}

function ChangeBlockNode({ node, props }: { node: ChangeBlock; props: SheetProps }) {
  const { openId, focusedId, onToggle, registerHost, registerAnchor } = props
  const open = openId === node.changeId
  const decision = decisionOf(props, node.changeId)
  const single = node.blocks.length === 1 && node.type === 'cut'

  return (
    <div
      className={hostClass('change-block', open, focusedId === node.changeId, decision)}
      data-change={node.changeId}
      data-type={node.type}
      ref={(el) => {
        registerHost(node.changeId, el)
        registerAnchor(node.anchorId, el)
      }}
    >
      <MarkButton
        id={node.changeId}
        type={node.type}
        track={trackFor(props, node.changeId)}
        where={whereFor(props, node.changeId, 'this passage')}
        decision={decision}
        open={open}
        focused={focusedId === node.changeId}
        onToggle={onToggle}
        onDecide={props.onDecide}
      />
      {single ? (
        <p className="block-orig wash-cut" {...passageProps(node.changeId, onToggle)}>
          <InlineText content={node.blocks[0].content} />
        </p>
      ) : (
        <div
          className={`block-orig wash-${node.type}`}
          {...passageProps(node.changeId, onToggle)}
        >
          <BlockText blocks={node.blocks} />
        </div>
      )}
      {node.altered ? (
        <div className="block-alt" {...passageProps(node.changeId, onToggle)}>
          <BlockText blocks={node.altered} />
        </div>
      ) : (
        <div className="block-scar" aria-hidden="true" {...passageProps(node.changeId, onToggle)}>
          <span className="scar-rule" />
        </div>
      )}
    </div>
  )
}

function Node({ node, props }: { node: EssayNode; props: SheetProps }) {
  const { openId, focusedId, onToggle, registerHost, registerAnchor } = props

  if (node.kind === 'p') {
    return (
      <p className={node.className} ref={(el) => registerAnchor(node.anchorId, el)}>
        <InlineText content={node.content} />
      </p>
    )
  }

  if (node.kind === 'rewritten') {
    const open = openId === node.changeId
    const decision = decisionOf(props, node.changeId)
    return (
      <div
        className={hostClass('graf', open, focusedId === node.changeId, decision)}
        data-change={node.changeId}
        ref={(el) => {
          registerHost(node.changeId, el)
          registerAnchor(node.anchorId, el)
        }}
      >
        <MarkButton
          id={node.changeId}
          type="rewritten"
          track={trackFor(props, node.changeId)}
          where={whereFor(props, node.changeId, 'this line')}
          decision={decision}
          open={open}
          focused={focusedId === node.changeId}
          onToggle={onToggle}
          onDecide={props.onDecide}
        />
        <p>
          <span
            className="chg"
            data-id={node.changeId}
            data-type="rewritten"
            {...passageProps(node.changeId, onToggle)}
          >
            <span className="text-orig">
              <InlineText content={node.orig} />
            </span>
            <span className="text-edit">
              <InlineText content={node.edit} />
            </span>
          </span>
        </p>
      </div>
    )
  }

  return <ChangeBlockNode node={node} props={props} />
}

/** A section the pass removed outright: the section element is the change host. */
function WholeCutSection({
  section,
  cut,
  props,
}: {
  section: EssaySection
  cut: WholeCut
  props: SheetProps
}) {
  const { openId, focusedId, onToggle, registerHost, registerAnchor } = props
  const open = openId === cut.changeId
  const decision = decisionOf(props, cut.changeId)

  return (
    <section
      id={`sec-${section.id}`}
      data-section={section.id}
      className={hostClass('change-block', open, focusedId === cut.changeId, decision)}
      data-change={cut.changeId}
      data-type="cut"
      data-whole="true"
      ref={(el) => {
        registerAnchor(section.id, el)
        registerAnchor(cut.anchorId, el)
        registerHost(cut.changeId, el)
      }}
    >
      <MarkButton
        id={cut.changeId}
        type="cut"
        track={trackFor(props, cut.changeId)}
        where={whereFor(props, cut.changeId, 'this section')}
        decision={decision}
        open={open}
        focused={focusedId === cut.changeId}
        onToggle={onToggle}
        onDecide={props.onDecide}
      />
      <div className="block-orig wash-cut" {...passageProps(cut.changeId, onToggle)}>
        <h2>
          <InlineText content={cut.heading} />
        </h2>
        <BlockText blocks={cut.blocks} />
      </div>
      <div className="block-ghost">
        <div className="ghost-section" {...passageProps(cut.changeId, onToggle)}>
          <p className="ghost-kicker">Removed in this pass</p>
          <h2>
            <InlineText content={cut.heading} />
          </h2>
        </div>
      </div>
    </section>
  )
}

/**
 * The paper before there is anything on it. It is still paper, and it carries
 * one next step and nothing else: go to screen one and paste a draft.
 *
 * There is exactly one button here on purpose. Screen two is a reading of a
 * pass, so with no pass to read it says where the pass comes from and gets out
 * of the way.
 */
function EmptyPaper({ onDraft }: { onDraft: () => void }) {
  return (
    <div className="paper-empty">
      <p className="paper-empty-lead">Paste a draft, then Run pass.</p>
      <p className="paper-empty-body">
        The draft goes on <b>screen one</b> — or drop a <code>.md</code> anywhere on the desk.
        <b> Run pass</b> reads that one draft, marks it up, and lands you back here.
      </p>
      <p className="paper-empty-acts">
        <button type="button" className="paper-act" onClick={onDraft}>
          Go to Draft
        </button>
      </p>
    </div>
  )
}

/**
 * The one control this screen owns: which version the spine is read in. Both
 * readings carry the same marks in the margin — the words on the mark are the
 * same either way, and screen three stands the two of them side by side.
 */
function Reading({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  return (
    <div className="paper-top">
      <span className="reading" role="radiogroup" aria-label="Reading">
        <span className="reading-lab">Reading</span>
        <button
          type="button"
          className="reading-opt"
          role="radio"
          id="btn-orig"
          aria-checked={mode === 'original'}
          title="The manuscript as written (o)"
          onClick={() => onMode('original')}
        >
          Original
        </button>
        <span className="sep" aria-hidden="true">
          /
        </span>
        <button
          type="button"
          className="reading-opt"
          role="radio"
          id="btn-edit"
          aria-checked={mode === 'edited'}
          title="The manuscript as this pass leaves it (e)"
          onClick={() => onMode('edited')}
        >
          Edited
        </button>
      </span>
    </div>
  )
}

export function EssaySheet(props: SheetProps) {
  const {
    head,
    sections,
    marks,
    mode,
    openId,
    onCloseSlip,
    onDecide,
    registerAnchor,
    markCount,
    sample,
    empty,
  } = props
  const open = openId ? marks.get(openId) ?? null : null
  const slipFor = (id: string) =>
    open && open.id === id ? (
      <Slip
        change={open}
        where={whereFor(props, open.id, 'this passage')}
        mode={mode}
        decision={decisionOf(props, open.id)}
        onDecide={onDecide}
        onClose={onCloseSlip}
      />
    ) : null

  return (
    <div className="stage">
      <article className="sheet" id="sheet">
        {sample ? (
          <p className="stamp" aria-label="This is the sample manuscript">
            Sample
          </p>
        ) : null}
        {/* Export, a read draft, a stale one: the desk says so on the paper,
            because the blotter it used to say it on may well be shut. */}
        {props.notice ? (
          <PaperNote text={props.notice} onDismiss={props.onDismissNotice} />
        ) : null}
        {/* The sample is on the paper: yours goes on screen one, said here at
            the top rather than in a footer a whole manuscript away. */}
        {props.onboard ? (
          <p className="paper-yours">
            Reading the sample.{' '}
            <button type="button" className="foot-draft" onClick={props.onDraft}>
              Paste your own draft
            </button>{' '}
            to replace it.
          </p>
        ) : null}
        {/* This screen's own control, on the paper, above the manuscript. */}
        {empty ? null : <Reading mode={mode} onMode={props.onMode} />}
        <div className="essay" id="essay">
          <header className="essay-head">
            {head.derivedTitle ? null : <h1>{head.title}</h1>}
            {head.byline ? (
              <p className="byline">
                <InlineText content={head.byline} />
              </p>
            ) : null}
            {/* The epigraph is kept as the line the draft wrote, so it goes back
                out byte for byte — but it is read as prose on the way in, or a
                draft that emphasised it prints its own asterisks at the reader. */}
            {head.epigraph ? (
              <blockquote className="epigraph">
                <InlineText content={parseInline(head.epigraph)} />
              </blockquote>
            ) : null}
          </header>

          {empty ? <EmptyPaper onDraft={props.onDraft} /> : null}

          {sections.map((section) =>
            section.wholeCut ? (
              <Fragment key={section.id}>
                <WholeCutSection section={section} cut={section.wholeCut} props={props} />
                {slipFor(section.wholeCut.changeId)}
              </Fragment>
            ) : (
              <section
                key={section.id}
                id={`sec-${section.id}`}
                data-section={section.id}
                ref={(el) => registerAnchor(section.id, el)}
              >
                {section.heading ? (
                  <h2>
                    <InlineText content={section.heading} />
                  </h2>
                ) : null}
                {section.nodes.map((node, i) => (
                  <Fragment key={i}>
                    <Node node={node} props={props} />
                    {node.kind !== 'p' ? slipFor(node.changeId) : null}
                  </Fragment>
                ))}
              </section>
            ),
          )}

          {/* Above the rule, not below it: a word added under the last line of
              the page lands off the bottom of a phone. Here it takes the
              footer's own place, right beside the tap that asked for it. */}
          {props.footNote ? (
            <PaperNote foot text={props.footNote} onDismiss={props.onDismissNotice} />
          ) : null}
          <div className="sheet-foot">
            <span id="foot-mode">
              {empty ? (
                'No draft on the paper. Nothing has been marked.'
              ) : (
                <>
                  {markCount === 1 ? 'One mark' : `${markCount} marks`} on this pass. You are
                  reading the {mode === 'original' ? 'original' : 'edited'} version.
                </>
              )}
              {/* Export at the end of the manuscript, because that is where you
                  are when you have finished reading it. */}
              {!empty && props.onExport ? (
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
        </div>
      </article>
    </div>
  )
}
