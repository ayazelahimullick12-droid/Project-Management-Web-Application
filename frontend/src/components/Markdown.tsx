/**
 * Renders Markdown safely, and optionally highlights quoted text (comments and suggestions).
 */
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useMemo, useRef } from 'react'

export function mdToHtml(md: string): string {
  return DOMPurify.sanitize(marked.parse(md ?? '', { async: false }) as string)
}

export interface Highlight {
  id: string
  quote: string
  kind: 'comment' | 'suggest'
  active?: boolean
}

/** Wraps the first occurrence of each quote in <mark>, across formatting boundaries. */
function applyHighlights(root: HTMLElement, highlights: Highlight[]) {
  for (const h of highlights) {
    const words = h.quote.trim().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let full = ''
    while (walker.nextNode()) {
      const n = walker.currentNode as Text
      nodes.push(n)
      full += n.data
    }
    const re = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'))
    const m = re.exec(full)
    if (!m) continue
    const start = m.index
    const end = start + m[0].length
    let pos = 0
    for (const n of nodes) {
      const a = pos
      const b = pos + n.data.length
      pos = b
      if (b <= start || a >= end) continue
      const from = Math.max(start, a) - a
      const to = Math.min(end, b) - a
      const range = document.createRange()
      range.setStart(n, from)
      range.setEnd(n, to)
      const mark = document.createElement('mark')
      mark.className = `${h.kind === 'comment' ? 'hl-comment' : 'hl-suggest'}${h.active ? ' hl-active' : ''}`
      mark.dataset.hl = h.id
      try {
        range.surroundContents(mark)
      } catch {
        /* overlapping highlight: skip */
      }
    }
  }
}

export function Markdown({ text, highlights, onHighlightClick, className }: { text: string; highlights?: Highlight[]; onHighlightClick?: (id: string) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = useMemo(() => mdToHtml(text), [text])
  const key = JSON.stringify(highlights ?? [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = html
    if (highlights?.length) applyHighlights(el, highlights)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, key])
  return (
    <div
      ref={ref}
      className={`md ${className ?? ''}`}
      onClick={(e) => {
        const id = (e.target as HTMLElement).closest('mark[data-hl]')?.getAttribute('data-hl')
        if (id && onHighlightClick) onHighlightClick(id)
      }}
    />
  )
}
