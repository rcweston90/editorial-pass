# Editorial Pass — turn the demo into a product

Implement in /workspace/editorial-pass (Vite 8 + React 19 + TypeScript). The one-essay demo already works. Keep its visual language and inspect UX. Generalize it so Charlie can paste any markdown draft, get a pass, inspect marks, accept/reject, and export.

Read the existing source first. Do not start from scratch. Do not ship a single HTML file. No GitHub hosting. No Solara, Arca, wealthtech, auth, or extra UI libraries (no MUI, no Tailwind, no Inter).

npm run build MUST succeed (tsc -b && vite build). tsconfig has erasableSyntaxOnly, noUnusedLocals, noUnusedParameters, verbatimModuleSyntax — no enums, no leftover imports.

When done: print SUCCESS and a file list of what you added. Do not deploy. Do not git init.


## What already works (KEEP)

Paper desk: Newsreader + Source Sans 3, --desk / --paper / --mark tokens in src/index.css. Margin marks (cut / compressed / rewritten) with existing SVG MarkShape. Click mark / passage / scar / ghost opens a slip with the other version. Flow two-track spine; ghosts for removed sections; shorter bars for compressed. Original / Edited toggle. j / k / Enter / Esc. The Most Finished One with five hand-authored marks in src/data/essay.ts + src/data/pass.ts.

The example remains the default so the app is never empty. First load with no localStorage = that essay, those five marks, identical reading experience.

## Product bar (must all ship)

1. Paste or drag-drop any markdown. Example stays available via Load example.
2. Two inputs: Original draft, optional Edited/pass. If both: derive marks from a REAL structural diff of sections/paragraphs, not a word-diff soup. Every mark has a reason.
3. If only Original: Run pass produces a structured editorial pass. Try POST /api/pass (Anthropic, if ANTHROPIC_API_KEY is set). If the API is missing/fails, run a strong local engine (not fake LLM prose). Tags: Voice / Skeptic / Cut / HN.
4. Inspect UX stays: original as spine, margin marks, slip, flow, Original/Edited.
5. Accept / reject per mark. Rejected cuts stay. Accepted cuts apply. Export the resulting markdown.
6. Pass stats: words in/out, % cut, mark counts by type.
7. Filter marks by type and by reviewer track.
8. Persist session in localStorage (refresh must not nuke the draft).
9. Keyboard: j/k/Enter/Esc plus accept/reject. Do not trap typing in paste boxes.
10. Build succeeds.

10x extras, in this order, as many as you can: apply-all / reject-all; undo; multiple passes as layers; drop a .md file; split pane for paste vs manuscript; print/export; density that still feels like a desk, not a Jira board.


## Architecture

Generalize hardcoded ESSAY / CHANGES / SECTIONS into a session the UI renders. The example is one session built from existing data. User drafts become sessions from parser + diff or local pass.

Suggested modules:

- src/types.ts — Mode, Track, Decision, Session
- src/lib/markdown.ts — parse markdown to document; serialize export
- src/lib/diff.ts — structural section/paragraph diff to marks
- src/lib/localPass.ts — local editorial engine
- src/lib/apply.ts — apply decisions, word counts, export md
- src/lib/session.ts — build render model (EssaySection[] + Change[] + FlowSection[]) from a document + marks
- src/lib/persist.ts — localStorage
- src/lib/example.ts — session from existing essay.ts / pass.ts
- src/lib/llmPass.ts — client probe + POST /api/pass, fall back
- api/pass.ts — Vercel serverless (Anthropic)
- src/components/Composer.tsx — blotter: two paper fields, drop, run/compare
- src/components/StatsBar.tsx — words in/out, filters, apply-all, export

Make EssaySheet, FlowView, Slip, Chrome, MarkButton data-driven (props). Keep DOM class names so existing CSS still works.

src/data/essay.ts and src/data/pass.ts stay as the example corpus. Add track to example changes (Voice, Cut, Cut, Cut, HN) and keep their notes.

## Data model

```
Mode = original | edited
ChangeType = cut | compressed | rewritten
Track = Voice | Skeptic | Cut | HN
Decision = pending | accepted | rejected
PassSource = example | diff | local | llm

Graf { id, text, content: Inline[] }
SectionDoc { id, heading: string | null, headingInline, grafs }
DocumentModel { title, byline, epigraph, sections }

Mark {
  id, type, track, sectionId, sectionTitle, grafIds, wholeSection?,
  note, original: Block[], altered: Block[] | null, source, layerId
}

Layer { id, label, source, marks }
SessionState { originalMd, editedMd, document, layers, activeLayerId, decisions, title }
```

Example session: DocumentModel from ESSAY, marks from CHANGES (preserve ids hedge/instrument/mail/hired/taste), one layer labeled Example.


## Markdown parser (src/lib/markdown.ts)

Support enough CommonMark to round-trip Charlie's essays:

- # Title → title (first h1)
- italic line after title *By …* → byline (parse em/strong)
- > epigraph → epigraph
- ## Heading → section (quoted headings stay)
- blank-line separated paragraphs
- *em* / **strong** inside paragraphs
- Preserve em-dashes, curly quotes, profanity. Do not sanitize.

Leading grafs before the first ## belong to a section with heading null (the lede), id lede.

Section ids: slug of heading, unique with a suffix if needed. Graf ids: ${sectionId}-g${index}.

Export documentToMarkdown for download. Inline parser: walk the string, handle ** and * without eating em-dashes. Zero new deps.

Export plain(inlines) and wordCount(text) (split on whitespace).

Add src/md.d.ts if you import original.md?raw:
  declare module '*.md?raw' { const s: string; export default s }

## Structural diff (src/lib/diff.ts) — NOT a toy word diff

Input: original DocumentModel, edited DocumentModel. Output: Mark[] with reasons.

Align sections by normalized heading (trim, collapse space, strip quotes, lowercase). Unmatched original section → whole-section cut. Unmatched edited sections (insertions) can be ignored (spine is the original).

Align paragraphs inside a matched section pair with LCS + similarity, NOT raw equality only:

normalize(s): lowercase, collapse whitespace, strip punctuation except inner apostrophes
similarity(a,b): 1 if equal after normalize; 0.85 if one contains the other (len ratio > 0.6); else Jaccard of word sets (words length ≥ 4); match if ≥ 0.55

Two pointers + lookahead of ~3 for skipped grafs.

Classification:
- Whole section unmatched → cut, wholeSection true, altered null. Reason: Whole section removed in the edited pass. Track Cut.
- Run of 2+ unmatched original grafs, no replacement → compressed. Reason names N paragraphs taken out. Track Cut.
- Single unmatched original graf → cut. Reason: This paragraph does not appear in the edited pass. Track Cut.
- Original graf matched to edited graf with similarity < 1 → rewritten. Reason MUST name the delta (dropped words / added words). Track Voice if hedge/apology; HN if selection/taste/structure; else Voice.
- Run of N orig grafs replaced by shorter unmatched edited run → compressed with altered = surviving edited grafs.

Gold test: diffing original.md vs edited.md should recover the five example sites:
1. Lede graf rewritten (hedge dropped)
2. Three grafs in The instrument compressed
3. The cheap version of this essay… cut
4. Whole section Why design got hired… cut
5. Last graf of Every generation rewritten

Reasons on every mark. Never empty note. source: diff. layer label: Compare.


## Local pass engine (src/lib/localPass.ts)

Used when the user has only Original and clicks Run pass, or when /api/pass is unavailable.

A real editor, not lorem. It only deletes, compresses, or drops phrases that already exist. It must not invent new arguments or fake Claude said. Layer label Local pass, source local.

Cap at 12 marks, ranked by confidence. Prefer fewer sharp marks.

Voice — hedges. Scan each graf for: not everywhere, not for everyone; I think; I believe; perhaps; maybe; sort of; kind of; a bit; a little; somewhat; in some sense; it seems; it appears; I would argue; I suppose; to some extent. If found: type rewritten, altered = original with those phrases (and leftover — but glue) removed. Note: Hedge dropped: "I think". Track Voice.

Skeptic — workshop disclaimers. Cut a graf matching: cheap version of this essay/piece; let me kill that now; I'm not going to tell you they can't; before you say/object; the flattering version; a short I know. pre-rebuttal under ~30 words. Note: Workshop disclaimer. Track Skeptic.

Cut — repeated claims. Pairwise Jaccard of content words (len ≥ 4, minus stopwords). If ≥ 0.52, cut the later graf. Note: Repeats a claim already made in "{section}". Track Cut. No two overlapping cuts of the same graf.

Cut/Compressed — bloated interior. If a section has ≥ 6 grafs, interior grafs that are ≤ 18 words AND no strong AND no heading nouns: if ≥ 3 consecutive thin grafs, one compressed mark. Track Cut.

HN — selection vs structure. Do not cut the thesis. Flag Selection installs nothing. as rewritten dropping that sentence. Track HN. Grafs about pick/finished/twenty options that are doing real work (the hook, the restaurant line) stay.

Never add sentences the author did not write. Altered text is a subset of original (deletions / light glue cleanup only).

Skip grafs already claimed by a higher-confidence mark.

On The Most Finished One original, a decent local pass should catch the opening hedge rewrite and the cheap version / kill that now cut. Do not force a match to the five example marks — those are a human pass.

## LLM pass (api/pass.ts + client)

Vercel Node serverless at api/pass.ts (repo root api/, not src/).

GET → { available: boolean }  true if ANTHROPIC_API_KEY is set
POST { original: string } → { marks: ApiMark[], editedMarkdown?: string }

No key: GET { available: false }, POST 501 { available: false, error: "no_key" }.

If key present: fetch https://api.anthropic.com/v1/messages, model claude-sonnet-4-20250514, headers x-api-key, anthropic-version: 2023-06-01. Max tokens 8000.

System: editorial pass, JSON only, 4–10 marks, originalExcerpts must be verbatim substrings, rewritten alteredExcerpts are tightenings not new ideas, cut/compressed alteredExcerpts null.

Client src/lib/llmPass.ts: on load GET /api/pass. Run pass: if available POST and map excerpts onto grafs by similarity; drop unmatched. source llm, layer Editorial pass. If unavailable or POST fails: run localPass and show quiet blotter note: Local pass — no model key on this deploy. Never pretend it was a model.

fetch only, no SDK. Type the Vercel handler req/res without unused vars.


## Applying decisions (src/lib/apply.ts)

Working document (Edited view + stats words-out): start from original; apply marks whose decision is accepted OR pending; skip rejected (those cuts stay; those rewrites revert).

Export markdown = working document. apply-all sets all visible (filter-respecting) pending → accepted. reject-all sets them → rejected.

Apply a mark:
- cut / compressed with altered null: remove those grafs; if wholeSection, drop the section (edited view uses ghost)
- compressed/rewritten with altered: replace the graf span with altered blocks
- Preserve headings, byline, epigraph, emphasis

stats: wordsIn original; wordsOut working doc; pctCut; counts by type for active layer; accepted/rejected/pending counts.

Undo: stack of decisions snapshots (cap 40). Push before each accept/reject/apply-all/reject-all. u or chrome Undo pops.

## Render model (src/lib/session.ts)

Convert DocumentModel + active layer marks + decisions → existing EssaySection[] / Change[] / FlowSection[] so EssaySheet/FlowView stay close to today.

Rewritten mark → RewrittenGraf. Cut/compressed span → ChangeBlock. Whole section cut → wholeCut. Unmarked grafs → Para.

Flow: one slot per original section. origWeight = max(1, wordCount). editWeight = wordCount after applying pending+accepted (0 if whole cut and not rejected). changeId = first visible mark in that section.

If a mark is filtered out, still render the prose, but hide MarkButton and wash classes. j/k only walks visible marks.

changeById looks at the session's active marks, not the example constant.

MarkButton aria-label: type + sectionTitle (MARK_WHERE as fallback for example ids).

Slip: show track as uppercase kicker next to type. Accept / Reject. If accepted, quiet "taken". If rejected, "left in".

Rejected cut/compress: class is-rejected overrides body[data-mode=edited] hide rules so original stays visible. Rejected rewrite: show original text in both modes.

Pending: same as accepted for display of the suggestion (working copy = pending+accepted).

## UI (desk, not SaaS)

Chrome: kicker Editorial pass, title = current manuscript title. Controls: legend, Original/Edited, Flow, Draft (toggles composer), Export (download slug.md of working copy + clipboard write). No settings cog, avatar, or purple buttons.

Composer: a paper blotter, not a dimmed modal. Split pane when Draft is open. Left (top on narrow): two fields on --paper, italic serif labels Original draft and Edited / pass (optional). Right: the manuscript sheet.

Textareas: Newsreader, paper background, no Inter, no bootstrap inputs. Placeholder: Paste markdown. Drop a .md file.

Buttons as italic text like the mode toggle: Load example · Compare versions · Run pass. Disable Compare if original empty. Run pass uses original only.

Drop: drag-over wash; .md or text/markdown or text/plain. Two files → first original, second edited. Single file → field under cursor, or original.

Load example restores The Most Finished One (five marks) and fills both textareas from original.md / edited.md imported as ?raw.

body.composer-open. .workspace { display: grid; grid-template-columns: minmax(22rem, 1fr) minmax(28rem, 1.3fr); gap: 1rem; } collapse under 1100px.

Stats bar under chrome on desk stock:
2,847 → 2,610 · 8% cut · 2 cut · 1 compressed · 2 rewritten

Filter groups, italic toggle language: Type All/Cut/Compressed/Rewritten. Track All/Voice/Skeptic/Cut/HN. Then Take all / Leave all and Undo when stack nonempty.

Print: hide chrome, composer, flow; show the sheet; prefer edited working copy.

Sheet foot: n marks on this pass. You are reading the original|edited version. plus a take · r leave · u undo · j k step · enter inspect · esc close

Slip: type svg + REWRITTEN · VOICE, note, other version, [ take ] [ leave ] serif italic.

Layers extra: each Compare or Run pass pushes a layer. Switcher in chrome like mode radios. If time is short, one layer is ok as long as re-running replaces the non-example layer rather than crashing.


## Persistence

Key: editorial-pass:v1
Save originalMd, editedMd, layers (marks), activeLayerId, decisions, title. On load: if present and parseable and originalMd nonempty, restore. Else example. Version the blob { v: 1, ... }. Swallow JSON errors.

## Keyboard

Document listener, skip when target is input, textarea, select, [contenteditable]:

- j / ArrowDown — next visible mark
- k / ArrowUp — previous
- Enter — toggle slip
- Esc — close slip; if no slip and composer open, close composer
- a or y — accept focused/open mark
- r or n — reject focused/open mark
- u — undo
- o — Original mode
- e — Edited mode
- f — toggle Flow
- d — toggle Draft/composer

preventDefault on handled keys so the page does not scroll on j/k. Do not trap typing in the paste box.

## CSS additions (match the desk)

Extend src/index.css. No new font.

- .blotter paper panel, same shadow language as .sheet
- textarea.ms transparent/paper, Newsreader 1.05rem, outline on focus 2px solid var(--mark)
- .stats uppercase 0.56rem Source Sans muted, italic serif numbers
- .filter-toggle clone of .mode-toggle
- .slip-actions take/leave
- .mark-btn.is-rejected muted + 40% opacity
- .is-rejected display overrides for edited mode
- .workspace split
- .drop-hover inset mark-wash
- print rules
- @media (max-width: 1100px) stack workspace

Density: one manuscript, marks in the margin, blotter only when Draft is on. No card grid of comments. No sidebar of threads.

Update index.html title to Editorial pass. Keep Google Fonts links.

## Implementation order

1. Types + markdown parser + apply/export + persist
2. session.ts render model; wire EssaySheet/FlowView/Slip/Chrome to props; example session still default
3. Composer paste/drop/load example; split pane
4. Structural diff + Compare versions
5. Local pass + Run pass + GET probe + api/pass.ts
6. Accept/reject, stats, filters, keyboard, export
7. apply-all / reject-all / undo
8. Layers if time
9. Print CSS
10. npm run build until clean

Fix unused vars. Keep original.md and edited.md at project root. Do not git init. Do not deploy.

After build: print SUCCESS, list new files, and a 10-line summary of behavior.

Go. World-class functionality. 10x the demo.

INSPO (Charlie 2026-08-27)
GitHub pull-request Files changed: split/unified diff, red/green, inline comments, viewed. That is how textual edits track on the paper.
Flora canvas (flora.ai): nodes on a graph, plus-handles, bezier edges, each block a unit of work. That is how essay structure tracks (sections as nodes, cuts as missing nodes, compressions as smaller nodes).
Do not clone GitHub chrome or Flora dark-mode. Steal the mechanics. The surface stays paper.
