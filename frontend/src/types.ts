/**
 * All the data shapes used by the prototype.
 *
 * These mirror the data model the real backend will have (BUILD_PROMPT.md section 3,
 * BUILD_PROMPT_SQA_UAT.md section 2). Dates are ISO strings.
 */

export type ID = string

// ─── People and projects ────────────────────────────────────────────────

export type Team = 'PM' | 'TECH' | 'STAKEHOLDER' | 'SPONSOR'
export const TEAMS: Team[] = ['PM', 'TECH', 'STAKEHOLDER', 'SPONSOR']

export interface User {
  id: ID
  name: string
  email: string
  title: string
  department: string
  isAdmin?: boolean
  external?: boolean // outside BRAC (open item in SPEC.md)
  deactivated?: boolean
}

export interface Member {
  userId: ID
  team: Team
  isHead?: boolean
  isDeputy?: boolean
  isSqa?: boolean // tech team only (SPEC_SQA_UAT.md)
}

export interface AwayPeriod {
  userId: ID
  from: string
  to: string
  setBy: ID
}

export interface IntakeState {
  description: string
  descriptionBy?: ID
  analysed: boolean // Q/A agent has extracted facts from the inputs
  ragRunId?: ID
  duplicateAck?: { by: ID; at: string }
  confirmRequestedAt?: string // PM asked the stakeholder head to confirm the Fact Sheet
  feedback?: { by: ID; at: string; text: string }[] // stakeholder head's comments on the draft Fact Sheet
  gapsLogged?: { by: ID; at: string; factKeys: string[] }
}

export interface Project {
  id: ID
  slug: string // which canned AI content set to use (seed/ai/<slug>.json)
  name: string
  description: string
  ownerId: ID
  status: 'active' | 'archived'
  createdAt: string
  archivedAt?: string
  members: Member[]
  away: AwayPeriod[]
  templateVersions: Partial<Record<DocType, number>>
  facts: Fact[] // the working Fact Sheet
  intake: IntakeState
  finished?: boolean // past project (all four documents signed)
  finishedYear?: number
  department?: string
  summary?: string // short summary shown in RAG results
  legacy?: { year: number; department: string; importedBy: ID; files: string[]; memberNames: string[] }
}

export interface TeamTemplate {
  id: ID
  ownerId: ID
  name: string
  members: Member[]
}

// ─── Fact Sheet and Q/A ─────────────────────────────────────────────────

export type FactStatus = 'filled' | 'missing' | 'assumed' | 'conflicting'
export type FactCategory =
  | 'scope'
  | 'budget'
  | 'timeline'
  | 'requirement'
  | 'stakeholder'
  | 'technical'
  | 'process'
  | 'other'
export type RoundPurpose = 'intake' | 'brd_business' | 'srs_technical' | 'change_request'

/** A field the templates need (the required-fields checklist). */
export interface FactDef {
  key: string
  label: string
  category: FactCategory
  round: Exclude<RoundPurpose, 'change_request'>
  question?: string // the question the (simulated) Q/A agent asks when it is missing
  sample?: string // demo helper: a ready answer the presenter can use with one click
  defaultIfUnknown?: string // the agreed default when someone answers "Unknown"
}

export interface FactSource {
  type: 'description' | 'upload' | 'answer' | 'transcript' | 'chat' | 'manual' | 'rag' | 'edit' | 'decision'
  ref?: ID
  label: string
}

export interface Fact {
  key: string
  label: string
  category: FactCategory
  value: string
  status: FactStatus
  source?: FactSource
  assumption?: string // shown when status = assumed
  credit?: string // "From Project X (PM: name)"
  conflict?: { value: string; source: FactSource }[]
  ai?: boolean // proposed by the AI and not yet confirmed by a person
  extra?: boolean // not in the template checklist (e.g. accepted from RAG)
}

export interface FactSheetVersion {
  id: ID
  projectId: ID
  number: number
  facts: Fact[]
  createdAt: string
  createdBy: ID | null
  note: string
  confirmedBy?: ID
  actingFor?: ID
}

export interface QARound {
  id: ID
  projectId: ID
  purpose: RoundPurpose
  number: number
  status: 'open' | 'closed'
  startedAt: string
  closedAt?: string
  changeRequestId?: ID
}

export interface Question {
  id: ID
  projectId: ID
  roundId: ID
  factKey: string
  text: string
  team: Team
  assigneeIds: ID[]
  createdAt: string
  sampleAnswer?: string // demo helper: one-click answer
  answer?: string
  unknown?: boolean
  defaultValue?: string
  answeredBy?: ID
  actingFor?: ID
  answeredAt?: string
}

export interface Upload {
  id: ID
  projectId: ID
  name: string
  size: number
  mime: string
  uploadedBy: ID
  uploadedAt: string
  extractedText: string
  ocrUsed: boolean
  pages: number
  context: 'intake' | 'test' | 'defect' | 'legacy' | 'audio'
  dataUrl?: string // small images only, for previews
}

// ─── RAG ────────────────────────────────────────────────────────────────

export interface RagMatch {
  projectId: ID
  score: number
  why: string[]
  sections: { docType: DocType; sectionKey: string; title: string; excerpt: string }[]
}

export interface RagRun {
  id: ID
  projectId: ID
  createdAt: string
  matches: RagMatch[]
  duplicate?: { projectId: ID; score: number }
}

export interface RagHighlight {
  text: string
  status: 'pending' | 'confirmed' | 'replaced'
  replacement?: string
}

export interface RagSuggestion {
  id: ID
  projectId: ID
  runId: ID
  kind: 'requirement' | 'risk' | 'objective' | 'technical decision'
  text: string
  factKey: string
  factLabel: string
  sourceProjectId: ID
  sourceDocType: DocType
  sectionTitle: string
  highlights: RagHighlight[]
  status: 'pending' | 'accepted' | 'rejected'
  decidedBy?: ID
  decidedAt?: string
}

// ─── Templates and documents ────────────────────────────────────────────

/**
 * PROPOSAL is the "Proposal & Charter" package: one document with two parts, written and approved
 * together (the Charter's sections have keys starting with "charter_", see rules/pipeline.ts).
 */
export type DocType = 'PROPOSAL' | 'BRD' | 'SRS' | 'SQA_SIGNOFF' | 'UAT_SIGNOFF'
export const MAIN_DOCS: DocType[] = ['PROPOSAL', 'BRD', 'SRS']

export interface TemplateSection {
  key: string
  title: string
  guidance: string
  factKeys: string[]
  scopeSensitive?: boolean // touches objectives, deliverables, budget or timeline
}

export interface Template {
  docType: DocType
  version: number
  sections: TemplateSection[]
  createdAt: string
  createdBy: ID
  placeholder: boolean
  note?: string
}

export interface Section {
  id: ID // stable across versions
  key: string
  title: string
  content: string // Markdown
  factKeys: string[]
}

export interface ScopeCheck {
  flagged: boolean
  sectionTitles: string[]
  reason: string
  decision?: 'normal' | 'scope_change'
  decidedBy?: ID
  decidedAt?: string
}

export interface DocVersion {
  id: ID
  docId: ID
  projectId: ID
  number: number
  authorId: ID | null // null = AI
  message: string
  kind: 'ai_draft' | 'manual' | 'ai_regen' | 'restore' | 'change_request' | 'report'
  sections: Section[]
  regeneratedSectionIds: ID[]
  factSheetVersion: number
  templateVersion: number
  minorCorrection?: { declaredBy: ID; at: string }
  scopeCheck?: ScopeCheck
  buildId?: ID // sign-off reports: the build being signed off
  frozen: boolean
  createdAt: string
}

export interface Doc {
  id: ID
  projectId: ID
  type: DocType
  title: string
  currentVersionId?: ID
  outOfSync?: { since: string; cause: string; suggestedSectionIds: ID[] }
}

export interface Draft {
  docId: ID
  baseVersionId: ID
  sections: Section[]
  regeneratedSectionIds: ID[]
  updatedAt: string
  updatedBy: ID
  proposals?: { sectionId: ID; prompt: string; content: string; createdAt: string }[] // AI rewrites waiting for accept/reject
}

export interface EditLock {
  docId: ID
  userId: ID
  acquiredAt: string
  heartbeatAt: string
  reason: 'edit' | 'ai'
}

// ─── Comments and suggestions ───────────────────────────────────────────

export type CommentStatus = 'open' | 'pending_check' | 'resolved'

export interface Reply {
  id: ID
  authorId: ID
  body: string
  createdAt: string
}

export interface Comment {
  id: ID
  docId: ID
  projectId: ID
  createdOnVersionId: ID
  versionId: ID // the latest version it is attached to
  sectionId: ID | null // null = general comment on the document
  quote: string
  prefix: string
  suffix: string
  body: string
  authorId: ID
  authorTeam: Team | 'OWNER'
  mentions: ID[]
  status: CommentStatus
  pendingReason?: 'text_edited' | 'regenerated'
  resolvedHow?: 'ticked' | 'confirmed'
  resolvedBy?: ID
  resolvedOnVersionId?: ID
  reopenCount: number
  replies: Reply[]
  createdAt: string
  fromRequestChanges?: boolean
}

export interface Suggestion {
  id: ID
  docId: ID
  projectId: ID
  versionId: ID
  sectionId: ID
  quote: string
  prefix: string
  suffix: string
  proposed: string
  authorId: ID
  status: 'open' | 'accepted' | 'rejected'
  decidedBy?: ID
  decidedAt?: string
  createdAt: string
}

// ─── Approval and signing ───────────────────────────────────────────────

export type ApproverRole = 'PM' | 'TECH_HEAD' | 'STAKEHOLDER_HEAD' | 'SPONSOR_HEAD'
export type StepStatus = 'waiting' | 'pending' | 'approved' | 'changes_requested' | 'cancelled' | 'carried_over'

export interface ApprovalStep {
  role: ApproverRole
  assigneeId: ID
  status: StepStatus
  sign?: boolean // sponsor head signs instead of only approving
  pendingSince?: string
  actedAt?: string
  actedBy?: ID
  actingFor?: ID
  comment?: string
}

export interface ApprovalChain {
  id: ID
  docId: ID
  projectId: ID
  versionId: ID
  status: 'in_progress' | 'changes_requested' | 'approved' | 'signed' | 'cancelled'
  steps: ApprovalStep[]
  startedAt: string
  startedBy: ID
  endedAt?: string
  cancelReason?: string
  minorCorrectionOf?: ID // previous chain id
  reapproval?: boolean // re-approving an unchanged version after a restart
}

export interface Signature {
  id: ID
  projectId: ID
  docId: ID
  versionId: ID
  signerId: ID
  actingFor?: ID
  signedAt: string
  ip: string
  userAgent: string
  method: 'password' | 'email_otp'
  docHash: string // SHA-256 of the document as signed
  finalHash: string // SHA-256 of document + signature page
  snapshot: { title: string; versionNumber: number; sections: { title: string; content: string }[] }
}

// ─── Change requests ────────────────────────────────────────────────────

export interface ChangeRequest {
  id: ID
  projectId: ID
  title: string
  description: string
  trigger: 'edit' | 'decision' | 'defect'
  sourceLabel: string
  status: 'questions' | 'impact_review' | 'regenerating' | 'reapproval' | 'closed'
  roundId?: ID
  changedFactKeys: string[]
  impact: { docId: ID; docType: DocType; sectionIds: ID[]; reason: string }[]
  proposals?: { docId: ID; sectionId: ID; title: string; before: string; after: string; status: 'pending' | 'accepted' | 'rejected' }[]
  createdAt: string
  createdBy: ID
  closedAt?: string
}

export interface FactUpdateProposal {
  id: ID
  projectId: ID
  docId: ID
  versionId: ID
  factKey: string
  factLabel: string
  oldValue: string
  newValue: string
  excerpt: string
  status: 'pending' | 'accepted' | 'rejected'
  decidedBy?: ID
  decidedAt?: string
  createdAt: string
}

// ─── Chat, calls and decisions ──────────────────────────────────────────

export interface Chat {
  id: ID
  projectId: ID | null
  kind: 'project' | 'document' | 'direct' | 'rag_dm'
  docId?: ID
  memberIds?: ID[]
  title?: string
}

export interface Message {
  id: ID
  chatId: ID
  authorId: ID | null // null = system
  body: string
  createdAt: string
  kind: 'text' | 'system' | 'transcript' | 'call'
  decisionId?: ID
  transcriptId?: ID
  reactions?: Record<string, ID[]> // emoji → who reacted
}

export interface Call {
  id: ID
  chatId: ID
  kind: 'voice' | 'video'
  startedBy: ID
  startedAt: string
  endedAt?: string
  transcription: boolean
  participantIds: ID[]
}

export interface Transcript {
  id: ID
  chatId: ID
  projectId: ID
  source: 'call' | 'upload'
  fileName?: string
  callId?: ID
  segments: { speakerId: ID | null; speaker: string; raw: string; corrected: string }[]
  createdAt: string
}

export interface CandidateDecision {
  id: ID
  projectId: ID
  source: 'transcript' | 'chat'
  chatId: ID
  messageId?: ID
  transcriptId?: ID
  text: string
  ai: boolean
  markedBy?: ID
  status: 'pending' | 'confirmed' | 'dismissed'
  outcome?: 'fact' | 'change_request'
  factKey?: string
  changeRequestId?: ID
  decidedBy?: ID
  decidedAt?: string
  createdAt: string
}

// ─── Notifications, audit, AI log ───────────────────────────────────────

export interface Notification {
  id: ID
  userId: ID
  type: string
  title: string
  body: string
  link: string
  projectId?: ID
  createdAt: string
  readAt?: string
  emailId?: ID
  reminder?: boolean
  forUserId?: ID // set when sent to a deputy on behalf of an Away head
}

export interface Email {
  id: ID
  to: ID
  subject: string
  body: string
  createdAt: string
}

export interface AuditEntry {
  id: ID
  projectId?: ID
  actorId?: ID | null
  actingFor?: ID
  action: string
  details: string
  createdAt: string
}

export interface AiCall {
  id: ID
  projectId?: ID
  agent: string
  title: string
  promptTokens: number
  durationMs: number
  success: boolean
  createdAt: string
}

export interface AiJob {
  id: ID
  projectId?: ID
  agent: string
  title: string
  steps: string[]
  step: number
  status: 'running' | 'done' | 'failed'
  startedAt: string
  startedReal: number // real Date.now() at start, to spot jobs interrupted by a closed tab
  finishedAt?: string
  byUserId: ID
  link?: string
  resultNote?: string
}

// ─── SQA and UAT ────────────────────────────────────────────────────────

export type TestStage = 'SQA' | 'UAT'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type DefectStatus =
  | 'New'
  | 'Open'
  | 'In progress'
  | 'Fixed'
  | 'Ready for retest'
  | 'Closed'
  | 'Reopened'
  | 'Rejected'
  | 'Duplicate'
  | 'Deferred'
  | 'Change request'
export type TestResult = 'not_run' | 'pass' | 'fail' | 'blocked'

export interface Requirement {
  id: string // e.g. OBJ-1, BR-03, SR-07
  projectId: ID
  docType: 'PROPOSAL' | 'BRD' | 'SRS' // objectives (OBJ-) come from the Charter part of the Proposal & Charter
  text: string
  parentId?: string // SRS → BRD, BRD → Charter objective
  notTestable?: { reason: string; by: ID; at: string }
}

export interface TestCase {
  id: ID
  projectId: ID
  stage: TestStage
  key: string
  title: string
  preconditions: string
  steps: string[]
  expected: string
  requirementIds: string[]
  priority: 'High' | 'Medium' | 'Low'
  type: string
  needsReview?: boolean
  ai: boolean
  acceptedBy?: ID
  createdBy: ID | null
  createdAt: string
  history: { by: ID | null; at: string; text: string }[]
}

export interface TestListConfirmation {
  projectId: ID
  stage: TestStage
  by: ID
  actingFor?: ID
  at: string
}

export interface Build {
  id: ID
  projectId: ID
  version: string
  envUrl: string
  notes: string
  fixesDefectIds: ID[]
  registeredBy: ID
  registeredAt: string
  releasedToUatAt?: string
  releasedBy?: ID | null // null = released automatically on SQA sign-off
}

export interface TestRun {
  id: ID
  projectId: ID
  stage: TestStage
  buildId: ID
  name: string
  createdBy: ID
  createdAt: string
}

export interface Execution {
  id: ID
  runId: ID
  projectId: ID
  stage: TestStage
  testCaseId: ID
  buildId: ID
  assigneeId: ID
  result: TestResult
  actual?: string
  notes?: string
  blockedReason?: string
  defectIds: ID[]
  files: string[]
  executedBy?: ID
  executedAt?: string
}

export interface Defect {
  id: ID
  projectId: ID
  stage: TestStage
  key: string
  title: string
  steps: string
  expected: string
  actual: string
  severity: Severity
  status: DefectStatus
  reporterId: ID
  reporterTeam: Team | 'SQA' // whose team may close or reopen it after retest
  assigneeId?: ID
  testCaseId?: ID
  requirementId?: string
  foundInBuildId: ID
  fixedInBuildId?: ID
  outcomeReason?: string
  duplicateOfId?: ID
  changeRequestId?: ID
  sqaVerified?: { buildId: ID; by: ID; at: string } // SQA checked a UAT fix before release
  reopenCount: number
  ai: boolean
  watchers: ID[]
  files: string[]
  comments: { id: ID; authorId: ID; body: string; mentions: ID[]; createdAt: string }[]
  history: { by: ID | null; actingFor?: ID; at: string; text: string }[]
  createdAt: string
  updatedAt: string
}

// ─── Settings and the whole demo state ──────────────────────────────────

export interface Settings {
  workDays: number[] // 0 = Sunday … 6 = Saturday
  workStart: number // hour, Bangladesh time
  workEnd: number
  reminderHours: number
  lockIdleMinutes: number
  qaRoundLimit: number
  ragTopK: number
  ragDuplicateThreshold: number
  signoffBlocking: Severity[]
  defectDuplicateThreshold: number
  aiSpeed: 'normal' | 'fast' | 'instant'
  holidays: string[] // YYYY-MM-DD
}

export interface DemoMeta {
  seedVersion: string
  seedNow: string // the demo clock's starting time
  loadedAtReal: number // Date.now() when the seed was loaded
  timeOffsetMs: number // time travel
  counter: number // for new ids
}

export interface DemoState {
  meta: DemoMeta
  settings: Settings
  users: User[]
  projects: Project[]
  teamTemplates: TeamTemplate[]
  factCatalog: FactDef[]
  templates: Template[]
  factSheets: FactSheetVersion[]
  rounds: QARound[]
  questions: Question[]
  uploads: Upload[]
  ragRuns: RagRun[]
  ragSuggestions: RagSuggestion[]
  docs: Doc[]
  versions: DocVersion[]
  drafts: Draft[]
  locks: EditLock[]
  comments: Comment[]
  suggestions: Suggestion[]
  chains: ApprovalChain[]
  signatures: Signature[]
  changeRequests: ChangeRequest[]
  factUpdates: FactUpdateProposal[]
  chats: Chat[]
  messages: Message[]
  calls: Call[]
  transcripts: Transcript[]
  decisions: CandidateDecision[]
  notifications: Notification[]
  emails: Email[]
  audit: AuditEntry[]
  aiCalls: AiCall[]
  jobs: AiJob[]
  reminders: Record<string, { count: number; lastAt: string }>
  otps: Record<ID, { code: string; expiresAt: string }> // email one-time codes for signing
  chatReads: Record<string, string> // '<userId>:<chatId>' → when that person last read the chat
  requirements: Requirement[]
  traceLinksDone: Record<ID, boolean> // SRS traceability matrix built, per project
  testCases: TestCase[]
  testConfirmations: TestListConfirmation[]
  builds: Build[]
  testRuns: TestRun[]
  executions: Execution[]
  defects: Defect[]
}
