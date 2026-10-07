# Progress

## 7 October 2026 — clickable prototype, all six slices

Built in one go (as agreed) in `frontend/`. Everything in `SPEC.md` and `SPEC_SQA_UAT.md` can be
clicked through or is explained in the app; see `SPEC_COVERAGE.md` for the full checklist.

**What works**

- Slice 1 — Shell, projects and teams: login with demo users, user switcher, dashboards with the
  portfolio view, new project wizard, team management (heads, deputies, Away, SQA tags, templates,
  replace), archive, audit log, Open questions and How the real app works pages.
- Slice 2 — Intake: description, uploads with simulated OCR, intake analysis, conflicts, RAG
  matches with duplicate warning, suggestions with old-detail checks and credit labels, routed Q/A
  rounds with “Unknown”, round limit, Fact Sheet versions with compare and restore, confirmation.
- Slice 3 — Documents: AI generation section by section, TipTap editor with autosave, edit lock
  and force-unlock, AI rewrite with diff, scope check, fact-change proposals, comments with
  @tags, Pending check, suggestions, history, compare, restore, summaries and slides,
  traceability, Out of sync, change requests, template versions.
- Slice 4 — Approval and signing: full chain, Request changes, minor correction, deputies,
  reassignment, signing with password or email code, SHA-256 fingerprints, certificate page,
  PDF / DOCX / PPTX exports.
- Slice 5 — SQA and UAT: test cases with AI drafting and coverage, list confirmation, builds and
  release rules, runs and My tests, defect board and defect pages, AI defect writer, duplicates,
  exit criteria, generated sign-off reports, SQA and UAT sign-off chains.
- Slice 6 — Chat (project, document, direct, cross-project), simulated calls with transcription,
  transcripts, decisions queue, notifications with email previews, working-hours reminders, time
  travel, Admin (templates, users, settings, import, AI activity, audit).

**Checked**

- 65 rule tests pass (`npm test`).
- Production build passes (`npm run build`).
- The Field Loan project was driven from intake to **Complete** (Proposal approved, Charter,
  BRD and SRS signed, SQA and UAT signed off), plus a change request on Branch Cash, reminders
  with time travel, the lock timeout, a call with transcription and the import tool — with no
  errors.

**Simulated (by design)**

AI results, OCR, transcription, emails (Mailbox), calls (mock screen), embeddings search,
security (enforced only in the browser). See **How the real app works** in the app.

**How to try it**

```bash
cd frontend
npm install
npm run dev
```

Then follow `frontend/DEMO.md`.

**Next**

- Review with BRAC using the Open questions page; replace the placeholder templates and colours.
- When ready: build the FastAPI backend (`BUILD_PROMPT.md`, `BUILD_PROMPT_SQA_UAT.md`) and move
  `frontend/src/rules/` into it.
