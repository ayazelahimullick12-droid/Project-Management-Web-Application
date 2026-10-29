# Demo script (about 20 minutes)

A walkthrough of the prototype for a BRAC audience. To show every feature, use `FEATURE_TOUR.md`.

Before you start:

- Start LM Studio with `qwen2.5-coder-0.5b-instruct` and `text-embedding-nomic-embed-text-v1.5`
  loaded and its server running (Developer tab). Then run `npm run dev` and open the app in a wide
  browser window. The **Demo** menu shows "AI (LM Studio): connected".
- The AI is real, so its wording (and sometimes the facts it picks out) changes from run to run.
  The steps below say what to look for rather than the exact text.
- The app opens in the **Simple view**. This script uses the **Full view**: click **Full** in the
  top bar. (To show the Simple view, see Part 0 of `FEATURE_TOUR.md`.)
- The app starts with **no projects**. In the demo clock menu (bottom left, above your name), click
  **Start again → With demo projects**, then set **Speed of the simulated steps** to `fast` (only
  file reading and call transcripts are simulated).
- Switch people with the demo clock menu or your profile menu at the bottom left. Each step says
  who to be. The sun/moon button next to the search box switches between light and dark mode.
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
2. Be **Nusrat Jahan** (PM). Click **Run intake analysis**. Watch the AI card (bottom left): the
   local model reads the description and the upload (about 30 seconds), then similar past projects
   are found by meaning (a second or two).
3. **Fact Sheet** tab: every fact is labelled AI until a person confirms it. “Number of users” is
   usually **conflicting** (description says 1,200, the upload says 1,450). Click **Settle** and pick
   a value. Fix any fact the small model got wrong with **Edit**.
4. **Similar projects** tab (PM team only):
   - A **duplicate warning**: Field Collection Tracker matches about 90%. Click **Acknowledge**.
   - Each match shows why it matched, its members (with **Message** buttons) and **View full
     document** for its signed documents.
   - Suggestions: highlighted old-project details (yellow, such as “7 working days” or a place
     name) must be confirmed (**Still true here**) or **Replace**d before **Accept into the Fact
     Sheet**. Accept one. Back on the Fact Sheet it carries the credit “From Field Collection
     Tracker (PM: Mithila Sarker)”.
5. **Q/A questions** tab: **Start the first round**. The AI writes one question per missing field
   (about a second each) and routes them: business ones to stakeholders, budget ones to sponsors.
6. Be **Selim Reza** (sponsor head). **My work → Q/A questions**: answer one with **Use sample
   answer**, and another with **Unknown** — it becomes an assumption with the agreed default.
7. Be **Habib Ullah** (stakeholder). Answer the stakeholder questions with sample answers.
8. Be **Nusrat**. **Close round**, then on the Fact Sheet click **Send for confirmation**.
9. Be **Rokeya Begum** (stakeholder head). **Confirm Fact Sheet**. The project’s next step becomes
   “Write the Proposal & Charter”.

## 3. Proposal & Charter: draft, comments, versions, approval (5 min)

1. Be **Nusrat**. Open **Proposal & Charter** → **Generate with AI**. The AI writes it section by
   section from this project’s facts (about 20 seconds; the card at the bottom left counts the
   sections). It is kept short on purpose: a few sentences or bullets per section. The Charter
   part has numbered objectives (OBJ-1…), which the BRD later links to. The summary and slides
   are made in the background.
2. Be **Habib**. Select some text in **Objectives and scope** → **Comment**, tag Rafiq. Select other text →
   **Suggest wording**. Both appear in the **Comments** rail on the right.
3. Be **Nusrat**. **Send for approval** (top right) is greyed out, and a note says why: there is
   an open comment.
4. Be **Rafiq Hasan** (PM team). Accept the suggestion (it goes into the draft), click **Edit**,
   try **Rewrite with AI** on a section (“make it shorter”; about 5 seconds; accept the diff). Then
   change a date or the budget in **Timeline and budget** and click **Save version**: the AI
   checks whether the edit changes scope (a few seconds) and says why. Resolve Habib’s comment
   (or show that it became **Pending check** because its text changed).
5. Be **Nusrat**: decide **Normal edit** if asked, then **Send for approval** and **Approve**.
6. Be **Arif Rahman** (tech head): **Approve**. Then be **Shuvo Das** (developer): the comments
   rail says his team can no longer comment, because his head approved this version.
7. Be **Rokeya**: **Approve**. Then be **Selim** (sponsor head): **Approve and sign** — the
   sponsor signs the whole package. The **Approval** tab of the rail shows every reviewer with a
   tick.
8. Show **History** and **Compare** (side-by-side diff), and **Summary** (one-page summary, very
   short summary, slides, PPTX download — each labelled “AI summary of version N”; **Make them
   again** asks the AI for a new one).

## 4. Approval variants and signing (3 min) — Branch Cash Reconciliation

1. Be **Jahid Hasan**. Open **Branch Cash Reconciliation → BRD**. Rokeya is **Away**, so Jahid,
   her deputy, sees **Approve (as deputy)** at the top. The record will say who acted for whom.
2. Open the **Proposal & Charter** (Charter tab): it was sent back by the sponsor (“split the
   budget”), edited, and signed.
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
   **Write** (AI defect writer, a few seconds). If the defect means the same as an open one, it is
   shown as a possible duplicate. Raise the defect.
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
   go to **Changes & decisions → Decisions**: **Confirm into the Fact Sheet** (in the dialog,
   **Suggest with AI** picks the fact and writes the value; check it), or **It changes scope:
   start a change request** (then show **Change requests**).

## 7. Wrap-up (1 min)

- **Help & prototype** (bottom left): **Open questions** (what the spec leaves open and what the
  prototype assumes) and **How the real app works** (LM Studio, BanglaASR, OCR, embeddings,
  LiveKit, signing).
- Be **Farhana Kabir** (Admin): **Admin → Templates** (versioned, placeholder), **Settings**
  (working hours, holidays, blocking severities, and the **AI models** from LM Studio), **Import
  past projects**, **AI activity** (every request: model, tokens, seconds, errors).
- To show what happens when the AI is off: stop LM Studio's server and click any AI button. The
  action stops with “LM Studio is not reachable…” and nothing is changed.
