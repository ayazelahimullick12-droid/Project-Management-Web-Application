# BRAC Project Management — prototype

A working prototype of the app described in `../SPEC.md` and `../SPEC_SQA_UAT.md`, for demos on
this laptop. A small Node server keeps all data in **one JSON file** and passes AI requests to
**LM Studio** (a local AI model; nothing leaves the laptop). Open several browser tabs and sign in
as different people: they share the same data and update each other live.

**What the AI really does** (the model in LM Studio): fact extraction from the description and
text uploads, the Q/A questions, the Proposal & Charter, BRD and SRS (section by section),
**Rewrite with AI**, the scope check on edits, updating sections for a change request, summaries
and slides, test cases, the defect writer, the sign-off paragraph and "Suggest with AI" for
decisions. **Similar past projects**, **possible duplicate defects** and the fact a decision sets
are found by meaning, with an embedding model.

**Still simulated:** reading PDF, Word and scanned files (OCR; plain `.txt`, `.md` and `.csv`
files are really read), call transcription, and email (sent to the in-app Mailbox).

Everything the AI writes is kept **short on purpose** (about 2 sentences or 3 bullets per section,
roughly 200 words per document) so a small model answers in seconds. Measured on this laptop with
`qwen2.5-coder-0.5b-instruct`: Proposal & Charter (6 sections) about 18 s, BRD about 20 s, SRS
about 17 s, facts from a description about 10–13 s, one question about 1 s, a rewrite about 5 s,
a test case about 5 s, summary and slides about 15–25 s (in the background).

If LM Studio is off or does not answer, the action stops with a clear message and nothing is
changed (no made-up text).

## Run it

You need Node.js 20 or newer (this machine has v24) and **LM Studio**.

1. In LM Studio, download and load **`qwen2.5-coder-0.5b-instruct`** (writes text) and
   **`text-embedding-nomic-embed-text-v1.5`** (compares meaning). Other models can be chosen
   later in Admin → Settings.
2. In LM Studio's **Developer** tab, start the server (it listens on http://localhost:1234).
3. Start the app:

```bash
cd frontend
npm install
npm run dev
```

Open the address it prints (normally http://localhost:5173) and pick a person. Every account
uses the password `demo1234`. The **Demo** menu shows whether LM Studio is connected.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app with live reload (Vite plus the data and AI server) |
| `npm start` | Builds the app, then runs it without Vite on http://localhost:3000 |
| `npm test` | Runs the tests (business rules in `src/rules/`, reading AI answers in `src/ai/`) |
| `npm run build` | Type-checks and builds the files into `dist/` |

**Where the data is:** `frontend/data/db.json` (not in git). The first start creates it with
the people, settings and templates and **no projects**. Demo menu → **Start again** offers
**Empty** or **With demo projects** (the five fictional projects from `seed/`). To start from
scratch by hand, stop the app and delete `data/db.json`.

**Settings by environment variable** (optional):

| Variable | Default | What it is |
| --- | --- | --- |
| `LMSTUDIO_URL` | `http://localhost:1234` | Where LM Studio's server is |
| `AI_TIMEOUT_MS` | `180000` | How long to wait for one AI answer (milliseconds) |
| `DATA_FILE` | `data/db.json` | The data file |
| `PORT` | `3000` | Port for `npm start` |

This prototype is meant for one laptop. There is no real sign-in, so do not put it on a shared
server.

## Using it

The app has **two views** of the same pages, switched with **Simple | Full** in the top bar (or
the sidebar). The switch keeps you on the page you are on, and is remembered in this browser.

**Simple view** (the default) is for people who use the app now and then. It keeps the load on
each page low:

- A top bar with four places: **To do · Projects · Messages · Help**, plus your profile and the
  **Demo** menu. Nothing floats over the page; AI progress shows as a strip under the top bar.
- **To do** (Home): only what you have to do, oldest first, as plain sentences with one button
  each. "Nothing to do right now" when there is nothing. Updates are folded away; the Owner and
  Admin find the portfolio dashboard under **Reports**.
- **Project**: which step it is at, **Your turn** (or who it is waiting for), the documents so far,
  and only the areas that matter at this stage. Team, changes and the activity log are under More.
- **Document**: a status sentence, your next step, at most one notice, "What changed since
  version N", the text (select text to comment; comments open on request) and the main buttons in
  a bar at the bottom. Editing, history, compare, summaries and downloads are under **More** (they
  open the full document tools).
- **Questions**: one question at a time, a large answer box and **I don't know**.
- Plain words (Project facts, Business requirements, Ask for changes…), text of at least 16px,
  large buttons, a **text size** setting (profile menu), light colours by default.
- Pages without a Simple version yet (intake, testing, defects, team, changes, admin) open their
  Full version inside the Simple frame.

**Full view** shows every tool, for people who use the app all day:

- **Home** is a dashboard: numbers at a glance (waiting on you, documents in review, open
  questions, defects, decisions), what is waiting on you and for how long, your recent
  conversations, a card per project (health, progress, next step, heads) and the last two weeks of
  activity. The Owner and Admin also see the pipeline by stage and stalled items.
- **My work** lists your approvals, Q/A questions and tests in one place; **Inbox** holds
  notifications (the bell next to the app name shows the latest).
- **Messages** are never hidden: the **chat dock** sits at the bottom right of every page (like
  LinkedIn or Facebook Messenger). Open a conversation and it pops up in a small window, so you can
  keep chatting while you read a document. **Discuss** buttons on the project overview and on each
  document open their chat the same way, and the project overview shows the latest messages with a
  reply box. The **Messages** page is the full view (conversations, the chat, and details).
- The two kinds of chat look different, as on social media: **group channels** (the project chat
  and one chat per document) look like Slack, with names, reactions, @mentions and **Mark as
  decision** on hover; **direct messages** look like Messenger, with your messages as magenta
  bubbles on the right and **Seen** under your last one.
- **Ctrl+K** (or the search box) jumps to any project, document or page.
- **Dark mode**: the sun/moon button next to the search box (also on the login page, and "dark" in Ctrl+K) switches between light and dark. The profile menu (bottom left) also offers **System**, which follows the computer.
- **Your profile menu** (bottom left): text size, theme, and **Switch user**. Each
  browser tab can be a different person, so two windows side by side can show the edit lock and the
  live read-only view.
- **Demo controls** (the clock above your name in the Full view, the **Demo** button in the Simple
  view): whether LM Studio is connected and which models are used, switch user, move time forward
  to see reminders and the 1-hour edit-lock timeout, the speed of the simulated steps, **Start
  again** (empty, or with the demo projects), and **Show prototype notes** (off by default; turn
  it on for spec reviews to see the "In the real app…" notes and open-question markers).
- **AI work** runs in the background with its steps and seconds shown (a strip under the top bar
  in the Simple view, cards at the bottom left in the Full view). Admin → **AI activity** lists
  every request: model, tokens in and out, time, and any error.
- **Help & prototype** (in the sidebar): the Mailbox (every email the app would send, including
  signing codes), Open questions, and How the real app works.

The layout borrows familiar patterns: a Linear-style sidebar with the page in a rounded panel,
a quick switcher, a bento-style home dashboard, an Asana-style "My work" list, a Google Docs-style
document page with a comments rail, GitHub-style reviewers, a Jira-style defect board, and
LinkedIn/Messenger-style chat.
- `DEMO.md` is a 20-minute walkthrough script. `FEATURE_TOUR.md` shows every feature, part by part,
  with the account to use for each step.

## How the code is organised

```
frontend/
  server/        api.mjs: keeps the data file, tells open tabs about changes, passes AI
                 requests to LM Studio; index.mjs: runs the built app (npm start)
  data/          db.json, the data (created on first start; not in git)
  seed/          the starting data (JSON + one Markdown file per demo document) — see seed/README.md
  src/
    ai/          the AI agents: prompts.ts (every instruction and length limit), agents.ts
                 (asking and reading the answers back), client.ts (talking to LM Studio)
    rules/       the business rules as plain functions, with tests       ← real logic
    api/         the only way screens read or change data                ← the "backend" boundary
    demo/        prototype plumbing: the data copy, AI jobs, worker, clock, simulated OCR and transcripts
    pages/       one file or folder per screen
    simple/      the Simple view: top bar, To do, Projects, Project, Document, Questions, Help,
                 and words.ts (the plain words it uses)
    components/  shared pieces (buttons, badges, approval panel, editor helpers…)
      chat/      the chat dock, conversation list and chat thread (used on every page)
    theme/       brand.ts — BRAC colours and fonts in one place
    types.ts     every data shape
```

Three folders matter most:

- **`src/rules/`** is real logic: who can do what, the approval chain, comment carry-forward,
  working-hours reminders, the defect status flow, build release rules, exit criteria. Each file
  starts with a comment naming the spec section it follows. These move to the Python backend
  later; their `*.test.ts` files are the checklist of what to move.
- **`src/api/`** plays the part of the FastAPI backend. Every action checks permissions with the
  rules and refuses with a clear message. It works on the tab's copy of the data, which
  `src/demo/store.ts` keeps in step with the server (a change is sent at once; if another tab
  saved first, it is re-applied on top of the newer data). Later each function becomes an HTTP
  call with the same name, and the screens do not change.
- **`src/ai/`** holds the AI agents. Answers are asked for as short labelled lines (not JSON,
  which costs a small model more words) and read back by `agents.ts`; `agents.test.ts` shows
  the kinds of answers the 0.5B model gives and how each is read.
- **`src/demo/`** holds the prototype plumbing: `store.ts` (the data copy), `seed.ts` (turns the
  seed files into data), `jobs.ts` (background AI jobs with progress), `worker.ts` (reminders,
  lock timeouts; runs in one tab only), `clock.ts` (time travel), `ai/` (simulated OCR and
  transcripts).

## Common changes

| I want to… | Edit |
| --- | --- |
| Change BRAC colours or the logo text | `src/theme/brand.ts` (and `public/favicon.svg`) |
| Change the Simple view's wording | `src/simple/words.ts` |
| Make the Full view the default | `view` in `DEFAULTS`, `src/components/prefs.ts` |
| Change dark-mode colours | `brand.dark` in `src/theme/brand.ts`; status colours in `src/index.css` (`.dark`) |
| Change demo direct messages or what shows as unread | `seed/messages.json` |
| Change dummy projects, people or documents | files in `seed/`, then Demo → Start again |
| Change what the AI is told, or how long its answers may be | `src/ai/prompts.ts` (`LIMITS` holds the length limits) |
| Use other AI models | Admin → Settings → AI models, or `ai` in `seed/settings.json` |
| Use LM Studio on another address | the `LMSTUDIO_URL` environment variable |
| Change the simulated OCR text or call transcript | `seed/ai/field-loan.json` |
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
2. Move `src/rules/` and `src/ai/` into the backend (the tests show what each must do; the
   prompts and length limits in `src/ai/prompts.ts` are a tested starting point).
3. Make each function in `src/api/` call the backend instead of the data copy.
4. Delete `src/demo/`, `server/` and the "simulated" notes.
