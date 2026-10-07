# Build SQA and UAT (addendum to BUILD_PROMPT.md)

This file adds the SQA and UAT stages described in `SPEC_SQA_UAT.md` to the app built from `BUILD_PROMPT.md`.

Everything in `BUILD_PROMPT.md` still applies: the target machine, tech stack, architecture rules, security rules, UI rules, testing rules and working rules. This file only adds to them.

---

## 0. Source of truth and planning

- `SPEC_SQA_UAT.md` is the source of truth for **what** SQA and UAT do. It overrides `SPEC.md` only in the points listed in its "Changes to SPEC.md" section. Everywhere else, `SPEC.md` wins. If you find any other conflict, follow `SPEC.md` and tell me.
- If `PLAN.md` has not been approved yet, include SQA and UAT in it: data model, endpoints, the defect status state machine, the build release rules, and the milestones in section 7 below.
- If `PLAN.md` is already approved, write `PLAN_SQA_UAT.md` with the same content and wait for my approval before starting Milestone 9a.

---

## 1. Stack additions

| Area | Choice |
| --- | --- |
| Defect board drag and drop | `@dnd-kit/core` |

Nothing else is new. Reuse what `BUILD_PROMPT.md` already builds: file uploads, the LLM interface and FakeLLM, embeddings and ChromaDB, the approval state machine and signing, notifications, working-hours reminders, the job queue and the audit log.

New settings in `.env` (and `.env.example`):

| Key | Default | Meaning |
| --- | --- | --- |
| `SIGNOFF_BLOCKING_SEVERITIES` | `critical,high` | Severities that block sign-off and cannot be deferred |
| `DEFECT_DUPLICATE_THRESHOLD` | `0.85` | Similarity above which an open defect is shown as a possible duplicate (tune on real data) |
| `ATTACHMENT_MAX_MB` | `10` | Largest screenshot or file on a test result or defect |

---

## 2. Data model (starting point; refine it in the plan)

```
project_members      + is_sqa (bool; allowed only for tech team members)

requirements         reuse the requirement records created for the SRS traceability matrix (Milestone 7)
                     + not_testable (bool), not_testable_reason, not_testable_by

builds               id, project_id, version, environment_url, release_notes,
                     registered_by, registered_at, released_to_uat_at?, released_to_uat_by?
build_fixes          build_id, defect_id            -- defects this build claims to fix

test_cases           id, project_id, stage[sqa|uat], key ("SQA-TC-12"), title, preconditions,
                     steps (JSON list), expected_result, priority, type, needs_review (bool),
                     ai_generated (bool), accepted_by?, created_by, created_at, updated_at
test_case_requirements  test_case_id, requirement_id
test_case_events     id, test_case_id, actor_id, changes (JSON), created_at
test_list_confirmations id, project_id, stage, confirmed_by, acting_for?, confirmed_at

test_runs            id, project_id, stage, build_id, name, created_by, created_at, completed_at?
test_executions      id, test_run_id, test_case_id, assignee_id,
                     result[not_run|pass|fail|blocked], actual_result, notes, blocked_reason?,
                     executed_by?, executed_at?
test_execution_defects  test_execution_id, defect_id

defects              id, project_id, stage, key ("UAT-7"), title, steps, expected_result, actual_result,
                     severity, status, reporter_id, assignee_id?, test_case_id?, requirement_id?,
                     found_in_build_id, fixed_in_build_id?, outcome_reason?, duplicate_of_id?,
                     change_request_id?, reopen_count, ai_drafted (bool), created_at, updated_at
defect_events        id, defect_id, actor_id, acting_for?, from_status?, to_status?, changes (JSON), created_at
defect_comments      id, defect_id, author_id, body, created_at   (mentions reuse the existing mentions table)
defect_watchers      defect_id, user_id

attachments          reuse the existing uploads table, linked by (entity_type, entity_id)
counters             project_id, kind, next_value    -- per-project keys like SQA-12, UAT-TC-5

sign-off reports     reuse documents and document_versions with doc types SQA_SIGNOFF and UAT_SIGNOFF;
                     store the computed report data (JSON) in the version
```

`acting_for` records the head when a deputy acts, as elsewhere in the app.

---

## 3. Architecture rules

### 3.1 Defect workflow

- Put the defect status flow in **one backend module** with no UI or database code in it, like the approval state machine.
- Write it as a table of allowed transitions: from status, to status, who may do it, and which fields are required (for example, Fixed requires a build; Rejected requires a reason; Duplicate requires the original defect).
- The API and the board both use this module. The board only offers the moves the module allows for the current user. The backend refuses everything else, whatever the UI sends.
- Severity rules (which severities block sign-off and cannot be deferred) come from `SIGNOFF_BLOCKING_SEVERITIES`, not from hard-coded values.

### 3.2 Builds and stages

- Put the build availability rules (a build is in SQA when registered; it reaches UAT only when released; automatic release on SQA sign-off) in one module.
- "Ready for retest" is set automatically from these rules, never by a person.
- A UAT tester cannot record a result on a build that has not been released to UAT. Enforce it on the backend.

### 3.3 Exit criteria

- One pure function per stage that returns pass or fail **and** the list of unmet criteria. The UI shows that list as a checklist.
- The backend refuses to send a sign-off for approval when the function fails.

### 3.4 Sign-off reports

- **Do not build a second approval engine.** Extend the existing approval state machine so the chain and the sender are configured per document type:
  - `SQA_SIGNOFF`: sent by an SQA member; one step, tech head; no signature.
  - `UAT_SIGNOFF`: sent by the PM; PM, tech head, stakeholder head; then the sponsor head signs.
- For these two types, the exit criteria replace the open-comments check. They have no inline comments, and minor correction does not apply.
- The report is generated, never edited by hand. A new version comes only from regenerating it. Signing works exactly as in `BUILD_PROMPT.md` section 3.5.
- **Every number in the report is counted by code.** The AI writes only the summary paragraph, and that paragraph is labelled AI-generated.

### 3.5 Changes during testing

- Extend the existing Out of sync and pipeline restart logic so SQA_SIGNOFF and UAT_SIGNOFF come after the SRS, in that order.
- When a requirement changes, mark its linked test cases Needs review and reset their latest result to Not run.

### 3.6 AI

New agent modules, each with its own prompt file in `app/ai/prompts/`, behind the existing LLM interface:

- **Test case drafting:** one requirement per call, so prompts stay small for the local model. Returns structured test cases (JSON schema, validated with Pydantic).
- **Defect writer:** turns a tester's rough note into title, steps, expected result and actual result. The tester can skip it and write the defect by hand.
- **Sign-off summary:** one paragraph from the computed report data.

Duplicate detection uses embeddings (with the `search_document: ` and `search_query: ` prefixes) in a ChromaDB collection per project, compared against open defects only. It runs as a background job and never blocks saving a defect.

The security rules in `BUILD_PROMPT.md` section 3.1 apply: tester and developer text goes into prompts as delimited data, and agents only propose.

### 3.7 Keys and history

- Generate keys (`SQA-12`, `UAT-TC-5`) from the per-project `counters` table inside the same transaction as the insert, so two people never get the same key.
- Every change to a test case or defect writes an event row. The history tab is built from these rows.

---

## 4. UI

- **Stage tracker:** Intake → Proposal → Charter → BRD → SRS → SQA → UAT → Complete.
- **Testing area** per project, with SQA and UAT tabs. Each tab has:
  - **Test cases:** list with coverage view (requirements without a test highlighted), Not testable marking (PM), and the confirm button for the head.
  - **Builds:** list of builds, what each claims to fix, and **Release to UAT** (SQA members) with the reason when it is not allowed.
  - **Runs:** create a run, assign testers, see progress.
  - **Defects:** board and list views, with the filters and saved shortcuts from the spec.
  - **Sign-off:** the exit criteria checklist, the generated report, and the approval panel.
- **My tests** inbox for testers, next to "My questions".
- **Defect page:** fields, comments with @tags, files, history and linked test runs. Show possible duplicates while the tester is writing.
- AI-drafted test cases and defects are visibly labelled until a person accepts or edits them.

---

## 5. Seed data

Add to `python -m app.seed`:

- Demo users: two SQA-tagged tech members and two developers (tech members without the tag), plus a deputy for the tech head if not already present. All with password `demo1234`, and listed on the login page in development mode.
- The two finished past projects also get approved SQA sign-offs and signed UAT sign-offs, with a few test cases and no open defects, so they show as Complete.
- **One project in UAT**, ready for a testing demo:
  - all four documents signed; SQA signed off on build 1.0;
  - build 1.0 released to UAT; build 1.1 registered and in SQA, with an SQA run that has one test left to run;
  - UAT test cases confirmed; a UAT run with mixed results;
  - at least one defect in every status and outcome, including a UAT defect marked Fixed in build 1.1 (waiting for SQA to release it), a Deferred Low defect, a Rejected defect and a Duplicate.

Add a testing segment to `DEMO.md` (about 5 minutes): a UAT tester fails a test and uses the AI defect writer; a possible duplicate is shown; the PM triages on the board; a developer marks it Fixed in build 1.1; an SQA member finishes the run and releases 1.1 to UAT; the tester retests and closes it; the exit criteria checklist turns green; the UAT sign-off goes through the chain and the sponsor head signs.

---

## 6. Tests

`pytest`, all with FakeLLM. Required:

- Defect workflow: every allowed transition by the right role; refused transitions and wrong roles; required fields (build for Fixed, reason for Rejected and Deferred, original for Duplicate).
- Deferring a Critical or High defect is refused.
- Developers cannot close or reopen defects; SQA members cannot be assigned defects.
- Ready for retest: an SQA defect when its fix build is registered; a UAT defect only after the fix build is released to UAT.
- Release to UAT refused without a completed SQA run that retests the claimed fixes, or while a Critical or High SQA defect is unresolved. Automatic release when the SQA sign-off is approved.
- A UAT tester cannot record a result on a build not released to UAT.
- Testing cannot start before the stage's test case list is confirmed.
- Coverage: a requirement without a test is flagged; Not testable removes the block and appears in the report.
- Exit criteria: each of the four criteria blocks sending on its own.
- Sign-off chains: SQA is approved by the tech head only; UAT runs PM, tech head, stakeholder head, then the sponsor head signs; a deputy acts while the head is Away and both names are recorded.
- UAT cannot start before the SQA sign-off is approved; the project is Complete after the UAT sign-off is signed.
- A change during UAT: linked test cases become Needs review with results reset; approved sign-offs become Out of sync; a sign-off cannot be sent until the earlier documents are approved again.
- Report numbers are correct even when FakeLLM's summary paragraph contains wrong numbers.
- Permissions: stakeholders cannot write SQA test cases or raise SQA defects; sponsors are read-only.
- Reminders for untriaged defects and waiting retests follow working hours.

Playwright end-to-end, with FakeLLM: an SQA test fails → defect raised → fixed in build 2 → retest passes → SQA signed off → UAT test passes → UAT signed off → project Complete.

---

## 7. Milestones

Build these after Milestone 9 (RAG) and before Milestone 10 (Chat and calls). Follow the same end-of-milestone routine as `BUILD_PROMPT.md` section 7: run the tests, start the app and check it works, commit, and tell me what I can now try.

- **9a. Test cases, builds and runs:** data model and migrations, SQA tag on tech members, test case editor, AI test case drafting, coverage and Not testable, extended traceability matrix, test case list confirmation, builds, test runs, My tests inbox, recording results with files.
- **9b. Defects:** defect workflow module, defect page, board and list views, comments with @tags, files, history, watchers, AI defect writer, duplicate detection, Ready for retest, Release to UAT, notifications and reminders.
- **9c. Sign-offs and stage flow:** exit criteria, generated sign-off reports, SQA and UAT chains on the existing approval engine, UAT signing, stage tracker through Complete, Out of sync after changes during testing, end-to-end test.

Also extend:

- **Milestone 11 (Dashboards):** SQA and UAT statuses and counts per project; untriaged defects and waiting retests in the portfolio's stalled items.
- **Milestone 12 (Demo polish):** the seed data and `DEMO.md` segment from section 5.
