# Seed data

Everything the prototype starts with. All people, projects and documents are fictional.
When any file here changes, every browser resets to the new data on its next load.

| File | Contents |
| --- | --- |
| `users.json` | The user directory (one person per role, deputies, past project members) |
| `settings.json` | `seedNow` (the demo clock's start: a Wednesday morning) and the default settings |
| `catalog.json` | The required-fields checklist: every fact the templates need, its category, which Q/A round asks for it, the question, a sample answer and the default for “Unknown” |
| `templates.json` | Draft templates for the four documents (sections, AI guidance, required facts, scope-sensitive flag). Replace with BRAC’s real templates. |
| `team-templates.json` | Saved teams for the new project wizard |
| `messages.json` | Direct (one-to-one) messages, and where people last read a chat — later messages show as unread |
| `projects/*.json` | One file per demo project (see below) |
| `docs/<project>/*.md` | Document text for seeded projects |
| `ai/<project>.json` and `ai/<project>/*.md` | Pre-written AI results (facts, RAG matches, drafts, transcript, requirements) |

## Demo projects

| File | Stage | Shows |
| --- | --- | --- |
| `field-loan.json` | Intake, just created | The full walkthrough. Its AI results are in `ai/field-loan*` |
| `branch-cash.json` | BRD in review | Comments, pending check log, suggestions, versions, minor-correction history, the stakeholder head Away with a deputy covering, a meeting transcript, decisions |
| `savings-portal.json` | UAT | Test cases, four builds, runs, defects in every status, SQA signed off |
| `collection-tracker.json`, `officer-dashboard.json` | Finished | Past projects for RAG matches and the duplicate warning |

## Writing a document file

One Markdown file per document. Each section starts with `## Title {#key}`, where `key` matches a
section key in `templates.json`:

```markdown
## Objectives {#objectives}

1. First objective…
```

In `ai/<project>/*.md` (AI drafts) you can use placeholders that are filled from the project’s
Fact Sheet when the AI “generates” the document: `{{project}}` and `{{fact:budget_total}}`.

## Writing a project file

The main parts (see `branch-cash.json` for a full example):

- `team`: per team, `head`, `deputy`, `members` and (tech team) `sqa`.
- `facts`: `key`, `value`, `source` (`description`, `answer`, `upload`, `manual`).
- `documents`: per document, the Markdown `file`, its `versions` (each later version lists only the
  sections it `changes`) and its approval `chains` (one entry per step, in the order of the chain:
  `{ "s": "approved", "at": "…" }`; add `"by"` and `"for"` when a deputy acted).
- `comments` and `suggestions`: anchored by document type, version number, section key and the
  quoted text.
- `messages`: `chat` is `project` or `doc:BRD`; add `decisionBy` to mark a message as a decision,
  and `reactions` (for example `{ "👍": ["u-pm", "u-tech"] }`) for emoji reactions. Write
  `@Full Name` to mention someone.
- `testing`: test cases, builds, runs (`[testKey, result, tester, [defectKeys]]`) and defects.

Dates are written in Bangladesh time (`+06:00`). The loader shifts them by whole weeks so the demo
always starts on a recent Wednesday morning.
