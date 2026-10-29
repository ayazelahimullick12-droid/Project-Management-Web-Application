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

## 27 October 2026 — Simple view (less to take in per page), with a Simple / Full switch

- Supervisor feedback: most users are over 35 and use the app now and then; there was too much on each page and navigation was hard.
- New **Simple view** (default), in `src/simple/`: a top bar with To do · Projects · Messages · Help; one job per page; plain words; text of at least 16px, large buttons; one status sentence, one "Your next step" box, at most one notice, and the main buttons in a bar at the bottom; everything else under More.
- Pages built for the Simple view so far: To do (Home), Projects, Project, Document (reading, reviewing, approving), Questions (one at a time), Help. Other pages open their Full version inside the Simple frame.
- **Simple | Full** switch in the top bar (Simple) and the sidebar (Full), and in Ctrl+K; it keeps you on the same page. Text size setting (A / A+ / A++); light colours by default; with larger text the top bar moves its four places to a second row.
- The Full view is unchanged apart from the switch and the shared menus. In the Simple view there are no floating chat windows: chats open on the Messages page.
- Checked: 65 rule tests pass, production build passes; To do, Projects, Project, Document (as PM and as deputy reviewer), Questions (answering, "I don't know"), Messages, the switch in both directions, dark mode, larger text and the phone layout were checked in the browser.
- Next: Simple versions of intake, testing (one test at a time), problem reports, and Messages without hover-only actions.

## 29 October 2026 — start a project alone; Proposal & Charter in one step

- One person can start a project and becomes Owner and PM. The app stops before a step that needs people (questions, Fact Sheet confirmation, approval, testing) and offers **Add**; the whole approval chain is checked before sending. Away asks for a deputy. One person may hold several roles, with a warning.
- The Proposal and the Charter are one package: one approval round, the sponsor signs; Simple view tabs Proposal · Charter · Slides; PDF and Word for the whole package or either part. The pipeline has 7 steps.
- Checked: 78 rule tests pass, production build passes; starting alone and the Add buttons were checked in the browser.

## 29 October 2026 — one JSON file and real AI (LM Studio)

- The data now lives in `frontend/data/db.json` behind a small Node server; several tabs share it and update each other live. `npm run dev` for development, `npm start` to run the built app. Starts empty; Demo → Start again → With demo projects.
- Real AI with LM Studio (`qwen2.5-coder-0.5b-instruct`, switchable in Admin → Settings): fact extraction, Q/A questions, Proposal & Charter, BRD and SRS, Rewrite with AI, scope check, change-request rewrites, summaries and slides, test cases, defect writer, sign-off paragraph, decision suggestions. Embeddings (`nomic-embed-text`) for similar projects, duplicate defects and decisions. Still simulated: OCR, transcription, email.
- Documents are short on purpose (about 200 words). Measured on this laptop: Proposal & Charter 18 s, BRD 20 s, SRS 17 s, facts 10–13 s (about 30 s with an upload), a question 1 s, a rewrite 5 s, a scope check 3 s, a test case 5 s, a defect write-up 6 s, similar projects 1.5 s, summary and slides 15–25 s in the background.
- When LM Studio is off, the action stops with a clear message; nothing is changed.
- Fixed on the way: the server answered an API request and then tried to answer it again (`npm start` crashed).
- Checked: 91 tests pass (78 rules, 13 reading AI answers), production build passes, `npm start` serves the app. In the browser with LM Studio: a project started alone and taken through intake, questions, Fact Sheet, Proposal & Charter, BRD and SRS (all signed), Rewrite with AI, the scope check, test cases, the defect writer, summaries and slides, similar projects with the duplicate warning, a text upload with a conflict, decision suggestions, the AI-off message, two tabs as different people, Admin AI settings and AI activity.
- Not checked in the browser: the change-request rewrite through its page (the agent was checked on its own), the SQA/UAT sign-off paragraph.
