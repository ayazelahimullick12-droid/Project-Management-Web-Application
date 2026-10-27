# Full feature tour (about 2 hours, in parts)

A step-by-step guide to showing **every** feature of the prototype, and which account to use for
each one. For a short demo, use `DEMO.md` (20 minutes) instead.

The parts can be shown on their own, in any order, **except Parts 4, 5 and 6**: they follow the
Field Loan Application App from intake to signed documents, so do them in that order.

**Two views.** The app opens in the **Simple view** (Part 0). Parts 1–13 are written for the
**Full view**, where every tool is on screen: click **Full** in the top bar first. The switch keeps
you on the same page, so you can flip between the two at any point to compare.

---

## Before you start

1. Run the app (`npm run dev` in `frontend/`) and open it in a wide browser window.
2. Sign in as anyone. Open the **Demo** menu (the **Demo** button at the top right in the Simple
   view; the clock above your name in the Full view) and click **Reset demo data**. Then set
   **AI speed** to `fast`.
3. Every account's password is **demo1234**. On the login page you can also just click a person.
4. **Switch person** at any time from the **Demo** menu → pick someone from the list. You do not
   need to sign out.
5. **Tip: use two browser windows side by side.** Each browser tab can be signed in as a
   different person. Keep the PM (Nusrat) in one window and the person approving or answering in
   the other.
6. **Prototype notes:** for a product-style demo, leave **Show prototype notes** off (demo clock
   menu). For a spec review, turn it on: “In the real app…” notes and open-question markers appear.

## Who to sign in as

The three active projects have the same team, so each person has the same role everywhere.

| Person | Role | Use them to show |
| --- | --- | --- |
| **Farhana Kabir** | Admin (system-wide) | Admin pages: templates, users, settings, import, AI activity, audit log; the portfolio view |
| **Imran Chowdhury** | Project Owner of every project | Home portfolio view, new project wizard, team changes, Away, archive |
| **Nusrat Jahan** | Project Manager (PM head) | Running intake, generating documents, approvals, decisions, change requests, defect triage, UAT sign-off |
| **Sadia Islam** | Deputy PM | Acting for the PM when Nusrat is Away |
| **Rafiq Hasan**, **Mehnaz Akter** | PM team members | Editing documents, accepting suggestions, the edit lock |
| **Arif Rahman** | Tech head | Approving documents, confirming the SQA test list, approving the SQA sign-off, answering technical questions |
| **Kamrul Hossain** | Deputy tech head | Acting for the tech head |
| **Shuvo Das**, **Nabila Sultana** | Developers | Registering builds, fixing defects; seeing what developers are not allowed to do |
| **Tania Ferdous**, **Mahmud Karim** | SQA testers (tech team, SQA tag) | SQA test cases, runs, builds, release to UAT, retesting |
| **Rokeya Begum** | Stakeholder head (**Away** in Branch Cash) | Confirming the Fact Sheet, approving documents, confirming the UAT test list |
| **Jahid Hasan** | Deputy stakeholder head | Approving **as deputy** while Rokeya is Away |
| **Shirin Akhter**, **Habib Ullah** | Stakeholders (UAT testers) | Writing the description, answering questions, commenting, UAT testing, raising defects |
| **Selim Reza** | Sponsor head | Answering budget questions, **signing** the Charter, BRD and SRS |
| **Laila Nasrin** | Deputy sponsor head | Suggestions in Branch Cash |
| **Grace Mwangi** | Sponsor, outside BRAC | An external member (signs with an email code) |
| **Mithila Sarker**, **Anwar Hossain**, **Dilruba Yasmin** | People from past projects | Cross-project messages: they see only that one conversation |

The projects: **Field Loan Application App** (just created, for the full walkthrough), **Branch
Cash Reconciliation** (BRD in review), **Member Savings Statement Portal** (in UAT testing), and
two finished past projects used by the RAG agent.

---

## Part 0 — The Simple view (8 min)

The view most people will use. Show it first, then flip to **Full** to show the difference.

1. Be **Selim Reza** (sponsor head). **To do** shows only what he must do, as plain sentences with
   one button each. Point out the top bar: four places, nothing else.
2. Be **Nusrat Jahan** (PM). **To do** lists her tasks, oldest first; the first one is highlighted.
   **Recent updates** is folded away.
3. **Projects → Branch Cash Reconciliation:** “Step 4 of 8”, **Your turn** with one button, the
   documents so far, and only the areas that matter now. Team, changes and the activity log are
   under **More**.
4. Be **Jahid Hasan** → open the **Business requirements (BRD)**: “Waiting for your approval, as
   deputy for Rokeya Begum, who is away”, **Your turn**, a blue box **What changed since version 2**,
   the text, and **Approve (as deputy)** / **Ask for changes** at the bottom of the screen.
   **Comments** open on request; **More** has editing, history, compare and downloads.
5. Questions (after Part 4 starts a round): **To do → Answer** shows one question at a time with
   **Save answer** and **I don't know**.
6. Profile menu (top right): **Text size** A / A+ / A++ and light or dark colours. With larger
   text, the four places move to their own row so nothing is cut off.
7. Click **Full** (top bar): the same page with every tool. Click **Simple** to come back.
8. **Help:** short “How do I…” answers.

## Part 1 — Login, look and navigation (5 min) — anyone

1. **Login page:** point out the prototype note, the demo users grouped by team, and the
   **sun/moon** button at the top right (dark mode).
2. Sign in with the form: `nusrat.jahan@brac.example` / `demo1234`.
3. Walk around the frame:
   - **Sidebar:** Home, My work, Inbox, Messages (with unread counts), your projects (the open
     project expands to show its pages), **Help & prototype** at the bottom.
   - **Search** (or **Ctrl+K**): type `brd` and press Enter to jump to a BRD. Type `dark` to switch
     theme from the keyboard.
   - **Sun/moon button** next to search: light or dark mode. The **profile menu** also offers
     **System** (follows the computer).
   - **Bell**: the latest notifications.
   - **Messages bar** at the bottom right: the chat dock (Part 9).
   - **AI tray** at the bottom left: appears whenever the AI is working (Part 4).
4. **Phone layout:** make the window narrow. The sidebar becomes a menu button, and the chat
   becomes a round button.

## Part 2 — Home dashboard and project overview (6 min)

1. Be **Imran Chowdhury** (Owner). **Home** shows:
   - **Number tiles:** waiting on you, documents in review, open Q/A questions, open defects (with
     critical ones), decisions to confirm. Some tiles open the list behind them.
   - **Waiting on you:** each item with how long it has waited (grey under a day, amber up to 3
     days, red after that).
   - **Conversations:** recent and unread chats. Click one to open it in a chat window.
   - **Project cards:** health (On track, Waiting, Delayed, Needs attention), progress ring,
     stage, the **next step** (who must act and for how long), the heads, and counts of
     questions, defects and decisions.
   - **Activity:** a 14-day chart and the latest actions.
   - **Pipeline** (projects by stage) and **Stalled across the portfolio** (longest waiting
     first, with “deputy covering” where it applies). Only the Owner and the Admin see these.
2. Switch to **Nusrat Jahan**. Her Home has no portfolio section. Similar items are grouped
   (“3 decisions are waiting for your confirmation”).
3. **My work:** everything waiting on her, with **Q/A questions** and **Tests** tabs.
4. Open **Branch Cash Reconciliation** (sidebar). The **overview** shows the stage bar, one
   **Next step** card, the document list with “waiting on … since”, **Needs attention**, the
   **Team discussion** with a reply box, the team heads, and **Discuss** (opens the project chat).
   The **…** menu has Team and roles, Audit log, and Open in Messages.

## Part 3 — New project and team management (8 min) — Imran

1. Be **Imran**. Click **+** next to Projects (or **New project** on Home). The wizard:
   1. **Details:** a name and a short description → **Next**.
   2. **Project Manager:** choose Nusrat → **Next**.
   3. **Teams and heads:** use **Load a saved team template**, or add people from the
      directory. Show the head (crown), deputy, and the **SQA** tag on tech members. In the
      **Add from the user directory** list, people already in another team are greyed out
      (“already in …”): one role per person.
   4. **Review and invite** → **Create project and send invitations**.
2. The new project opens in the **Intake** stage. Members got a notification and an email
   (**Help & prototype → Mailbox**).
3. Open the new project's **Team** page (use this project, so the demo projects stay intact):
   - **Add** someone → **Add and notify**.
   - **Replace** a person (a pending approval moves to the new head, on the same version).
   - **Make head**, **Make deputy**, **Toggle SQA tag**, **Remove**.
   - **Away** on a head: choose an end date. Their deputy now receives approvals, signatures,
     questions and reminders. **End Away** stops it.
   - **Save as team template** (it appears in the wizard next time).
4. Switch to **Nusrat** and open the Team page: she sees the team but cannot change it. Only the
   Owner can.
5. Next to **Team** is the **Audit log**: every action, by whom and when.

## Part 4 — Intake, Q/A rounds and the Fact Sheet (12 min) — Field Loan Application App

1. Be **Shirin Akhter** (stakeholder). Open **Field Loan Application App → Intake & facts**.
   - **Description and files:** the description is already written (**Edit** to change it).
   - Click **Upload a file** and choose any PDF or image. Open it to see the **extracted text**
     (simulated OCR, English and Bangla).
2. Be **Nusrat** (PM). Click **Run intake analysis**. The **AI tray** (bottom left) shows the
   steps: the Q/A agent extracts facts, then the RAG agent searches past projects.
3. **Fact Sheet** tab: every required field with its value, status (filled, missing, assumed,
   conflicting), source and the documents that need it. **Number of users** is **conflicting**
   (the description says 1,200, the upload says 1,450) → **Settle** → **Use this value**.
4. **Similar projects** tab (PM team only):
   - A **duplicate warning**: Field Collection Tracker matches 92%. Click **Acknowledge** (rounds
     cannot start until it is acknowledged).
   - Each match shows why it matched, matching sections, **View full document**, and its members.
     **Rashed Kabir** shows **unavailable** (deactivated).
   - Click **Message** next to **Mithila Sarker**: a chat window opens at the bottom right. Send
     her a question.
   - **Suggestions:** old-project details are highlighted in yellow. Click **Still true here** or
     **Replace** for each, then **Accept into the Fact Sheet** (accept the risk and the success
     criteria). **Reject** another one: it stays in the log.
   - Back on the **Fact Sheet**, accepted items carry the credit “From Field Collection Tracker
     (PM: Mithila Sarker)”.
5. **Q/A questions** tab → **Start the first round**. The card shows the routing: business
   questions go to stakeholders, funding to sponsors, technical ones to the tech team. Only five
   questions are needed, because the RAG suggestions filled two.
6. Be **Selim Reza** (sponsor head). **My work → Q/A questions**:
   - Budget: **Answer** → **Use sample answer (demo)** → save.
   - Funding source: **Answer** → tick **Unknown**. It is stored as an assumption with the agreed
     default.
7. Be **Habib Ullah** (stakeholder). Answer his three questions with **Use sample answer**.
8. Be **Nusrat**. **Q/A questions → Close round**. (If something was left unanswered, show
   **Ask again** and **Proceed with gaps logged**. The round limit is set by the Admin.)
9. **Fact Sheet → Send for confirmation**.
10. Be **Mithila Sarker** (past project). She sees only Nusrat's message, nothing else from the
    project. She can reply.
11. Be **Rokeya Begum** (stakeholder head). **Intake & facts → Fact Sheet**:
    - Optionally **Comment on what is wrong** → **Send to the PM team** (Nusrat sees it on the
      Description and files tab).
    - **Confirm Fact Sheet**. This saves Fact Sheet version 1, and the project's next step
      becomes “Generate the Proposal”. (Comparing versions is shown in Part 7.)

## Part 5 — The Proposal: drafting, comments, editing, versions, approval (15 min) — Field Loan

1. Be **Nusrat**. Open **Proposal** → **Generate with AI**. The AI writes it section by section
   from the confirmed facts. The header shows **AI draft**.
2. Be **Habib**. In the **Document** view, select a sentence in **Scope** → **Comment**, use
   **Tag people** to tag Rafiq, and send. Select other text → **Suggest wording**. Both appear in
   the **Comments** rail on the right. (Rafiq gets an in-app notification and an email.)
3. Be **Nusrat**. **Send for approval** (top right) is greyed out with the reason: there is an open
   comment. Open comments and comments pending a check block the chain.
4. Be **Rafiq Hasan** (PM team), ideally in a second window:
   - In the rail, **Accept** Habib's suggestion: it goes into the draft.
   - Click **Edit**. Open **Rewrite with AI** on Objectives, type an instruction, **Rewrite**, then
     **Accept** the diff.
   - Change the sentence Habib commented on, then **Save version** with a message. The scope check
     says the edit touches objectives.
   - Habib's comment becomes **Pending check**, because its text changed.
5. **Edit lock** (two windows): while Rafiq is editing, Nusrat's window says Rafiq is editing.
   Show **Show live edits**. Nusrat can **Force-unlock** from the **…** menu. Demo clock menu →
   **+1 hour** releases an idle lock (the draft is autosaved).
6. Be **Habib** (or **Shirin**, same team). On the pending comment: **Confirm** (or **Reopen**).
   Show **Show resolved comments log**.
7. Be **Nusrat**. On the banner, decide **Normal edit** (or **Scope change**, which starts a change
   request). Then **Send for approval** and **Approve**.
8. Be **Arif Rahman** (tech head): **Approve**. Then be **Shuvo Das** (developer): the rail says his
   team can no longer comment, because his head has approved this version.
9. Optional: **Request changes** and minor correction. Be **Rokeya** → **Request changes** with a
   comment. Be **Nusrat** → **Edit**, fix the text, **Save version** → **Declare minor
   correction**. The AI checks the scope. If scope is untouched, earlier approvals carry over and
   the chain resumes with Rokeya, who sees the diff. If scope is touched, it is refused and the
   full chain runs again.
10. Be **Rokeya** → **Approve**. In the rail, the **Approval** tab shows each reviewer with a tick.
11. Show the other views of the document (the switch above the text):
    - **History:** every version. **View**, **Changes**, **Restore**.
    - **Compare:** any two versions side by side.
    - **Summary:** one-page summary, very short summary and slides, each labelled “AI summary of
      version N”. **Download PPTX**.
    - **…** menu: **Download PDF**, **Download Word (.docx)**.

## Part 6 — Charter, BRD and SRS: signing, extra rounds, traceability (optional, 15 min) — Field Loan

This part takes Field Loan to signed documents. Each document follows the same pattern as the
Proposal, with signing at the end.

1. **Charter:** be **Nusrat** → **Charter → Generate with AI** → **Send for approval** →
   **Approve**. Be **Arif** → **Approve**. Be **Rokeya** → **Approve**.
2. Be **Selim Reza** (sponsor head) → **Approve and sign** → choose **password**, type
   `demo1234`, and sign. The record says it is an electronic approval record, not a
   CCA-certified signature. The version is now **frozen**.
3. Be **Nusrat** → **Intake & facts**: a banner asks for the **business processes** round before
   the BRD → **Start the round**. Be **Habib** and **Shirin** → answer. Be **Nusrat** →
   **Close round**.
4. **BRD:** generate, approve (Nusrat, Arif, Rokeya) and sign (Selim). This time, sign with
   **Email one-time code** → **Send me a code** → open **Help & prototype → Mailbox** in your
   second window → copy the code → sign.
5. Before the **SRS**, start the **technical** round (Intake banner). Be **Arif** or **Kamrul** →
   answer → be **Nusrat** → close it. Then generate, approve and sign the SRS.
6. **SRS → Traceability → Build the matrix:** each requirement linked to its BRD and Charter
   parent. An unlinked requirement (SR-08) is flagged.
7. The project moves to **SQA**. Draft its tests with AI:
   - Be **Tania Ferdous** (SQA) → **SQA → Test cases → Draft test cases with AI**: one draft per
     SRS requirement, labelled AI until accepted → **Accept all … AI drafts** (or edit one, then
     **Save and accept**).
   - Be **Arif** → **Confirm the list (tech head)**. Testing can now start.
   - UAT works the same way: the PM team drafts UAT tests from the BRD and the stakeholder head
     (Rokeya) confirms the list.
8. The rest of testing is shown with a project that is already in UAT (Part 8).

## Part 7 — Branch Cash: deputies, signing, Fact Sheet updates, decisions, change requests (12 min)

1. Be **Jahid Hasan** (deputy stakeholder head). Open **Branch Cash Reconciliation → BRD**.
   Rokeya is **Away**, so Jahid sees **Approve (as deputy)**. Click it. The record will say who
   acted for whom.
2. Be **Selim Reza** → **BRD** → **Approve and sign** with an **Email one-time code** (code in the
   **Mailbox**).
3. **Charter** (any member): it was sent back by the sponsor (“split the budget”), edited and
   signed. In the rail's **Approval** tab:
   - **Earlier approval rounds** shows the history.
   - **Open the signed PDF (stored copy)**: the stored copy plus a certificate page with SHA-256
     fingerprints.
   - Click **Verify fingerprint**.
4. Be **Nusrat** → **BRD**:
   - The rail shows Habib's open comment and Laila's suggestion. **Accept** or **Reject** the
     suggestion.
   - A notice says **The AI proposed 1 Fact Sheet update from edits** → **Review** → on
     **Changes & decisions**, **Accept (new Fact Sheet version)**.
   - **Intake & facts → Fact Sheet → Compare versions**: pick two versions to see what changed.
     (**Restore** brings back an older version as a new one.)
5. **Changes & decisions → Decisions:** decisions marked in chat and found by the AI in a meeting
   transcript.
   - On one: **Confirm into the Fact Sheet** → choose the fact → **Confirm**.
   - **Dismiss** another one.
   - On the last one: **It changes scope: start a change request**.
6. **Change requests:** the new request (or **New change request** → **What is changing?** and
   **Which facts change?** → **Start**):
   1. The AI asks **questions about the change**. Each shows who it is for: be that person and
      click **Answer (if it is yours)**.
   2. **Update the Fact Sheet and run the impact analysis**, or **Run impact analysis**: the
      affected documents and sections are listed.
   3. **Regenerate affected sections**: each AI-regenerated section is shown as a diff →
      **Accept** or **Reject**.
   4. **Create new versions and restart the pipeline** → **Go to the Proposal**. Later documents
      are **Out of sync**. Their banner has **Choose sections to regenerate**, and an unchanged
      Proposal can be sent for re-approval.
7. **Audit log** (Team → Audit log): builds, approvals, deputy actions, decisions, the change
   request.

## Part 8 — SQA and UAT testing (15 min) — Member Savings Statement Portal

1. Be **Nusrat** → **Member Savings Statement Portal → UAT**. Walk the tabs: **Overview**
   (progress), **Test cases** (with requirement coverage; BR-06 is **Not testable**), **Builds**,
   **Runs**, **Defects**, **Sign-off**.
2. **Test cases:** each has an ID, steps, expected result, requirement, priority, type and
   history. Both lists were confirmed already (by Arif for SQA and Rokeya for UAT). AI drafting
   is shown in Part 6, because every Savings requirement already has tests.
   - Be **Tania Ferdous** (SQA) → **SQA → Test cases → New** to add one by hand.
   - Be **Nusrat** → **UAT → Test cases**: **mark Not testable** on a requirement with a reason
     (and **undo**). Only the PM can.
3. **Builds:**
   - Be **Shuvo Das** (developer) → **SQA → Builds → Register a build**: version, test
     environment, notes and **Defects this build fixes** → **Register**. It is available to SQA
     at once.
   - Be **Mahmud Karim** (SQA). Build **1.1**: **Release to UAT** is greyed out, and the reason is
     shown.
4. Be **Mahmud** → **My work → Tests** → **Run test** on **SQA-TC-3** → **Pass** → record it.
5. **SQA → Defects:** **SQA-5** is **Ready for retest** → open it → **Retest passed: close**.
6. **SQA → Builds:** for **UAT-4** in build 1.1, click **Fix works** (or **Still fails**), then
   **Release to UAT**. UAT-4 is now ready for its reporter to retest.
7. Be **Habib** (stakeholder):
   - **My work → Tests** → **Run test** on **UAT-TC-4** → **Fail**. Type a rough note and click
     **Write**: the AI defect writer fills in steps, expected and actual, and shows a possible
     duplicate. **Attach a screenshot** → **Raise defect**.
   - Open **UAT-5** (Ready for retest) → **Retest passed: close**.
8. Be **Nusrat** → **UAT → Defects** (board view):
   - Drag the new defect from **New** to **Open** and choose a developer (triage).
   - Drag a card where she is not allowed: it snaps back with the reason.
   - **Show rejected, duplicate, deferred** reveals the outcome columns.
   - Switch to the **list** view (filters).
   - Open **UAT-1** → **Reject (not a defect)**, **Mark duplicate**, **Defer to after go-live**
     (Medium/Low only) or **Turn into a change request**.
9. Open any defect page (as anyone): comments with @tags, **Attach**, **Watch**, the full history.
10. Be **Shuvo** (developer) → **UAT-2** → **Start work** → **Mark fixed** (choose the build).
    There is no **Close** button for developers: only the reporter's team closes defects.
11. **New test run:** be **Tania** for SQA (or **Nusrat** for UAT) → **Runs → New test run** →
    choose build and tests → **Create run**. The tests appear in each tester's **My work → Tests**.
12. **Sign-off:**
    - **SQA → Sign-off** shows the signed SQA sign-off (approved by the tech head, which released
      build 1.0 to UAT automatically).
    - Be **Nusrat** → **UAT → Sign-off** → **Generate report**: numbers counted from the data, an
      AI summary paragraph, and the known issues. The **exit criteria** checklist is red (UAT-2 is
      Critical and open), so **Send for approval** is blocked with the reason. Once criteria are
      met, the chain is PM → tech head → stakeholder head, and the sponsor head signs.

## Part 9 — Chat, calls and meetings (8 min)

1. Be **Nusrat**. The **Messages** bar (bottom right) is on every page and shows unread messages.
   Open it: search, **All / Channels / Direct**, the current project's channels first.
2. **Direct message:** open **Arif Rahman**. Messenger-style bubbles, **Seen** or **Sent** under
   her last message. Reply. (Be **Arif** in the other window to see it arrive.)
3. **Group channel:** open the **Branch Cash Reconciliation** project chat. Slack-style messages
   with names. Hover a message for 👍 ✅ 👀 🎉 and **Decision** (Mark as decision, which the PM
   confirms on the Decisions page). Type `@` to mention someone (they get a notification).
4. **Document chats:** on any document, **Discuss** opens that document's chat. Document comments
   never appear in chat.
5. **New message** (pen icon in the Messages bar): message anyone in the directory.
6. **Windows:** up to two chat windows open next to the bar. Minimise, expand to the full page, or
   close them.
7. **Call:** in the **Field Loan** project chat, click the **video** icon. The call screen shows
   participants; your own camera and screen sharing work. Switch **Transcription on**: everyone
   sees “This meeting is being transcribed” (only the starter can switch it). **End call**.
8. The **transcript** appears in the chat after processing (AI tray). Toggle **Corrected / Raw**
   (Bangla). Candidate decisions go to **Changes & decisions → Decisions**.
9. **Meeting audio:** in a project chat, the audio icon in the message box uploads a recording to
   transcribe.
10. **Messages page** (sidebar → Messages): three panes with conversations, the chat, and details
    (people and their roles, Away status, decisions from that chat).

## Part 10 — Reminders, notifications and email (4 min)

1. Be **Nusrat**. Demo clock menu → **+4 hours** (or **Next working morning**). The message says
   how many reminders were sent. Reminders only go out in working hours (Sunday to Thursday,
   9–17), every 4 working hours, to the deputy while a head is Away.
2. **Inbox:** every notification. Click one to go to the item; **Mark all read**.
3. **Help & prototype → Mailbox:** every email the app would send, including signing codes.
4. Demo clock menu → **Reset clock** returns to the starting time.

## Part 11 — Admin (8 min) — Farhana Kabir

Be **Farhana Kabir**. Sidebar → **Admin**:

1. **Templates:** the four document templates (sections, AI writing instructions, required facts,
   scope-sensitive flag). Open the **SRS** template, change something, and **Save as v2**.
   Projects keep the version they started with. Be **Nusrat** → **Branch Cash → SRS** (not
   generated yet): it offers **A newer template (v2) exists. Switch to it.**
2. **Users:** **Add user** (with “Outside BRAC (signs with an email one-time code)”),
   **Deactivate** and **Reactivate**. Email and password login; BRAC sign-in can be added later.
3. **Settings:** working days and hours, holidays, reminder interval, Q/A round limit, edit-lock
   timeout, severities that block sign-off, duplicate warning threshold, how many similar projects
   are shown → **Save**.
4. **Import past projects:** name, year, department, members, documents (**Add a document**) →
   **Import and index**. The project becomes a finished project the RAG agent can find.
5. **AI activity:** every AI call (agent, project, prompt tokens, duration).
6. **Audit log:** everything across all projects.
7. Farhana's **Home** also has the portfolio view (pipeline and stalled items).

## Part 12 — Permissions: what people cannot do (5 min)

Each refusal shows the reason. Show a few:

- Be **Habib** (stakeholder) → Field Loan **Intake & facts**: there is no **Similar projects**
  tab (PM team only).
- Be **Shuvo** (developer) on a document his head has approved: he cannot comment any more.
- Be **Nusrat** → **Send for approval** with an open comment: greyed out, with the reason.
- Be **Nusrat** on the defect board: drag a card to a column she may not use, and it snaps back.
- When **Nusrat** triages a defect, only developers can be chosen: SQA testers cannot be assigned
  defects. Be **Shuvo** on a defect: developers cannot close it.
- Be **Nusrat** on the **Team** page: only the Owner changes the team.
- Be **Mithila Sarker** (past project member): she has no active projects. From Field Loan she sees
  only the conversation Nusrat started, nothing else.

## Part 13 — Archive and wrap-up (3 min)

1. **Help & prototype → Archived & finished:** the two finished past projects, read-only.
2. Be **Imran** → a project's **Team** page → **Archive project**. It becomes read-only and leaves
   the active dashboard. Do this last, or use the project you created in Part 3.
3. **Help & prototype → Open questions:** what the spec leaves open and what the prototype
   assumes. **How the real app works:** LM Studio, BanglaASR, OCR, embeddings, LiveKit, signing.
4. Demo clock menu → **Reset demo data** to start over.

---

## Feature checklist

| Feature | Part |
| --- | --- |
| Login, demo users, dark mode, quick search (Ctrl+K), phone layout | 1 |
| Home dashboard, portfolio view, My work, project overview | 2 |
| New project wizard, team templates, team changes, Away and deputies | 3, 7 |
| Uploads with OCR, intake analysis, Fact Sheet, conflicts, versions | 4 |
| RAG: similar projects, duplicate warning, suggestions, cross-project messages | 4 |
| Q/A rounds, routing, “Unknown” answers, round limit, extra rounds | 4, 6 |
| AI drafting, comments, @tags, suggestions, pending check, resolved log | 5 |
| Editing, Rewrite with AI, edit lock, live view, force-unlock, versions, compare, restore | 5 |
| Scope check, approval chain, request changes, minor correction | 5 |
| Summaries, slides, PDF, Word and PPTX exports | 5 |
| Signing with password or email code, frozen versions, fingerprints | 6, 7 |
| SRS traceability matrix | 6 |
| Deputy approvals, Fact Sheet updates from edits, decisions, change requests, Out of sync | 7 |
| Test cases (AI drafts), list confirmation, Not testable, builds, release to UAT | 8 |
| Test runs, My tests, Pass / Fail / Blocked, AI defect writer, duplicates | 8 |
| Defect board, triage, outcomes, retests, defect page, sign-off reports, exit criteria | 8 |
| Chat dock, channels, direct messages, reactions, mentions, Mark as decision | 9 |
| Calls, transcription, transcripts, meeting audio | 9 |
| Reminders, time travel, Inbox, Mailbox | 10 |
| Templates, users, settings, import, AI activity, audit log | 11 |
| Permission refusals | 12 |
| Archive, finished projects, open questions, how the real app works | 13 |
