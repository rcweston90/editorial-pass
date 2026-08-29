import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeType, Decision, Filters, FlowSection, Mode, Screen, SessionState } from './types'
import { BeatsSheet } from './components/BeatsSheet'
import { Chrome } from './components/Chrome'
import { Composer } from './components/Composer'
import { DraftSheet } from './components/DraftSheet'
import { EssaySheet } from './components/EssaySheet'
import { SplitSheet } from './components/SplitSheet'
import { StatsBar } from './components/StatsBar'
import { exportMarkdown, fileSlug, passStats } from './lib/apply'
import { diffToMarks } from './lib/diff'
import {
  activeMarks,
  emptySession,
  ensureDocument,
  isDraftFile,
  isEmptyDesk,
  nextLayerId,
  withLayer,
} from './lib/draft'
import { exampleOriginalMd, exampleSession } from './lib/example'
import { probePass, runPass } from './lib/llmPass'
import { parseMarkdown, wordCount } from './lib/markdown'
import { clearSession, loadSession, saveSession } from './lib/persist'
import { screenAt, screenLive } from './lib/screens'
import { buildRender, markIndex, visibleMarks, walkOrder } from './lib/session'
import { buildSplit, changedBeats } from './lib/split'

/** Where the desk answers: beside the tap that asked, on the screen you are on. */
type NoticeAt = 'draft' | 'paper' | 'foot'
interface Notice {
  text: string
  at: NoticeAt
}

const UNDO_CAP = 40
const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])
/** A scrap is not a draft: a stray paste never lands on paper already holding one. */
const SCRAP = 80

/**
 * Cold: blank paper, an empty Original, a blank Edited. Warm: whatever was on
 * the desk last time, down to a draft that was pasted and never read. The
 * example is never either of those — persist refuses to write it down, so a
 * refresh over any store that holds one still opens on empty paper.
 */
function firstSession(): SessionState {
  return loadSession() ?? emptySession()
}

export default function App() {
  const [session, setSession] = useState<SessionState>(firstSession)
  /* Four screens, and a refresh always lands on the first of them. The desk you
     come back to is a place, not a stack of open drawers. */
  const [asked, setScreen] = useState<Screen>('draft')
  const [mode, setMode] = useState<Mode>('original')
  const [openId, setOpenId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ type: 'all', track: 'all' })
  const [undoStack, setUndoStack] = useState<Array<Record<string, Decision>>>([])
  const [llmAvailable, setLlmAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  // The manuscript owns the scroll targets; these keep the handlers off the DOM query path.
  const hosts = useRef<Record<string, HTMLElement | null>>({})
  const topstack = useRef<HTMLDivElement | null>(null)
  const anchors = useRef<Record<string, HTMLElement | null>>({})
  // A real anchor, in the document, so Export writes a file instead of a promise.
  const download = useRef<HTMLAnchorElement | null>(null)
  const blobUrl = useRef<string | null>(null)

  const registerHost = useCallback((id: string, el: HTMLElement | null) => {
    hosts.current[id] = el
  }, [])
  const registerAnchor = useCallback((id: string, el: HTMLElement | null) => {
    anchors.current[id] = el
  }, [])

  const marks = useMemo(() => activeMarks(session), [session])
  const marksById = useMemo(() => markIndex(marks), [marks])

  /* Nothing has been read onto the paper, so there is nothing to read three
     ways. Screen one is always open; the other three arrive with the pass — and
     Start over, which takes the pass away, hands you back to screen one without
     having to remember to. */
  const empty = isEmptyDesk(session)
  const ready = !empty
  const screen: Screen = screenLive(asked, ready) ? asked : 'draft'

  const render = useMemo(
    () => buildRender(session.document, marks, session.decisions, filters),
    [session.document, marks, session.decisions, filters],
  )
  const order = useMemo(
    () => walkOrder(session.document, marks, filters),
    [session.document, marks, filters],
  )
  const stats = useMemo(
    () => passStats(session.document, marks, session.decisions),
    [session.document, marks, session.decisions],
  )
  const shown = useMemo(() => visibleMarks(marks, filters).length, [marks, filters])
  const splitRows = useMemo(
    () => (screen === 'split' ? buildSplit(render.sections, session.decisions) : []),
    [screen, render.sections, session.decisions],
  )
  const changed = useMemo(() => {
    if (screen !== 'split') return []
    const inOrder = order.map((id) => marksById.get(id)).filter((m) => m !== undefined)
    return changedBeats(inOrder, render.whereOfMark)
  }, [screen, order, marksById, render.whereOfMark])

  useEffect(() => {
    document.body.dataset.mode = mode
  }, [mode])
  useEffect(() => {
    document.body.dataset.screen = screen
  }, [screen])
  useEffect(() => () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
  }, [])
  useEffect(() => {
    document.title = `${session.title} · editorial pass`
  }, [session.title])
  useEffect(() => {
    saveSession(session)
  }, [session])
  useEffect(() => {
    let live = true
    void probePass().then((ok) => {
      if (live) setLlmAvailable(ok)
    })
    return () => {
      live = false
    }
  }, [])

  // A mark that a filter just hid should not keep the focus ring or the slip.
  useEffect(() => {
    if (openId && !order.includes(openId)) setOpenId(null)
    if (focusId && !order.includes(focusId)) setFocusId(null)
  }, [order, openId, focusId])

  /**
   * j and k move the reading eye, not the page. A mark already on the paper is
   * left where it sits; one that is off it comes to rest just under the chrome.
   * Centring it instead sends a short manuscript to the bottom of the page,
   * which is how you lose the mark you just asked for.
   */
  const scrollToHost = useCallback((id: string) => {
    const el = hosts.current[id]
    if (!el) return
    const rect = el.getBoundingClientRect()
    const rest = (topstack.current?.getBoundingClientRect().bottom ?? 0) + 24
    if (rect.top >= rest && rect.top <= window.innerHeight - 80) return
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - rest), behavior: 'smooth' })
  }, [])

  /* A jump that crosses a screen cannot scroll in the handler that asked for
     it: the paper it is aiming at is not on the page yet. It is parked here and
     spent once the screen it belongs to has been drawn. */
  const jump = useRef<{ kind: 'host' | 'anchor'; id: string } | null>(null)
  useEffect(() => {
    const target = jump.current
    if (!target) return
    jump.current = null
    if (target.kind === 'host') scrollToHost(target.id)
    else anchors.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [screen, order, scrollToHost])

  /* A pass that lands under the chrome is a pass you have to go looking for, so
     the marks screen comes up to its first mark as soon as the marks exist. */
  const landing = useRef(false)
  useEffect(() => {
    if (!landing.current || screen !== 'marks') return
    landing.current = false
    if (order.length) scrollToHost(order[0])
  }, [screen, order, scrollToHost])

  const beatOf = render.beatOfGraf

  const closeSlip = useCallback(() => {
    setOpenId(null)
    setActiveSection(null)
  }, [])

  const openSlip = useCallback(
    (id: string, scroll: boolean) => {
      const mark = marksById.get(id)
      if (!mark) return
      setOpenId(id)
      setFocusId(id)
      setActiveSection(beatOf.get(mark.grafIds[0]) ?? mark.sectionId)
      if (scroll) scrollToHost(id)
    },
    [marksById, beatOf, scrollToHost],
  )

  const toggleSlip = useCallback(
    (id: string) => {
      if (openId === id) closeSlip()
      else openSlip(id, false)
    },
    [openId, closeSlip, openSlip],
  )

  /** j/k walk the visible marks. If a slip is open it follows the focus. */
  const step = useCallback(
    (dir: number) => {
      if (order.length === 0) return
      const at = focusId ? order.indexOf(focusId) : -1
      const next = at < 0 ? (dir > 0 ? 0 : order.length - 1) : at + dir
      const i = ((next % order.length) + order.length) % order.length
      const id = order[i]
      setFocusId(id)
      scrollToHost(id)
      if (openId !== null) openSlip(id, false)
    },
    [order, focusId, openId, openSlip, scrollToHost],
  )

  /**
   * A beat on screen four is a place in the manuscript, so clicking it goes
   * there: to its mark if the pass left one, to the prose itself if it did not.
   * Either way the paper is on screen two, so the scroll waits for it.
   */
  const jumpToBeat = useCallback(
    (beat: FlowSection) => {
      setActiveSection(beat.id)
      setScreen('marks')
      if (beat.changeId) {
        openSlip(beat.changeId, false)
        jump.current = { kind: 'host', id: beat.changeId }
      } else {
        setOpenId(null)
        jump.current = { kind: 'anchor', id: beat.anchorId }
      }
    },
    [openSlip],
  )

  /**
   * The counts in the stats bar are a files-changed list: they walk their marks.
   * The count is of the whole pass, so a filter hiding what you clicked lifts.
   */
  const jumpToType = useCallback(
    (type: ChangeType) => {
      const ofType = walkOrder(session.document, marks, { type, track: 'all' })
      if (ofType.length === 0) return
      if (!order.includes(ofType[0])) setFilters({ type, track: 'all' })
      const at = focusId ? ofType.indexOf(focusId) : -1
      openSlip(ofType[(at + 1) % ofType.length], true)
    },
    [session.document, marks, order, focusId, openSlip],
  )

  /* ---------------- the desk takes a draft ---------------- */

  /**
   * A draft arrives the way drafts arrive: dropped on the desk, or pasted onto
   * it with nothing in particular focused. Wherever it lands on the page it
   * goes to the draft screen, and the desk goes there with it.
   */
  const landDraft = useCallback((text: string, note: string, second?: string) => {
    const draft = text.replace(/\r\n?/g, '\n').trim()
    if (!draft) return
    setSession((s) => ({
      ...s,
      originalMd: draft,
      // Two files at once are a comparison; one never fills the second box.
      editedMd: second === undefined ? s.editedMd : second.replace(/\r\n?/g, '\n').trim(),
      sample: s.sample && draft === exampleOriginalMd,
    }))
    setScreen('draft')
    setNotice({ text: note, at: 'draft' })
  }, [])

  /** What is on the paper now, for handlers that must not go stale. */
  const draftRef = useRef(session.originalMd)
  useEffect(() => {
    draftRef.current = session.originalMd
  }, [session.originalMd])

  /**
   * A .md dropped anywhere but the draft box used to be opened by the browser,
   * which throws the whole desk away; a paste with nothing focused used to go
   * nowhere at all. Both land on screen one now, wherever they arrive.
   */
  useEffect(() => {
    const scrap = (text: string) => draftRef.current.trim() !== '' && text.trim().length < SCRAP
    const allow = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? []).filter(isDraftFile)
      if (files.length > 1) {
        void Promise.all([files[0].text(), files[1].text()]).then(([a, b]) =>
          landDraft(a, `Read ${files[0].name} → original, ${files[1].name} → edited.`, b),
        )
        return
      }
      if (files.length === 1) {
        void files[0].text().then((text) => landDraft(text, `Read ${files[0].name} onto the paper.`))
        return
      }
      const text = e.dataTransfer?.getData('text/plain') ?? ''
      if (text.trim() && !scrap(text)) {
        landDraft(text, `Dropped ${wordCount(text)} words onto the paper — Run pass reads them.`)
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (TYPING.has(el.tagName) || el.isContentEditable)) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim() || scrap(text)) return
      e.preventDefault()
      landDraft(text, `Pasted ${wordCount(text)} words onto the paper — Run pass reads them.`)
    }
    window.addEventListener('dragover', allow)
    window.addEventListener('drop', onDrop)
    document.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragover', allow)
      window.removeEventListener('drop', onDrop)
      document.removeEventListener('paste', onPaste)
    }
  }, [landDraft])

  /* ---------------- decisions ---------------- */

  const pushUndo = useCallback(() => {
    setUndoStack((stack) => [...stack, session.decisions].slice(-UNDO_CAP))
  }, [session.decisions])

  const decide = useCallback(
    (id: string, decision: Decision) => {
      if (!marksById.has(id)) return
      pushUndo()
      setSession((s) => ({ ...s, decisions: { ...s.decisions, [id]: decision } }))
    },
    [marksById, pushUndo],
  )

  const decideFocused = useCallback(
    (decision: Decision) => {
      const id = openId ?? focusId
      if (id) decide(id, decision)
    },
    [openId, focusId, decide],
  )

  const bulk = useCallback(
    (decision: Decision) => {
      const targets = visibleMarks(marks, filters)
      if (targets.length === 0) return
      pushUndo()
      setSession((s) => {
        const decisions = { ...s.decisions }
        for (const mark of targets) {
          if ((decisions[mark.id] ?? 'pending') === 'pending') decisions[mark.id] = decision
        }
        return { ...s, decisions }
      })
    },
    [marks, filters, pushUndo],
  )

  const undo = useCallback(() => {
