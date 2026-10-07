# Build the clickable prototype (frontend only)

Oct 7, 2026 · Plan for review

This file describes a **clickable prototype** of the BRAC Project Management WebApp. Every feature in `SPEC.md` and `SPEC_SQA_UAT.md` can be clicked through, using dummy data that is already loaded. There is no backend, no database and no real AI.

**What it is for:**

- Showing BRAC what the app will do and how each feature works.
- Checking the spec: people click through and say what is wrong before the hard parts are built.
- Being the starting point for the real frontend later.

**What it is not:** a working system. No real AI, no real email, no security, and the data lives in the browser. Never put real project data in it.

---

## 0. Sources

| File | Used for |
| --- | --- |
| `SPEC.md` | What features exist and the rules they follow |
| `SPEC_SQA_UAT.md` | The SQA and UAT stages |
| `BUILD_PROMPT.md` | Only the frontend parts: frontend stack, UI (section 4), branding, demo users |
| `BUILD_PROMPT_SQA_UAT.md` | Only the UI section and the seed data ideas |

If the prototype has to simplify a rule, it is recorded in `DECISIONS.md` (one line: decision and reason).

---

## 1. What is real and what is simulated

| Real (works as it will in the final app) | Simulated |
| --- | --- |
| Every screen, menu and page | All AI results: pre-written, shown after a short "AI is working" progress panel |
| Switching between demo users to see each role's view | Emails: shown as in-app previews instead of Mailpit |
| Approval chain, minor correction, deputies acting while a head is Away | OCR and Bangla transcription: pre-written results |
| Comments, tagging, Pending check, carry-forward to new versions | Video and voice calls: a mock call screen |
| Document editor, versions, autosave, compare, restore | Embedding search for similar projects: pre-chosen matches |
| Edit lock and force-unlock | Password and one-time code checks: any value is accepted |
| Q/A rounds, Unknown answers, conflicts, Fact Sheet versions | Security: buttons are hidden by role, but nothing stops a determined user |
| Defect board, test runs, builds, sign-off checklists | Waiting time: a "time travel" control moves the clock forward |
| Notifications list and working-hours reminder times | |
| SHA-256 fingerprints of a signed version, before and after the signature page (calculated in the browser on the stored copy, not on PDF bytes) | |
| PDF export (browser print view), DOCX and PPTX export (generated in the browser) | |

Every simulated AI action shows a short note explaining what the real app would do, for example: *"In the real app, the AI reads the confirmed Fact Sheet and the signed Charter and writes the BRD one section at a time. This prototype shows a pre-written BRD."* AI results are labelled **AI-generated (simulated)**.

A badge in the top bar always says **Prototype · dummy data**.

Some parts of the spec can only be explained, not shown: the technical decisions (LM Studio, the models, BanglaASR, OCR, embeddings, LiveKit) and the AI security rules. They are covered on a **How the real app works** page in plain language.

---

## 2. Tech stack

The same frontend stack as `BUILD_PROMPT.md`, so this code can grow into the real frontend:

| Area | Choice |
| --- | --- |
| App | React + TypeScript + Vite |
| Styling | Tailwind CSS, with BRAC colours as tokens in one theme file |
| Pages | React Router |
| Data loading | TanStack Query (screens ask for data the same way they will when the real backend exists) |
| Editor | TipTap, free extensions only. Comments and suggestions use a small custom mark, not TipTap's paid extensions |
| Compare | `diff` (jsdiff), section by section |
| Defect board | `@dnd-kit/core` |
| Exports | Browser print view for PDF, `docx` for Word, `pptxgenjs` for PowerPoint |
| Fingerprint | The browser's built-in Web Crypto SHA-256 |
| Rule tests | Vitest |

Nothing else needs installing apart from Node.js (already on the laptop: v24). It runs comfortably on the 8 GB laptop.

---

## 3. How the code is organised

```
frontend/
  seed/                 all dummy data; edit these to change what the demo shows
    users.json
    projects.json       projects, teams, heads, deputies, stages
    intake/             Q/A questions, answers, facts, RAG matches, per project
    documents/          one Markdown file per document version, per project
    testing/            test cases, builds, runs, defects, per project
    chat/               messages, transcripts, decisions
    ai/                 the pre-written AI results, per project and action
  src/
    api/                the only way screens read or change data
    rules/              the business rules as plain functions (with tests)
    demo/               everything simulated: browser storage, reset, fake AI, time travel
    pages/              one folder per screen
    components/         shared pieces (buttons, tables, chips, panels)
    theme/              BRAC colours and fonts
  DEMO.md               the demo script
  README.md             how to install and run
```

Three folders matter most for understanding and later upgrading:

- **`src/rules/`** holds real logic: approval order, comment carry-forward, defect status flow, permissions, working hours. Each file starts with a comment naming the part of the spec it follows. These move to the Python backend later, and their tests show exactly what to move.
- **`src/demo/`** holds everything fake. It is deleted when the real backend arrives.
- **`src/api/`** is the bridge. Today it reads and writes the browser copy of the data; later it calls FastAPI. The screens don't change.

### Data and reset

- On first load, the app copies everything in `seed/` into the browser's storage. Every click changes that copy.
- **Reset demo** (top bar) restores the original seed data.
- If the seed files change, the app resets automatically on the next load.
- Two tabs in the same browser stay in sync, so "X is editing" and the live read-only view can be shown with two windows side by side.

---

## 4. Demo users

One cast of fictional people, with different roles in different projects. All are listed on the login page; anyone can switch user from the top bar at any time without logging out.

| Person (fictional) | Typical role |
| --- | --- |
| Admin | Admin |
| Project Owner | Owner of every demo project |
| Project Manager, plus a deputy | PM team head |
| Two PM team members | PM team |
| Tech head, plus a deputy | Tech team head |
| Two developers | Tech team |
| Two SQA testers | Tech team, tagged SQA |
| Stakeholder head, plus a deputy | Stakeholder team head |
| Two stakeholders | Stakeholder team |
| Sponsor head, plus a deputy | Sponsor team head |
| One sponsor | Sponsor team |
| Two members of past projects | Shown in RAG results and cross-project messages |

---

## 5. Demo projects

Projects are parked at different stages, so any feature can be shown immediately, without walking the whole flow first. All names and content are fictional and microfinance-flavoured.

| Project | Stage | Use it to show |
| --- | --- | --- |
| **Field Loan Application App** | Intake, just created | The full walkthrough from the stakeholders' description to UAT sign-off. Every AI step has pre-written content ready. Also the duplicate warning. |
| **Branch Cash Reconciliation** | BRD in review | Comments, Pending check, suggestions, versions, compare, approval chain mid-way, minor correction, a head Away with a deputy acting |
| **Member Savings Statement Portal** | UAT | Test cases, builds, runs, the defect board in every status, SQA sign-off done, UAT sign-off checklist |
| **Field Collection Tracker** (2024) | Complete | Past project for RAG matches and the duplicate warning |
| **Loan Officer Performance Dashboard** (2025) | Complete | Second past project for RAG matches |

Documents are realistic but short (about 1–2 pages each), following draft templates for the four document types. Projects created during a demo get generic pre-written content with the new project's name filled in.

---

## 6. Screens, in build order

Built in six slices. Each slice is clickable when done.

### Slice 1: Shell, projects and teams

- Login page with the demo users list; user switcher, notification bell, Reset demo and the prototype badge in the top bar
- Portfolio dashboard: all projects, stalled items sorted by waiting time
- Project home: stage tracker (Intake → Proposal → Charter → BRD → SRS → SQA → UAT → Complete), document cards with status and "Waiting on (name) since (time)", open items, team
- New project wizard: details → PM → teams, heads and deputies → invite
- Team management: replace members, heads and deputies (a pending approval moves to the new head on the same version); SQA tag; team templates; one-team-per-person block
- Away: a head, or the Owner for them, marks Away with start and end dates. While Away, their approvals, signatures, Q/A questions and reminders go to the deputy
- Archive
- Audit log
- **How the real app works** page (see section 1)
- **Open questions** page (see section 7)

### Slice 2: Intake, Q/A and Fact Sheet

- Stakeholder description and file uploads (simulated OCR result shown)
- RAG panel (PM team only): similar projects, why they matched, their members, View full document, suggestions to accept or reject, old-project details to confirm or replace, duplicate warning with Acknowledge
- Questions routed by team; **My questions** inbox; answering, including "Unknown" as an assumption
- Conflict resolver for the PM
- Rounds, and the PM's "ask again or proceed" choice after the round limit
- Fact Sheet table with status chips (filled, missing, assumed, conflicting), sources, credit labels, and which templates need each field
- Fact Sheet versions with compare and restore; stakeholder head confirmation
- The same Q/A screens are reused for the extra rounds before the BRD (business processes) and the SRS (technical, answered by the tech team), and for change-request questions about what changed

### Slice 3: Documents

- Document page: read-only live view, or the editor for the PM team
- Edit lock: "X is editing", idle timeout (through time travel), force-unlock by the PM; AI regeneration takes the lock too
- Autosaved draft; **Save version** with a message
- AI regenerate a part: edit prompt → diff → accept or reject
- Scope check result on save; PM decides normal edit or scope change
- Proposed Fact Sheet updates from a manual edit
- Comments sidebar: highlight and comment, @tags, tick, Pending check, confirm or reopen, resolved log, comment block after a team's head approves
- Suggestion mode: propose wording; PM team accepts or rejects
- Version history; compare any two versions side by side, section by section; restore
- Derived outputs tab: one-page summary, slide preview, very short summary, each labelled "AI summary of version N" and each exportable
- Traceability tab (SRS)
- Out of sync: banner on later documents; the PM picks which affected sections to regenerate
- Change requests: questions about what changed only, Fact Sheet update, impact list, affected sections regenerated as diffs, pipeline restart from the Proposal (re-approving it unchanged when it needs no edit), status on the dashboard until closed
- The template version the project uses, and the PM's option to switch to a newer one

### Slice 4: Approval and signing

- Approval panel: whose turn, Approve, Request changes (comment required), blocked while comments are open or pending check
- New version during review restarts the chain and notifies the approver
- Minor correction: declare, AI scope check, refusal when scope is touched, approvals carried over, diff for the requester, "Minor correction" label in the history with who declared it
- Deputy acting while a head is Away ("Approved by deputy X for head Y")
- A head replaced mid-chain: the pending step moves to the new head on the same version
- Approve and Sign: re-authentication (password or one-time code shown as an email preview), both fingerprints, the signature page (signer, time, IP address, fingerprint), frozen and signed states, labelled as an electronic approval record, not a certified digital signature
- A signed version always opens its stored copy; it is never rebuilt from current data
- Exports: PDF (print view, with signature page for signed versions), DOCX, PPTX

### Slice 5: SQA and UAT

- Test cases: list, coverage view, Not testable, AI drafting, list confirmation by the head
- Builds: register, what each fixes, Release to UAT with the reason when it is not allowed
- Test runs: create, assign, progress; **My tests** inbox; recording Pass, Fail, Blocked with notes and files
- Defects: board (drag between allowed statuses), list with filters and shortcuts, defect page with comments, files and history; AI defect writer; possible duplicates
- Sign-off: exit criteria checklist, generated report, SQA approval by the tech head, UAT chain and sponsor signature
- Fail must link to a defect; Blocked needs a reason
- Extended traceability matrix (requirement → test cases) and test case change history
- Changes during testing: linked test cases marked Needs review, approved sign-offs marked Out of sync
- SQA and UAT statuses and counts added to the project and portfolio dashboards

### Slice 6: Chat, calls, notifications and admin

- Project chat, document chats, direct messages, cross-project messages to past project members
- Mark as decision; PM decision queue (confirm into the Fact Sheet, or start a change request)
- Mock call screen: voice or video, screen share toggle, transcription switch and banner; after the call, raw and corrected transcripts in the chat and candidate decisions in the queue; audio upload
- Notifications centre with email previews, covering every event in the notification tables of both spec files; reminders at working-hours times (to the deputy while a head is Away); time travel control
- Admin: template editor, legacy project import, users, settings (working hours, reminder interval, round limit), AI activity log (simulated entries showing what the real app would record)

---

## 7. Rules built into the prototype

These live in `src/rules/` as plain functions with Vitest tests:

- **Permissions:** what each role can see and do in a project (decides which buttons appear).
- **Approval chain:** order, Request changes, restart on a new version, minor correction, deputies, sponsor signing for Charter, BRD and SRS.
- **Comments:** carry-forward when the quoted text is unchanged and the section was not regenerated; otherwise Pending check; confirm or reopen by the author's team; no comments after the team's head approved that version.
- **Pipeline:** document order, Out of sync, restart from the Proposal after a scope change.
- **Q/A:** rounds, Unknown as an assumption, conflicts.
- **Working hours:** reminder times, Sunday to Thursday, 9:00 to 17:00 Bangladesh time. A reminder is due after 4 hours of **working time** (time outside working hours is not counted).
- **Testing:** defect status flow, build release to UAT, exit criteria.
- **Deputies and reassignment:** while a head is Away (between the start and end dates), their approvals, signatures, Q/A questions and reminders go to the deputy, and every action records who acted for whom. Replacing a head moves their pending approval to the new head on the same version.

### Open questions from the spec

Both spec files end with open items. The prototype follows the default for each, and shows a small **Open question** marker on the screens where it applies, with the question and what the prototype assumes. An **Open questions** page lists them all, so they can be discussed during a review.

| Open item | What the prototype assumes |
| --- | --- |
| Escalation of stalled approvals to the Owner | Off |
| Reopening an archived project | Not possible |
| Archiving before the SRS is signed | Allowed |
| Owner also in a team | Allowed, still one team only |
| Stakeholders or sponsors from outside BRAC | Allowed, signing with an email one-time code |
| Q/A rounds before the PM decides | 3 |
| Working hours | Sunday to Thursday, 9:00 to 17:00 |
| Deputy sponsor | Can sign while the sponsor head is Away |
| SQA and UAT open items | The defaults in `SPEC_SQA_UAT.md` |

---

## 8. AI simulation

- Every AI button opens a **progress panel** with realistic steps ("Drafting section 3 of 9: Business requirements"). It takes a few seconds and never blocks the rest of the page. A setting makes it faster for live demos.
- The result is pre-written content from `seed/ai/`, labelled **AI-generated (simulated)** until a person accepts or edits it.
- An **"In the real app"** note explains what the real AI would read and produce.
- Free-text AI prompts (such as "rewrite this section to be shorter") always return the prepared result. `DEMO.md` gives the prompts to type so the results make sense.

---

## 9. Look and feel

- Clean, professional, desktop-first, works at tablet width.
- BRAC colours as tokens in one theme file. Placeholder colours until you set the exact values. Logo placeholder.
- Consistent status chips and colours across documents, facts, approvals, tests and defects.
- Empty states and short help text on every screen, so it can be explored without a guide.

---

## 10. How I will work

- Build one slice at a time. After each slice: run it, click through every screen in it, write what you can now try in `PROGRESS.md`, and stop for your review.
- Keep a **`SPEC_COVERAGE.md`** checklist: every feature and rule in `SPEC.md` and `SPEC_SQA_UAT.md`, each with where it can be seen (screen and demo project), or "explained only" and where it is explained. Update it after every slice. An item is ticked only when it can actually be clicked.
- Initialise a Git repository in this folder and commit after each slice, so every step can be undone.
- Keep the code easy to read: small components, one folder per screen, plain names, a comment at the top of each rules file pointing to the spec section.
- Do not change `SPEC.md`, `BUILD_PROMPT.md` or the two SQA/UAT files.

**To run it** (written fully in `README.md`):

```
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` produces static files that can be put online as a link.

---

## 11. Later: turning it into the real app

1. Build the FastAPI backend from `BUILD_PROMPT.md`.
2. Move the rules from `src/rules/` into the backend, using their tests as the checklist.
3. Point `src/api/` at the backend instead of the browser copy.
4. Delete `src/demo/` and the simulation notes.

The screens stay the same.

---

## Decisions to check

- [ ] Stop for your review after every slice? (Proposed: yes.)
- [ ] Git repository in this folder, one commit per slice? (Proposed: yes.)
- [ ] Reminders count only working hours, rather than clock hours held until the next working day? (Proposed: working hours only.)
- [ ] Project subjects and names in section 5 are fine for the demo? (All fictional.)
- [ ] Placeholder BRAC colours until you give the exact hex values? (Proposed: yes.)
