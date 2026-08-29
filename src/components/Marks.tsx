import type { ChangeType } from '../types'

/**
 * The three copyeditor marks, drawn the way the prototype draws them:
 * a delete cross, a compression arrow pair, and a rewrite squiggle.
 */
export function MarkShape({
  type,
  className,
  width,
  height,
}: {
  type: ChangeType
  className?: string
  width?: number
  height?: number
}) {
  const common = {
    className,
    width,
    height,
    viewBox: '0 0 16 14',
    'aria-hidden': true,
  } as const

  if (type === 'cut') {
    return (
      <svg {...common}>
        <path
          d="M2.6 2.6 L13.4 11.4 M13.4 2.6 L2.6 11.4"
          stroke="currentColor"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'compressed') {
    return (
      <svg {...common}>
        <path
          d="M1 7h5M4.3 5.1 6.2 7 4.3 8.9M15 7h-5M11.7 5.1 9.8 7l1.9 1.9"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path
        d="M1 7c1.6-3.6 3.2-3.6 4.8 0s3.2 3.6 4.8 0 3.2-3.6 4.8 0"
        stroke="currentColor"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
