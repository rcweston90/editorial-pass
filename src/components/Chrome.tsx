import type { Layer, Screen } from '../types'
import { SCREENS, screenLive } from '../lib/screens'

/**
 * The four screens are the chrome. There is no mode row, no Flow toggle and no
 * Draft drawer up here any more — each of those was a panel that opened over
 * the paper, and every one of them is now somewhere you go, in order, numbered
 * the way the 1–4 keys are numbered.
 *
 * Screens two to four are readings of a pass, so they stay shut until there is
 * one. Export is the only verb that belongs to all four.
 */
export function Chrome({
  title,
  screen,
  onScreen,
  ready,
  layers,
  activeLayerId,
  onLayer,
  onExport,
}: {
  title: string
  screen: Screen
  onScreen: (screen: Screen) => void
  /** A pass has been read onto the paper. Before that there is only screen one. */
  ready: boolean
  layers: Layer[]
  activeLayerId: string
  onLayer: (id: string) => void
  onExport: () => void
}) {
  return (
    <header className="chrome">
      <div className="chrome-brand">
        <div className="chrome-kicker">Editorial pass</div>
        <div className="chrome-title">{title}</div>
      </div>
      <nav className="screens" id="screens" aria-label="Screens">
        {SCREENS.map((s) => {
          const live = screenLive(s.id, ready)
          return (
            <button
              key={s.id}
              type="button"
              className="screen-tab"
              id={`screen-${s.id}`}
              data-screen={s.id}
              aria-current={screen === s.id ? 'page' : undefined}
              disabled={!live}
              title={live ? s.why : 'Nothing marked yet — paste a draft and Run pass'}
              onClick={() => onScreen(s.id)}
            >
              <span className="screen-n" aria-hidden="true">
                {s.n}
              </span>
              <span className="screen-name">{s.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="chrome-controls">
        {layers.length > 1 ? (
          <div className="mode-toggle layer-toggle" role="radiogroup" aria-label="Pass layer">
            {layers.map((layer, i) => (
              <span key={layer.id} className="layer-opt">
                {i > 0 ? (
                  <span className="sep" aria-hidden="true">
                    /
                  </span>
                ) : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={layer.id === activeLayerId}
                  onClick={() => onLayer(layer.id)}
                >
                  {layer.label}
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="chrome-acts">
          <button
            type="button"
            id="export-btn"
            title="Download the working copy as markdown"
            onClick={onExport}
          >
            Export
          </button>
        </div>
      </div>
    </header>
  )
}
