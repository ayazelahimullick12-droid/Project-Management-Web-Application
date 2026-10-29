/**
 * "In the real app" notes shown next to every AI action (when prototype notes are on).
 * realApp: what the full agent will read and produce (BUILD_PROMPT.md section 3.1).
 * prototype: what this app does today. "Live" = the local model in LM Studio really does it
 * (src/ai); "Simulated" = still made up by the app.
 */
export const AI_AGENTS: Record<string, { name: string; realApp: string; prototype?: string }> = {
  ocr: {
    name: 'File reading (OCR)',
    realApp: 'PyMuPDF reads the text layer of PDFs; any page without text is turned into an image and read by Tesseract with the English and Bangla language packs. Word files are read with python-docx.',
    prototype: 'Simulated: the file is stored, but its text is not really read yet.',
  },
  qa_extract: {
    name: 'Q/A agent: fact extraction',
    realApp: 'The local LLM (Qwen3.5-4B in LM Studio) reads the stakeholder description and the text of every upload, placed in clearly marked data blocks, and returns facts as JSON checked against a schema. Every fact keeps a link to where it came from.',
    prototype: 'Live: the local model in LM Studio reads the description and up to 3 uploads and returns facts as JSON. When two sources give different numbers or dates, the fact is marked conflicting.',
  },
  qa_questions: {
    name: 'Q/A agent: completeness check and questions',
    realApp: 'Compares the facts with the required-fields checklist built from all four templates, writes one question per missing field, and routes it: business questions to stakeholders, budget to sponsors, technical to the tech team.',
    prototype: 'Live: the local model writes all the questions in one request. A field it skips gets the question from seed/catalog.json.',
  },
  rag: {
    name: 'RAG agent: similar past projects',
    realApp: 'Every section of the signed documents of finished projects is turned into an embedding (nomic-embed-text in LM Studio) and stored in ChromaDB. The new project’s facts and description are searched against them; the LLM explains each match and extracts items the stakeholders did not mention, highlighting old-project details.',
    prototype: 'Live: the embedding model in LM Studio compares meaning (no ChromaDB yet). Old-project details such as numbers, dates and names are highlighted by the app.',
  },
  docgen: {
    name: 'Document agent: first draft',
    realApp: 'One LLM call per template section, using that section’s guidance, the facts it needs and the previous approved document. Never the whole document at once, so each request stays well inside the model’s context window. Each section records the facts it used.',
    prototype: 'Live: one short request per section (1–3 sentences or up to 4 bullets), so a small local model finishes in seconds.',
  },
  regen: {
    name: 'Document agent: rewrite a part',
    realApp: 'The LLM rewrites only the chosen section following your instruction. You see the result as a diff, and nothing changes until you accept it.',
    prototype: 'Live: the local model rewrites the section (under 70 words).',
  },
  scope: {
    name: 'Scope-check agent',
    realApp: 'Before a version is saved, the LLM compares the old and new text and answers yes or no, with a reason: does the edit touch objectives, deliverables, budget or timeline?',
    prototype: 'Live: the app finds edits to sections marked scope-sensitive; the local model decides whether they really change scope. If the AI cannot answer, the edit stays flagged and the PM decides.',
  },
  factchange: {
    name: 'Fact change detection',
    realApp: 'The LLM compares a manual edit with the Fact Sheet and proposes updates for facts the edit changed. A PM team member accepts or rejects each one.',
    prototype: 'The prototype looks for Fact Sheet values that disappeared from the edited text.',
  },
  summary: {
    name: 'Summary agent',
    realApp: 'After every saved version the LLM writes a one-page summary, a very short summary and slide content; python-pptx builds the PowerPoint. Each is labelled “AI summary of version N”.',
    prototype: 'Live: the local model writes the short summary, the key points and up to 5 slides for each new version. The PowerPoint is built in the browser.',
  },
  trace: {
    name: 'Traceability agent',
    realApp: 'The LLM links each SRS requirement to a BRD requirement and each BRD requirement to a Charter objective, and flags any requirement without a link.',
    prototype: 'The app reads the links the AI wrote next to each requirement, e.g. *(OBJ-1)*.',
  },
  impact: {
    name: 'Impact analysis',
    realApp: 'The LLM lists which documents and sections a Fact Sheet change affects, using the facts each section was written from.',
    prototype: 'The prototype uses the facts each section records.',
  },
  transcribe: {
    name: 'Transcription (BanglaASR) and correction',
    realApp: 'A Python recorder bot joins the LiveKit room and records each person’s audio separately. After the call, BanglaASR (Whisper small fine-tuned for Bangla) transcribes 30-second chunks on the CPU, and the LLM corrects recognition mistakes. The raw transcript is kept next to the corrected one.',
    prototype: 'The prototype shows a pre-written raw and corrected Bangla transcript.',
  },
  decisions: {
    name: 'Decision agent',
    realApp: 'The LLM pulls candidate decisions out of the corrected transcript. The PM confirms each one (into the Fact Sheet, or as a scope change) or dismisses it.',
    prototype: 'Live: “Suggest with AI” proposes which fact a decision sets and its value. Candidate decisions from calls are still simulated.',
  },
  testcases: {
    name: 'Test case drafting',
    realApp: 'The LLM drafts test cases from each requirement, one requirement per call so prompts stay small.',
    prototype: 'Live: one short request per requirement.',
  },
  defectwriter: {
    name: 'Defect writer',
    realApp: 'The LLM turns a tester’s rough note into a title, steps, expected and actual result. The tester checks and edits it before saving.',
    prototype: 'Live: the local model writes it in a few seconds.',
  },
  duplicates: {
    name: 'Duplicate defect check',
    realApp: 'Embeddings of open defects are compared with the new defect; close matches are shown before it is saved. It never blocks saving.',
    prototype: 'Live: the embedding model in LM Studio compares meaning.',
  },
  signoff: {
    name: 'Sign-off summary',
    realApp: 'The app counts every number in the report. The LLM only writes the summary paragraph.',
    prototype: 'Live: the local model writes the 2-sentence paragraph from the app’s numbers.',
  },
}

export const SECURITY_NOTE =
  'Text from uploads, past projects, chat and transcripts is given to the AI as data, never as instructions. The AI can only propose; it cannot approve, sign, send messages or change roles.'
