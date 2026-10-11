# Decisions

Choices made where the spec files were silent or where the prototype had to simplify.
One line each: the decision, then the reason.

## Prototype approach

- Frontend only, data in the browser (localStorage), AI simulated — agreed plan in `BUILD_PROMPT_FRONTEND.md`.
- Built in one go rather than slice by slice — the user asked for it; every slice is in place.
- Business rules live in `frontend/src/rules/` with Vitest tests — so they can move to the Python backend unchanged in meaning.
- The api layer (`frontend/src/api/`) refuses actions like a backend would — so screens never depend on hidden buttons for safety.
- Signed-in user is kept per browser tab (sessionStorage) — so two windows can be two people for the live view and lock demo.
- The demo clock starts at the seed’s Wednesday 10:00, shifted by whole weeks — reminders and “waiting since” look the same in every demo.
- Seed files are hashed; any change resets every browser automatically — so edited dummy data always shows up.
- Interrupted AI jobs (tab closed mid-job) are marked failed after 2 minutes — they cannot finish without the tab that started them.

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
- The scope check is simulated by template sections flagged “scope-sensitive” (objectives, scope, deliverables, timeline and budget sections) — predictable for demos; the real app asks the LLM.
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
- Defect duplicate detection is simulated by word overlap (threshold 0.5) — stands in for embeddings.
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

