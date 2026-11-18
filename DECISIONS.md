# Decisions

Choices made where the spec files were silent or where the prototype had to simplify.
One line each: the decision, then the reason.

## Prototype approach

- Frontend only, data in the browser (localStorage), AI simulated — agreed plan in `BUILD_PROMPT_FRONTEND.md`. (Changed on 29 October 2026: one JSON file and real AI, see the last section.)
- Built in one go rather than slice by slice — the user asked for it; every slice is in place.
- Business rules live in `frontend/src/rules/` with Vitest tests — so they can move to the Python backend unchanged in meaning.
- The api layer (`frontend/src/api/`) refuses actions like a backend would — so screens never depend on hidden buttons for safety.
- Signed-in user is kept per browser tab (sessionStorage) — so two windows can be two people for the live view and lock demo.
- The demo clock starts at the seed’s Wednesday 10:00, shifted by whole weeks — reminders and “waiting since” look the same in every demo.
- Seed files are hashed; any change resets every browser automatically — so edited dummy data always shows up. (Since 29 October 2026 the data lives in one file; Demo → Start again loads the seed files.)
- Interrupted AI jobs (tab closed mid-job) are marked failed when they have shown no progress for 4 minutes (checked every 30 seconds) — they cannot finish without the tab that started them, and one real AI answer may take up to 3 minutes.

## Q/A and Fact Sheet

- “4 working hours” counts only time inside working hours (Thursday 15:00 → Sunday 11:00) — the spec’s wording; the other reading is listed under Open questions.
- The intake round asks only intake fields; process fields are asked in the business round before the BRD and technical fields in the technical round before the SRS — matches “Extra rounds before later documents”.
- Questions go to every member of the routed team (not SQA testers); the first answer closes the question — simplest routing that works with Away deputies.
- Closing an extra round (business or technical) saves a new Fact Sheet version without another stakeholder-head confirmation — the spec asks for confirmation only before the Proposal.
- The stakeholder head’s “comment on what is wrong” goes back to the PM team and withdraws the confirmation request — the PM fixes the facts and sends it again.
- A change-request answer replaces the old value instead of creating a conflict — the question is explicitly about the new value.
- RAG runs once per project (a second intake analysis does not repeat it) — “RAG runs once”.
- Accepting a RAG suggestion for a fact that already has a value appends to it — avoids losing what the stakeholders said.

## Documents and approval

- Sections are edited one TipTap editor per section; sections with tables are edited as Markdown — keeps section ids stable and tables intact without paid extensions.
- “Send for approval” and the PM’s own approval are two clicks — the spec lists the PM both as sender and as step 1.
- While a head is Away, only the deputy can act (the head can end Away to act again) — avoids two people acting on the same step.
- Request changes always adds a general open comment to the document (main documents only) — the spec requires a comment and open comments block the next send.
- Accepted suggestions are applied to the draft, not saved as a version — a PM team member saves the version with a message.
- The scope check first finds edited sections flagged “scope-sensitive” in the template; only those go to the AI, which answers yes or no with a reason. If the AI cannot answer, the edit stays flagged and the PM decides. The minor-correction check uses the template flags only (no AI) — fast and predictable while someone waits for the button.
- Fact change detection is simulated by finding Fact Sheet values that disappeared from the edited text — predictable; the real app asks the LLM.
- A Fact Sheet update to a scope, budget or timeline fact automatically starts a change request at the impact-analysis step — “If the update changes scope, the change request flow applies.”
- Applying a change request marks the Proposal and every later document Out of sync; the Proposal can be re-approved unchanged — “the pipeline restarts from the Proposal”.
- Signing fingerprints are SHA-256 of the stored document text and of document + signature page, not of PDF bytes — the browser cannot produce byte-stable PDFs; the real app hashes the PDF.
- Any password is accepted when re-authenticating; email codes are real six-digit codes shown in the Mailbox — no real passwords in a prototype.
- PDF export uses the browser’s print dialog on a branded print page — no server-side Playwright in a prototype.

## SQA and UAT

- Retest “passed” on a defect with a linked test case also records a passed run of that test on the fix build — keeps the exit criteria consistent with the retest.
- A test case whose requirement text changed counts as not run until it is run again — “latest result is reset to Not run”.
- Sign-off reports have no comment sidebar; the request-changes comment is stored on the chain — per `SPEC_SQA_UAT.md`.
- Defect duplicate detection compares meaning with the embedding model (threshold 0.75; a reworded duplicate scored 0.82, an unrelated defect about 0.5).
- The board shows the four outcome columns (Rejected, Duplicate, Deferred, Change request) so the PM can drag to them; each asks for the required reason.

## Calls and notifications

- Calls are a mock screen; the user’s own camera and screen share work if the browser allows them — shows the real controls without LiveKit.
- “A defect you watch changed status” is in-app only — per `SPEC_SQA_UAT.md`.
- Decision and Fact Sheet update notifications are sent once, without reminders — the spec lists reminders for approvals, signatures and questions.
- The time-travel control is in the clock menu for everyone — convenient for demos; in the real app it is Admin-only in development mode.

## Layout (streamlining, 11 October 2026)

- Prototype explanations ("In the real app…" notes, open-question markers) are hidden by default and switched on in the clock menu — the app should look like the product; reviewers can still see every note.
- "My questions" and "My tests" are tabs of one **My work** page, with approvals and other waiting items — one place for everything waiting on a person (spec inboxes are kept as tabs).
- Change requests and Decisions share one sidebar entry; Team and Audit log share another — fewer sidebar items, linked by a switch at the top of each page.
- Each project shows one computed **next step** (who must act, since when) above the document list — answers "what happens now?" without reading every card.
- On a document, the main action (Edit, Send for approval, Approve, Approve and sign) sits in the header; downloads and rarer actions are behind "…"; comments and the approval list share a side rail.
- The defect board hides the outcome columns (Rejected, Duplicate, Deferred, Change request) until "Show…" is clicked — they are rarely needed while triaging.

## Current-style UI and chat (11 October 2026)

- Chat lives in a dock at the bottom right of every page instead of a project tab — people can talk while they read a document, as on LinkedIn and Facebook; the full Messages page is still there.
- Group channels (project and document chats) use a Slack-style layout and direct messages a Messenger-style bubble layout — a group conversation needs names on every message; a one-to-one conversation reads better as two sides.
- Document chats with no messages are left out of the conversation list (search still finds them); each document's Discuss button opens its chat — keeps the list short.
- At most two chat windows are open at once (the oldest closes) — they would cover the page otherwise. On phones, chats open the Messages page instead.
- Unread counts: messages from before the demo started count as read, unless `seed/messages.json` says otherwise. Reading a chat on screen marks it read.
- Reactions are a fixed quick set (👍 ✅ 👀 🎉) — enough for approvals and acknowledgements without an emoji picker. They are not in the spec; they are a small, common chat feature.
- @mentions in group channels send an in-app notification (no email); direct messages notify the other person in-app.
- Dark mode is the viewer's choice (System by default), kept in this browser: a one-click sun/moon button next to search (and on the login page), "dark"/"light" in Ctrl+K, and Light/Dark/System in the profile menu. The print/PDF view is always light.
- Activity on Home comes from the audit log (sign-ins left out); the "health" label is computed from the next step: Needs attention, Delayed (waiting more than 2 days), Waiting, On track, Complete.

## Simple view (27 October 2026)

- Two views of the same pages, Simple (default) and Full, with a switch — the supervisor asked for less on each page; people who work in the app all day keep every tool. The same page addresses are used, so switching never loses your place.
- Simple is the default for everyone, including the PM team — the same person can switch to Full when they need the tools; the choice is remembered per browser.
- The Simple view uses plain words (Project facts, Business requirements, Ask for changes, problem) while the Full view keeps the spec's terms — the spec's terms are still shown in brackets where people may know them (BRD, SRS).
- The To do list merges waiting items with the project's next step for the person's team (for example "Write the Proposal with AI" for the PM team) and sorts by how long things have waited.
- On a Simple document page only one notice is shown at a time, in this order: needs updating, scope decision, someone else editing, unsaved edits, suggested fact changes, why it cannot be sent yet.
- "What changed" compares the current version with the one reviewers last saw (the version that got "Ask for changes", or else the previous version), section by section.
- Editing, history, compare, summaries and traceability open the Full document tools at `/docs/<type>/tools` — they are used by the PM team, who are comfortable with the full tools.
- Light colours are now the default (dark and System remain); text size can be raised by 12.5% or 25%.

## Mark as decision (27 October 2026)

- **Not offered in direct messages between two members**, although SPEC.md says “any member can click Mark as decision on a chat message”. A private chat is not tied to one project (two people often share several), so nobody could tell which project the decision belongs to. Decisions are marked in the project chat or a document chat instead. Rule: `canMarkDecision` in `src/rules/permissions.ts`, enforced in `src/api/chat.ts`.
- Still offered in messages with a member of a similar past project: those are started from one project, and the spec asks for it there.

## Starting a project alone; Proposal & Charter in one step (29 October 2026)

The user changed the rules: one person can start a project, and the Proposal, Charter and slides are made in one step. Conflicts with `SPEC.md` were settled with the user:

- Whoever starts a project becomes the **Project Owner and the PM** — the smallest change that still has an owner and a PM.
- The **Owner and the PM** add people (on the Team page, or with the **Add** buttons where the app stops).
- The app **stops at the first step that needs people**: sending questions (the teams that get them), asking the stakeholder head to confirm the Fact Sheet, **Send for approval**, and testing. It says who is missing and offers **Add**. Rule: `rules/people.ts`. (Changed on 3 November 2026: approvals and confirmations no longer stop, see the last section.)
- Before **Send for approval** the **whole chain** is checked at once — so nobody approves a document that then gets stuck at a later, empty step. (Changed on 3 November 2026: a missing head no longer stops sending.)
- Deputies are optional; the app asks for one when a head is set **Away** — Away needs someone to cover.
- **One person may hold several roles**, with a warning (they would approve more than once and could approve their own work) — a small team may have no one else. This replaces the spec's one-role-per-person rule.
- The Proposal and Charter are **one document** (`PROPOSAL`, shown as “Proposal & Charter”) with two parts; Charter sections have keys starting with `charter_`. **One approval round**; the **sponsor head signs** the package — the spec had two chains; one round avoids asking the same people twice in a row.
- The slides are made automatically and are **not approved** — like the other derived outputs, they are for quick understanding only.
- PDF and Word downloads offer the whole package or either part.

## One JSON file and real AI with LM Studio (29 October 2026)

- **Data in one JSON file** (`frontend/data/db.json`) behind a small Node server with no dependencies (`frontend/server/`) — the user asked for a JSON file; several tabs on this laptop share the same data.
- **The business logic stays in the browser** (`src/api`, `src/rules`); the server only stores the whole data and passes AI requests on — no rule had to be rewritten, and the screens did not change.
- Each tab changes its copy at once and sends the whole data with the version it was based on; if another tab saved first, the change is re-applied on top of the newer data (a change that is no longer allowed is dropped). Tabs hear about changes through Server-Sent Events.
- The background worker (reminders, lock release) runs in **one tab only**, chosen with a browser lock — otherwise every open tab would send the same reminders.
- **Starts empty** (people, settings and templates only); the demo projects load from Demo → Start again → With demo projects — the user's choice.
- **Model:** `qwen2.5-coder-0.5b-instruct`, switchable in Admin → Settings — the larger `spark-x2.6-4b` would not load on this 8 GB laptop. Embeddings: `text-embedding-nomic-embed-text-v1.5`.
- **Short documents:** about 5–6 sections, each at most 2 sentences or 3 bullets (about 200 words per document), with a token limit per kind of request (`LIMITS` in `src/ai/prompts.ts`). Measured: Proposal & Charter about 18 s, BRD about 20 s, SRS about 17 s.
- **Plain labelled lines instead of JSON:** the model answers “key: value”, “- point”, “Title: …”. On this laptop it writes about 17 tokens a second, and JSON's quotes, brackets and indentation doubled the time (a fact extraction took 21 s and was cut off; the same in lines took 10 s).
- **One question per request:** asked for several questions at once, the 0.5B model wrote one question about something else; one at a time it writes good questions in about a second each.
- **Facts the model did not really find are dropped:** values that only repeat the field's name (“In scope.”) or say it is not given (“not specified in the text”), so those fields become questions.
- **Two sources disagree** when the numbers or dates in their values differ (for example “June 2027” and “September 2027”); wording differences are not conflicts. A person's value is kept unless the new reading gives different numbers.
- **The fact a decision sets is chosen by meaning** (embeddings, with the nomic `search_query:` / `search_document:` prefixes); the model writes only the value — asked to pick one of 24 fields, it could not; by meaning, 5 of 6 test decisions got the right field.
- **Similar projects** are matched by meaning against each finished project's summary, then their document sections; a match needs at least 0.6 (unrelated text scores about 0.5); the duplicate warning stays at 0.85.
- **Change requests:** an old value written word for word in a section is replaced directly; the AI rewrites only for the other changes, and a new value it leaves out is added as a line — the 0.5B model often repeated the text unchanged.
- **Summaries** are made from each section's first two sentences, with the instructions after the text — with the full text the small model ignored the format and wrote an essay.
- **When LM Studio is off or does not answer**, the action stops with the reason and nothing is changed — the user chose an error over made-up fallback text.
- **Still simulated:** OCR of PDF, Word and scanned uploads (`.txt`, `.md` and `.csv` files are really read), call transcription, email (Mailbox), calls.

## The Project Owner and the PM can approve in any head's place (3 November 2026)

The user's rule: the approval chain stays exactly as it is (each step belongs to its head), but the Project Owner and the Project Manager can also press the button for any step, for example when that person is not present.

- **Every approval and confirmation:** each step of every approval chain (including the sponsor head's **signature**), **Request changes**, confirming the **Fact Sheet**, and confirming the **SQA and UAT test case lists**. Rule: `actForHead` in `src/rules/permissions.ts`; `canAct` in `src/rules/approval.ts` uses it.
- **Always allowed, not only when the head is away** — the user said the Owner or PM can give it too; the head can still act themselves. The PM's own step and the head's step stay separate: the PM clicks once for each.
- **The record says who acted for whom:** the step, the audit log, the signed PDF's certificate and the approval record read, for example, "Nusrat Jahan (Project Manager, for the stakeholder head (Rokeya Begum))". The Owner or PM signs with their **own** password or email code. The head is told in-app when someone approved or signed in their place.
- **A head who has not been added yet no longer stops anything:** a document can be sent for approval, the Fact Sheet sent for confirmation and testing started without them. Their step waits on the PM ("No sponsor head yet — the Project Owner or the PM approves in their place"); if a head is added later, the waiting step moves to them. Work for a missing head (reminders, To do) goes to the Owner and the PM.
- **Still needed:** people who do the work — stakeholders, sponsors or the tech team to answer questions, SQA testers and developers to test. A deputy is still asked for before a head is set Away.
- Buttons say whose step it is: **Approve (for the stakeholder head)**, **Approve and sign (for the sponsor head)**, **Confirm Fact Sheet (for the stakeholder head)**. In the Simple view the status sentence still names the head whose turn it is, and adds "You can also approve it in the stakeholder head's place."
- A head's team can no longer comment on a version once its step is approved, also when the Owner or PM approved it — the same rule as before (it follows the step, not the person).
- **Fixed on the way:** the summary and slides failed with "could not use" when the model wrote only bullet points without the one-sentence first line (it often does). The first bullet is now the summary; a last bullet cut off at the length limit is dropped.

## The Project Owner's master key (5 November 2026)

The user's rule: the Project Owner can do everything in their project (answer every question, give every approval and every input in SQA and UAT). Every other rule stays as it is; this is added on top.

- **Who, not the checks:** in a project they own, the Owner may do any action any member may do: answer any Q/A question, write the description, run the analysis, edit and save documents, resolve comments, comment after the heads approved, every approval and signature, confirm the Fact Sheet and test lists, write SQA and UAT test cases, register builds, create runs, record any tester's result, raise defects, triage, mark fixed, check UAT fixes, release builds to UAT, close and reopen defects, the PM's outcomes (reject, duplicate, defer, change request), send and approve sign-offs, confirm decisions, change requests. The checks that are not about who you are still apply to them: open comments block sending, exit criteria, required reasons and builds, Critical and High defects cannot be deferred, one editor at a time, an archived project is read-only. Chosen by the user.
- **Only in the Owner's own projects:** the Admin pages (templates, users, settings) stay with the Admin.
- **Recorded as the Owner:** answers ("Imran Chowdhury (Project Owner)", also as the fact's source), defect history ("Ready for retest → Closed by Imran Chowdhury (Project Owner)"), test results ("recorded by Imran Chowdhury (Project Owner)"; the tester is told in-app), approvals as before ("Project Owner, for the stakeholder head").
- **A list, not reminders:** the Owner's To do (Simple view) has a folded section **You can also do, as Project Owner**, and My work (Full view) a tab **As Project Owner**: everything waiting for other people in their projects, with whose turn it is. The Owner gets no extra notifications or reminders. Chosen by the user.
- Rule: `actAsHead` in `src/rules/permissions.ts` lets the Owner act for any head (and for a head the project does not have); the other "who" checks (PM team, SQA tester, developer, the assigned tester or developer, the reporter's team) let the Owner through one by one. Deputies still cover only their own Away head (`deputyFor`).
- A test case's "SQA tester" and "developer" separation still applies to everyone else; the Owner may do both.

## Glass look for both views (5 November 2026)

- **Apple's glass style (iOS and macOS):** a soft background of BRAC magenta, violet, blue and green glows; frosted glass for everything that floats over content (the Full view's sidebar, the Simple view's floating top bar, menus, dialogs, the chat dock, AI progress cards, toasts, the bottom action bar); translucent cards with a light top edge; pill-shaped buttons; iOS-style segmented switches and tab strips. The user asked for it.
- **Document text stays on a near-solid white "sheet"**, and secondary text keeps at least 4.5:1 contrast on the glass cards (measured 5.0:1; body text 14:1) — the Simple view is for users over 35, and glass can make text harder to read.
- **"Look: Solid"** in the profile menu (and the computer's own "reduce transparency" setting) switches the glass off: solid white panels on a plain grey page, no blur — the same idea as Apple's "Reduce transparency".
- **Blur only where something floats over content** (bars, menus, dialogs, the sidebar); cards are translucent with a light blur only from the shared card style — many blurred elements would make scrolling slow on a laptop.
- **Exports keep their solid colours:** the glass values are separate tokens (`brand.glass`) used only by the web UI; PDF, Word and PowerPoint still use the solid BRAC colours.
- On phones the Simple view's top bar drops the logo and the small arrows (the To do tab is in the second row), so the bar fits at every text size.

## Simpler SQA and UAT: testing points, versions, PASS / FAIL (11 November 2026)

The user asked for a simpler testing process. It replaces the one in `SPEC_SQA_UAT.md` (test cases, list confirmation, builds, runs, Blocked, defects); the spec file itself is unchanged.

- **Testing points:** the AI writes up to 3 short points per requirement (SRS for SQA, BRD for UAT). Testers add, edit, regenerate (AI) and delete them. No confirmation step: the sign-off approval is the check.
- **Versions:** the tech team or PM team adds the version being tested (for example 1.2); SQA and UAT share the list. The tester picks the version first; every result is saved under it.
- **PASS or FAIL only**, each with an optional comment (the user removed the third "Comment" option). No Blocked.
- **A failed point is fixed in a new version** (the user's choice). A FAIL tells the developers, and "Fix N failed points" waits on them. On a new version **every point is checked again**; older versions keep their results.
- **Who:** SQA — SQA testers. UAT — developers, stakeholders and the PM team (the user's choice). Versions — tech or PM team. Reports — an SQA tester (SQA), the PM (UAT). The Project Owner can do all of it (master key).
- **Sign-off:** the report is made for one version and can be sent only when every point was checked and passed on that version. A point that cannot pass is deleted, or the PM marks its requirement Not testable.
- **Editing a point, or a change to its requirement, means it is checked again** (earlier results stay in its history but no longer count).
- **Once a stage is signed off**, its page and the project page show the signed-off version, not the newest.
- **Existing data is converted on load** (`src/demo/migrate.ts`): test case → point (title — expected), build → version, Pass → PASS, Fail/Blocked → FAIL (the tester's notes, the Blocked reason and linked defect titles become the comment), report → same version. Test steps, preconditions, priority, run names, list confirmations and defects are not kept.

## A calmer, more professional Simple view (16 November 2026)

The user asked for the Simple view to look more professional: a calmer look, a clearer task list, and the glass kept but tidied. The wording was not changed.

- **Calmer look, Simple view only** (the `simple-view` class on `<html>`, set by `SimpleShell`): a plain light-grey page instead of the coloured glows; near-white cards with a thin grey border and a small shadow; corners rounded less (16px instead of 24–30px); main buttons solid magenta without the coloured glow. The frosted glass stays on what floats (top bar, action bar, menus). The Full view is unchanged; "Look: Solid" still wins.
- **Magenta only where it matters:** the main button, counts, the active tab's icon, "Your turn" text and progress. The active tab is a neutral grey; the Demo button is a quiet outline with an amber dot.
- **The product name next to the logo** ("BRAC · Project Management") from tablet width up.
- **To do is a work queue:** one list with columns Task, Project, Waiting and the button; the waiting time is a label coloured grey (under a day), amber (1–3 days) or red (over 3 days), the same rule as the Full dashboard. Today's date above the greeting. On phones each task stacks.
- **Projects is one aligned list:** project and your role, a 7-step progress bar, and the status.
- **"Your next step" box:** a white card with a magenta left edge instead of a pink panel.

## Documents in the Simple view: paper sheet, contents, one status bar, changes in the text (16 November 2026)

The user chose four of seven proposed improvements (1–4). Code: `src/simple/DocumentParts.tsx`, used by `src/simple/DocumentPage.tsx`.

- **Paper sheet:** the text sits on a white sheet with a BRAC letterhead (logo, "BRAC · Project Management", a status stamp: Draft, In review, Changes requested, Approved, Signed, Needs updating), the formal title (Project Proposal, Project Charter, Business Requirements Document, Software Requirements Specification), project, version, date and "written by the AI" when no person has edited it. Sections are numbered (1., 2., …) so people can refer to them. At the end, an **approval record** table (role, name, decision, date) and the electronic signature with the start of its SHA-256 fingerprint.
- **Contents:** a numbered list of sections beside the sheet, staying in view, with the section on screen highlighted and small markers: *changed* (since the version people last saw), comment count, *AI*. On narrow screens, and while comments are open, it is a **Contents** button.
- **One slim bar** replaces the stacked status box, "Your turn" box and the blue "what changed" box: the status sentence, the approval steps as chips (approved ✓, current outlined), and one line saying what to do.
- **Show changes since version N:** a switch that marks the edits in the text itself (added words green, removed words struck through), compared word by word on whole words so a time like 5:00 → 4:30 reads as one change. Unchanged sections read normally; new and removed sections are labelled. Commenting is done with the switch off.
- The Full view's document page is unchanged (the shared text reader only gained optional numbering).

## Simple view: a project bar for moving between projects, documents and steps (17 November 2026)

The user asked for easier navigation between projects, documents and the other processes. Code: `src/simple/ProjectNav.tsx`, shown by `SimpleShell` on every `/projects/<id>/…` page.

- **Project switcher** (left of the bar): your projects with their step and how many things wait for you. Picking one keeps you in the same place where it exists (the BRD of one project → the BRD of the other; also questions, testing, team, changes), otherwise its overview. "All projects" and "New project" are at the bottom.
- **Tabs:** Overview · Proposal & Charter · BRD · SRS · Questions & facts · Testing, and **More** (team chat, team, changes and decisions, activity log). Each tab has a status dot (green done, blue in review, magenta in progress, amber needs attention, grey not started) and a magenta count when something there waits for you. Testing opens SQA or UAT, whichever stage the project is in.
- **Team chat sits under More** so the tabs fit on one row on a laptop; the top bar's Messages already shows unread chats, and More gets a dot when the project chat has new messages.
- **Phones:** the switcher and More on one row, the tabs under them, scrolling sideways with the current tab centred.
- The "← All projects" and "← project name" back links on the project and document pages were removed: the switcher and the Overview tab replace them.

## Simple view: a work-app header and project header (17 November 2026)

The user found the first project bar not professional enough and asked to look at other products. The patterns used: GitHub's Primer UnderlineNav (left-aligned underline tabs right above the content, neutral counters), Atlassian's navigation (the top bar holds only app-wide items; project navigation as horizontal tabs below it), and the GOV.UK header / service navigation split.

- **Top bar:** flush and full width (no floating rounded card), lightly frosted, thin bottom border, its content lined up with the page. The four places are underline tabs; the current one has a magenta line.
- **Project header** (a band under the top bar, scrolls with the page): breadcrumb "Projects / [icon] Project name ▾" (the name is the project switcher), the step and a small progress bar on the right, and underline tabs with icons: Overview, Proposal & Charter, BRD, SRS, Questions & facts, Testing, More. A finished document's icon is a green check; a magenta counter means something there waits for you. The coloured status dots were removed.
- **Pages are left-aligned** with the header instead of centred.
- **Overview:** headed "Overview" (the name is in the header), with an **About** panel on the right like GitHub's: description, Project Owner, the four heads (with "away"), start date and a link to the whole team. "Also in this project" became "Also needs attention" and lists only what does; the "More" section was removed (the More tab covers it). The step bar shows only on phones, where the header hides it.
- **Phones:** the tab strip fades at its edge to show it scrolls.

## Simple view: a simpler top bar (17 November 2026)

The user asked to simplify the top bar. It now has only: the logo with "Project Management" on one line, To do · Projects · Messages · Help, a small Demo icon (prototype only, amber dot) and the avatar. The Simple / Full switch moved into the avatar menu (as "View"), next to text size, colours and look; the first name next to the avatar and the "BRAC" line above the name were removed.

## Simple view: an overview without the document list (17 November 2026)

The user pointed out that the overview listed the documents a second time (they are tabs in the project header). The overview now shows what the tabs do not:

- **Your tasks here:** every task waiting for you in this project, with how long it has waited and its button (or where things stand when there is nothing).
- **Progress:** the six steps as a timeline: done (green check, "Signed", "Approved"), **Now** (what is happening: who it waits for and since when, or the testing numbers on the version), later (grey).
- **Recent activity:** the last six actions in the project (logins and the technical signature record left out; the full log stays under More → Activity log, for the Owner and the PM). The project data now includes these six entries for every member, as the home dashboard already shows recent activity.
- The **About** panel stays on the right. "Also needs attention" was removed: questions, testing and chat are tabs, and anything that waits for you is in "Your tasks here".

## Simple view: separate SQA and UAT tabs (18 November 2026)

The user could not find UAT: one "Testing" tab opened SQA or UAT depending on the stage. The project header now has an **SQA** and a **UAT** tab, in step order after the SRS. Each shows a green check once its sign-off is approved, a magenta count when something there waits for you, and its full name ("Technical testing (SQA)", "User testing (UAT)") on hover.

## Simple view: the project menu can be hidden (18 November 2026)

The user asked for the project bar to come and go with a click. **Hide** (top right of the bar) folds it into one slim line: the project name (still the switcher), where you are ("/ BRD"), how many things wait for you in the project ("2 for you") and **Show menu**. The choice is remembered in this browser (localStorage); the bar is open unless hidden.
