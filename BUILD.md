Build a production Vite + React + TypeScript app in /workspace/editorial-pass.

GOAL
Port the editorial-pass compare UX from the one-file prototype at /workspace/essay-compare/index.html into a real React+TS Vite app. Do NOT ship a single hand-rolled HTML file as the product. The prototype is the design spec only. Do NOT host on GitHub, raw.githack, jsdelivr, or htmlpreview.

STACK
- Vite + React + TypeScript
- Scaffold with: npm create vite@latest . -- --template react-ts
- The directory already has original.md and edited.md. If create vite refuses a non-empty dir, scaffold in /tmp/ep-app then copy the generated files into /workspace/editorial-pass, keeping original.md and edited.md.
- No Solara, no Arca, no wealthtech. No auth. No router. No extra UI libraries.
- Fonts: Newsreader + Source Sans 3 from Google Fonts (same as prototype).

READ THESE FIRST
- /workspace/essay-compare/index.html  (full UX, CSS, JS, data, markup — port this)
- /workspace/editorial-pass/original.md
- /workspace/editorial-pass/edited.md

FIVE CHANGES ONLY (already encoded in the prototype; do not invent a generic diff)
1. Rewritten opening hedge: drop "Not everywhere, not for everyone — but "
2. Compressed "The instrument": cut the three grafs about nobody taught you / land bridges / distance did double duty
3. Cut the workshop graf "The cheap version of this essay is a man missing the mail."
4. Cut the whole section "Why design got hired in the first place" (ghost in the flow)
5. Rewritten selection line: drop "Selection installs nothing." Add "Art direction comes after the bad ones, not instead of them."

UX TO PORT EXACTLY
- Original manuscript is the reading surface (default)
- Margin marks: Cut / Compressed / Rewritten with the same SVG marks as the prototype
- Click a mark, marked passage, scar, or ghost to inspect original vs alt in place via the slip panel
- Flow view: two-track section spine; removed sections as ghosts; compressed sections shorter; bars sized by origWeight
- Original / Edited toggle
- Keyboard j/k/Enter/Escape (also ArrowDown/ArrowUp)
- Typography-first paper/copyeditor desk. Not Inter-on-gray SaaS.
- Preserve em-dashes, italics, bold, and profanity ("Shitting out something that looks finished").

APP STRUCTURE
- index.html: Vite root. Include Google Fonts links. Title: The Most Finished One · editorial pass
- src/main.tsx, src/App.tsx
- src/index.css: port ALL CSS from the prototype, from :root through the media queries
- src/data/pass.ts: export the changes + sections objects from the prototype script#pass-data
- src/data/essay.ts: structured essay content (sections, paragraphs, change blocks) so React can render the manuscript
- Components: Chrome, FlowView, EssaySheet, MarkButton, Slip (names can vary; keep the same DOM classes so the CSS ports cleanly)
- Port every behavior from the prototype IIFE.

BEHAVIOR DETAILS (match the prototype)
- Document/root data-mode original|edited. Default original.
- flow-open class when Flow is open.
- Slip inserts after the change host and shows the OTHER version vs what is on the page.
- For cut/compressed with altered=null, show: "Nothing takes its place. The section closes over the gap." (cut) or "Nothing takes its place. The passage runs straight on." (compressed).
- Whole-section cut (id hired) shows ghost-section in edited mode.
- Compressed/cut (not whole) show scar-rule in edited mode.
- Rewritten inline spans swap text-orig / text-edit based on mode.
- Flow: two lanes labeled Original and This pass. Grid columns: 4.9rem plus origWeight fr per section. Edited bars at (editWeight/origWeight)*100 percent. Ghost sections get is-gone and line-through.
- Clicking a flow slot jumps to that section and opens the mark if the section has a change.
- Footer: "Five marks on this pass. You are reading the original." or "...edited version."
- keyhint: j k step · enter inspect · esc close
- Focus state: j/k cycle the five marks; Enter toggles the slip; Escape closes it.
- If a slip is already open, j/k close it then open the next.

IMPLEMENTATION NOTES
- Use React state, not innerHTML string building, except SVG markup can be components.
- Keep class names from the prototype (chrome, sheet, essay, graf, change-block, mark-btn, slip, flow, slot, etc.) so the CSS works unchanged.
- Do not sanitize or rewrite essay prose. Keep em-dashes as em-dashes. Keep italics and strong. Keep "Shitting".
- vite.config.ts should use the default React template. Base: /

WHEN DONE
- Run npm install in /workspace/editorial-pass
- Run npm run build — it MUST succeed
- Do not deploy. Do not git init unless the scaffold already did.
- Keep original.md and edited.md at the project root.
- Remove Vite boilerplate (the counter, hello world, App.css logos).
- After build, print SUCCESS and the dist/ path.
