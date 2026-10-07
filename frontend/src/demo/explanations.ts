/**
 * "In the real app" notes shown next to every simulated AI action.
 * Each entry says what the real agent will read and produce (BUILD_PROMPT.md section 3.1).
 */
export const AI_AGENTS: Record<string, { name: string; realApp: string; prototype?: string }> = {
  ocr: {
    name: 'File reading (OCR)',
    realApp: 'PyMuPDF reads the text layer of PDFs; any page without text is turned into an image and read by Tesseract with the English and Bangla language packs. Word files are read with python-docx.',
  },
  qa_extract: {
    name: 'Q/A agent: fact extraction',
    realApp: 'The local LLM (Qwen3.5-4B in LM Studio) reads the stakeholder description and the text of every upload, placed in clearly marked data blocks, and returns facts as JSON checked against a schema. Every fact keeps a link to where it came from.',
  },
  qa_questions: {
    name: 'Q/A agent: completeness check and questions',
    realApp: 'Compares the facts with the required-fields checklist built from all four templates, writes one question per missing field, and routes it: business questions to stakeholders, budget to sponsors, technical to the tech team.',
    prototype: 'The prototype uses the question written for each field in seed/catalog.json.',
  },
  rag: {
    name: 'RAG agent: similar past projects',
    realApp: 'Every section of the signed documents of finished projects is turned into an embedding (nomic-embed-text in LM Studio) and stored in ChromaDB. The new project’s facts and description are searched against them; the LLM explains each match and extracts items the stakeholders did not mention, highlighting old-project details.',
    prototype: 'The prototype uses pre-chosen matches for the demo project, and word overlap for others.',
  },
  docgen: {
    name: 'Document agent: first draft',
    realApp: 'One LLM call per template section, using that section’s guidance, the facts it needs and the previous approved document. Never the whole document at once, so each request stays well inside the model’s context window. Each section records the facts it used.',
    prototype: 'The prototype shows a pre-written draft filled in with the values from this project’s Fact Sheet.',
  },
  regen: {
    name: 'Document agent: rewrite a part',
    realApp: 'The LLM rewrites only the chosen section following your instruction. You see the result as a diff, and nothing changes until you accept it.',
    prototype: 'The prototype returns a prepared rewrite, or a shortened version of the section.',
  },
  scope: {
    name: 'Scope-check agent',
    realApp: 'Before a version is saved, the LLM compares the old and new text and answers yes or no, with a reason: does the edit touch objectives, deliverables, budget or timeline?',
    prototype: 'The prototype flags edits to the template sections marked as scope-sensitive.',
  },
  factchange: {
    name: 'Fact change detection',
    realApp: 'The LLM compares a manual edit with the Fact Sheet and proposes updates for facts the edit changed. A PM team member accepts or rejects each one.',
    prototype: 'The prototype looks for Fact Sheet values that disappeared from the edited text.',
  },
  summary: {
    name: 'Summary agent',
    realApp: 'After every saved version the LLM writes a one-page summary, a very short summary and slide content; python-pptx builds the PowerPoint. Each is labelled “AI summary of version N”.',
    prototype: 'The prototype builds the summaries from the first sentences of each section.',
  },
  trace: {
    name: 'Traceability agent',
    realApp: 'The LLM links each SRS requirement to a BRD requirement and each BRD requirement to a Charter objective, and flags any requirement without a link.',
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
  },
  testcases: {
    name: 'Test case drafting',
    realApp: 'The LLM drafts test cases from each requirement, one requirement per call so prompts stay small.',
  },
  defectwriter: {
    name: 'Defect writer',
    realApp: 'The LLM turns a tester’s rough note into a title, steps, expected and actual result. The tester checks and edits it before saving.',
  },
  duplicates: {
    name: 'Duplicate defect check',
    realApp: 'Embeddings of open defects are compared with the new defect; close matches are shown before it is saved. It never blocks saving.',
    prototype: 'The prototype compares the words in the titles.',
  },
  signoff: {
    name: 'Sign-off summary',
    realApp: 'The app counts every number in the report. The LLM only writes the summary paragraph.',
  },
}

export const SECURITY_NOTE =
  'Text from uploads, past projects, chat and transcripts is given to the AI as data, never as instructions. The AI can only propose; it cannot approve, sign, send messages or change roles.'
