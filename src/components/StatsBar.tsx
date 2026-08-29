import { useState } from 'react'
import type { ChangeType, Filters, PassStats, Track } from '../types'
import { KEEP_MINE_WHY, KEEP_THIS_WHY, TRACKS } from '../lib/labels'

const TYPES: ChangeType[] = ['cut', 'compressed', 'rewritten']

function n(value: number): string {
  return value.toLocaleString('en-US')
}

function Group<T extends string>({
  label,
  gloss,
  options,
  value,
  onPick,
  muted,
}: {
  label: string
  gloss: string
  options: T[]
  value: T | 'all'
  onPick: (v: T | 'all') => void
  muted: boolean
}) {
  return (
    <div
      className={muted ? 'filter-toggle is-muted' : 'filter-toggle'}
      role="radiogroup"
      aria-label={`${label} — ${gloss}`}
    >
      <span className="filter-lab">
        {label}
        <span className="filter-gloss">{gloss}</span>
      </span>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'all'}
        onClick={() => onPick('all')}
      >
        All
      </button>
      {options.map((option) => (
        <span key={option} className="filter-opt">
          <span className="sep" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onPick(option)}
          >
            {option === 'cut' ? 'Cut' : option === 'compressed' ? 'Compressed' : option === 'rewritten' ? 'Rewritten' : option}
          </button>
        </span>
      ))}
    </div>
  )
}

export function StatsBar({
  stats,
  filters,
  onFilters,
  onJumpType,
  onKeepAll,
  onKeepMineAll,
  onUndo,
  canUndo,
  shown,
  armed,
}: {
  stats: PassStats
  filters: Filters
  onFilters: (f: Filters) => void
  armed: boolean
  onJumpType: (type: ChangeType) => void
  onKeepAll: () => void
  onKeepMineAll: () => void
  onUndo: () => void
  canUndo: boolean
  shown: number
}) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const filtered = filters.type !== 'all' || filters.track !== 'all'
  const muted = !armed && !filtered

  return (
    <div className={toolsOpen ? 'stats is-tools-open' : 'stats'}>
      <div className="stats-count">
        <span className="fig">{n(stats.wordsIn)}</span>
        <span className="arrow" aria-hidden="true">
          →
        </span>
        <span className="fig">{n(stats.wordsTaken)}</span>
        <span className="dot">·</span>
        <span className="fig">{stats.pctTaken}%</span> cut
        <span className="stats-types">
          <span className="dot">·</span>
          {TYPES.map((type, i) => (
            <span key={type} className="stat-jump-wrap">
              {i > 0 ? <span className="dot">·</span> : null}
              <button
                type="button"
                className="stat-jump"
                disabled={stats[type] === 0}
                title={`Jump to the next ${type} mark`}
                onClick={() => onJumpType(type)}
              >
                <span className="fig">{stats[type]}</span> {type}
              </button>
            </span>
          ))}
        </span>
        {stats.pending > 0 ? (
          <span className="stats-open" title="A mark you have not decided yet reads as kept in the edited reading and in Export.">
            <span className="dot">·</span>
            <span className="fig">{stats.pending}</span> open
            <span className="stats-iftaken">
              <span className="dot">·</span>
              <span className="fig">{n(stats.wordsOut)}</span> if kept
            </span>
          </span>
        ) : null}
        {shown !== stats.total ? (
          <>
            <span className="dot">·</span>
            <span className="fig">{shown}</span> shown
          </>
        ) : null}
      </div>
      <button
        type="button"
        className="stats-tuck"
        aria-expanded={toolsOpen}
        aria-controls="stats-tools"
        onClick={() => setToolsOpen((v) => !v)}
      >
        {toolsOpen ? 'Close' : filtered ? 'Marks · filtered' : 'Marks'}
      </button>
      <div className="stats-tools" id="stats-tools">
        <Group<ChangeType>
          label="Type"
          gloss="what the mark did"
          options={TYPES}
          value={filters.type}
          muted={muted}
          onPick={(type) => onFilters({ ...filters, type })}
        />
        <Group<Track>
          label="Track"
          gloss="which pass wrote it"
          options={TRACKS}
          value={filters.track}
          muted={muted}
          onPick={(track) => onFilters({ ...filters, track })}
        />
        <div className="bulk">
          <button type="button" title={`${KEEP_THIS_WHY}, on every open mark`} onClick={onKeepAll}>
            Keep all
          </button>
          <span className="sep" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            title={`${KEEP_MINE_WHY}, on every open mark`}
            onClick={onKeepMineAll}
          >
            Keep all mine
          </button>
          {canUndo ? (
            <>
              <span className="sep" aria-hidden="true">
                ·
              </span>
              <button type="button" onClick={onUndo}>
                Undo
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
