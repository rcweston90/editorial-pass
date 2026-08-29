from pathlib import Path
p = Path("/workspace/editorial-pass/api/pass.ts")
t = p.read_text()
old = "const ENDPOINT = 'https://api.anthropic.com/v1/messages'\nconst VERSION = '2023-06-01'\nconst MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'\n"
new = """function env(name: string): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } }
  return g.process?.env?.[name]
}

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const VERSION = '2023-06-01'
const MODEL = env('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514'
"""
if old not in t:
    raise SystemExit("pattern not found")
t = t.replace(old, new)
t = t.replace("const key = process.env.ANTHROPIC_API_KEY", "const key = env('ANTHROPIC_API_KEY')")
p.write_text(t)
print("patched api/pass.ts")
