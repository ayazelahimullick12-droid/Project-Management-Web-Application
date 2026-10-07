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

export function ApprovalPanel(props: ApprovalProps) {
  const [requesting, setRequesting] = useState(false)
  const [comment, setComment] = useState('')
  const [signing, setSigning] = useState(false)
  const [history, setHistory] = useState(false)
  const send = useAction(api.documents.sendForApproval, { success: 'Sent for approval. The first approver was notified.' })
  const approve = useAction(api.documents.approve, { success: 'Approved. The next approver was notified.' })
  const request = useAction(api.documents.requestChanges, { success: 'Changes requested. The PM team was notified.', onDone: () => setRequesting(false) })
  const minor = useAction(api.documents.declareMinorCorrection, { success: 'Minor correction declared. The chain resumes at the person who asked for changes.' })
  const cfg = CHAIN_CONFIG[props.docType]
  const chain = props.activeChain?.status === 'in_progress' ? props.activeChain : undefined
  const current = chain?.steps.find((s) => s.status === 'pending')
  const shown = chain ?? props.activeChain ?? props.lastChain

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Approval
        </span>
      }
      subtitle={`${cfg.steps.length > 1 ? 'In order: ' : 'By the '}${cfg.steps.map((r) => (r === 'PM' ? 'PM' : ROLE_LABEL[r].toLowerCase()) + (cfg.signs && r === 'SPONSOR_HEAD' ? ' (signs)' : '')).join(' → ')}`}
      actions={props.docType === 'UAT_SIGNOFF' ? <OpenQuestion id="uat-chain" /> : props.docType === 'SQA_SIGNOFF' ? <OpenQuestion id="sqa-approver" /> : undefined}
    >
      {shown ? (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            Version {shown.versionNumber} · started by {shown.startedByName} {fmtDateTime(shown.startedAt)}
            {shown.reapproval && <Badge tone="blue">re-approval</Badge>}
            {shown.minorCorrectionOf && <Badge tone="violet">minor correction</Badge>}
            {shown.status === 'cancelled' && <Badge>cancelled: {shown.cancelReason}</Badge>}
          </div>
          <ol className="space-y-2">
            {shown.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                {s.status === 'approved' || s.status === 'carried_over' ? <BadgeCheck className="mt-0.5 h-4 w-4 text-leaf" /> : s.status === 'pending' ? <CircleDot className="mt-0.5 h-4 w-4 text-sky-600" /> : s.status === 'changes_requested' ? <Undo2 className="mt-0.5 h-4 w-4 text-amber-600" /> : <CircleDashed className="mt-0.5 h-4 w-4 text-muted" />}
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{s.roleLabel}</span>
                    {s.sign && <Badge tone="magenta">signs</Badge>}
                    <StepStatusChip status={s.status} />
                  </div>
                  <div className="text-xs text-muted">
                    {s.assigneeName}
                    {s.actedByName && s.actedByName !== s.assigneeName && <> · acted by {s.actedByName}</>}
                    {s.actingForName && <> (deputy for {s.actingForName})</>}
                    {s.actedAt && <> · {fmtDateTime(s.actedAt)}</>}
                    {s.status === 'pending' && s.deputyCovering && <> · {s.assigneeName} is Away, so {s.deputyCovering} is covering</>}
                  </div>
                  {s.comment && <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">“{s.comment}”</div>}
                  {s.sign && s.status === 'pending' && <OpenQuestion id="deputy-sign" />}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted">Not sent for approval yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {chain && props.act.ok && current && !current.sign && (
          <div className="flex flex-wrap gap-2">
            <Button variant="success" onClick={() => approve.run(props.docId)}>
              <BadgeCheck className="h-4 w-4" /> Approve{props.act.actingFor ? ' (as deputy)' : ''}
            </Button>
            <Button onClick={() => { setComment(''); setRequesting(true) }}>
              <Undo2 className="h-4 w-4" /> Request changes
            </Button>
          </div>
        )}
        {chain && props.act.ok && current?.sign && (
          <div className="flex flex-wrap gap-2">
            <Button variant="success" onClick={() => setSigning(true)}>
              <FileSignature className="h-4 w-4" /> Approve and Sign{props.act.actingFor ? ' (as deputy)' : ''}
            </Button>
            <Button onClick={() => { setComment(''); setRequesting(true) }}>
              <Undo2 className="h-4 w-4" /> Request changes
            </Button>
          </div>
        )}
        {chain && !props.act.ok && props.act.reason && <p className="text-xs text-muted">{props.act.reason}</p>}
        {!chain && (
          <Guarded variant="primary" check={props.send} onClick={() => send.run(props.docId)}>
            <Send className="h-4 w-4" /> {props.outOfSync && props.frozen ? 'Send for re-approval (unchanged)' : 'Send for approval'}
          </Guarded>
        )}
        {!chain && props.minor.requested && (
          <div className="rounded-md bg-canvas p-2.5">
            <div className="mb-1 text-xs font-medium">Minor correction</div>
            <p className="mb-2 text-xs text-muted">For a small fix after Request changes: earlier approvals carry over and the chain resumes at the person who asked. Not allowed if the edit touches objectives, deliverables, budget or timeline.</p>
            <Guarded size="sm" check={props.minor} onClick={() => minor.run(props.docId)}>
              Declare a minor correction
            </Guarded>
            {props.compareLink && (
              <Link to={props.compareLink} className="mt-1 block text-xs font-medium text-brand hover:underline">
                Compare with the version that was reviewed
              </Link>
            )}
          </div>
        )}
      </div>

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
            <History className="h-3.5 w-3.5" /> Approval history ({props.chains.length} chains)
          </button>
          {history && (
            <ul className="mt-2 space-y-1.5 text-xs">
              {[...props.chains].reverse().map((c) => (
                <li key={c.id} className="rounded bg-canvas px-2 py-1.5">
                  <b>v{c.versionNumber}</b> · {c.status.replace('_', ' ')} · {fmtDateTime(c.startedAt)}
                  {c.cancelReason && <span className="text-muted"> ({c.cancelReason})</span>}
                  <div className="text-muted">{c.steps.filter((s) => s.actedAt).map((s) => `${s.roleLabel}: ${s.status.replace('_', ' ')} by ${s.actedByName}`).join(' · ') || 'No actions'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Request changes"
        footer={
          <Button variant="primary" disabled={!comment.trim()} onClick={() => request.run(props.docId, comment)}>
            Request changes
          </Button>
        }
      >
        <p className="mb-3 text-sm text-muted">The document goes back to the PM team. A comment is required{cfg.comments ? '; it is added to the document as an open comment' : ''}.</p>
        <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What needs to change?" autoFocus />
      </Modal>
      {signing && <SignModal docId={props.docId} onClose={() => setSigning(false)} />}
    </Card>
  )
}
