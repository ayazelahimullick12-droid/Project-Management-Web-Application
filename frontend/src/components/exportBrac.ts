/**
 * Word (.docx) export in BRAC's layout, for documents written in a BRAC format (rules/formats.ts):
 * A4, the magenta BRAC logo on the cover and top-left in the header of every other page, the
 * document control table, Change history and a table of contents (BRD Template A, from real Word
 * headings: Word asks to update it on opening), Markdown tables as real tables, and the BRAC footer
 * with "Page X of Y". Signature and date lines stay blank: a signature is never generated.
 */
import type { BracCover, DocFormat } from '../rules/formats'

const A4 = { width: 11906, height: 16838 } // twips
const MARGIN = 1417 // 2.5 cm

/** The logo as PNG (Word does not take WebP). */
async function logoPng(): Promise<Uint8Array | undefined> {
  try {
    const blob = await (await fetch('/brac-logo.webp')).blob()
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    canvas.getContext('2d')!.drawImage(bmp, 0, 0)
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    return png ? new Uint8Array(await png.arrayBuffer()) : undefined
  } catch {
    return undefined
  }
}

export async function exportBracDocx(args: { format: DocFormat; cover: BracCover; sections: { key: string; title: string; content: string }[]; fileName: string; date: string; author: string }) {
  const d = await import('docx')
  const { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, Packer, PageBreak, PageNumber, Paragraph, Table, TableCell, TableOfContents, TableRow, TabStopType, TextRun, WidthType } = d
  const srs = args.format.startsWith('SRS')
  const font = srs ? 'Segoe UI Light' : 'Calibri'
  const size = srs ? 18 : 22 // half-points
  const headColor = srs ? '0F4761' : '000000'
  const logo = await logoPng()
  const logoRun = (w: number) => (logo ? new ImageRun({ type: 'png', data: logo, transformation: { width: w, height: w } }) : new TextRun({ text: '[BRAC LOGO – MAGENTA]', italics: true }))

  /** "**bold** and *italic*" → runs */
  const runs = (line: string, base: { bold?: boolean } = {}) => {
    const out: InstanceType<typeof TextRun>[] = []
    let last = 0
    for (const m of line.matchAll(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)) {
      if (m.index! > last) out.push(new TextRun({ text: line.slice(last, m.index), ...base }))
      const t = m[0]
      out.push(t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true }) : new TextRun({ text: t.slice(1, -1), italics: true, color: '595959' }))
      last = m.index! + t.length
    }
    if (last < line.length) out.push(new TextRun({ text: line.slice(last), ...base }))
    return out
  }
  const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const grid = { top: line, bottom: line, left: line, right: line }
  const table = (rows: string[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((c) => new TableCell({ borders: grid, children: [new Paragraph({ children: runs(c, i === 0 ? { bold: true } : {}) })] })) })),
    })

  /** Markdown of one section → Word blocks. */
  const blocks = (md: string) => {
    const out: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []
    const lines = md.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trimEnd()
      if (!l.trim()) continue
      if (l.startsWith('|')) {
        const rows: string[][] = []
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
          if (!cells.every((c) => /^-{3,}$/.test(c))) rows.push(cells)
          i++
        }
        i--
        out.push(table(rows), new Paragraph({ text: '' }))
        continue
      }
      if (l.trim() === '---') {
        out.push(new Paragraph({ text: '' }))
        continue
      }
      const h = l.match(/^(#{2,4})\s+(.*)$/)
      if (h) {
        out.push(new Paragraph({ heading: h[1].length === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: [new TextRun({ text: h[2], bold: true, color: headColor })] }))
        continue
      }
      const bullet = l.match(/^\s*[-*]\s+(.*)$/)
      const numbered = l.match(/^\s*\d+\.\s+(.*)$/)
      out.push(new Paragraph({ bullet: bullet ? { level: 0 } : undefined, numbering: undefined, spacing: { after: 120 }, children: runs(numbered ? `${l.trim().match(/^\d+\./)![0]} ${numbered[1]}` : (bullet?.[1] ?? l)) }))
    }
    return out
  }

  // ─── Cover (no header or footer) ───
  const c = args.cover
  const coverRows = new Table({
    width: { size: 75, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: c.rows.map(([k, v]) =>
      new TableRow({
        children: [
          new TableCell({ width: { size: 27, type: WidthType.PERCENTAGE }, borders: srs ? grid : { top: line, bottom: line, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: line }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: !srs })] })] }),
          new TableCell({ borders: srs ? grid : { top: line, bottom: line, left: line, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }, children: [new Paragraph({ children: runs(v) })] }),
        ],
      }),
    ),
  })
  const cover = [
    new Paragraph({ spacing: { before: 2200 }, alignment: AlignmentType.CENTER, children: [logoRun(srs ? 190 : 225)] }),
    ...(c.org ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.org, bold: true, size: 28 })] })] : []),
    new Paragraph({ spacing: { before: srs ? 600 : 1700 }, alignment: srs && args.format === 'SRS_CR' ? AlignmentType.LEFT : AlignmentType.CENTER, children: [new TextRun({ text: c.title, bold: !srs, size: srs ? (args.format === 'SRS_CR' ? 40 : 56) : 28, color: args.format === 'SRS_FULL' ? '0070C0' : '000000', font: srs ? 'Segoe UI Light' : 'Calibri' })] }),
    ...(c.subtitle ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.subtitle, size: srs ? 32 : 28, color: srs ? '000000' : '595959' })] })] : []),
    new Paragraph({ spacing: { before: 1100 }, text: '' }),
    coverRows,
  ]

  // ─── Front matter: Change history and contents (Template A), revision history (SRS) ───
  const front: (InstanceType<typeof Paragraph> | InstanceType<typeof Table> | InstanceType<typeof TableOfContents>)[] = []
  if (args.format === 'BRD_A') {
    front.push(
      new Paragraph({ children: [new TextRun({ text: 'Change history', bold: true, size: 26 })] }),
      table([['Date', 'Version', 'Created by', 'Description of change'], [args.date, '1.0', args.author, 'Document Created'], ['', '', '', ''], ['', '', '', ''], ['', '', '', ''], ['', '', '', '']]),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: '[Note: Information bracketed in blue text within this template document is for guidance only and should be deleted or replaced by the person completing the document.  Note that not all sections will be appropriate for all services; delete as not required.]', italics: true, color: '595959' })] }),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ children: [new TextRun({ text: 'Table of contents', bold: true, size: 26 })] }),
      new TableOfContents('Table of contents', { hyperlink: true, headingStyleRange: '1-2' }),
      new Paragraph({ children: [new PageBreak()] }),
    )
  } else if (srs) {
    front.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Revision History', color: headColor })] }),
      table(args.format === 'SRS_CR' ? [['Date', 'Version', 'Created by', 'Description of change'], [args.date, '1.0', args.author, 'Initial Draft']] : [['Date', 'Version', 'Created By', 'Change Log', 'Affected Section(s)'], [args.date, 'V1.0', args.author, 'Initial draft Document', 'All']]),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ children: [new TextRun({ text: 'Table of Contents', size: 16, color: '808080' })] }),
      new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
      new Paragraph({ children: [new PageBreak()] }),
    )
  }

  // ─── The sections ───
  const body: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = []
  const newPage = new Set(['use_cases', 'signoff', 'functional', 'effort'])
  for (const s of args.sections) {
    if (s.key === 'open_questions') continue // after the document, outside its pages
    if (newPage.has(s.key) && body.length) body.push(new Paragraph({ children: [new PageBreak()] }))
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: s.title, bold: true, color: headColor })] }), ...blocks(s.content))
  }
  const oq = args.sections.find((s) => s.key === 'open_questions')
  if (oq) body.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ children: [new TextRun({ text: 'Open Questions', bold: true, size: 26 })] }), ...blocks(oq.content))

  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 4 } },
        tabStops: [{ type: TabStopType.CENTER, position: (A4.width - 2 * MARGIN) / 2 }, { type: TabStopType.RIGHT, position: A4.width - 2 * MARGIN }],
        children: [
          new TextRun({ text: c.footerLeft, size: 16 }),
          new TextRun({ text: `\t${c.footerCentre?.[0] ?? ''}`, size: 16 }),
          new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, bold: true }),
        ],
      }),
      ...(c.footerCentre?.[1] ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c.footerCentre[1], size: 16 })] })] : []),
    ],
  })
  const page = { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } }
  const doc = new Document({
    creator: 'BRAC Project Management (prototype)',
    title: `${c.subtitle ?? c.title}`,
    features: { updateFields: true },
    styles: { default: { document: { run: { font, size } } } },
    sections: [
      { properties: { page }, children: cover },
      { properties: { page }, headers: { default: new Header({ children: [new Paragraph({ children: [logoRun(95)] })] }) }, footers: { default: footer }, children: [...front, ...body] },
    ],
  })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = args.fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
