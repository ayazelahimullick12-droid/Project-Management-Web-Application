# Project Management WebApp — Functional Spec

Oct 6, 2026 · @Ayaz

## Overview

The app takes a BRAC project from a stakeholder's request to four approved documents: Project Proposal, Project Charter, BRD and SRS. AI agents gather the information and draft; people review, approve and sign.

- **In scope:** project setup, the Q/A agent and Fact Sheet, document generation, approvals and signing, versions, comments, chat and calls, notifications, dashboard, archive.
- **Reuse:** a RAG agent suggests items from similar finished projects, and the PM team decides what to add.
- **Out of scope:** project execution after the SRS is signed.
- **Language:** all documents are in English.

## Roles and permissions

Roles are assigned per project. Each team has one named head, and one person can hold only one role in a project.

| Role | Scope | Responsibilities |
| --- | --- | --- |
| Admin | Whole system | Creates and maintains the BRAC document templates |
| Project Owner | One project | Creates the project, assigns all roles, heads and deputies, reassigns people, archives the project |
| Project Manager | Head of the PM team | First approver; decides normal edit vs change scope; declares minor corrections; confirms Fact Sheet items; force-unlocks documents |
| PM team members | PM team | Edit documents, accept suggestions, resolve comments |
| Tech head | Head of the tech team | Second approver; answers technical questions from the Q/A agent |
| Stakeholder head | Head of the stakeholders | Third approver; confirms the Fact Sheet |
| Sponsor head | Head of the sponsors | Signs the Charter, BRD and SRS |
| Deputy (one per head) | Same team as the head | Acts for the head while the head is marked Away |
| Other team members | Tech, stakeholder and sponsor teams | View, comment, suggest, tag, chat |

| Action | PM team | Tech, stakeholder and sponsor teams |
| --- | --- | --- |
| View every document and every version | Yes | Yes |
| Comment, suggest wording, tag people | Yes | Yes, until their team's head has approved that version |
| Edit manually or ask AI to regenerate a part | Yes | No |
| Accept suggestions, resolve comments | Yes | No |
| Confirm or reopen an auto-resolved comment | Members of the author's team | Members of the author's team |
| Approve | Project Manager only | Tech head and stakeholder head, each in turn |
| Sign | No | Sponsor head only |

## Project setup

The Project Owner sets up the whole team at creation and can change anyone later.

1. Create the project: name and a short description.
2. Assign the Project Manager.
3. Add members to the four teams (PM, tech, stakeholders, sponsors) from the BRAC user directory. The system blocks adding one person to two teams.
4. Mark one head for each of the tech, stakeholder and sponsor teams.
5. Mark one deputy for each head (the PM included), chosen from the same team.
6. Invitations go out in-app and by email.

- **Reassigning:** the Owner can replace any member, head or deputy at any time. A pending approval moves to the new head on the same version.
- **Deputies:** a head marks themselves **Away** with start and end dates (or the Owner does it for them). While a head is Away, their pending approvals, signatures and Q/A questions go to their deputy, and reminders go to the deputy. Every action records who actually took it ("Approved by deputy X for head Y").
- **Team templates (suggested):** save a team as a template, so people who work together often don't have to be added one by one each time.

## Q/A agent and the Project Fact Sheet

The Q/A agent turns everything people provide into a confirmed **Project Fact Sheet**. Every document is generated from the Fact Sheet; it is the project's single source of truth.

**Inputs**

- The stakeholders' description of what they want.
- Uploaded files: PDF, DOCX and images. Scanned pages are read with OCR.
- Items from similar past projects, after the PM team accepts them (see RAG agent).
- Answers to the agent's questions.
- Meeting transcripts and chat decisions, after the PM confirms them (see Chat and meetings).

**Checking completeness**

- A required-fields checklist is built from all four templates together.
- The agent marks each field as filled, missing, assumed or conflicting.

**Question loop**

- Questions go to the right people: business questions to stakeholders, funding to sponsors, and technical questions (performance, security, integrations, hosting) to the tech team.
- "Unknown" is a valid answer. The agent records it as an assumption with an agreed default.
- When two people's answers conflict, the agent flags it for the PM to settle.
- After a set number of rounds, the PM decides whether to ask again or proceed with the gaps logged.
- Unanswered questions trigger a reminder every 4 working hours (see Notifications).

**The Fact Sheet**

- Each fact has a value, a category (scope, budget, timeline, requirement and so on), a link to its source, and a status.
- It is versioned like the documents. Every Fact Sheet version is kept and can be compared and restored.
- The stakeholder head confirms it before the Proposal is drafted.

**Keeping the Fact Sheet and documents in step**

- When a manual edit to a document changes a fact (for example a date, a budget line or a requirement), the AI proposes a matching Fact Sheet update, linked to that edit.
- A PM team member accepts or rejects the proposed update. Accepting it creates a new Fact Sheet version.
- If the update changes scope, the change request flow applies (see Editing, versions and change requests).

**Extra rounds before later documents**

- Before the BRD: business processes, how they work today and how they should work.
- Before the SRS: a technical round answered by the tech team.

## RAG agent: reuse from past projects

RAG runs once, right after the stakeholders have given all their information to the Q/A agent. It suggests useful items from similar finished projects, and the PM team decides what, if anything, to add.

**What is searched**

- Only finished projects (all four documents signed), and only their signed or frozen versions.
- BRAC projects from before the app will be added to the archive later. The Admin needs an import tool for their documents (Word, PDF) with basic details: name, year, department.

**What the PM team sees**

Only the PM team sees these results. Stakeholders, the tech team and sponsors do not.

- For each similar project: its name, a short summary, why it matched, its project members, and the matching sections.
- **View full document** opens the signed version of each of its documents.
- Matches are shown as found, with no information on how the project turned out.

**Suggestions to the Q/A agent**

1. RAG finds items in the similar projects that the stakeholders did not mention, such as requirements, risks, objectives and technical decisions.
2. These go to the Q/A agent as optional suggestions.
3. A PM team member accepts or rejects each one. Adding anything is optional.
4. An accepted item becomes a proposed fact in the Fact Sheet, labelled "From Project X (PM: name)" and linked to its source section.
5. The AI highlights old-project details in it (names, dates, places, numbers, budgets, vendors). Each must be confirmed or replaced.
6. The Q/A agent then checks for missing fields as usual, so accepted items can mean fewer questions to stakeholders.
7. The stakeholder head confirms the Fact Sheet as usual.

**Talking to the original team**

- PM team members see a **direct message** button beside the name of each member of the similar project.
- **Mark as decision** works in these messages as in other chats. The PM confirms before anything enters the Fact Sheet.

**Duplicate warning**

If a finished project is a very close match, the PM sees a warning, with that project's PM as a contact. The PM must acknowledge the warning before the project continues.

## Document pipeline

The four documents are produced in a fixed order. Each one starts only after the previous one is fully approved (and signed, where signing applies).

| Document | Generated from | Extra Q/A round first | Approved by | Signed by sponsor head |
| --- | --- | --- | --- | --- |
| Project Proposal | Fact Sheet | No | PM, then tech head, then stakeholder head | No |
| Project Charter | Fact Sheet and the approved Proposal | No | PM, then tech head, then stakeholder head | Yes |
| BRD | Fact Sheet and the signed Charter | Business processes | PM, then tech head, then stakeholder head | Yes |
| SRS | Fact Sheet and the signed BRD | Technical, answered by the tech team | PM, then tech head, then stakeholder head | Yes |

**Restarting the pipeline**

- **Scope change:** the pipeline restarts from the Proposal. If the Proposal needs no change, the PM team leaves it unedited and the approvers re-approve the existing version; the pipeline then moves on to the Charter.
- **Change to an earlier document:** if any document changes after later documents exist, the pipeline restarts from that document. All later documents are marked **Out of sync** and go through approval (and signing, where it applies) again, in order. The PM chooses which affected sections of each later document to regenerate.

**Derived outputs**

Every saved version of every document is regenerated in four forms: the full document, a one-page summary, a PowerPoint presentation, and a very short summary.

- The three shorter forms exist only to help people understand the document quickly.
- Approval and signing apply to the full document only.
- Each short form is labelled "AI summary of version N".

**SRS traceability**

The SRS includes a requirements traceability matrix: each SRS requirement links to a BRD requirement, and each BRD requirement links to a Charter objective. Any requirement without a link is flagged.

**Templates and export**

- The Admin maintains the templates.
- A project keeps the template version it started with. The PM can choose to switch to a newer one.
- Every form can be exported (PDF, DOCX, PPTX) with BRAC branding.

## Approval and signing

Every document is approved in order by the PM, then the tech head, then the stakeholder head. The sponsor head then signs the Charter, BRD and SRS. Every approval is tied to one exact version.

&#91;embedded content: approval flow · 3 approvers, sponsor signature for Charter, BRD, SRS\]

The Proposal is frozen after the stakeholder head approves; the other three documents also need the sponsor's signature. The sponsor can also request changes, which sends the document back the same way.

**Approval rules**

- The approval chain can only start when the document has no open comments and no comments pending check.
- Each approver is notified in-app and by email when it is their turn, and reminded every 4 working hours until they act.
- An approver has two buttons: **Approve** and **Request changes**. Request changes requires at least one comment.
- Request changes sends the document back to the PM team. Their edit creates a new version, and the chain restarts from the PM (unless the PM declares a minor correction, below).
- A new version cancels all approvals given to earlier versions, except under a minor correction.
- **Editing during review:** the PM team can save a new version while a document is in review. Saving it restarts the chain from the PM, and the approver who currently holds the document is notified that the version they were reviewing has been replaced.
- **Comments during review:** once a team's head has approved a version, members of that team can no longer comment on that version. Teams whose head has not yet approved can still comment; their head uses Request changes if a comment needs action.
- There is no conditional approval and no cancellation.

**Minor correction**

For small fixes after a Request changes, so the whole chain does not have to run again.

1. An approver (or the sponsor head) clicks **Request changes**.
2. The PM team edits the document and saves a new version.
3. The PM declares the new version a **minor correction**.
4. The AI checks the edit. If it touches objectives, deliverables, budget or timeline, it cannot be a minor correction and the full chain runs instead.
5. Approvals given before the requester carry over to the new version. The chain resumes at the requester, who sees the diff against the version they reviewed.
6. After the requester approves, the chain continues to any remaining approvers and the sponsor as usual.

The version history labels the version "Minor correction" and records who declared it.

**Signing**

- The sponsor head clicks **Approve and Sign**, then re-enters their password or an email one-time code.
- The system saves the exact PDF of the document being signed and computes its SHA-256 fingerprint (hash).
- A signature page (certificate of completion) is added, showing who signed, when, from which IP address, and the document's fingerprint.
- The final PDF (document plus signature page) is saved as a file with its own fingerprint.
- Both PDFs are stored exactly as signed and are never regenerated. Downloads of a signed version always serve the stored file.
- The sponsor head can also Request changes. The document then goes back to the PM team in the same way.
- The signed version is frozen. Any later change creates a new version that needs the full chain and a new signature.
- This is an electronic approval record with an audit trail, not a CCA-certified digital signature under Bangladesh's ICT Act. It is suitable for internal governance.

## Editing, versions and change requests

Only PM team members edit. Every saved version is kept, like a Git commit, and the PM decides whether an edit is a normal edit or a scope change.

**Normal edits**

- Manual editing.
- AI regeneration of a part: a PM team member writes an edit prompt. The AI's result appears as a diff to accept or reject, never as a silent overwrite.

**Editing lock**

- One editor per document at a time. Everyone else can view the document live while it is being edited.
- The lock is released when the editor saves or leaves, or after 1 hour idle. Work is autosaved first.
- The PM can force-unlock a document.
- AI regeneration takes the lock too.

**Versions**

- Work is autosaved as a draft. **Save version** creates a numbered version with a short message.
- The history shows each version's author, time and message.
- Any two versions can be compared section by section, with changes highlighted as on GitHub.
- An old version can be restored. Restoring creates a new version on top.
- Every member can see every version.

**Change scope (change request)**

- The AI flags edits that touch objectives, deliverables, budget or timeline. The PM decides whether the edit is normal or a scope change.
- For a scope change:
  1. The Q/A agent asks only about what changed.
  2. The Fact Sheet is updated.
  3. An impact analysis lists the affected documents and sections.
  4. Those sections are regenerated.
  5. The pipeline restarts from the Proposal (see Restarting the pipeline).

## Comments and suggestions

Any member can highlight text, comment, suggest new wording and tag people, subject to the review rule above. Comments are visible to everyone and never appear in chat.

- **Tagging** sends an in-app and email notification that shows the comment.
- **Suggestion mode:** a member proposes exact replacement text, and a PM team member accepts or rejects it.
- **Carrying forward:** a comment stays on the version it was added to. It carries forward to new versions as long as the commented text is not edited and its section is not regenerated.
- **Resolving:**
  - A PM team member ticks the comment, or
  - the comment auto-resolves when the commented text is edited manually or regenerated.
- **Pending check:** an auto-resolved comment becomes **Pending check**. Any member of the comment author's team can confirm it (it is then resolved) or reopen it on the new version. The author is notified.
- **History:** resolved comments disappear from view but stay in the log, together with the version where they were resolved.
- **Effect on approval:** open comments and comments pending check block the approval chain from starting. An approver with concerns comments and clicks Request changes.

## Chat and meetings

Each project has a project-wide group chat, a group chat for each document, and direct messages between members. Calls run on self-hosted LiveKit.

- **Calls:** any chat can start a group voice call or a group video call with screen sharing.
- **Transcription:** the person who starts the meeting switches it on. Everyone sees a "This meeting is being transcribed" banner.
  1. Speech is transcribed with BanglaASR.
  2. The LLM corrects recognition mistakes in the raw transcript.
  3. The corrected transcript is saved to the chat. The raw transcript is kept with it, so corrections can be checked.
- **Decisions from meetings:** the AI pulls candidate decisions out of each corrected transcript.
- **Decisions from chat:** any member can click **Mark as decision** on a chat message.
- **Into the Fact Sheet:** the PM confirms each decision before it enters the Fact Sheet. A confirmed decision that changes scope starts a change request.
- Document comments do not appear in chat.

## Notifications, dashboard and archive

Notifications go out in-app and by email. Anything waiting on a person is re-sent every 4 working hours until they act.

- **Working hours:** Sunday to Thursday, 9:00 to 17:00 Bangladesh time, set by the Admin. No reminders are sent outside working hours; a reminder that falls outside is sent at the start of the next working day.
- While a head is Away, reminders for their items go to their deputy.

| Event | Who is notified |
| --- | --- |
| Your turn to approve or sign | The head whose turn it is (or their deputy while they are Away) |
| The version you were reviewing was replaced | The approver who held the document |
| Changes requested | PM team |
| A minor correction is ready for you | The approver who requested the changes |
| You are tagged in a comment | The tagged member |
| Your comment was auto-resolved | The comment's author and their team |
| A Q/A question is assigned to you | The person it was routed to |
| A decision is waiting for confirmation | PM |
| A Fact Sheet update is proposed from an edit | PM team |
| A new document or version is generated | All members |
| A document is out of sync | PM team |
| A role is reassigned to you | The new member |

**Dashboard**

- **Per project:** the current stage, and each document's status: Draft, In review, Waiting on (name, since when), Changes requested, Approved, Signed, Out of sync. Also the count of open comments, comments pending check and unanswered Q/A questions.
- **Portfolio view** (for the Owner and Admin): all projects, with stalled items sorted by how long they have waited.

**Archive**

The Project Owner archives a project. An archived project becomes read-only and leaves the active dashboard.

## Technical decisions

| Area | Decision |
| --- | --- |
| LLM serving | LM Studio, through its OpenAI-compatible API, so project data stays on BRAC machines |
| LLM (prototype) | Qwen3.5-4B, Q4_K_M quantisation (about 3 GB). Alternative: Gemma 4 E4B |
| Speech-to-text (prototype) | BanglaASR (Whisper small fine-tuned for Bangla), run as a separate Python service; its output is corrected by the LLM |
| OCR (prototype) | Tesseract, with English and Bangla language packs |
| Embeddings for RAG (prototype) | nomic-embed-text-v1.5, served by LM Studio |
| Vector store (prototype) | ChromaDB |
| Calls | LiveKit, self-hosted |
| Edit lock idle timeout | 1 hour |
| Reminder interval | Every 4 working hours |
| Document language | English |
| Signing | Re-authentication, a stored PDF with its hash, and a signature page |

LM Studio is built for one user on one machine. Write the app against its OpenAI-compatible API, so that the same models can later be moved to a multi-user server (such as vLLM or Ollama) without code changes. The prototype models are chosen for speed of setup and should be swapped for larger ones after the showcase. Before committing to a model, test it on a real BRAC template: long documents need a large context window, so generate long documents section by section.

BanglaASR works on short audio clips, so meeting audio must be split into chunks (about 30 seconds) before transcription.

**Security: AI inputs**

- Text from uploaded files, past projects, chat messages and transcripts is passed to the agents as data, never as instructions.
- Agents can only propose: facts, edits, decisions and Fact Sheet updates, each confirmed by a person. Agents cannot approve, sign, send messages, change roles or change permissions.

## Open items

- [ ] After how many days without action does a stalled approval escalate to the Project Owner?
- [ ] Can an archived project be reopened?
- [ ] Can the Owner archive a project before the SRS is signed?
- [ ] Is the Project Owner also a member of one of the four teams?
- [ ] Do any stakeholders or sponsors come from outside BRAC? If so, they need accounts outside BRAC sign-in, with email one-time codes for signing.
- [ ] How many Q/A rounds before the PM decides? (Suggested: 3.)
- [ ] Confirm the SRS traceability matrix.
- [ ] When will pre-app BRAC projects be imported into the archive? RAG can only suggest from projects it has.
- [ ] Confirm BRAC working hours for reminders (assumed Sunday to Thursday, 9:00 to 17:00).
- [ ] Can a deputy sponsor sign, or only approve? (Currently: a deputy can sign while the sponsor head is Away.)
