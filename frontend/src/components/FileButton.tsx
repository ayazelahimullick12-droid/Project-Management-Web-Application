/** A button that opens the file picker. Only the file's name and size are kept (plus small image previews). */
import { Upload } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { Button } from './ui'

export interface PickedFile {
  name: string
  size: number
  type: string
  dataUrl?: string
}

export function FileButton({ onPick, accept, children, size = 'md', disabled }: { onPick: (f: PickedFile) => void; accept?: string; children?: ReactNode; size?: 'sm' | 'md'; disabled?: boolean }) {
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
          if (file.type.startsWith('image/') && file.size < 400_000) {
            const reader = new FileReader()
            reader.onload = () => onPick({ name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result) })
            reader.readAsDataURL(file)
          } else onPick({ name: file.name, size: file.size, type: file.type })
        }}
      />
      <Button size={size} disabled={disabled} onClick={() => ref.current?.click()}>
        <Upload className="h-4 w-4" /> {children ?? 'Upload a file'}
      </Button>
    </>
  )
}
