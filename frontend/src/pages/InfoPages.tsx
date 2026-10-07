/** Open questions from the spec, and "How the real app works" (the parts the prototype can only explain). */
import { AI_AGENTS, SECURITY_NOTE } from '../demo/explanations'
import { OPEN_QUESTIONS } from '../demo/openQuestions'
import { Badge, Card, PageHeader, Table, Td } from '../components/ui'

export function OpenQuestionsPage() {
  return (
    <div>
      <PageHeader title="Open questions" subtitle="Items the spec files leave open. The prototype follows the assumption shown; markers on the screens point here. Use this list in review sessions." />
      <Card padded={false}>
        <Table head={['Question', 'Prototype assumes', 'Where it shows', 'Source']}>
          {OPEN_QUESTIONS.map((q) => (
            <tr key={q.id}>
              <Td className="font-medium">{q.question}</Td>
              <Td>{q.assumption}</Td>
              <Td className="text-xs text-muted">{q.where}</Td>
              <Td><Badge>{q.source}</Badge></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}

const DECISIONS: [string, string][] = [
  ['LLM serving', 'LM Studio on a BRAC machine, through its OpenAI-compatible API, so project data stays on BRAC machines. The same code can later talk to vLLM or Ollama.'],
  ['LLM (prototype)', 'Qwen3.5-4B, Q4_K_M quantisation (about 3 GB). Alternative: Gemma 4 E4B. Long documents are generated section by section to fit the context window.'],
  ['Speech-to-text', 'BanglaASR (Whisper small fine-tuned for Bangla), on the CPU, on 30-second chunks; the LLM then corrects the transcript.'],
  ['OCR', 'Tesseract with English and Bangla language packs; PyMuPDF for PDF text; python-docx for Word files.'],
  ['Embeddings and search', 'nomic-embed-text-v1.5 served by LM Studio; vectors in ChromaDB. Only signed or frozen versions of finished projects are indexed.'],
  ['Calls', 'LiveKit, self-hosted. The backend issues tokens; only project members can join. A Python recorder bot records each participant separately.'],
  ['Backend', 'Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL. A worker process runs one AI job at a time and APScheduler sends reminders and releases idle locks.'],
  ['Email', 'Mailpit in development (catches every email); a real SMTP server in production.'],
  ['Signing', 'Re-authentication (password or email code), the exact PDF stored with its SHA-256 fingerprint, a signature page, and the final PDF with its own fingerprint. Signed files are never regenerated. An electronic approval record, not a CCA-certified signature.'],
  ['Security', 'Permissions are checked on the server for every request. In this prototype they are only enforced in the browser.'],
  ['Exports', 'DOCX with python-docx, PPTX with python-pptx, PDF by rendering a branded HTML page with Playwright.'],
]

export function HowItWorksPage() {
  return (
    <div>
      <PageHeader title="How the real app works" subtitle="The prototype shows what the app does. These are the parts it can only explain: the technical decisions from SPEC.md and what each AI agent really does." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Technical decisions" className="lg:col-span-2">
          <dl className="grid gap-3 md:grid-cols-2">
            {DECISIONS.map(([k, v]) => (
              <div key={k} className="rounded-md bg-canvas p-3">
                <dt className="text-sm font-semibold">{k}</dt>
                <dd className="mt-0.5 text-sm text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="AI agents" subtitle={SECURITY_NOTE} className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(AI_AGENTS).map(([k, a]) => (
              <div key={k} className="rounded-md p-3 ring-1 ring-violet-200">
                <div className="text-sm font-semibold text-violet-900">{a.name}</div>
                <p className="mt-1 text-sm">{a.realApp}</p>
                {a.prototype && <p className="mt-1 text-xs text-muted">Prototype: {a.prototype}</p>}
              </div>
            ))}
          </div>
        </Card>
        <Card title="What is simulated in this prototype">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>All AI results are pre-written, shown after a short progress panel.</li>
            <li>Emails appear in the in-app Mailbox; nothing is sent.</li>
            <li>OCR and Bangla transcription show pre-written results.</li>
            <li>Calls are a mock screen (your own camera and screen share work if you allow them).</li>
            <li>Data lives in this browser only. Reset it from the clock menu.</li>
            <li>A demo clock lets you move time forward to see reminders and lock timeouts.</li>
          </ul>
        </Card>
        <Card title="What is real logic">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Who can do what, deputies and Away, one role per person.</li>
            <li>The approval chain, minor correction, Request changes, re-approval in order.</li>
            <li>Comment carry-forward and Pending check.</li>
            <li>Working-hours reminder times.</li>
            <li>The defect status flow, build release rules and sign-off exit criteria.</li>
            <li>SHA-256 fingerprints of signed versions.</li>
          </ul>
          <p className="mt-2 text-xs text-muted">This logic lives in <code>frontend/src/rules/</code> with tests, ready to move to the Python backend.</p>
        </Card>
      </div>
    </div>
  )
}
