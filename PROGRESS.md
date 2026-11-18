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

## 3 November 2026 — the Project Owner and the PM can approve in any head's place

- New rule: the chain is unchanged, but the Project Owner and the PM can approve, sign, request changes, confirm the Fact Sheet and confirm the test case lists for any head. Each record says who acted for whom ("Project Manager, for the stakeholder head (Rokeya Begum)"), including the signed PDF's certificate; the head is told in-app.
- A missing head no longer stops sending a document, the Fact Sheet confirmation or testing: the step waits on the PM and moves to the head when one is added.
- Fixed: summaries and slides failed when the model answered with bullet points only.
- Checked: 99 tests pass (8 new), production build passes. In the browser on a separate test data file: as Nusrat, approved the BRD for the stakeholder head and signed it for the sponsor head (approval list, audit log, notices, approval record and certificate checked); sent a new version with no sponsor head (blue note, "No sponsor head yet" step); the Simple view's status sentence; making Selim sponsor head moved the waiting step to him. The summary fix was checked against the model's real answers for the Agami Update proposal.
- Not checked in the browser: confirming the Fact Sheet and a test list in a head's place (same rule; covered by tests).

## 5 November 2026 — the Project Owner's master key

- In a project they own, the Project Owner may do anything any member may do: answer questions, edit, approve and sign, confirm, write tests, register builds, create runs, record any tester's result, raise and triage defects, mark fixed, check fixes, release to UAT, close or reopen, the PM's outcomes, send and approve sign-offs. The same checks still apply to them. Records say "(Project Owner)".
- The Owner's To do has **You can also do, as Project Owner** and My work an **As Project Owner** tab: everything waiting for others in their projects, without reminders.
- Checked: 108 tests pass (9 new, in `src/rules/owner.test.ts`), type-check passes. In the browser on a separate test data file, as Imran: the "You can also do" list (6 groups, whose turn each is); answered a question sent to the sponsors from the Questions tab ("Imran Chowdhury (Project Owner)", also as the fact's source); "Run for Habib" recorded a test result ("recorded by … (Project Owner)", Habib told); and through the api: closed a retest, confirmed a decision, took the edit lock, approved for the stakeholder head, checked a UAT fix, created an SQA run; deferring a Critical defect was still refused.

## 5 November 2026 — glass look (iOS / macOS style) for the Simple and Full views

- A soft coloured background; frosted glass sidebar (Full) and floating top bar (Simple); frosted menus, dialogs, chat dock, toasts and AI cards; translucent cards; pill buttons and iOS-style switches and tabs; a near-solid "sheet" for document text. Light and dark.
- Profile menu → **Look: Glass / Solid** (Solid = no transparency or blur); the computer's "reduce transparency" setting is followed too. Exports are unchanged.
- Fixed on the way: in dark mode the "What changed since version N" box had dark text on a dark background.
- Checked: 108 tests pass, type-check passes. Screenshots (headless Chrome, on a separate test data file) of the Simple To do, the Full home, a Full document page, the defects board, dark mode and the login page; computed styles for the glass materials, the Solid look, contrast (body text 14:1, secondary text 5.0:1 on cards), and no sideways scrolling at phone width in either view at every text size.

## 11 November 2026 — simpler SQA and UAT: testing points, versions, PASS / FAIL

- New testing page (both views): version picker and **Add a version**; points with **PASS** / **FAIL** and an optional comment, filters, history per point; **Write points with AI**, **Add a point**, edit, **Regenerate** (AI), delete; requirements covered; Sign-off tab for the chosen version.
- Removed: test cases, list confirmation, builds and release to UAT, test runs and assignments, Blocked, the defect board and defect page (old defect links open UAT testing), the defect settings in Admin, and the drag-and-drop package.
- To do / My work: "Check N points on version X" for testers, "Fix N failed points" for developers. Dashboard: failed testing points.
- Old data is converted when loaded (`src/demo/migrate.ts`); the demo project's testing data was rewritten in the new shape.
- Checked: all tests pass (new tests for the rules, the AI point parsing and the conversion), type-check and build pass. In the browser on separate test data: a copy of the real data (converted correctly; PASS with comment, FAIL, a new version resets every point to To check, an older version keeps its results, adding or editing a point, sign-off criteria per version) and the demo projects (stakeholder and developer To do, signed-off SQA shows its signed version, phone width with no sideways scrolling). LM Studio was off, so writing and regenerating points with the AI was checked by unit tests only.

## 16 November 2026 — a calmer, more professional Simple view

- Plain neutral background, white cards with thin borders, smaller corners, solid main buttons; glass kept on the top bar, action bar and menus; product name next to the logo; neutral active tab and Demo button. Simple view only.
- To do as a work queue (task, project, waiting label in grey / amber / red, button); Projects as one list with a progress bar per project; "Your next step" as a white card with a magenta edge.
- Checked: type-check and tests pass. In the browser on separate test data: To do, Projects, a project page and a document page at desktop width; To do at phone width (no sideways scrolling) and in dark mode; switching to Full removes the calmer look.

## 16 November 2026 — documents in the Simple view

- Paper sheet with letterhead, status stamp, numbered sections and an approval record with the signature; a contents list with changed / comments / AI markers; one slim status bar with the approval steps; "Show changes since version N" marks edits in the text.
- Checked: type-check and tests pass. In the browser on separate test data: the Branch Cash BRD as the deputy (bar, contents markers, letterhead, approval record, changes switch, contents jump), the signed Loan Repayment Proposal & Charter (Signed stamp, Proposal and Charter titles, signature line), and phone width (no sideways scrolling, Contents opens as a pop-up, comments open). Screenshots were not possible because the browser pane was hidden; the checks read the page itself.

## 17 November 2026 — Simple view: project bar

- A project bar under the top bar on every project page: a project switcher that keeps your place, and tabs for Overview, the three documents, Questions & facts, Testing and More, each with a status dot and a count of what waits for you.
- Checked: type-check and tests pass. In the browser on separate test data: the bar on a document, the overview, Questions & facts and Team (More highlighted), not on To do or Projects; switching from Branch Cash's BRD to Member Savings opened Member Savings' BRD; Testing opened UAT; the More menu; laptop width (all tabs on one row) and phone width (no sideways page scroll, current tab in view).

## 17 November 2026 — Simple view: work-app header and project header

- Flush full-width top bar with underline tabs; a project header with breadcrumb switcher, step progress and underline tabs with icons and counters; left-aligned pages; an About panel on the overview.
- Checked: type-check and tests pass. In the browser on separate test data: overview and BRD at laptop width, overview at phone width (no sideways page scroll, faded tab edge).

## 17 November 2026 — Simple view: simpler top bar

- Logo and name, the four places, a Demo icon and the avatar; Simple / Full is in the avatar menu.
- Checked: type-check and tests pass; on separate test data the menu's View switch goes to Full and back; no sideways scrolling at phone width.

## 17 November 2026 — Simple view: overview without the document list

- Your tasks here, a progress timeline of the six steps and recent activity, with the About panel; no repeated document list.
- Checked: type-check and tests pass; on separate test data the Member Savings overview (testing step "Now") and Branch Cash (BRD in review) at laptop width, and Branch Cash at phone width.

## 18 November 2026 — Simple view for people over 35

- Larger default text (17px), 14px minimum, darker secondary text (7:1+), 44px targets, words next to icons, messages that stay until read, visible keyboard focus, underlined links, reduced motion.
- Checked: type-check and all tests pass. Not yet checked in the browser: the laptop had only 0.3–0.4 GB of memory free, so the preview could not load the app.

## 18 November 2026 — one bar inside a project

- The project and its tabs are part of the top bar (two lines, one bar).
- Checked in the browser on separate test data (memory allowed it this time): the merged bar on the BRD at laptop width, Hide / Menu, the testing page's Edit / Rewrite / Delete buttons (47px tall), 17px text; at phone width no sideways scrolling, the project name shortened with "…".
