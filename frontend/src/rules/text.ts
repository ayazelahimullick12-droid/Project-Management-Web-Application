/**
 * Small text helpers shared by the rules (no screen code).
 */

/** Collapses all whitespace to single spaces. */
export const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Turns Markdown into the plain text a reader sees (good enough for finding quotes). */
export function markdownToPlain(md: string): string {
  return normalize(
    md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-*:?\s*\|?\s*$/gm, ' ')
      .replace(/\|/g, ' ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/(^|[^\w*])\*(?!\s)(.+?)\*/g, '$1$2')
      .replace(/`([^`]*)`/g, '$1'),
  )
}

/** Finds a quote in text, preferring the occurrence surrounded by the saved prefix/suffix. */
export function findQuote(text: string, quote: string, prefix = '', suffix = ''): number {
  const q = normalize(quote)
  if (!q) return -1
  const hits: number[] = []
  let i = text.indexOf(q)
  while (i !== -1) {
    hits.push(i)
    i = text.indexOf(q, i + 1)
  }
  if (hits.length <= 1) return hits[0] ?? -1
  const p = normalize(prefix)
  const s = normalize(suffix)
  const best = hits.find((h) => (!p || text.slice(0, h).trimEnd().endsWith(p.slice(-12))) && (!s || text.slice(h + q.length).trimStart().startsWith(s.slice(0, 12))))
  return best ?? hits[0]
}

/** A little text before and after a quote, saved so the quote can be found again later. */
export function contextAround(text: string, index: number, length: number, size = 30) {
  return {
    prefix: text.slice(Math.max(0, index - size), index),
    suffix: text.slice(index + length, index + length + size),
  }
}

/** Fills {{project}} and {{fact:key}} placeholders in canned AI content. */
export function fillPlaceholders(md: string, projectName: string, factValue: (key: string) => string | undefined): string {
  return md.replace(/\{\{project\}\}/g, projectName).replace(/\{\{fact:([a-z_]+)\}\}/g, (_, key: string) => factValue(key) ?? `[missing: ${key.replace(/_/g, ' ')}]`)
}
