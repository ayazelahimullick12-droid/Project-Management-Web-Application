/**
 * Reads documents written as Markdown files with one "## Title {#key}" heading per section.
 * Used for the seed documents and the pre-written AI drafts.
 */
export interface RawSection {
  key: string
  title: string
  content: string
}

export function parseSections(md: string): RawSection[] {
  const out: RawSection[] = []
  let current: RawSection | null = null
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*\{#([a-z_]+)\}\s*$/)
    if (m) {
      if (current) out.push(current)
      current = { title: m[1], key: m[2], content: '' }
    } else if (current) {
      current.content += line + '\n'
    }
  }
  if (current) out.push(current)
  return out.map((s) => ({ ...s, content: s.content.trim() }))
}
