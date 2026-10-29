/**
 * Branded print view, used for PDF export (browser "Save as PDF").
 * A signed version always prints its stored copy plus the signature page; it is never rebuilt.
 */
import { Printer } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../api/hooks'
import { brand } from '../theme/brand'
import { Markdown } from '../components/Markdown'
import { fmtDateTime } from '../components/format'
import { Button, ErrorBox, Loading } from '../components/ui'
import { PART_LABEL, sectionPart, type DocPart } from '../rules/pipeline'

export function PrintPage() {
  const { versionId = '' } = useParams()
  const [params] = useSearchParams()
  const kind = params.get('kind') ?? 'doc'
  const { data, isLoading, error } = useApi(['print', versionId], () => api.documents.printable(versionId))
  if (isLoading) return <Loading />
  if (error || !data) return <ErrorBox error={error} />
  const signed = data.signature
  const status = signed ? 'SIGNED' : data.version.frozen ? 'FROZEN' : 'DRAFT'
  // A signed version prints its stored copy (same order as the version's sections, so keys line up).
  const all = (signed ? signed.snapshot.sections.map((s, i) => ({ id: String(i), title: s.title, content: s.content })) : data.version.sections).map((s, i) => ({ ...s, key: data.version.sections[i]?.key ?? '' }))
  const part = params.get('part') as DocPart | null
  const sections = part ? all.filter((s) => sectionPart(s.key) === part) : all
  const bothParts = !part && all.some((s) => sectionPart(s.key) === 'charter')
  const title = part ? PART_LABEL[part] : data.label
  const onePager = kind === 'onepager' ? data.summary : undefined
  if (kind === 'onepager' && !onePager) return <ErrorBox error={new Error('This version has no AI summary yet. Open the document’s Summary tab and make it first.')} />

  return (
    <div className="min-h-full bg-gray-200 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between no-print">
        <span className="text-sm text-muted">Use your browser’s “Save as PDF” in the print dialog.</span>
        <Button variant="primary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
      </div>
      <div className="print-page relative mx-auto max-w-[210mm] bg-white px-[18mm] py-[16mm] shadow-xl" style={{ fontFamily: brand.font, color: brand.ink }}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="rotate-[-30deg] text-[110px] font-bold tracking-widest" style={{ color: status === 'SIGNED' ? 'rgba(0,137,69,0.07)' : status === 'FROZEN' ? 'rgba(39,40,28,0.06)' : 'rgba(209,0,116,0.06)' }}>{status}</span>
        </div>
        <header className="mb-8 flex items-start justify-between border-b-4 pb-4" style={{ borderColor: brand.primary }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded text-lg font-bold text-white" style={{ background: brand.primary }}>logo</div>
            <div>
              <div className="text-lg font-bold" style={{ color: brand.primary }}>{brand.orgName}</div>
              <div className="text-xs" style={{ color: brand.muted }}>{brand.unitName}</div>
            </div>
          </div>
          <div className="text-right text-xs" style={{ color: brand.muted }}>
            {data.project.name}<br />{data.label} · version {data.version.number}<br />{status}
          </div>
        </header>
        <h1 className="mb-1 text-3xl font-light uppercase">{onePager ? `${data.label}: one-page summary` : title}</h1>
        <div className="mb-8 text-sm" style={{ color: brand.muted }}>{data.project.name} · Version {data.version.number} · {fmtDateTime(data.version.createdAt)}</div>
        {onePager ? (
          <>
            <div className="mb-4 rounded p-3 text-sm" style={{ background: brand.primarySoft }}>AI summary of version {data.version.number} — for quick understanding; the full document is the approved text.</div>
            <Markdown text={onePager.onePager} />
          </>
        ) : (
          sections.map((s, i) => (
            <section key={s.id} className={i > 0 && bothParts && sectionPart(sections[i - 1].key) !== sectionPart(s.key) ? 'page-break mb-6' : 'mb-6 break-inside-avoid-page'}>
              {bothParts && (i === 0 || sectionPart(sections[i - 1].key) !== sectionPart(s.key)) && (
                <div className="mb-4 text-xl font-semibold uppercase" style={{ color: brand.ink }}>Part {sectionPart(s.key) === 'proposal' ? 1 : 2}: {PART_LABEL[sectionPart(s.key)]}</div>
              )}
              <h2 className="mb-2 text-lg font-semibold" style={{ color: brand.primary }}>{s.title}</h2>
              <Markdown text={s.content} />
            </section>
          ))
        )}
        {!onePager && data.approvals.length > 0 && (
          <section className="mt-8 border-t pt-4 text-xs" style={{ borderColor: brand.line }}>
            <div className="mb-1 font-semibold">Approval record</div>
            {data.approvals.map((a, i) => <div key={i}>{a.role}: {a.by}{a.actingFor ? ` (deputy for ${a.actingFor})` : ''} · {fmtDateTime(a.at)}</div>)}
          </section>
        )}
        <footer className="mt-10 text-center text-[10px]" style={{ color: brand.muted }}>{brand.orgName} · {brand.appName} · Prototype export · dummy data</footer>
      </div>
      {signed && !onePager && (
        <div className="print-page page-break mx-auto mt-8 max-w-[210mm] bg-white px-[18mm] py-[16mm] shadow-xl">
          <div className="mb-6 border-b-4 pb-3" style={{ borderColor: brand.green }}>
            <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: brand.green }}>Certificate of completion</div>
            <div className="text-2xl font-light uppercase">Electronic approval record</div>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['Document', `${data.project.name} — ${data.label}`],
                ['Version', String(signed.snapshot.versionNumber)],
                ['Signed by', `${signed.signerName}${signed.actingForName ? ` (deputy, acting for ${signed.actingForName})` : ''}`],
                ['Signed at', fmtDateTime(signed.signedAt)],
                ['IP address', signed.ip],
                ['Re-authentication', signed.method === 'password' ? 'Password' : 'Email one-time code'],
                ['Document fingerprint (SHA-256)', signed.docHash],
                ['Fingerprint with this page', signed.finalHash],
              ].map(([k, v]) => (
                <tr key={k} className="border-b" style={{ borderColor: brand.line }}>
                  <td className="w-56 py-2 pr-4 align-top font-medium">{k}</td>
                  <td className="py-2 font-mono text-xs break-all">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-6 text-xs" style={{ color: brand.muted }}>This is an electronic approval record with an audit trail, suitable for internal governance. It is not a CCA-certified digital signature under Bangladesh’s ICT Act. The signed document and this page are stored exactly as signed and are never regenerated.</p>
        </div>
      )}
    </div>
  )
}
