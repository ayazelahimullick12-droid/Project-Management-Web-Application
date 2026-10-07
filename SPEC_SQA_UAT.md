# SQA and UAT — Functional Spec (addendum)

Oct 7, 2026 · Addendum to `SPEC.md`

## Overview

This file adds two stages after the SRS: **SQA** (testing by the SQA team) and then **UAT** (testing by business users). It extends `SPEC.md`. Where it changes something in `SPEC.md`, the change is listed in the next section; everything else in `SPEC.md` still applies.

- **In scope:** test cases, builds, test runs, defects (tracked like Jira), SQA sign-off and UAT sign-off.
- **Out of scope:** writing the software itself (developers work in their own tools), automated tests, deployment and go-live, training, hypercare and project closure.
- The app manages the **testing** of the system the project builds. It does not hold or run the system's code.

## Changes to SPEC.md

| Where in `SPEC.md` | Change |
| --- | --- |
| Overview, "Out of scope" | Project execution after the SRS is still out of scope, **except** SQA and UAT, which are now in scope. |
| Project stages | Intake → Proposal → Charter → BRD → SRS → **SQA → UAT** → Complete. A project is Complete when the UAT sign-off is signed. |
| Roles | Tech team members can be tagged **SQA**. The tag is not a second role: the person is still only in the tech team. |
| Roles | Tech team members without the SQA tag act as **developers**: they register builds and fix defects. |
| Restarting the pipeline | The SQA sign-off and the UAT sign-off count as later documents. They are marked **Out of sync** when an earlier document changes (see "Changes during testing"). |
| Notifications | New events are added (see "Notifications"). |
| Dashboard | New stage statuses and counts are added (see "Dashboard"). |
| Archive | The Owner can archive once the UAT sign-off is signed (and before, as already allowed in `SPEC.md`). |

RAG is unchanged: a finished project is still one with all four documents signed. Test cases and defects are not indexed.

## The two stages

SQA always comes first. Business users only receive a build after the SQA team has passed it.

| Stage | Tested by | Tests come from | Starts when | Ends with |
| --- | --- | --- | --- | --- |
| **SQA** | Tech team members tagged SQA | The signed **SRS** (each SRS requirement) | The SRS is signed and the first build is registered | **SQA sign-off**, approved by the tech head. No signature. |
| **UAT** | Stakeholders (and the PM team) | The signed **BRD** (each BRD requirement, as business scenarios) | The SQA sign-off is approved | **UAT sign-off**, approved by the PM, then the tech head, then the stakeholder head, and **signed by the sponsor head** |

**SQA** checks that the system was built correctly against the SRS: functions, integration with other BRAC systems, regression (re-running earlier tests after a fix), performance and security. Performance and security tests are run with specialist tools outside the app; the app records their results and stores the reports as files.

**UAT** checks that the system works for real business tasks ("disburse a loan", "collect an instalment").

UAT test cases can be drafted and confirmed while SQA is still running, so UAT can start as soon as SQA is signed off.

## Who does what

| Action | PM team | Tech team (developers) | Tech team (SQA) | Stakeholders | Sponsors |
| --- | --- | --- | --- | --- | --- |
| View test cases, builds, results and defects of both stages | Yes | Yes | Yes | Yes | Yes |
| Write and edit **SQA** test cases | No | No | Yes | No | No |
| Write and edit **UAT** test cases | Yes | No | No | No | No |
| Confirm the test case list | — | Tech head confirms the SQA list | — | Stakeholder head confirms the UAT list | — |
| Register a build | No | Yes (and tech head) | No | No | No |
| Release a build to UAT | No | No | Yes | No | No |
| Run SQA tests, raise SQA defects | No | No | Yes | No | No |
| Run UAT tests, raise UAT defects | Yes | No | No | Yes | No |
| Triage a defect (confirm severity, assign a developer) | PM only | Tech head only | No | No | No |
| Work on and fix a defect | No | Assigned developer | No | No | No |
| Close or reopen a defect after retest | UAT defects raised by the PM team | No | SQA defects | UAT defects raised by stakeholders | No |
| Reject, mark duplicate, defer, or turn into a change request | PM only | No | No | No | No |
| Comment, tag people and attach files on defects | Yes | Yes | Yes | Yes | Yes |
| Send the SQA sign-off for approval | No | No | Yes | No | No |
| Approve the SQA sign-off | No | Tech head | No | No | No |
| Send the UAT sign-off for approval | PM only | No | No | No | No |
| Approve the UAT sign-off | PM (step 1) | Tech head (step 2) | No | Stakeholder head (step 3) | No |
| Sign the UAT sign-off | No | No | No | No | Sponsor head |

Deputies work as in `SPEC.md`: while a head is Away, their confirmations, approvals, signatures and reminders go to their deputy.

SQA-tagged members cannot be assigned defects to fix, and developers cannot close or reopen defects. Testers and developers stay separate.

**"The reporter's team"** in this file means: for SQA defects, the SQA-tagged members; for UAT defects, the team of the person who raised it (stakeholders or PM team).

## Test cases

Each test case has:

- an ID (`SQA-TC-12` or `UAT-TC-5`, numbered per project),
- a title, preconditions, numbered steps and the expected result,
- the requirement or requirements it tests,
- a priority (High, Medium, Low),
- a type: for SQA, functional, integration, regression, performance or security; for UAT, business scenario,
- a change history (who changed what, and when).

**Drafting:** the AI drafts test cases from the signed SRS (for SQA) and the signed BRD (for UAT). Drafts are labelled AI-generated until a person edits or accepts them.

**Coverage:** every SRS requirement needs at least one SQA test case, and every BRD requirement needs at least one UAT test case. Requirements without a test are flagged. The PM can mark a requirement **Not testable**, with a reason; it is then listed in the sign-off report instead of blocking it. The traceability matrix is extended: Charter objective → BRD requirement → SRS requirement → SQA test case, and BRD requirement → UAT test case.

**Confirming the list:** testing in a stage starts only after the test case list is confirmed (tech head for SQA, stakeholder head for UAT). Test cases can still be added or edited afterwards; every change is kept in the history.

## Builds

A build is one version of the software, ready to test. A developer registers it with:

- a version number,
- the test environment link,
- release notes,
- the defects it claims to fix.

**Where a build can be tested:**

- A new build is available to the SQA team as soon as it is registered.
- A build reaches UAT only when an SQA member **releases it to UAT**. This is allowed only when:
  1. the SQA team has completed a test run on that build, including retests of every defect it claims to fix, and
  2. no Critical or High SQA defect is unresolved (as defined under "Sign-off").
- When the SQA sign-off is approved, the signed-off build is released to UAT automatically.

**Fixes during UAT go through SQA first.** When a developer fixes a UAT defect, the new build goes to SQA. SQA checks the fix and re-runs the main tests. Only after SQA releases the build does the UAT tester retest the defect.

## Test runs

A test run is one round of testing on one build.

- SQA members create SQA runs and assign test cases to SQA testers. The PM team creates UAT runs and assigns test cases to stakeholders.
- A run can include all test cases or a subset (for example, a regression set, or only the tests linked to fixed defects).
- Each tester has a **My tests** inbox, like "My questions" in the Q/A agent.
- For each test case, the tester records **Pass**, **Fail**, **Blocked** or leaves it **Not run**, with the actual result, notes and screenshots or files.
  - **Fail** must link to a defect: a new one (pre-filled from the test case) or an existing one.
  - **Blocked** requires a reason, for example "blocked by UAT-4".

## Defects

A defect is a problem found while testing. Defects are tracked like Jira issues.

**Each defect has:**

- an ID, numbered per project and stage (`SQA-12`, `UAT-7`),
- a title, steps to reproduce, expected result and actual result,
- a severity (below),
- the reporter, the assigned developer and watchers,
- the test case and requirement it relates to,
- the build it was found in and the build it was fixed in,
- screenshots and files,
- a comment thread with @tags,
- a full history of every change (status, severity, assignee, fields).

**Severity**

| Severity | Meaning |
| --- | --- |
| Critical | Work stops, or money or data is wrong. No workaround. |
| High | A major function is broken, but there is a workaround. |
| Medium | A minor function is broken. |
| Low | Cosmetic: wording, layout, colours. |

The reporter sets the severity. The PM or tech head confirms or changes it during triage, and every change is kept in the history.

**Status flow**

| Status | Meaning | Who moves it here |
| --- | --- | --- |
| **New** | A tester raised it | SQA member (SQA defects), stakeholder or PM team member (UAT defects) |
| **Open** | Checked, severity confirmed, assigned to a developer | PM or tech head |
| **In progress** | The developer is working on it | Assigned developer |
| **Fixed** | The developer says it is fixed in build X (the build must be named) | Assigned developer |
| **Ready for retest** | Build X is available to the reporter's stage | Automatic: for SQA defects when build X is registered; for UAT defects when build X is released to UAT |
| **Closed** | The retest passed | Reporter, or any member of the reporter's team |
| **Reopened** | The retest failed; it goes back to the same developer, who moves it to In progress | Reporter, or any member of the reporter's team. Also SQA members, for a UAT defect whose fix fails SQA's check before the build reaches UAT |

**Other outcomes** (PM only, from any status before Closed, each with a required reason):

| Outcome | Meaning |
| --- | --- |
| **Rejected** | Not a defect: the system works as the SRS or BRD says |
| **Duplicate** | Already reported; linked to the original defect |
| **Deferred** | Real, but will be fixed after go-live. **Only Medium and Low defects can be deferred.** |
| **Change request** | Not a defect but a new or changed requirement. It starts the change request flow in `SPEC.md`, and the defect is closed with a link to it. |

The reporter is notified of each of these outcomes and can comment, but cannot overturn them. The PM can move a Rejected or Deferred defect back to Open.

**Views**

- **Board:** one column per status. Cards can be dragged only to the statuses the person is allowed to set; anything else snaps back with a message.
- **List:** sortable and filterable by stage, status, severity, assignee, reporter, build and requirement. Saved shortcuts: "Assigned to me", "Raised by me", "Waiting for my retest", "Untriaged".
- **Defect page:** all fields, comments, files, history and linked test runs.

Defect comments are separate from document comments and never appear in chat. The rule that a team cannot comment after its head approves applies to document versions only, not to defects.

## What the AI does

As everywhere else in `SPEC.md`, the AI only proposes and a person confirms.

- **Drafts test cases** from SRS and BRD requirements.
- **Writes a defect from a rough note.** A tester types something like "save doesn't work on the loan page", and the AI proposes a title, steps, expected and actual result. The tester checks and edits it before saving.
- **Flags likely duplicates.** Before a new defect is saved, similar open defects are shown. The tester can link to one instead.
- **Writes the summary paragraph** of each sign-off report. All numbers in the report are counted by the app, never by the AI.

Text written by testers and developers is passed to the AI as data, never as instructions.

## Sign-off

The same rules apply to the SQA sign-off and the UAT sign-off.

**Exit criteria** (shown as a checklist; the sign-off cannot be sent until all are met):

1. The stage's test case list has been confirmed.
2. Every requirement has at least one test case, or is marked Not testable by the PM.
3. Every test case has been run, and its latest result is Pass, or Fail or Blocked only because of Medium or Low defects (these are listed as known issues).
4. No Critical or High defect in the stage is unresolved. "Unresolved" means New, Open, In progress, Fixed, Ready for retest or Reopened.

**The sign-off report** is generated by the app and cannot be edited by hand. It shows:

- the build being signed off and the testing dates,
- the number of test cases by result, and coverage of requirements,
- defects by severity and status,
- **known issues:** every Medium or Low defect still unresolved, and every Deferred defect,
- requirements marked Not testable, with reasons,
- the testers,
- an AI-written summary paragraph, labelled as AI-generated.

**SQA sign-off:** an SQA member sends the report to the tech head, who approves or requests changes (a comment is required). The PM is notified of the result.

**UAT sign-off:** the PM sends the report into the same approval chain as the other documents: PM, then tech head, then stakeholder head. The sponsor head then approves and signs, exactly as in `SPEC.md` (re-authentication, stored PDF, SHA-256 fingerprint, signature page, frozen).

Sign-off reports have no inline comments. Instead of the open-comments rule in `SPEC.md`, the exit criteria decide when a report can be sent.

**Request changes** (a comment is required) sends the stage back to testing. The team fixes the underlying problem (re-runs tests, fixes or reclassifies defects) and generates a new report, which starts the chain again from the beginning. Minor correction does not apply to sign-off reports.

When the UAT sign-off is signed, the project is **Complete**.

## Changes during testing

A change request can happen during SQA or UAT, for example from a defect turned into a change request. It follows the change request flow in `SPEC.md`. In addition:

- Test cases linked to a changed requirement are marked **Needs review**, and their latest result is reset to Not run.
- An SQA or UAT sign-off that was already approved is marked **Out of sync** and must be done again, SQA first and then UAT.
- Testing can continue while documents are re-approved, but neither sign-off can be sent until the documents before it are approved (or signed) again.

## Notifications

Added to the table in `SPEC.md`. Reminders follow the same rule (every 4 working hours).

| Event | Who is notified | Reminder? |
| --- | --- | --- |
| Test cases were assigned to you | The tester | Yes, until they are run |
| A build is ready for your stage | Testers of that stage | No |
| A new defect was raised | PM and tech head | Yes, until it is triaged |
| A defect was assigned to you | The developer | Yes for Critical, until it is Fixed |
| A defect you raised is ready for retest | The reporter and their team | Yes, until it is Closed or Reopened |
| A defect you raised was rejected, deferred, marked duplicate or turned into a change request | The reporter | No |
| You are tagged in a defect comment | The tagged member | No |
| A defect you watch changed status | Watchers (in-app only) | No |
| Your turn to confirm a test case list | Tech head (SQA) or stakeholder head (UAT) | Yes |
| Your turn to approve or sign a sign-off | The head whose turn it is | Yes |

## Dashboard

**Per project**, for each of SQA and UAT:

- Status: Not started, Preparing tests, Testing (build X), Waiting on (name, since when), Changes requested, Signed off, Out of sync.
- Test progress: run, passed, failed, blocked, not run.
- Defects by severity and status, the oldest untriaged defect, and requirements without a test.

**Portfolio view:** stalled items now also include untriaged defects and retests waiting, sorted by how long they have waited.

## Audit log

Added to the list in `SPEC.md`: builds registered and released to UAT, test case list confirmations, test results, every defect status and severity change, Not testable decisions, and every sign-off action.

## Open items

- [ ] Where does BRAC's SQA team sit: inside the tech team (assumed) or as a separate team with its own head?
- [ ] Who approves the SQA sign-off? (Assumed: the tech head.)
- [ ] Is the UAT sign-off chain right? (Assumed: PM, tech head, stakeholder head, then the sponsor head signs.)
- [ ] Which severities block sign-off and cannot be deferred? (Assumed: Critical and High.)
- [ ] Should stakeholders and sponsors see SQA defects? (Assumed: yes, read-only, like everything else in the project.)
- [ ] Should a Prototype Review stage be added before development? (Not included.)
- [ ] Should test cases and defects from finished projects be reused through RAG? (Not included.)
