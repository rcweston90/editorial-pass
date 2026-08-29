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

  const hosts = useRef<Record<string, HTMLElement | null>>({})
  const topstack = useRef<HTMLDivElement | null>(null)
  const anchors = useRef<Record<string, HTMLElement | null>>({})
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
  useEffect(() => {
    if (openId && !order.includes(openId)) setOpenId(null)
    if (focusId && !order.includes(focusId)) setFocusId(null)
  }, [order, openId, focusId])

  const scrollToHost = useCallback((id: string) => {
    const el = hosts.current[id]
    if (!el) return
    const rect = el.getBoundingClientRect()
    const rest = (topstack.current?.getBoundingClientRect().bottom ?? 0) + 24
    if (rect.top >= rest && rect.top <= window.innerHeight - 80) return
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - rest), behavior: 'smooth' })
  }, [])

  const jump = useRef<{ kind: 'host' | 'anchor'; id: string } | null>(null)
  useEffect(() => {
    const target = jump.current
    if (!target) return
    jump.current = null
    if (target.kind === 'host') scrollToHost(target.id)
    else anchors.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [screen, order, scrollToHost])

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
  const landDraft = useCallback((text: string, note: string, second?: string) => {
    const draft = text.replace(/\r\n?/g, '\n').trim()
    if (!draft) return
    setSession((s) => ({
      ...s,
      originalMd: draft,
      editedMd: second === undefined ? s.editedMd : second.replace(/\r\n?/g, '\n').trim(),
      sample: s.sample && draft === exampleOriginalMd,
    }))
    setScreen('draft')
    setNotice({ text: note, at: 'draft' })
  }, [])
  const draftRef = useRef(session.originalMd)
  useEffect(() => {
    draftRef.current = session.originalMd
  }, [session.originalMd])
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
    if (undoStack.length === 0) return
    const decisions = undoStack[undoStack.length - 1]
    setUndoStack((stack) => stack.slice(0, -1))
    setSession((s) => ({ ...s, decisions }))
  }, [undoStack])
  const setOriginal = useCallback((originalMd: string) => {
    setNotice(null)
    setSession((s) => ({ ...s, originalMd, sample: s.sample && originalMd === exampleOriginalMd }))
  }, [])
  const setEdited = useCallback((editedMd: string) => {
    setNotice(null)
    setSession((s) => ({ ...s, editedMd }))
  }, [])
  const landOnMarks = useCallback((text: string | null) => {
    landing.current = true
    setUndoStack([])
    setOpenId(null)
    setFocusId(null)
    setFilters({ type: 'all', track: 'all' })
    setMode('original')
    setScreen('marks')
    setNotice(text ? { text, at: 'paper' } : null)
  }, [])
  const loadExample = useCallback(() => {
    landOnMarks('The sample draft and the pass over it are on the desk. Start over clears them.')
    setSession(exampleSession())
  }, [landOnMarks])
  const compare = useCallback(() => {
    if (!session.originalMd.trim() || !session.editedMd.trim()) return
    const base = ensureDocument(session, session.originalMd)
    const existing = base.layers.find((l) => l.label === 'Compare')
    const layerId = existing?.id ?? nextLayerId(base, 'compare')
    const marksOut = diffToMarks(base.document, parseMarkdown(session.editedMd), layerId)
    landOnMarks(null)
    setSession(withLayer(base, { id: layerId, label: 'Compare', source: 'diff', marks: marksOut }))
  }, [session, landOnMarks])
  const pass = useCallback(async () => {
    if (!session.originalMd.trim() || busy) return
    setBusy(true)
    try {
      const base = ensureDocument(session, session.originalMd)
      const layerId = nextLayerId(base, 'pass')
      const result = await runPass(base.document, base.originalMd, layerId, llmAvailable)
      landOnMarks(result.notice)
      setSession(
        withLayer(base, {
          id: layerId,
          label: result.label,
          source: result.source,
          marks: result.marks,
        }),
      )
    } finally {
      setBusy(false)
    }
  }, [session, busy, llmAvailable, landOnMarks])
  const exportMd = useCallback((at: NoticeAt) => {
    const text = exportMarkdown(session.document, marks, session.decisions)
    const name = `${fileSlug(session.title)}.md`
    const link = download.current
    let saved = false
    try {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current)
      blobUrl.current = url
      if (link) {
        link.href = url
        link.download = name
        link.click()
        saved = true
      } else {
        saved = window.open(url, '_blank') !== null
      }
    } catch {
      saved = false
    }
    setNotice({
      text: saved ? `Downloaded ${name}.` : `Could not write ${name} — copying it instead.`,
      at,
    })
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setNotice({
          text: saved
            ? `Downloaded ${name}. The working copy is on your clipboard too.`
            : `Could not write ${name}. The working copy is on your clipboard.`,
          at,
        })
      })
      .catch(() => undefined)
  }, [session, marks])
  const startOver = useCallback(() => {
    clearSession()
    setSession(emptySession())
    setScreen('draft')
    setMode('original')
    setOpenId(null)
    setFocusId(null)
    setActiveSection(null)
    setFilters({ type: 'all', track: 'all' })
    setUndoStack([])
    setNotice(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const read = useCallback((choice: Mode) => {
    setMode(choice)
    setScreen('marks')
  }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (TYPING.has(el.tagName) || el.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const numbered = screenAt(e.key, ready)
      if (numbered) {
        e.preventDefault()
        setScreen(numbered)
        return
      }
      switch (e.key) {
        case 'Escape':
          if (openId) {
            e.preventDefault()
            closeSlip()
          }
          return
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          step(1)
          return
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          step(-1)
          return
        case 'Enter': {
          if (order.length === 0) return
          e.preventDefault()
          if (!focusId) {
            setFocusId(order[0])
            scrollToHost(order[0])
            return
          }
          const willOpen = openId !== focusId
          toggleSlip(focusId)
          if (willOpen) scrollToHost(focusId)
          return
        }
        case 'a':
        case 'y':
          e.preventDefault()
          decideFocused('accepted')
          return
        case 'r':
        case 'n':
          e.preventDefault()
          decideFocused('rejected')
          return
        case 'u':
          e.preventDefault()
          undo()
          return
        case 'o':
          if (!ready) return
          e.preventDefault()
          read('original')
          return
        case 'e':
          if (!ready) return
          e.preventDefault()
          read('edited')
          return
        case 'd':
          e.preventDefault()
          setScreen('draft')
          return
        default:
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openId, focusId, order, ready, closeSlip, step, toggleSlip, scrollToHost, decideFocused, read, undo])
  const typeOf = useCallback(
    (changeId: string | null): ChangeType | null =>
      changeId ? marksById.get(changeId)?.type ?? null : null,
    [marksById],
  )
  const onboard = session.sample
  const stale = session.docMd !== null && session.docMd !== session.originalMd
  const deskNote =
    notice ??
    (stale
      ? { text: 'Draft not read yet — Compare versions or Run pass.', at: 'draft' as NoticeAt }
      : null)
  const notePlace: NoticeAt | null = !deskNote
    ? null
    : screen === 'draft'
      ? 'draft'
      : deskNote.at === 'draft'
        ? 'paper'
        : deskNote.at
  const noteText = deskNote?.text ?? null
  const draftNote = notePlace === 'draft' ? noteText : null
  const paperNote = notePlace === 'paper' ? noteText : null
  const footNote = notePlace === 'foot' ? noteText : null
  const dismissNote = useCallback(() => setNotice(null), [])
  const toDraft = useCallback(() => setScreen('draft'), [])
  const toMarks = useCallback(() => setScreen('marks'), [])
  const head = {
    title: session.document.title,
    derivedTitle: session.document.derivedTitle,
    byline: session.document.byline,
    epigraph: session.document.epigraph,
  }
  const canReset =
    session.originalMd.trim() !== '' || session.editedMd.trim() !== '' || marks.length > 0
  const paperProps = {
    marks: marksById,
    markCount: marks.length,
    openId,
    focusedId: focusId,
    where: render.whereOfMark,
    onToggle: toggleSlip,
    onDecide: decide,
    onCloseSlip: closeSlip,
    onboard,
    sample: session.sample,
    onDraft: toDraft,
    notice: paperNote,
    footNote,
    onDismissNotice: notice ? dismissNote : undefined,
    onExport: () => exportMd('foot'),
    registerHost,
    registerAnchor,
  }
  let sheet
  if (screen === 'draft') {
    sheet = (
      <DraftSheet
        sample={session.sample}
        words={wordCount(session.originalMd)}
        ready={ready}
        canReset={canReset}
        onStartOver={startOver}
        onMarks={toMarks}
      >
        <Composer
          originalMd={session.originalMd}
          editedMd={session.editedMd}
          onOriginal={setOriginal}
          onEdited={setEdited}
          onLoadExample={loadExample}
          onCompare={compare}
          onRunPass={() => void pass()}
          busy={busy}
          notice={draftNote}
          marked={marks.length > 0}
        />
      </DraftSheet>
    )
  } else if (screen === 'split') {
    sheet = <SplitSheet head={head} rows={splitRows} changed={changed} {...paperProps} />
  } else if (screen === 'beats') {
    sheet = (
      <BeatsSheet
        beats={render.flow}
        typeOf={typeOf}
        activeSection={activeSection}
        onJump={jumpToBeat}
        markCount={marks.length}
        sample={session.sample}
        notice={paperNote}
        footNote={footNote}
        onDismissNotice={notice ? dismissNote : undefined}
        onExport={() => exportMd('foot')}
      />
    )
  } else {
    sheet = (
      <EssaySheet
        head={head}
        sections={render.sections}
        decisions={session.decisions}
        mode={mode}
        onMode={setMode}
        empty={empty}
        {...paperProps}
      />
    )
  }
  return (
    <>
      <div className="topstack" ref={topstack}>
        <Chrome
          title={session.title}
          screen={screen}
          onScreen={setScreen}
          ready={ready}
          layers={session.layers}
          activeLayerId={session.activeLayerId}
          onLayer={(id) => {
            setOpenId(null)
            setFocusId(null)
            setSession((s) => ({ ...s, activeLayerId: id }))
          }}
          onExport={() => exportMd('paper')}
        />
        {ready && (screen === 'marks' || screen === 'split') ? (
          <StatsBar
            stats={stats}
            filters={filters}
            armed={openId !== null}
            onFilters={setFilters}
            onJumpType={jumpToType}
            onKeepAll={() => bulk('accepted')}
            onKeepMineAll={() => bulk('rejected')}
            onUndo={undo}
            canUndo={undoStack.length > 0}
            shown={shown}
          />
        ) : null}
      </div>
      <div className="workspace">{sheet}</div>
      <a ref={download} className="export-anchor" aria-hidden="true" tabIndex={-1}>
        export
      </a>
    </>
  )
}
