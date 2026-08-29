# Editorial pass

A Vite + React + TypeScript reading desk for editing prose. Paste or drop a
markdown draft anywhere on the desk, run a pass over it, read the marks against
the manuscript, take or leave each one, and export the working copy.

It opens cold: blank paper, an empty **Original**, a blank **Edited**. The pass
reads the first box alone, so the first Run pass can never be a comparison you
did not ask for. *The Most Finished One* and the five marks one editor made on
it are still here — **Load example** puts them on the paper, asks first if there
is anything to overwrite, leaves the Edited box empty, and stamps the sheet
SAMPLE so nobody mistakes it for their own draft. A reload keeps what you
pasted, marked or not.

- `original.md` / `edited.md` — the example essay, before and after that pass.
- `src/data/essay.ts`, `src/data/pass.ts` — the example corpus and its five marks.
- `src/lib/` — markdown parse/serialize, structural diff, the local pass engine,
  decisions and export, the render model, the flow beats, the split rows.
- `src/components/` — chrome, stats bar, flow, sheet, split sheet, mark, slip, blotter.
- `src/index.css` — the whole paper/copyeditor stylesheet.

## Reading it

| | |
| --- | --- |
| Original / Edited | the unified spine: the manuscript, with the pass inline |
| Split | two paper columns — original left, working copy right, marks in the gutter |
| Flow | the two-track spine of beats — `##` sections when the draft is built on them, arrivals in the prose when it is not; cut beats show as ghosts, compressed ones as shorter bars |
| Draft | the blotter paper: paste a draft, drop a `.md`, run a pass, or compare two versions |
| the second box | the slip beside the paper, only for **Compare versions**. Left empty, nothing is compared |
| Export | downloads the working copy as markdown |
| the words in the stats bar | `in → out` is the draft with the marks you have taken, so it moves as you take them; the tail says how many are still open and what they would come to |
| the counts in the stats bar | click one to walk the marks of that type |

A draft lands on the blotter paper wherever it arrives: pasted with nothing
focused, or dropped on the manuscript, the chrome or the desk itself. Two files
dropped together read as a comparison.

Clicking a mark, a marked passage, a scar rule, a ghost section, a beat in the
flow or a name in the split view's *Changed* strip all open the same slip — and
every one of them calls the place by the same name, the beat it sits in, so a
draft with no headings is never five marks all called Opening.

| key | |
| --- | --- |
| `j` / `k` (or arrows) | step to the next mark — it comes to rest under the chrome, and a short manuscript is never thrown to the bottom of the page |
| `Enter` | open or close the mark under focus |
| `a` / `r` | take or leave it · `u` undoes |
| `o` / `e` / `s` | original · edited · split |
| `f` / `d` | flow · draft |
| `Esc` | close the slip, then the blotter |

## The pass

With one draft, **Run pass** reads it. If `/api/pass` has an `ANTHROPIC_API_KEY`
it asks the model and maps what comes back onto real paragraphs; otherwise the
local engine runs and the blotter says so. The local engine only deletes,
compresses and drops phrases the author already wrote — it never invents a
sentence — and it does not come back empty: hedges, throat-clearing, workshop
disclaimers, repeated claims, stalls and overlong paragraphs are all marks, and
a quiet draft still gets its longest paragraphs compressed with an honest reason.

With two drafts, **Compare versions** runs a structural diff — sections aligned
by heading, paragraphs by similarity — and every mark carries the delta it found.
Not every delta is a rewrite: a paragraph that lost a sentence, or a third of
itself, is marked compressed on the Cut track, and only a swap or a dropped
phrase reads as rewritten.

Pending reads as accepted: the edited view and the export are the same document.
The stats bar counts only what you have actually taken — so a rewrite taken moves
the percent — and its tail says what the marks still open would come to.

## Running it

```sh
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
npm run smoke    # the parser, diff, pass, flow, split and export harness
npm run preview  # serve the build
```
