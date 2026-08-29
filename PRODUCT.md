# Editorial Pass — turn the demo into a product

Implement in /workspace/editorial-pass (Vite 8 + React 19 + TypeScript). The one-essay demo already works. Keep its visual language and inspect UX. Generalize it so Charlie can paste any markdown draft, get a pass, inspect marks, accept/reject, and export.

Read the existing source first. Do not start from scratch. Do not ship a single HTML file. No GitHub hosting. No Solara, Arca, wealthtech, auth, or extra UI libraries (no MUI, no Tailwind, no Inter).

npm run build MUST succeed (tsc -b && vite build). tsconfig has erasableSyntaxOnly, noUnusedLocals, noUnusedParameters, verbatimModuleSyntax — no enums, no leftover imports.

When done: print SUCCESS and a file list of what you added. Do not deploy. Do not git init.
