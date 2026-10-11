# Spec coverage

Every feature and rule in `SPEC.md` and `SPEC_SQA_UAT.md`, and where to see it in the prototype.

- `[x]` can be clicked in the prototype · `[~]` partly, see the note · `[e]` explained only (on **How the real app works**)
- Projects: **Loan** = Field Loan Application App (walkthrough), **Cash** = Branch Cash Reconciliation, **Savings** = Member Savings Statement Portal, **Past** = the two finished projects.

## Roles and permissions

- [x] Roles per project; Admin system-wide — Team page; Admin menu (Farhana Kabir)
- [x] One head per team; one role per person (blocked in the wizard and on the Team page) — New project, Team
- [x] One deputy per head, including the PM — Team page (all projects)
- [x] Deputy acts while the head is Away; “Approved by deputy X for head Y” — Cash → BRD (Jahid Hasan); approval history, audit log
- [x] Permission matrix enforced in the api layer (not only hidden buttons) — every action; refusals appear as messages
- [x] Comment and suggest only until the team’s head has approved that version — any document after the tech head approves (log in as a developer)
- [x] Confirm or reopen an auto-resolved comment: members of the author’s team — Pending check comments in the sidebar
- [~] Server enforcement — enforced in `src/api` in the browser; real security needs the backend `[e]`

## Project setup

- [x] Wizard: details → PM → teams, heads, deputies → invite (in-app + email) — New project
- [x] Members from the user directory; one-team block — New project, Team
- [x] Team templates (load in wizard, save from Team page)
- [x] Reassigning: replace member, head or deputy; pending approval moves to the new head on the same version — Team → Replace / make head
- [x] Away with start and end dates, set by the head or the Owner; deputy gets approvals, signatures, questions and reminders — Team → Away; Cash (Rokeya Away)

## Q/A agent and the Fact Sheet

- [x] Inputs: description, uploads with OCR, RAG items, answers, transcripts and chat decisions — Loan → Intake; Changes & decisions → Decisions
- [x] Required-fields checklist from all four templates; filled, missing, assumed, conflicting — Intake → Fact Sheet (“Needed by” column)
- [x] Routing: business → stakeholders, funding → sponsors, technical → tech team — Intake → Q/A questions; My work → Q/A questions
- [x] “Unknown” stored as an assumption with an agreed default — answer funding source as Unknown
- [x] Conflicts flagged; the PM settles — Loan (number of users) → Settle
- [x] Round limit; PM decides ask again or proceed with gaps logged — Intake → Q/A questions (limit in Admin → Settings)
- [x] Reminders every 4 working hours for unanswered questions — clock menu → time travel; Notifications
- [x] Each fact: value, category, source, status; versioned, compared and restored — Intake → Fact Sheet
- [x] Stakeholder head confirms before the Proposal; can comment on what is wrong — Intake → Fact Sheet
- [x] Manual edit changes a fact → AI proposes a Fact Sheet update; PM team accepts (new version); scope change → change request — Cash → Change requests; any document edit
- [x] Extra rounds: business processes before the BRD, technical (tech team) before the SRS — Intake page banner after the Charter / BRD is signed
- [~] Sources are shown as labels, not clickable links to the exact page or message

## RAG agent

- [x] Only finished projects and their signed or frozen versions — Past projects; import tool
- [x] Admin import of pre-app projects (name, year, department, members, Word/PDF) — Admin → Import past projects
- [x] PM team only — Intake → Similar projects (other roles do not see the tab; the api refuses)
- [x] Per project: name, summary, why it matched, members, matching sections, View full document — Loan → Similar projects
- [x] No outcome information shown
- [x] Suggestions accepted or rejected; old-project details confirmed or replaced; credit “From Project X (PM: name)” — Loan → Similar projects, Fact Sheet
- [x] Accepted items reduce questions — Loan (5 questions instead of 7)
- [x] Direct message to a past project member (sees that conversation only); deactivated accounts unavailable — Similar projects → Message; Rashed Kabir shows unavailable
- [x] Mark as decision in these messages — Direct messages
- [x] Duplicate warning with the past PM as contact; Acknowledge required and logged — Loan → Similar projects
- [e] Embeddings in ChromaDB, real similarity search

## Document pipeline

- [x] Fixed order; each starts after the previous is approved or signed — every project
- [x] Generated from the Fact Sheet + earlier documents, section by section — Loan → Generate with AI (progress per section)
- [x] Scope change restarts from the Proposal; unchanged Proposal can be re-approved — Change requests; “Send for re-approval (unchanged)”
- [x] Change to an earlier document marks later ones Out of sync; PM picks sections to regenerate; re-approval in order — edit a frozen Proposal in Cash
- [x] Derived outputs for every version: one-page summary, PPTX, very short summary, labelled “AI summary of version N” — Summaries and slides tab
- [x] SRS traceability matrix with unlinked items flagged — Savings → SRS → Traceability; Loan after the SRS (SR-08 is flagged)
- [x] Admin maintains templates; projects keep their version; PM can switch — Admin → Templates; document page notice
- [x] Export PDF, DOCX, PPTX with branding — document header buttons; Summaries tab
- [~] The very short summary has no file export (shown in the app)

## Approval and signing

- [x] PM → tech head → stakeholder head; sponsor head signs Charter, BRD, SRS — approval panel
- [x] Chain starts only with no open comments and no comments pending check — try Send for approval with an open comment
- [x] Turn notifications and reminders every 4 working hours — Notifications, Mailbox
- [x] Approve / Request changes (comment required) — approval panel
- [x] New version cancels earlier approvals; holder notified “version replaced” — save a version while a chain runs
- [x] Editing during review; comments during review — Cash → BRD
- [x] No conditional approval, no cancellation — no such buttons
- [x] Minor correction: declare, AI scope check, refusal when scope is touched, approvals carried over, requester sees the diff, history label — approval panel after Request changes (Cash → Charter: the budget edit touched scope, so the full chain ran)
- [x] Signing: password or email one-time code (Mailbox), stored copy, SHA-256 fingerprints, signature page, frozen, never regenerated — Cash → Charter (signed PDF, Verify fingerprint)
- [x] “Electronic approval record, not a CCA-certified signature” label — sign dialog, certificate page
- [~] Fingerprints are of the stored text, not PDF bytes `[e]`

## Editing, versions and change requests

- [x] Only the PM team edits — Edit button
- [x] AI regenerate a part, shown as a diff to accept or reject — Edit → Rewrite with AI
- [x] Edit lock, live read-only view, 1-hour idle release (autosaved), force-unlock by the PM, AI takes the lock — two browser windows; clock menu → +1 hour
- [x] Autosaved draft, Save version with a message, history, compare any two versions, restore — document tabs
- [x] Every member sees every version
- [x] Scope check flags edits; PM decides normal edit or scope change — Save version dialog; document banner
- [x] Change request: questions about what changed, Fact Sheet updated, impact analysis, regenerated sections as diffs, pipeline restart — Change requests (start one from a decision in Cash)

## Comments and suggestions

- [x] Highlight and comment; @tag with in-app + email notification showing the comment — document read view
- [x] Suggestion mode; PM team accepts (into the draft) or rejects (kept in the log) — Cash → BRD suggestion
- [x] Visible to everyone; never in chat
- [x] Carry forward while the text is unchanged and the section not regenerated — save a version
- [x] Tick to resolve (PM team); auto-resolve → Pending check; author’s team confirms or reopens; author notified — comments sidebar
- [x] Resolved comments in a log with the version — “Show resolved comments log”
- [x] Open and pending comments block the chain

## Chat and meetings

- [x] Project chat, chat per document, direct messages — chat dock (bottom right, every page); Messages page; Discuss on the project overview and documents
- [~] Voice and video calls with screen sharing — simulated call screen (own camera and screen share work) `[e]` LiveKit
- [x] Transcription switched on by the starter; banner for everyone — call screen
- [~] BanglaASR transcript, LLM correction, raw kept — pre-written Bangla transcript with Raw/Corrected toggle `[e]`
- [x] Audio upload as a transcript source — a project or document chat → audio button in the message box
- [x] Decisions from transcripts and “Mark as decision”; PM confirms into the Fact Sheet or starts a change request — Changes & decisions → Decisions

## Notifications, dashboard and archive

- [x] In-app + email (Mailbox) for every event in the table — Notifications, Mailbox
- [x] Working hours Sunday–Thursday 9–17, set by the Admin; holidays — Admin → Settings
- [x] Reminders only in working hours; deputy receives them while the head is Away
- [x] Per-project dashboard: stage, document statuses with “Waiting on name since”, open comments, pending check, unanswered questions — Project overview (next step and document list), Home
- [x] Portfolio view for the Owner and Admin, stalled items sorted by waiting time — Home → Stalled across the portfolio (Imran or Farhana)
- [x] Archive: read-only, leaves the active dashboard — Team → Archive; Help & prototype → Archived & finished

## Technical decisions and security

- [e] LM Studio, Qwen3.5-4B, BanglaASR, Tesseract, nomic embeddings, ChromaDB, LiveKit, 1-hour lock, reminders, signing — How the real app works
- [e] AI inputs are data, never instructions; agents only propose — every “In the real app” note
- [x] Agents only propose; every AI result is labelled until a person confirms — AI badges throughout

## Open items

- [x] All open items from both spec files, with the assumption used — Open questions page; markers on the screens when Show prototype notes is on

---

## SQA and UAT (`SPEC_SQA_UAT.md`)

- [x] Stages SQA then UAT on the stage tracker; Complete after the UAT sign-off is signed — Project home
- [x] SQA tag inside the tech team; developers = tech members without the tag — Team page
- [x] Who does what (writing tests, confirming, builds, release, running, raising, triage, fixing, closing, outcomes, sign-offs) — enforced in `src/rules/testing.ts`; try as different users
- [x] Testers and developers kept apart (SQA cannot be assigned; developers cannot close) — defect page
- [x] Test cases: ID, steps, expected, requirement, priority, type, history; AI drafting; labelled until accepted — Savings → Test cases
- [x] Coverage with Not testable (PM) — Savings → UAT → Test cases (BR-06)
- [x] Extended traceability (requirement → tests) — Savings → SRS → Traceability
- [x] Test case list confirmed by the tech head (SQA) / stakeholder head (UAT) — Test cases tab
- [x] Builds: register, claimed fixes, available to SQA at once, Release to UAT only after an SQA run and with no open Critical/High SQA defects — Savings → Builds
- [x] Fixes during UAT go through SQA first (“Fix works” / “Still fails”) — Savings → Builds (UAT-4 in build 1.1)
- [x] Test runs, My tests inbox, Pass / Fail (must link a defect) / Blocked (reason), files — My work → Tests
- [x] Defects: fields, severity, status flow, outcomes (Rejected, Duplicate, Deferred — Medium/Low only, Change request) — Savings → Defects
- [x] Board with drag and drop (only allowed moves), list with filters and saved shortcuts, defect page with comments, @tags, files, history, watchers — Savings → Defects
- [x] AI defect writer; possible duplicates — Raise a defect / record a Fail
- [x] Exit criteria checklist; generated report (numbers counted by code, AI summary paragraph labelled); known issues; Not testable list — Sign-off tab
- [x] SQA sign-off approved by the tech head (auto-releases the build to UAT); UAT sign-off PM → tech → stakeholder head, sponsor signs — Sign-off tab
- [x] Request changes on a report → regenerate → chain restarts
- [x] Changes during testing: linked tests Needs review (reset), sign-offs Out of sync, re-done in order — after a change request or a requirement edit
- [x] Notifications and reminders for tests, builds, defects, retests, list confirmation, sign-offs — Notifications
- [x] Dashboard: SQA/UAT status, progress and defects; untriaged defects and retests in stalled items — Project overview, Home
- [x] Audit log entries for builds, results, defect changes, Not testable, sign-offs — Audit log
