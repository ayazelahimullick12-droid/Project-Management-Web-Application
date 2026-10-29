# Seed data

Everything the prototype starts with. All people, projects and documents are fictional.

The first start (when `data/db.json` does not exist yet) builds the data from these files **without
the projects**: people, settings, templates and the fact checklist only. Demo menu → **Start
again** → **With demo projects** loads the projects below as well; **Empty** goes back to no
projects. After changing a file here, use Start again to load it (the data file is not reset by
itself).

| File | Contents |
| --- | --- |
| `users.json` | The user directory (one person per role, deputies, past project members) |
| `settings.json` | `seedNow` (the demo clock's start for the demo projects: a Wednesday morning) and the default settings, including `ai`: the LM Studio models (`model` writes, `embedModel` compares meaning) |
| `catalog.json` | The required-fields checklist: every fact the templates need, its category, which Q/A round asks for it, the question, a sample answer and the default for “Unknown” |
| `templates.json` | Draft templates for the Proposal & Charter, BRD and SRS: sections, AI guidance, required facts, the scope-sensitive flag, and `numbered` (`OBJ`, `BR` or `SR`) for the numbered lists. Kept short (5–6 sections) so the AI writes quickly. Sections whose key starts with `charter_` form the Charter part. Replace with BRAC’s real templates. |
| `team-templates.json` | Saved teams for the new project wizard |
| `messages.json` | Direct (one-to-one) messages, and where people last read a chat — later messages show as unread |
| `projects/*.json` | One file per demo project (see below) |
| `docs/<project>/*.md` | Document text for seeded projects |
| `ai/<project>.json` | Results for the parts that are still simulated: the text "read" from an uploaded PDF or scan (OCR), a call transcript, and fallback numbered requirements. Everything else is written by the real AI. |

## Demo projects

| File | Stage | Shows |
| --- | --- | --- |
| `field-loan.json` | Intake, just created | The full walkthrough (the AI writes its documents live). Its simulated OCR text and transcript are in `ai/field-loan.json` |
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

The Proposal & Charter is one document with two files: write `"files": ["proposal.md",
"charter.md"]` in the project file. The second file's section keys get the `charter_` prefix.

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
