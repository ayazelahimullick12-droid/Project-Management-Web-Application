/**
 * The editor (PM team, one editor at a time). Each section has its own TipTap editor; sections
 * with tables are edited as Markdown. Changes autosave as a draft; "Save version" makes a version.
 * AI rewrites of a section arrive as proposals shown as a diff to accept or reject.
 */
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TurndownService from 'turndown'
import { Bold, Italic, List, ListOrdered, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Draft, Section } from '../../types'
import { api } from '../../api'
import { useAction } from '../../api/hooks'
import { mdToHtml } from '../../components/Markdown'
import { SideBySide } from '../../components/Diff'
import { AiBadge, AiNote } from '../../components/ai'
import { Button, Field, Modal, Textarea } from '../../components/ui'

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', strongDelimiter: '**' })
td.addRule('listItem', {
  filter: 'li',
  replacement: (content, node) => {
    const text = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n/gm, '\n  ')
    const parent = node.parentNode as HTMLElement
    const index = Array.prototype.indexOf.call(parent.children, node)
    const prefix = parent.nodeName === 'OL' ? `${Number(parent.getAttribute('start') ?? 1) + index}. ` : '- '
    return `${prefix}${text}\n`
  },
})

/** HTML from the editor back to tidy Markdown (lists stay compact so diffs stay small). */
export function htmlToMd(html: string): string {
  return td
    .turndown(html)
    .replace(/^((?:\s*[-*]|\s*\d+\.) .*)\n\n(?=\s*(?:[-*]|\d+\.) )/gm, '$1\n')
    .trim()
}

function RichSection({ initial, onChange }: { initial: string; onChange: (md: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3] } })],
    content: mdToHtml(initial),
    onUpdate: ({ editor: e }) => onChange(htmlToMd(e.getHTML())),
  })
  if (!editor) return null
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button type="button" title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`rounded p-1 ${active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-black/5'}`}>
      {icon}
    </button>
  )
  return (
    <div className="rounded-md ring-1 ring-line focus-within:ring-2 focus-within:ring-brand">
      <div className="flex gap-0.5 border-b border-line px-1.5 py-1">
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), <Bold className="h-3.5 w-3.5" />, 'Bold')}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), <Italic className="h-3.5 w-3.5" />, 'Italic')}
        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), <List className="h-3.5 w-3.5" />, 'Bullet list')}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered className="h-3.5 w-3.5" />, 'Numbered list')}
      </div>
      <div className="md px-3 py-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

export function DocEditor({ docId, draft, onStop }: { docId: string; draft: Draft; onStop: () => void }) {
  const [sections, setSections] = useState<Section[]>(draft.sections)
  const [rev, setRev] = useState<Record<string, number>>({})
  const [rewriting, setRewriting] = useState<Section | null>(null)
  const [prompt, setPrompt] = useState('')
  const [saved, setSaved] = useState<string>('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(sections)
  latest.current = sections
  const mounted = useRef(true)
  const rewrite = useAction(api.documents.rewriteSection, { success: 'The AI is rewriting the section…', onDone: () => setRewriting(null) })
  const decide = useAction(api.documents.decideProposal)

  // Autosave the draft a moment after typing stops; keep the lock alive.
  const change = (id: string, content: string) => {
    setSections((xs) => xs.map((x) => (x.id === id ? { ...x, content } : x)))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      api.documents.saveDraft(docId, latest.current).then(
        () => setSaved(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })),
        () => onStop(),
      )
    }, 1200)
  }
  useEffect(() => {
    mounted.current = true
    const beat = setInterval(() => api.documents.heartbeat(docId), 60_000)
    const leave = () => api.documents.releaseLock(docId)
    window.addEventListener('beforeunload', leave)
    return () => {
      mounted.current = false
      clearInterval(beat)
      window.removeEventListener('beforeunload', leave)
      // Leaving the editor releases the lock (the draft is already autosaved).
      setTimeout(() => {
        if (!mounted.current) {
          if (timer.current) api.documents.saveDraft(docId, latest.current).finally(() => api.documents.releaseLock(docId))
          else api.documents.releaseLock(docId)
        }
      }, 0)
    }
  }, [docId])

  const proposals = draft.proposals ?? []

  return (
    <div>
      <div className="mb-3 text-xs text-muted">{saved ? `Draft autosaved at ${saved}.` : 'Changes autosave as a draft.'} The lock is released when you save a version or leave, or after 1 hour idle.</div>
      {sections.map((s) => {
        const prop = proposals.find((p) => p.sectionId === s.id)
        const hasTable = /^\s*\|.*\|\s*$/m.test(s.content)
        return (
          <section key={s.id} className="mb-6">
            <div className="mb-1.5 flex items-center gap-2">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              {draft.regeneratedSectionIds.includes(s.id) && <AiBadge label="AI rewrite accepted" />}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => { setRewriting(s); setPrompt('') }}>
                <Sparkles className="h-3.5 w-3.5 text-violet-700" /> Rewrite with AI
              </Button>
            </div>
            {prop && (
              <div className="mb-3 rounded-lg bg-violet-50/60 p-3 ring-1 ring-violet-200">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <AiBadge label="AI proposal" /> <span className="text-muted">Instruction: “{prop.prompt}”</span>
                </div>
                <SideBySide before={s.content} after={prop.content} leftLabel="Current text" rightLabel="AI proposal" />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={async () => {
                      await decide.run(docId, s.id, true)
                      setSections((xs) => xs.map((x) => (x.id === s.id ? { ...x, content: prop.content } : x)))
                      setRev((r) => ({ ...r, [s.id]: (r[s.id] ?? 0) + 1 }))
                    }}
                  >
                    Accept
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => decide.run(docId, s.id, false)}>
                    Reject
                  </Button>
                </div>
              </div>
            )}
            {hasTable ? (
              <div>
                <Textarea key={`${s.id}:${rev[s.id] ?? 0}`} rows={Math.min(16, s.content.split('\n').length + 2)} defaultValue={s.content} onChange={(e) => change(s.id, e.target.value)} className="font-mono text-xs" />
                <div className="mt-1 text-[11px] text-muted">This section has a table, so it is edited as Markdown.</div>
              </div>
            ) : (
              <RichSection key={`${s.id}:${rev[s.id] ?? 0}`} initial={s.content} onChange={(md) => change(s.id, md)} />
            )}
          </section>
        )
      })}
      <Modal
        open={!!rewriting}
        onClose={() => setRewriting(null)}
        title={`Rewrite “${rewriting?.title}” with AI`}
        footer={
          <Button variant="primary" disabled={rewrite.pending} onClick={() => rewrite.run(docId, rewriting!.id, prompt)}>
            <Sparkles className="h-4 w-4" /> Rewrite
          </Button>
        }
      >
        <Field label="What should change?" hint="The result comes back as a diff. Nothing changes until you accept it.">
          <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Make this shorter and clearer" />
        </Field>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {['Make this shorter and clearer', 'Add more detail', 'Use simpler words for field staff'].map((x) => (
            <button key={x} className="rounded-full bg-canvas px-2 py-0.5 text-xs ring-1 ring-line hover:bg-white" onClick={() => setPrompt(x)}>
              {x}
            </button>
          ))}
        </div>
        <AiNote agent="regen" compact />
      </Modal>
    </div>
  )
}
