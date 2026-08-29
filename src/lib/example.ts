/* The desk's example: a real draft of Charlie's and a real pass over it, read
   off the two files in comparison/ and diffed into one layer of marks. Loading
   it fills both boxes — original.md as the Original, pass.md as this pass — so
   all four screens have something true on them a second after you ask.

   It is a thing you ask for out loud, every time. The layer keeps the `example`
   source and the session keeps the sample stamp, which is what persist.ts reads
   to refuse to write it down and to refuse to hand it back on a cold load. */

import originalMd from '../../comparison/original.md?raw'
import passMd from '../../comparison/pass.md?raw'
import { diffToMarks } from './diff'
import { parseMarkdown } from './markdown'
import type { Layer, Mark, SessionState } from '../types'

const LAYER_ID = 'example'
export const EXAMPLE_LABEL = 'This pass'

export function exampleSession(): SessionState {
  const document = parseMarkdown(originalMd)
  const marks: Mark[] = diffToMarks(document, parseMarkdown(passMd), LAYER_ID).map((mark) => ({
    ...mark,
    source: 'example',
  }))
  const layer: Layer = { id: LAYER_ID, label: EXAMPLE_LABEL, source: 'example', marks }
  return {
    originalMd,
    // Both boxes, because this example is a comparison: that is where the marks
    // came from, and Compare versions can be run again over the same two files.
    editedMd: passMd,
    // The document is that markdown, byte for byte, so the desk knows the paper
    // has been read — and knows the moment you paste something else.
    docMd: originalMd,
    document,
    layers: [layer],
    activeLayerId: LAYER_ID,
    decisions: {},
    title: document.title,
    sample: true,
  }
}

/** The sample's own text, so the stamp comes off the moment you replace it. */
export const exampleOriginalMd = originalMd
export const examplePassMd = passMd
