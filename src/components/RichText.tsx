import { Fragment } from 'react'
import type { ReactNode } from 'react'
import type { Block, DeltaBlock, Inline } from '../types'

/** Renders stored prose, keeping em-dashes, italics and bold intact. */
export function InlineText({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((node, i) => {
        if (typeof node === 'string') return <Fragment key={i}>{node}</Fragment>
        if (node.tag === 'em')
          return (
            <em key={i}>
              <InlineText content={node.content} />
            </em>
          )
        return (
          <strong key={i}>
            <InlineText content={node.content} />
          </strong>
        )
      })}
    </>
  )
}

export function BlockText({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.tag === 'h3' ? (
          <h3 key={i}>
            <InlineText content={b.content} />
          </h3>
        ) : (
          <p key={i}>
            <InlineText content={b.content} />
          </p>
        ),
      )}
    </>
  )
}

/* ---------------- word-level deltas ---------------- */

interface Cursor {
  i: number
}

const SPACE = /^\s+$/

/**
 * Walks the prose and the flags together: one flag per word, in the order the
 * words appear, so emphasis inside a changed phrase survives the marking.
 */
function marked(nodes: Inline[], flags: boolean[], kind: 'del' | 'ins', cur: Cursor): ReactNode[] {
  const out: ReactNode[] = []

  nodes.forEach((node, k) => {
    if (typeof node !== 'string') {
      const inner = marked(node.content, flags, kind, cur)
      out.push(
        node.tag === 'em' ? (
          <em key={`e${k}`}>{inner}</em>
        ) : (
          <strong key={`s${k}`}>{inner}</strong>
        ),
      )
      return
    }

    const tokens = node.split(/(\s+)/).filter((s) => s !== '')
    const on = tokens.map((tok) => (SPACE.test(tok) ? false : (flags[cur.i++] ?? false)))
    // The space between two changed words changed too, so the rule runs through.
    for (let i = 1; i < tokens.length - 1; i++) {
      if (SPACE.test(tokens[i]) && on[i - 1] && on[i + 1]) on[i] = true
    }

    let buf = ''
    let hot = false
    let seq = 0
    const flush = () => {
      if (!buf) return
      const key = `t${k}-${seq++}`
      if (!hot) out.push(<Fragment key={key}>{buf}</Fragment>)
      else if (kind === 'del') out.push(<del key={key}>{buf}</del>)
      else out.push(<ins key={key}>{buf}</ins>)
      buf = ''
    }
    tokens.forEach((tok, i) => {
      if (on[i] !== hot) {
        flush()
        hot = on[i]
      }
      buf += tok
    })
    flush()
  })

  return out
}

export function DeltaText({
  content,
  flags,
  kind,
}: {
  content: Inline[]
  flags: boolean[]
  kind: 'del' | 'ins'
}) {
  return <>{marked(content, flags, kind, { i: 0 })}</>
}

export function DeltaBlocks({ blocks, kind }: { blocks: DeltaBlock[]; kind: 'del' | 'ins' }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.tag === 'h3' ? (
          <h3 key={i}>
            <DeltaText content={b.content} flags={b.flags} kind={kind} />
          </h3>
        ) : (
          <p key={i}>
            <DeltaText content={b.content} flags={b.flags} kind={kind} />
          </p>
        ),
      )}
    </>
  )
}
