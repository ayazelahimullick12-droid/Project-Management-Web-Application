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

## 11 October 2026 — streamlined layout

- New shell: Home, My work, Inbox, Messages, then projects (only the open one expanded); help and prototype pages grouped at the bottom; Ctrl+K quick switcher.
- Home leads with "Waiting on you" (grouped) and each project's next step; the project page leads with one next-step card and a simple document list.
- Document page: one main action in the header, a Google Docs-style page, and a rail with Comments and a GitHub-style reviewer list.
- Statuses shown as small coloured dots; sentence-case titles; prototype notes off by default (clock menu → Show prototype notes).
- Checked again: 65 rule tests pass, production build passes, every page renders for each role.

## 11 October 2026 — current-style UI, new Home dashboard, chat everywhere

- Look and feel: Inter font, the page in a rounded panel next to the sidebar (Linear/Vercel style), softer cards, skeleton loading, toasts at the top, and **dark mode** (Light, Dark or System, in the profile menu). Colours for both modes live in `src/theme/brand.ts`.
- Sidebar: app name with the notification bell, search, Home / My work / Inbox / Messages (with unread counts), projects with coloured icons, and the demo clock and profile menu at the bottom.
- Home: number tiles, "Waiting on you" with age chips, recent conversations, project cards (health, progress ring, next step, heads), a 14-day activity chart and feed; pipeline and stalled items for the Owner and Admin.
- Chat is no longer a project page: a chat dock at the bottom right of every page opens conversations in small windows (LinkedIn/Messenger); the Messages page is a three-pane view (Slack). Group channels and direct messages have different layouts; reactions, @mentions with suggestions, unread counts, "Seen", date separators and a call banner were added. Discuss buttons on the project overview and documents; the overview shows the latest messages with a reply box.
- Seed: `seed/messages.json` adds direct messages and unread markers; project messages can carry reactions.
- Checked: 65 rule tests pass, production build passes; dashboard, Messages (channel and DM), dock windows, calls, light and dark mode and the phone layout were checked in the browser.

