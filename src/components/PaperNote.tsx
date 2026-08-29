/**
 * What the desk last said, standing next to the tap that caused it: at the top
 * of the paper for a tap in the chrome, at the foot of it for a tap in the
 * footer. Same slip of ink either way — only the place moves.
 */
export function PaperNote({
  text,
  foot,
  onDismiss,
}: {
  text: string
  /** It answers a footer tap, so it sits under the footer rule, not up top. */
  foot?: boolean
  onDismiss?: () => void
}) {
  return (
    <p className={foot ? 'paper-note is-foot' : 'paper-note'}>
      <span className="paper-note-copy">{text}</span>
      {onDismiss ? (
        <button type="button" className="paper-note-x" onClick={onDismiss}>
          dismiss
        </button>
      ) : null}
    </p>
  )
}
