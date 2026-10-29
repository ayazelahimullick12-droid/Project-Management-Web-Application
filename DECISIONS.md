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
- The app **stops at the first step that needs people**: sending questions (the teams that get them), asking the stakeholder head to confirm the Fact Sheet, **Send for approval**, and testing. It says who is missing and offers **Add**. Rule: `rules/people.ts`.
- Before **Send for approval** the **whole chain** is checked at once — so nobody approves a document that then gets stuck at a later, empty step.
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
