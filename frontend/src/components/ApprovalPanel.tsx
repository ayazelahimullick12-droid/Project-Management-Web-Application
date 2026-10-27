/**
 * Approval panel: whose turn it is, Approve / Request changes / Approve and Sign, Send for approval,
 * minor correction, chain history and signature records. Used for documents and sign-off reports.
 * The rules live in src/rules/approval.ts; this only shows what they allow.
 */
import { BadgeCheck, CircleDashed, CircleDot, FileSignature, Fingerprint, History, Send, ShieldCheck, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { ApprovalChain, DocType, Signature } from '../types'
import { api } from '../api'
import { useAction } from '../api/hooks'
import { canonicalDocument, sha256Hex } from '../api/fingerprint'
import { CHAIN_CONFIG, ROLE_LABEL } from '../rules/approval'
import type { Check } from '../rules/permissions'
import { StepStatusChip } from './status'
import { OpenQuestion } from './OpenQuestion'
import { fmtDateTime } from './format'
import { printUrl } from './exports'
import { Badge, Button, Card, Field, Guarded, Input, Modal, Note, Textarea } from './ui'
import { useToast } from './toast'

type NamedChain = Omit<ApprovalChain, 'steps'> & {
  versionNumber?: number
  startedByName: string
  steps: (ApprovalChain['steps'][number] & { assigneeName: string; actedByName?: string; actingForName?: string; roleLabel: string; deputyCovering?: string | false })[]
}

export interface ApprovalProps {
  docId: string
  docType: DocType
  versionId?: string
  versionNumber?: number
  activeChain?: NamedChain
  lastChain?: NamedChain
  chains: NamedChain[]
  send: Check
  act: Check
  minor: Check & { requested?: boolean }
  outOfSync?: boolean
  frozen?: boolean
  signatures: (Signature & { signerName: string; actingForName?: string })[]
  compareLink?: string
}

function SignModal({ docId, onClose }: { docId: string; onClose: () => void }) {
  const toast = useToast()
  const [method, setMethod] = useState<'password' | 'email_otp'>('password')
  const [secret, setSecret] = useState('')
  const [sent, setSent] = useState<{ email: string; code: string } | null>(null)
  const sendCode = useAction(api.documents.sendSigningCode, { onDone: (r) => setSent(r) })
  const sign = useAction(api.documents.approveAndSign, {
    onDone: (r) => {
      toast.ok(`Signed. SHA-256 fingerprint ${r.docHash.slice(0, 12)}… stored with the PDF.`)
      onClose()
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      title="Approve and Sign"
      footer={
        <Button variant="success" disabled={sign.pending || !secret} onClick={() => sign.run(docId, method, secret)}>
          <FileSignature className="h-4 w-4" /> Approve and Sign
        </Button>
      }
    >
      <Note tone="blue" className="mb-4">
        Signing re-checks who you are. The system then saves the exact document, computes its SHA-256 fingerprint, adds a signature page (signer, time, IP address, fingerprint) and freezes the version.
      </Note>
      <div className="mb-3 flex gap-2">
        {(['password', 'email_otp'] as const).map((m) => (
          <button key={m} onClick={() => { setMethod(m); setSecret('') }} className={clsx('flex-1 rounded-md px-3 py-2 text-sm ring-1', method === m ? 'bg-brand-soft font-medium text-brand ring-brand' : 'ring-line hover:bg-canvas')}>
            {m === 'password' ? 'Re-enter password' : 'Email one-time code'}
          </button>
        ))}
      </div>
      {method === 'password' ? (
        <Field label="Your password" hint="Prototype: any password is accepted (demo accounts use demo1234). The real app checks it.">
          <Input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoFocus />
        </Field>
      ) : (
        <div>
          {!sent ? (
            <Button onClick={() => sendCode.run()}>Send me a code</Button>
          ) : (
            <Note tone="green" className="mb-3">
              A code was sent to {sent.email}. Open it in the <Link to="/mailbox" target="_blank" className="font-medium underline">Mailbox</Link> (prototype hint: <b>{sent.code}</b>).
            </Note>
          )}
          {sent && (
            <Field label="Code from the email">
              <Input value={secret} onChange={(e) => setSecret(e.target.value)} inputMode="numeric" autoFocus />
            </Field>
          )}
        </div>
      )}
      <p className="text-xs text-muted">This is an electronic approval record with an audit trail, not a CCA-certified digital signature under Bangladesh’s ICT Act.</p>
    </Modal>
  )
}

function SignatureRecord({ sig }: { sig: ApprovalProps['signatures'][number] }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const verify = async () => setVerified((await sha256Hex(canonicalDocument(sig.snapshot))) === sig.docHash)
  return (
    <div className="rounded-md bg-leaf-soft/50 p-3 text-xs ring-1 ring-green-200">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-leaf">
        <BadgeCheck className="h-4 w-4" /> Signed by {sig.signerName}
        {sig.actingForName && <span className="font-normal"> (deputy for {sig.actingForName})</span>}
      </div>
      <div className="space-y-0.5 text-ink/80">
        <div>{fmtDateTime(sig.signedAt)} · IP {sig.ip} · {sig.method === 'password' ? 'password' : 'email code'}</div>
        <div className="break-all">Document SHA-256: <code>{sig.docHash}</code></div>
        <div className="break-all">With signature page: <code>{sig.finalHash}</code></div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a href={printUrl(sig.versionId)} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
          Open the signed PDF (stored copy)
        </a>
        <button onClick={verify} className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
          <Fingerprint className="h-3.5 w-3.5" /> Verify fingerprint
        </button>
        {verified !== null && <Badge tone={verified ? 'green' : 'red'}>{verified ? 'Matches the stored copy' : 'Does not match'}</Badge>}
      </div>
    </div>
  )
}

/** Who may send the version: hide the button for people who could never send it. */
function sendVisible(send: Check): boolean {
  return send.ok || !/^Only (the Project Manager|an SQA)/.test(send.reason ?? '')
}

/**
 * The approval buttons: Approve / Approve and Sign / Request changes, Send for approval and
 * Declare a minor correction. `row` is for a page header (one main button), `stack` for a panel.
 */
export function ApprovalActions(props: ApprovalProps & { layout?: 'row' | 'stack'; plain?: boolean; size?: 'md' | 'lg' }) {
  const [requesting, setRequesting] = useState(false)
  const [comment, setComment] = useState('')
  const [signing, setSigning] = useState(false)
  const send = useAction(api.documents.sendForApproval, { success: 'Sent for approval. The first approver was notified.' })
  const approve = useAction(api.documents.approve, { success: 'Approved. The next approver was notified.' })
  const request = useAction(api.documents.requestChanges, { success: 'Changes requested. The PM team was notified.', onDone: () => setRequesting(false) })
  const minor = useAction(api.documents.declareMinorCorrection, { success: 'Minor correction declared. The chain resumes at the person who asked for changes.' })
  const cfg = CHAIN_CONFIG[props.docType]
  const chain = props.activeChain?.status === 'in_progress' ? props.activeChain : undefined
  const current = chain?.steps.find((s) => s.status === 'pending')
  const row = props.layout === 'row'
  const deputy = props.act.actingFor ? ' (as deputy)' : ''
  // plain: the Simple view's wording and larger buttons
  const size = props.size ?? 'md'
  const askLabel = props.plain ? 'Ask for changes' : 'Request changes'

  const buttons: React.ReactNode[] = []
  if (chain && props.act.ok && current) {
    buttons.push(
      current.sign ? (
        <Button key="sign" size={size} variant="success" onClick={() => setSigning(true)}>
          <FileSignature className="h-4 w-4" /> Approve and sign{deputy}
        </Button>
      ) : (
        <Button key="approve" size={size} variant="success" onClick={() => approve.run(props.docId)}>
          <BadgeCheck className="h-4 w-4" /> Approve{deputy}
        </Button>
      ),
      <Button key="request" size={size} variant={props.plain ? 'ghost' : 'secondary'} onClick={() => { setComment(''); setRequesting(true) }}>
        <Undo2 className="h-4 w-4" /> {askLabel}
      </Button>,
    )
  }
  if (!chain && props.minor.requested && props.minor.ok)
    buttons.push(
      <Button key="minor" size={size} variant="primary" onClick={() => minor.run(props.docId)}>
        {props.plain ? 'It was a small fix: continue the approvals' : 'Declare minor correction'}
      </Button>,
    )
  if (!chain && sendVisible(props.send)) {
    const label = props.outOfSync && props.frozen ? 'Send for re-approval' : 'Send for approval'
    buttons.push(
      row ? (
        <Button key="send" size={size} variant={props.minor.requested && props.minor.ok ? 'secondary' : 'primary'} disabled={!props.send.ok} why={props.send.reason} onClick={() => send.run(props.docId)}>
          <Send className="h-4 w-4" /> {label}
        </Button>
      ) : (
        <Guarded key="send" variant="primary" check={props.send} onClick={() => send.run(props.docId)}>
          <Send className="h-4 w-4" /> {label}
        </Guarded>
      ),
    )
  }

  return (
    <>
      {buttons.length > 0 && <div className={row ? 'flex flex-wrap items-center gap-2' : 'flex flex-wrap gap-2'}>{buttons}</div>}
      {!row && chain && !props.act.ok && props.act.reason && <p className="mt-2 text-xs text-muted">{props.act.reason}</p>}
      {!row && !chain && props.minor.requested && !props.minor.ok && props.minor.reason && <p className="mt-2 text-xs text-muted">Minor correction: {props.minor.reason}</p>}
      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title={askLabel}
        footer={
          <Button variant="primary" disabled={!comment.trim()} onClick={() => request.run(props.docId, comment)}>
            {askLabel}
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">The document goes back to the PM team. A comment is required{cfg.comments ? '; it is added to the document as an open comment' : ''}.</p>
        <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What needs to change?" autoFocus />
      </Modal>
      {signing && <SignModal docId={props.docId} onClose={() => setSigning(false)} />}
    </>
  )
}

/** Reviewers in order with their status (like GitHub's reviewers list), then signatures and history. */
export function ApprovalTimeline(props: ApprovalProps) {
  const [history, setHistory] = useState(false)
  const cfg = CHAIN_CONFIG[props.docType]
  const chain = props.activeChain?.status === 'in_progress' ? props.activeChain : undefined
  const shown = chain ?? props.activeChain ?? props.lastChain
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5" />
        {cfg.steps.map((r) => (r === 'PM' ? 'PM' : ROLE_LABEL[r].replace(' head', ''))).join(' → ')}
        {cfg.signs && ' · sponsor signs'}
        {props.docType === 'UAT_SIGNOFF' && <OpenQuestion id="uat-chain" />}
        {props.docType === 'SQA_SIGNOFF' && <OpenQuestion id="sqa-approver" />}
      </div>
      {shown ? (
        <>
          <ol className="space-y-3">
            {shown.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                {s.status === 'approved' || s.status === 'carried_over' ? <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf" /> : s.status === 'pending' ? <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /> : s.status === 'changes_requested' ? <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-ink/25" />}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="font-medium">{s.actedByName ?? s.assigneeName}</span>
                    <StepStatusChip status={s.status} />
                  </div>
                  <div className="text-xs text-muted">
                    {s.roleLabel}
                    {s.sign && ' · signs'}
                    {s.actingForName && ` · deputy for ${s.actingForName}`}
                    {s.actedAt && ` · ${fmtDateTime(s.actedAt)}`}
                    {s.status === 'pending' && s.deputyCovering && ` · Away; ${s.deputyCovering} is covering`}
                  </div>
                  {s.comment && <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">“{s.comment}”</div>}
                  {s.sign && s.status === 'pending' && <OpenQuestion id="deputy-sign" />}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted">
            Version {shown.versionNumber} · sent by {shown.startedByName} {fmtDateTime(shown.startedAt)}
            {shown.reapproval && <Badge tone="blue">re-approval</Badge>}
            {shown.minorCorrectionOf && <Badge tone="violet">minor correction</Badge>}
            {shown.status === 'cancelled' && <Badge>cancelled: {shown.cancelReason}</Badge>}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">Not sent for approval yet.</p>
      )}
      {props.minor.requested && props.compareLink && (
        <Link to={props.compareLink} className="mt-3 block text-xs font-medium text-brand hover:underline">
          Compare with the version that was reviewed
        </Link>
      )}
      {props.signatures.length > 0 && (
        <div className="mt-4 space-y-2">
          {props.signatures.map((s) => (
            <SignatureRecord key={s.id} sig={s} />
          ))}
        </div>
      )}
      {props.chains.length > 1 && (
        <div className="mt-4 border-t border-line pt-3">
          <button onClick={() => setHistory(!history)} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
            <History className="h-3.5 w-3.5" /> Earlier approval rounds ({props.chains.length - 1})
          </button>
          {history && (
            <ul className="mt-2 space-y-1.5 text-xs">
              {[...props.chains].reverse().slice(1).map((c) => (
                <li key={c.id} className="rounded-md bg-canvas px-2 py-1.5">
                  <b>v{c.versionNumber}</b> · {c.status.replace('_', ' ')} · {fmtDateTime(c.startedAt)}
                  {c.cancelReason && <span className="text-muted"> ({c.cancelReason})</span>}
                  <div className="text-muted">{c.steps.filter((s) => s.actedAt).map((s) => `${s.roleLabel}: ${s.status.replace('_', ' ')} by ${s.actedByName}`).join(' · ') || 'No actions'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Both together, in a card (used for the SQA and UAT sign-off reports). */
export function ApprovalPanel(props: ApprovalProps) {
  return (
    <Card title="Approval">
      <div className="space-y-4">
        <ApprovalTimeline {...props} />
        <ApprovalActions {...props} layout="stack" />
      </div>
    </Card>
  )
}
