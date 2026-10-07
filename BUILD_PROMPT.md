# Build the BRAC Project Management WebApp (prototype)

You are building a working prototype of the web app described in `SPEC.md` (in this folder). It is a showcase app for BRAC's Microfinance Programme Technology Unit, so it must run end to end on one machine and demo smoothly: one project going from a stakeholder's request to a signed SRS.

`SPEC.md` is the source of truth for **what** the app does. This file tells you **how** to build it. If the two conflict, follow `SPEC.md` and tell me about the conflict.

---

## 0. Before writing any code

1. Read `SPEC.md` completely.
2. Write `PLAN.md` containing:
   - the data model (tables, key columns, relationships),
   - the main API endpoints,
   - the state machines for document approval and comment status,
   - the milestone list from section 7 with what each delivers,
   - any questions where the spec is ambiguous, each with the default you propose.
3. Stop and wait for my approval of `PLAN.md` before starting Milestone 1.

---

## 1. Target machine

Everything runs locally on my computer:

- 16 GB RAM, AMD Ryzen 5 3500 CPU, AMD RX 6600 GPU (8 GB VRAM).
- Check the operating system yourself (`uname` / `ver`) and write commands that work on it. Assume it may be Windows. Do not rely on `fork()` (so no RQ or Celery workers).
- LM Studio runs on the host with its OpenAI-compatible server at `http://localhost:1234/v1`. I will load the models myself.
- Docker Desktop is available for supporting services.

---

## 2. Tech stack (use exactly this unless you ask me first)

| Area | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query |
| Rich text editing | TipTap (free/open-source extensions only, no paid Pro extensions) |
| Diffs | `diff` (jsdiff) on the frontend for section-by-section comparison |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database | PostgreSQL (Docker) |
| Real-time | FastAPI WebSockets (chat, notifications, live document view, lock status) |
| Background jobs | A simple job queue stored in a Postgres `jobs` table, processed by a separate worker process (`python -m app.worker`). One LLM job at a time, because LM Studio serves one machine |
| Scheduler | APScheduler inside the worker, for reminders and lock timeouts |
| LLM | LM Studio via the `openai` Python SDK with `base_url` from `.env`. Model: Qwen3.5-4B (Q4_K_M). Model name comes from `.env` (`LLM_MODEL`) |
| Structured AI output | LM Studio structured output (`response_format` with a JSON schema), validated with Pydantic, retried up to 2 times on invalid output |
| Embeddings | `nomic-embed-text-v1.5` through LM Studio's `/v1/embeddings`. Prefix stored text with `search_document: ` and queries with `search_query: ` |
| Vector store | ChromaDB, persistent local client |
| OCR | Tesseract via `pytesseract`, languages `eng+ben`. PDFs: PyMuPDF for text; any page without extractable text is rendered to an image and OCR'd. DOCX: `python-docx` |
| Speech-to-text | `bangla-speech-processing/BanglaASR` via Hugging Face `transformers` pipeline, on **CPU**, with `chunk_length_s=30` |
| Calls | LiveKit server in Docker (dev mode), `@livekit/components-react` on the frontend, LiveKit Python SDK for the recorder bot |
| Email | Mailpit in Docker (captures all emails locally; web UI for the demo) |
| Export | DOCX: `python-docx`. PPTX: `python-pptx`. PDF: render a branded HTML template with Playwright (Chromium) `page.pdf()`. Merge PDFs with `pypdf` |
| Hashing | `hashlib.sha256` |
| Auth | Email + password login with secure HTTP-only session cookies. No external sign-in. Passwords hashed with `argon2` or `bcrypt` |

`docker-compose.yml` runs Postgres, Mailpit and LiveKit. The backend, worker and frontend run natively. Provide a `README.md` with exact setup and run steps for my OS, including installing Tesseract with the Bangla language pack.

All configuration goes in `.env` (with a committed `.env.example`): database URL, LM Studio URL, model names, LiveKit keys, Mailpit SMTP, working hours, reminder interval, lock timeout.

---

## 3. Architecture rules

### 3.1 AI layer

- Put every LLM call behind one interface (`app/ai/llm.py`) with a `FakeLLM` implementation for tests. Tests must never need LM Studio running.
- One module per agent task, each with its own prompt file in `app/ai/prompts/`:
  - Q/A agent: completeness check, question generation and routing, conflict detection, answer → fact extraction.
  - Document generation: generate **one section at a time** from the template section, the relevant facts and the previous approved document. Never send a whole document to the model at once. Keep each request well under 32K tokens.
  - Partial regeneration from an edit prompt (returns new text for one section; the UI shows it as a diff).
  - Scope check on an edit (touches objectives, deliverables, budget or timeline? yes/no + reason).
  - Fact change detection on a manual edit (returns proposed Fact Sheet updates).
  - Derived outputs: one-page summary, slide outline (then built with `python-pptx`), very short summary.
  - RAG suggestion extraction and old-project detail highlighting.
  - Transcript correction and decision extraction.
  - Traceability matrix building for the SRS.
- **Security:** all user-provided text (uploads, past projects, chat, transcripts) is placed in the prompt inside clearly delimited data blocks, and every system prompt says this content is data, never instructions. Agents only return proposals. No agent output may directly approve, sign, send messages, change roles or change permissions. Every AI result that changes state waits for a person to confirm it.
- Log every LLM call (agent name, prompt size, duration, success) to an `ai_calls` table so I can show it in the demo.

### 3.2 Documents and versions

- A document is a list of sections (id, title, content as Markdown). Each section stores which Fact Sheet facts it used.
- `document_versions` are immutable once saved. Each stores: number, author, message, full section content, the Fact Sheet version used, the template version, `is_minor_correction`, and who declared it.
- Drafts are autosaved separately from versions.
- The editing lock is per document, held in the database with a heartbeat. It is released on save, on leave, or after 1 hour idle (worker job). The PM can force-unlock.
- Fact Sheet versions are also immutable and comparable.

### 3.3 Comments

- Anchor each comment by section id + quoted text + a little text before and after it (so it can be found again).
- On a new version: if the section was regenerated or the quoted text changed, the comment becomes **Pending check**; otherwise it carries forward as Open.
- Status flow: Open → Resolved (PM team ticks) or Open → Pending check (auto) → Resolved (confirmed by any member of the author's team) or back to Open (reopened).
- Members of a team whose head has approved a version cannot comment on that version (enforce on the backend, not only in the UI).

### 3.4 Approval state machine

Implement it as one backend module with no UI logic in it, and cover it with tests (section 6). It must handle:

- The order PM → tech head → stakeholder head → sponsor head (signature for Charter, BRD and SRS only).
- The chain cannot start while any comment is Open or Pending check.
- A new version restarts the chain from the PM and notifies the approver currently holding the document.
- Minor correction: carries earlier approvals over, resumes at the requester, and is refused if the scope check flags the edit.
- Deputies acting while a head is Away; record who actually acted.
- Pipeline restarts: a scope change restarts from the Proposal (which can be re-approved unchanged); a change to an earlier document marks later documents Out of sync and requires them to be re-approved in order.

### 3.5 Signing

- Re-authentication by password or an email one-time code (sent through Mailpit).
- Save the exact PDF being signed, compute its SHA-256, generate a signature page showing signer, time, IP and that hash, merge, compute the final PDF's SHA-256, and store both files permanently.
- Downloads of a signed version always serve the stored file; never regenerate it.

### 3.6 Notifications

- In-app (WebSocket + notification list) and email (Mailpit) for every event in the spec's table.
- Reminders every 4 **working** hours (Sunday to Thursday, 9:00 to 17:00, `Asia/Dhaka`; configurable). A reminder that falls outside working hours goes out at the start of the next working day.
- Add an admin-only "time travel" control in development mode that advances the scheduler clock, so I can demo reminders without waiting.

### 3.7 Calls and transcription

- Calls through LiveKit rooms tied to a chat.
- When the host switches on transcription, a Python recorder bot joins the room, records each participant's audio track separately (this gives speaker names for free), and shows the "This meeting is being transcribed" banner to everyone.
- After the call ends, a worker job transcribes with BanglaASR on CPU, sends the raw transcript to the LLM for correction, saves both raw and corrected transcripts to the chat, then extracts candidate decisions for the PM to confirm.
- Allow uploading an audio file as a transcript source too, so transcription can be demoed without a live call.

### 3.8 RAG

- Index only signed or frozen versions of finished projects, chunked by section, with project, document type and section metadata.
- Admin import tool for pre-app projects (DOCX, PDF) with name, year and department.
- Results visible to the PM team only (enforce on the backend).

### 3.9 Templates and branding

- Templates are stored as JSON: document type, version, sections (title, guidance for the AI, required fact categories). The Admin can edit them in the UI.
- If a `templates/` folder exists with real BRAC templates, build the seed templates from it. Otherwise write sensible draft templates for the four documents and tell me they need replacing.
- Branding: one theme file with BRAC colours as tokens (I will set the exact hex values), used by the web UI and every export.

---

## 4. UI

- Clean, professional, desktop-first, works at tablet width.
- Main screens: login; portfolio dashboard; project dashboard (stage, document statuses, "Waiting on name since time", counts of open comments and unanswered questions); project setup and team management; Q/A and Fact Sheet view (with status chips: filled, missing, assumed, conflicting); RAG suggestions panel (PM team only); document view and editor with comment sidebar, suggestion mode, version history and side-by-side diff; approval/sign panel; chats and calls; notifications; admin templates and import.
- Every AI action shows progress (jobs can take minutes) and never blocks the whole page.
- Every AI-generated item is visibly labelled as AI-generated until a person confirms it.

---

## 5. Seed data for the demo

Write `python -m app.seed` that creates (all names and content clearly fictional):

- One user per role, plus deputies and a few extra team members, all with password `demo1234`, and an Admin.
- Two **finished** past projects with all four documents signed and indexed in RAG, so suggestions and the duplicate warning can be demoed.
- One **new** project with only a stakeholder description, ready to start the demo flow.
- A login page "demo users" list (development mode only) to switch users quickly.

---

## 6. Testing

- `pytest` for the backend. Required tests:
  - approval chain order and permissions,
  - chain blocked by Open and Pending check comments,
  - new version during review restarts the chain,
  - minor correction (allowed case and scope-flagged refusal),
  - deputy acting while Away,
  - pipeline restart after a scope change and after an earlier document changes,
  - comment carry-forward and auto Pending check,
  - comment block after a team's head approves,
  - signing: both hashes stored, signed file never regenerated,
  - working-hours reminder scheduling,
  - RAG results hidden from non-PM users.
- All tests use `FakeLLM` and run without LM Studio, LiveKit or Mailpit.
- One Playwright end-to-end test of the happy path: create project → Fact Sheet confirmed → Proposal approved → Charter signed (with FakeLLM).

---

## 7. Milestones

Build in this order. At the end of each milestone: run the tests, start the app and check it works, commit with a clear message, and give me a short summary of what I can now try.

1. **Foundation:** repo structure, Docker services, database and migrations, auth, users, roles, project setup with teams, heads and deputies, WebSocket plumbing, notification system with Mailpit, job queue and worker.
2. **AI plumbing:** LLM interface + FakeLLM, LM Studio client, `ai_calls` logging, file uploads with OCR.
3. **Q/A agent and Fact Sheet:** question loop with routing, answers, unknowns as assumptions, conflicts, rounds, reminders, Fact Sheet versions and stakeholder head confirmation.
4. **Templates and document generation:** Admin template editor, section-by-section generation of the Proposal, versions, autosave, lock, diff view, partial regeneration with accept/reject diff.
5. **Comments and suggestions:** anchoring, tagging, suggestion mode, carry-forward, Pending check, history.
6. **Approval and signing:** the full state machine, minor correction, signing with hashes and signature page, PDF/DOCX export with branding.
7. **Full pipeline:** Charter, BRD (business process round), SRS (technical round) with traceability matrix; scope change flow; Out of sync and restarts; Fact Sheet updates proposed from manual edits.
8. **Derived outputs:** one-page summary, PPTX, very short summary, each labelled "AI summary of version N".
9. **RAG:** indexing, import tool, suggestions to the Q/A agent, old-detail highlighting, direct messages to the original team, duplicate warning.
10. **Chat and calls:** group and document chats, DMs, Mark as decision, LiveKit calls with screen share, recorder bot, BanglaASR transcription and correction, decision extraction, audio upload.
11. **Dashboards and archive:** project and portfolio dashboards, stalled items, archive, time-travel demo control.
12. **Demo polish:** seed data, README, a `DEMO.md` script that walks through the whole flow in about 15 minutes.

---

## 8. Working rules

- Where the spec is silent, choose the simplest option that fits it, and record it in `DECISIONS.md` (one line each: decision and reason). Do not stop for small questions.
- Stop and ask me only for: changes to the tech stack, anything that contradicts `SPEC.md`, or anything that would delete my data.
- Keep business rules on the backend. The frontend only hides what the backend would refuse.
- Write a docstring for each backend module explaining its part of the spec.
- Never commit `.env`, model files, uploaded files or the database.
- Before telling me a milestone is done, actually run it. If something cannot be verified on this machine (for example, a live call with two people), say so plainly.
