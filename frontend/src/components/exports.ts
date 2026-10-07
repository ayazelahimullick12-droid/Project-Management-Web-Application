/**
 * Exports with BRAC branding: Word (docx), PowerPoint (pptxgenjs) and PDF (the print view).
 * The libraries are loaded only when needed, to keep the app light.
 */
import { brand } from '../theme/brand'

const hex = (c: string) => c.replace('#', '')

/** Splits "**bold** text" into runs. */
function runs(line: string) {
  const out: { text: string; bold: boolean; italics: boolean }[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  for (const m of line.matchAll(re)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index), bold: false, italics: false })
    const t = m[0]
    out.push(t.startsWith('**') ? { text: t.slice(2, -2), bold: true, italics: false } : { text: t.slice(1, -1), bold: false, italics: true })
    last = m.index! + t.length
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false, italics: false })
  return out
}

export async function exportDocx(args: { project: string; title: string; versionLabel: string; status: string; sections: { title: string; content: string }[]; fileName: string }) {
  const d = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Header, Footer, AlignmentType } = d
  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ children: [new TextRun({ text: brand.orgName, bold: true, color: hex(brand.primary), size: 28 })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: args.title, color: hex(brand.ink) })] }),
    new Paragraph({ children: [new TextRun({ text: `${args.project} · ${args.versionLabel} · ${args.status}`, color: hex(brand.muted) })] }),
  ]
  for (const s of args.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: s.title, color: hex(brand.primary) })] }))
    for (const raw of s.content.split('\n')) {
      const line = raw.trimEnd()
      if (!line.trim() || /^\s*\|?\s*-{3,}/.test(line)) continue
      const bullet = line.match(/^\s*[-*]\s+(.*)$/)
      const numbered = line.match(/^\s*\d+\.\s+(.*)$/)
      const text = (bullet?.[1] ?? numbered?.[1] ?? line).replace(/^\|\s*|\s*\|$/g, '').replace(/\s*\|\s*/g, '  ·  ')
      children.push(new Paragraph({ bullet: bullet || numbered ? { level: 0 } : undefined, children: runs(text).map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italics })) }))
    }
  }
  const doc = new Document({
    creator: brand.appName,
    title: args.title,
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${brand.orgName} · ${args.project}`, color: hex(brand.muted), size: 16 })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${args.title} · ${args.versionLabel} · ${args.status} · Prototype export`, color: hex(brand.muted), size: 16 })] })] }) },
        children,
      },
    ],
  })
  download(await Packer.toBlob(doc), args.fileName)
}

export async function exportPptx(args: { project: string; title: string; versionLabel: string; slides: { title: string; bullets: string[] }[]; fileName: string }) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  args.slides.forEach((s, i) => {
    const slide = pptx.addSlide()
    slide.background = { color: i === 0 ? hex(brand.primary) : 'FFFFFF' }
    slide.addText(s.title, { x: 0.6, y: i === 0 ? 2.2 : 0.4, w: 12, h: 0.9, fontSize: i === 0 ? 34 : 26, bold: true, color: i === 0 ? 'FFFFFF' : hex(brand.ink), fontFace: 'Helvetica' })
    if (i > 0) slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.25, w: 1.2, h: 0.06, fill: { color: hex(brand.primary) } })
    slide.addText(
      s.bullets.map((b) => ({ text: b, options: { bullet: i > 0, breakLine: true } })),
      { x: 0.6, y: i === 0 ? 3.2 : 1.5, w: 12, h: 4.5, fontSize: i === 0 ? 18 : 18, color: i === 0 ? 'FFFFFF' : hex(brand.ink), valign: 'top', fontFace: 'Helvetica' },
    )
    slide.addText(`${brand.orgName} · ${args.project} · AI summary of ${args.versionLabel}`, { x: 0.6, y: 7.0, w: 12, h: 0.3, fontSize: 10, color: i === 0 ? 'FFFFFF' : hex(brand.muted) })
  })
  await pptx.writeFile({ fileName: args.fileName })
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const printUrl = (versionId: string, kind: 'doc' | 'onepager' = 'doc') => `/print/${versionId}?kind=${kind}`
export const safeName = (s: string) => s.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-')
