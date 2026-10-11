# BRAC Project Management — clickable prototype

A frontend-only prototype of the app described in `../SPEC.md` and `../SPEC_SQA_UAT.md`.
Every feature can be clicked through with fictional data. There is no backend and no real AI:
AI results are pre-written, emails go to an in-app Mailbox, and all data lives in your browser.

## Run it

You need Node.js 20 or newer (this machine has v24).

```bash
cd frontend
npm install
npm run dev
```

Open the address it prints (normally http://localhost:5173) and pick a demo user. Every demo
account uses the password `demo1234`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the prototype with live reload |
| `npm test` | Runs the business-rule tests (65 tests in `src/rules/`) |
| `npm run build` | Type-checks and builds static files into `dist/` |
| `npm run preview` | Serves the built `dist/` folder |

**Sharing it:** `npm run build` produces plain files in `dist/`. Any static web host can serve
them (for example an internal web server, Netlify or GitHub Pages). Each visitor gets their own
copy of the dummy data in their own browser.

## Using it

- **Home** shows what is waiting on you and each project's next step; **My work** lists your
  approvals, Q/A questions and tests in one place; **Inbox** holds notifications.
- **Ctrl+K** (or the search box) jumps to any project, document or page.
- **Switch user** from the top-right menu. Each browser tab can be a different person, so two
  windows side by side can show the edit lock and the live read-only view.
- **Demo controls** (the clock in the top bar): move time forward to see reminders and the 1-hour
  edit-lock timeout, change the AI speed, **Reset demo data**, and **Show prototype notes**
  (off by default; turn it on for spec reviews to see the "In the real app…" notes and
  open-question markers).
- **Help & prototype** (bottom of the sidebar): the Mailbox (every email the app would send,
  including signing codes), Open questions, and How the real app works.

The layout borrows familiar patterns: a Linear-style sidebar and quick switcher, an Asana-style
"My work" list, a Google Docs-style document page with a comments rail, GitHub-style reviewers,
and a Jira-style defect board.
- `DEMO.md` is a 20-minute walkthrough script.

## How the code is organised

```
frontend/
  seed/          all dummy data (JSON + one Markdown file per document) — see seed/README.md
  src/
    rules/       the business rules as plain functions, with tests       ← real logic
    api/         the only way screens read or change data                ← the "backend" boundary
    demo/        everything simulated: browser storage, fake AI, clock   ← deleted later
    pages/       one file or folder per screen
    components/  shared pieces (buttons, badges, approval panel, editor helpers…)
    theme/       brand.ts — BRAC colours and fonts in one place
    types.ts     every data shape
```

Three folders matter most:

- **`src/rules/`** is real logic: who can do what, the approval chain, comment carry-forward,
  working-hours reminders, the defect status flow, build release rules, exit criteria. Each file
  starts with a comment naming the spec section it follows. These move to the Python backend
  later; their `*.test.ts` files are the checklist of what to move.
- **`src/api/`** plays the part of the FastAPI backend. Every action checks permissions with the
  rules and refuses with a clear message. Today it works on the browser copy of the data; later
  each function becomes an HTTP call with the same name, and the screens do not change.
- **`src/demo/`** holds everything fake: `store.ts` (browser storage), `seed.ts` (turns the seed
  files into data), `ai/` (pre-written AI results), `jobs.ts` (AI progress), `worker.ts`
  (reminders, lock timeouts), `clock.ts` (time travel).

## Common changes

| I want to… | Edit |
| --- | --- |
| Change BRAC colours or the logo text | `src/theme/brand.ts` (and `public/favicon.svg`) |
| Change dummy projects, people or documents | files in `seed/` (the browser resets automatically when they change) |
| Change what the simulated AI writes | `seed/ai/field-loan.json` and `seed/ai/field-loan/*.md` |
| Change the questions the Q/A agent asks | `seed/catalog.json` (`question`, `sample`, `defaultIfUnknown`) |
| Change a rule (for example who approves) | `src/rules/…` — then run `npm test` |
| Change working hours, round limit, blocking severities | Admin → Settings in the app, or `seed/settings.json` |
| Change the "In the real app" notes | `src/demo/explanations.ts` |
| Change the open questions list | `src/demo/openQuestions.ts` |

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, TipTap 3 (free
extensions only), jsdiff, dnd-kit (defect board), docx and pptxgenjs (exports, loaded on demand),
Vitest. This is the frontend stack of `BUILD_PROMPT.md`, so this code can grow into the real
frontend.

## Turning it into the real app

1. Build the FastAPI backend from `BUILD_PROMPT.md` and `BUILD_PROMPT_SQA_UAT.md`.
2. Move `src/rules/` into the backend (the tests show what each rule must do).
3. Make each function in `src/api/` call the backend instead of the browser store.
4. Delete `src/demo/` and the "simulated" notes.
