# Demo script (about 20 minutes)

A walkthrough of the prototype for a BRAC audience. Before you start:

- Run `npm run dev` and open the app in a wide browser window.
- In the demo clock menu (bottom left, above your name), click **Reset demo data**, then set
  **AI speed** to `fast`.
- Switch people with your profile menu at the bottom left. Each step says who to be. The same
  menu switches between light and dark mode.
- For a product-style demo, leave **Show prototype notes** off (demo clock menu). For a spec review,
  turn it on: “In the real app…” notes and open-question markers appear on the screens.
- **Ctrl+K** jumps to any project, document or page.

Tip: open a second browser window for the tech head or a stakeholder, so you can show the live
view and notifications without switching back and forth.

---

## 1. The idea (1 min) — as Imran Chowdhury (Owner)

1. On the login page, point out the prototype note and the demo users.
2. Sign in as **Imran Chowdhury**. **Home** shows what is waiting on him, his projects with their
   **next step** (who must act, and for how long), and **Stalled across the portfolio**.

## 2. Intake and the Fact Sheet (5 min) — Field Loan Application App

1. Be **Shirin Akhter** (stakeholder). Open **Field Loan Application App → Intake & facts**.
   The description is already written. Click **Upload a file** and choose any PDF or image:
   the extracted text appears (simulated OCR, English + Bangla).
2. Be **Nusrat Jahan** (PM). Click **Run intake analysis**. Watch the AI tray (bottom left):
   facts are extracted, then the RAG agent searches past projects.
3. **Fact Sheet** tab: “Number of users” is **conflicting** (description says 1,200, the upload
   says 1,450). Click **Settle** and pick a value.
4. **Similar projects** tab (PM team only):
   - A **duplicate warning**: Field Collection Tracker matches 92%. Click **Acknowledge**.
   - Each match shows why it matched, its members (with **Message** buttons) and **View full
     document** for its signed documents.
   - Suggestions: highlighted old-project details (yellow) must be confirmed (**Still true
     here**) or **Replace**d before **Accept into the Fact Sheet**. Accept the risk and the
     success criteria. Back on the Fact Sheet they carry the credit “From Field Collection
     Tracker (PM: Mithila Sarker)”.
5. **Q/A questions** tab: **Start the first round**. Five questions are routed: business ones to
   stakeholders, budget ones to sponsors (two fewer than without RAG).
6. Be **Selim Reza** (sponsor head). **My work → Q/A questions**: answer the budget with **Use
   sample answer**, and answer the funding source with **Unknown** — it becomes an assumption
   with the agreed default.
7. Be **Habib Ullah** (stakeholder). Answer the three stakeholder questions with sample answers.
8. Be **Nusrat**. **Close round**, then on the Fact Sheet click **Send for confirmation**.
9. Be **Rokeya Begum** (stakeholder head). **Confirm Fact Sheet**. The project’s next step becomes
   “Generate the Proposal”.

## 3. Proposal: draft, comments, versions, approval (5 min)

1. Be **Nusrat**. Open **Proposal** → **Generate with AI**. The AI drafts it section by section,
   filled in with this project’s facts, labelled “AI draft”.
2. Be **Habib**. Select some text in **Scope** → **Comment**, tag Rafiq. Select other text →
   **Suggest wording**. Both appear in the **Comments** rail on the right.
3. Be **Nusrat**. **Send for approval** (top right) is greyed out, and a note says why: there is
   an open comment.
4. Be **Rafiq Hasan** (PM team). Accept the suggestion (it goes into the draft), click **Edit**,
   try **Rewrite with AI** on Objectives (accept the diff), then **Save version**: the scope check
   says it touches objectives. Resolve Habib’s comment (or show that it became **Pending check**
   because its text changed).
5. Be **Nusrat**: decide **Normal edit**, then **Send for approval** and **Approve**.
6. Be **Arif Rahman** (tech head): **Approve**. Then be **Shuvo Das** (developer): the comments
   rail says his team can no longer comment, because his head approved this version.
7. Be **Rokeya**: **Approve**. The **Approval** tab of the rail shows every reviewer with a tick.
8. Show **History** and **Compare** (side-by-side diff), and **Summary** (one-page summary, very
   short summary, slides, PPTX download — each labelled “AI summary of version N”).

## 4. Approval variants and signing (3 min) — Branch Cash Reconciliation

1. Be **Jahid Hasan**. Open **Branch Cash Reconciliation → BRD**. Rokeya is **Away**, so Jahid,
   her deputy, sees **Approve (as deputy)** at the top. The record will say who acted for whom.
2. Open **Charter**: it was sent back by the sponsor (“split the budget”), edited, and signed.
   In the rail’s **Approval** tab, open the **signed PDF** (stored copy plus the certificate page
   with the SHA-256 fingerprints) and click **Verify fingerprint**.
3. Clock menu → **+4 hours**: reminders arrive in the **Inbox**, and **Help & prototype →
   Mailbox** (bottom left) shows the emails.

## 5. SQA and UAT (5 min) — Member Savings Statement Portal

1. Be **Mahmud Karim** (SQA tester). **SQA → Builds**: build 1.1 cannot be released to UAT
   yet; the reason is shown. Open **My work → Tests**, run **SQA-TC-3** and record **Pass**.
2. **SQA → Defects**: SQA-5 is **Ready for retest** → open it → **Retest passed: close**.
3. **SQA → Builds**: for UAT-4 click **Fix works**, then **Release to UAT**. UAT-4 is now ready
   for its reporter to retest.
4. Be **Habib**. **My work → Tests** → run **UAT-TC-4** → **Fail**, type a rough note and click
   **Write** (AI defect writer); a possible duplicate is shown. Raise the defect.
5. Be **Nusrat**. **UAT → Defects** board: drag the new defect from **New** to **Open** (choose a
   developer). Try dragging a card where you are not allowed: it snaps back with the reason.
   **Show rejected, duplicate, deferred** reveals the outcome columns.
6. **UAT → Sign-off**: the exit criteria checklist is red (UAT-2 is Critical and still open).

## 6. Meetings and decisions (2 min) — Field Loan Application App

1. Be **Nusrat**. Point out the **Messages** bar at the bottom right: it has an unread count and
   is on every page. Open **Arif Rahman** (a direct message: Messenger-style bubbles, **Seen**),
   reply, then open the **Branch Cash Reconciliation** project chat (Slack-style: reactions,
   hover a message for 👍 ✅ 👀 🎉 and **Decision**, type `@` to mention someone).
2. Open **Field Loan Application App** → **Discuss** (or **Project chat** in the sidebar): the chat
   opens in a small window. Click the video icon → switch **Transcription on** (everyone sees the
   banner) → **End call**.
3. The transcript appears in the chat: toggle **Corrected / Raw** (Bangla). Candidate decisions
   go to **Changes & decisions → Decisions**: **Confirm into the Fact Sheet**, or **It changes
   scope: start a change request** (then show **Change requests**).

## 7. Wrap-up (1 min)

- **Help & prototype** (bottom left): **Open questions** (what the spec leaves open and what the
  prototype assumes) and **How the real app works** (LM Studio, BanglaASR, OCR, embeddings,
  LiveKit, signing).
- Be **Farhana Kabir** (Admin): **Admin → Templates** (versioned, placeholder), **Settings**
  (working hours, holidays, blocking severities), **Import past projects**, **AI activity**.
