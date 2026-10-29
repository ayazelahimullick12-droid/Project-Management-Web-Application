# BRAC Project Management WebApp

A web app that takes a BRAC project from a stakeholder’s request to four approved documents
(Project Proposal, Project Charter, BRD, SRS), then through SQA and UAT. AI agents gather the
information and draft; people review, comment, approve and sign.

This repository holds the specification and a **working prototype** with fictional data: the
data is kept in one JSON file and the AI runs locally in LM Studio.

## Files

| File | What it is |
| --- | --- |
| `SPEC.md` | Functional spec: what the app does |
| `SPEC_SQA_UAT.md` | Addendum: the SQA and UAT stages |
| `BUILD_PROMPT.md` | How to build the full app (Python/FastAPI backend, local AI) |
| `BUILD_PROMPT_SQA_UAT.md` | Addendum: how to build SQA and UAT |
| `BUILD_PROMPT_FRONTEND.md` | The plan for the clickable prototype |
| `frontend/` | **The prototype** — start with `frontend/README.md` |
| `frontend/DEMO.md` | A 20-minute demo script |
| `SPEC_COVERAGE.md` | Every feature in the specs and where to see it in the prototype |
| `DECISIONS.md` | Choices made where the spec was silent |
| `PROGRESS.md` | What is built and checked |

## Try the prototype

1. In LM Studio, load `qwen2.5-coder-0.5b-instruct` and `text-embedding-nomic-embed-text-v1.5`,
   and start its server (Developer tab).
2. Run:

```bash
cd frontend
npm install
npm run dev
```

Open the address it prints and pick a demo user (password `demo1234` for everyone). The app
starts with no projects; Demo menu → **Start again → With demo projects** loads the examples.
Details in `frontend/README.md`.
