/*
 * Vercel Node serverless function. GET reports whether this deploy has a key;
 * POST runs one editorial pass and returns marks as JSON. Raw fetch, no SDK, so
 * the function has no dependencies of its own.
 *
 * Model is pinned to claude-sonnet-4-20250514 and overridable with
 * ANTHROPIC_MODEL if you want to move it without a redeploy of this file.
 */

function env(name: string): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
  return g.process?.env?.[name]
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const VERSION = '2023-06-01'
const MODEL = env('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514'
const MAX_TOKENS = 8000

const SYSTEM = `You are a hard, fair line editor doing one editorial pass over an essay in markdown.

Return JSON only. No prose, no code fence, no commentary. The shape is:

{"marks":[{"type":"cut"|"compressed"|"rewritten","track":"Voice"|"Skeptic"|"Cut"|"HN","note":string,"originalExcerpts":[string],"alteredExcerpts":[string]|null}],"editedMarkdown":string}

Rules:
- Between 4 and 10 marks. Prefer fewer sharp marks to many soft ones.
- Every originalExcerpt MUST be a verbatim substring of the draft, copied exactly,
  including punctuation, em-dashes and curly quotes. Quote whole paragraphs.
- "cut" removes one paragraph. "compressed" removes a run of consecutive
  paragraphs. Both MUST have alteredExcerpts: null.
- "rewritten" replaces exactly one paragraph. alteredExcerpts is a one-element
  array holding the tightened paragraph. A tightening removes hedges, filler and
  throat-clearing. It never introduces a new idea, a new claim or a new example.
- note is one sentence naming what moved and why, in a working editor's voice.
- Tracks: Voice for hedges and apologies, Skeptic for workshop disclaimers and
  pre-rebuttals, Cut for repetition and bloat, HN for claims a sharp reader would
  push on.
- Do not sanitise the author's language. Keep profanity, keep the em-dashes.
- editedMarkdown is the whole draft with every mark applied.`

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

function readOriginal(body: unknown): string {
  let parsed: unknown = body
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return ''
    }
  }
  if (!parsed || typeof parsed !== 'object') return ''
  const value = (parsed as Record<string, unknown>).original
  return typeof value === 'string' ? value : ''
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('no json object in response')
  return JSON.parse(body.slice(start, end + 1))
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const key = env('ANTHROPIC_API_KEY')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    res.status(200).json({ available: Boolean(key) })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  if (!key) {
    res.status(501).json({ available: false, error: 'no_key' })
    return
  }

  const original = readOriginal(req.body)
  if (!original.trim()) {
    res.status(400).json({ error: 'no_original' })
    return
  }

  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Here is the draft. Return the JSON described in the system prompt.\n\n${original}`,
          },
        ],
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      res.status(502).json({ error: 'upstream_error', status: upstream.status, detail: detail.slice(0, 400) })
      return
    }

    const payload = (await upstream.json()) as { content?: Array<{ type?: string; text?: string }> }
    let text = ''
    for (const block of payload.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text
    }
    const parsed = extractJson(text) as { marks?: unknown; editedMarkdown?: unknown }
    res.status(200).json({
      marks: Array.isArray(parsed.marks) ? parsed.marks : [],
      editedMarkdown: typeof parsed.editedMarkdown === 'string' ? parsed.editedMarkdown : undefined,
    })
  } catch (error) {
    res.status(502).json({ error: 'pass_failed', detail: String(error).slice(0, 400) })
  }
}
