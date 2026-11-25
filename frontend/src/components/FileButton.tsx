/** A button that opens the file picker. Only the file's name and size are kept (plus small image previews and the text of small text files). */
import { Upload } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Button } from './ui'

export interface PickedFile {
  name: string
  size: number
  type: string
  dataUrl?: string
  text?: string // plain-text files (.txt, .md, .csv): their text, so the AI can really read them
}

export function FileButton({ onPick, accept, children, size = 'md', disabled, icon }: { onPick: (f: PickedFile) => void; accept?: string; children?: ReactNode; size?: 'sm' | 'md'; disabled?: boolean; icon?: { label: string; node: ReactNode } }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          if ((file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) && file.size < 200_000) {
            file.text().then((text) => onPick({ name: file.name, size: file.size, type: file.type, text }))
          } else if (file.type.startsWith('image/') && file.size < 400_000) {
            const reader = new FileReader()
            reader.onload = () => onPick({ name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result) })
            reader.readAsDataURL(file)
          } else onPick({ name: file.name, size: file.size, type: file.type })
        }}
      />
      {icon ? (
        <button type="button" disabled={disabled} onClick={() => ref.current?.click()} title={icon.label} aria-label={icon.label} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-40">
          {icon.node}
        </button>
      ) : (
        <Button size={size} disabled={disabled} onClick={() => ref.current?.click()}>
          <Upload className="h-4 w-4" /> {children ?? 'Upload a file'}
        </Button>
      )}
    </>
  )
}
