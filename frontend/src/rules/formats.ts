/**
 * BRAC document formats for the BRD and the SRS (November 2026), from
 * "BRAC BRD & SRS Generator — Master Instructions":
 *   BRD_A    BRAC Microfinance BRD, official template (13 numbered sections) — the default
 *   BRD_B    BRAC Microfinance BRD, executive / integration format
 *   SRS_FULL BRAC IT SRS for a new build or an integration
 *   SRS_CR   BRAC IT Change Request SRS, for a change to a live app
 *
 * The small local model writes only short prose and short lists. Everything with a fixed shape
 * (tables, fixed wording, the priority table, sign-off blocks, glossary, placeholders) is built here
 * by code, so the documents always have BRAC's structure. Anything unknown stays a <placeholder>
 * and is listed under "Open Questions" at the end; nothing is invented.
 *
 * Pure functions: no screen code, no storage.
 */
import type { DocType, Fact } from '../types'

export type DocFormat = 'BRD_A' | 'BRD_B' | 'SRS_FULL' | 'SRS_CR'

export const FORMAT_LABEL: Record<DocFormat, string> = {
  BRD_A: 'BRAC BRD (official template)',
  BRD_B: 'BRAC BRD (executive / integration format)',
  SRS_FULL: 'BRAC IT SRS (full)',
  SRS_CR: 'BRAC IT Change Request SRS',
}

export const FORMATS_FOR: Partial<Record<DocType, DocFormat[]>> = { BRD: ['BRD_A', 'BRD_B'], SRS: ['SRS_FULL', 'SRS_CR'] }

/** The default format: BRD Template A; the SRS from the Update / New label (an update → CR SRS). */
export function defaultFormat(type: DocType, kind?: 'new' | 'update'): DocFormat | undefined {
  if (type === 'BRD') return 'BRD_A'
  if (type === 'SRS') return kind === 'update' ? 'SRS_CR' : 'SRS_FULL'
  return undefined
}

/**
 * How a section is made:
 *  ai      the AI writes it (short prose or bullets) from the facts, with the guidance
 *  fixed   built by code from what the project knows (or fixed BRAC wording)
 *  reqs    BRD 8.0: AI bullets + fixed priority table + FR-B table + NFR table
 *  frs     SRS functional requirements: AI list of FRs, each expanded into the BRAC block
 *  after   built after the rest (glossary, traceability, open questions)
 */
export interface FormatSection {
  key: string
  title: string
  make: 'ai' | 'fixed' | 'reqs' | 'frs' | 'after'
  guidance?: string
  factKeys: string[]
  scopeSensitive?: boolean
}

const S = (key: string, title: string, make: FormatSection['make'], factKeys: string[] = [], guidance?: string, scopeSensitive?: boolean): FormatSection => ({ key, title, make, factKeys, guidance, scopeSensitive })

export const FORMAT_SECTIONS: Record<DocFormat, FormatSection[]> = {
  BRD_A: [
    S('introduction', '1.0 Introduction', 'ai', ['problem', 'target_users', 'objectives'], 'the key business needs, what is wrong today and its effect on clients or staff, and what new module or change is introduced and who it serves'),
    S('objective', '2.0 Objective', 'ai', ['objectives', 'success_criteria'], '3 one-line bullets, each starting with a verb such as Improve, Ensure, Enable or Reduce', true),
    S('resources', '3.0 Document Resources', 'fixed'),
    S('glossary', '4.0 Glossary of Terms', 'after'),
    S('assumptions', '5.0 Key Assumptions and Constraints', 'fixed', ['risks', 'budget_total', 'timeline', 'connectivity'], undefined, true),
    S('present_system', '6.0 Present System', 'ai', ['current_process', 'problem'], 'how it works today and its pain points'),
    S('proposed_system', '7.0 Proposed System', 'ai', ['future_process', 'objectives'], 'how the proposed changes solve the problem'),
    S('business_requirements', '8.0 Business Requirements', 'reqs', ['objectives', 'future_process', 'approval_steps', 'reports', 'performance', 'security'], 'each required change in business language, naming the screen or part of the system', true),
    S('use_cases', '9.0 Use Cases/Prototype', 'fixed'),
    S('out_of_scope', '10.0 Out of Scope', 'fixed', ['scope_out'], undefined, true),
    S('traceability', '11.0 Traceability Matrix', 'after'),
    S('appendix', '12.0 Appendix:', 'fixed'),
    S('signoff', '13.0 Signoff', 'fixed'),
    S('open_questions', 'Open Questions', 'after'),
  ],
  BRD_B: [
    S('executive_summary', 'Executive Summary', 'ai', ['problem', 'objectives', 'integrations'], 'one paragraph: what will be streamlined and digitised, which systems work together, and what it ensures'),
    S('objectives_problem', 'Section 1: Business Objectives & Problem Definition', 'ai', ['problem', 'objectives', 'target_users', 'success_criteria'], 'the primary business problem, key objectives, expected benefits and the end-users', true),
    S('business_requirements', 'Section 2: Functional & Non-Functional Requirements', 'reqs', ['objectives', 'future_process', 'integrations', 'performance', 'security'], 'the core functionalities', true),
    S('stakeholders', 'Section 3: Stakeholder Alignment & Success Criteria', 'ai', ['success_criteria', 'target_users'], 'the key KPIs and how success is measured, with numbers where known'),
    S('process', 'Section 4: Business Process & Workflow Analysis', 'ai', ['current_process', 'future_process', 'integrations'], 'the current process and its gaps, and the to-be workflow'),
    S('timeline', 'Section 5: Project Scope & Timeline', 'fixed', ['timeline', 'go_live'], undefined, true),
    S('risks', 'Section 6: Risk Management & Mitigation', 'fixed', ['risks']),
    S('growth', 'Section 7: Future Growth & Evolution', 'ai', ['user_count', 'coverage'], 'future growth considerations and scalability requirements'),
    S('support', 'Section 8: Post-Launch Support & Maintenance', 'fixed'),
    S('annexure', 'Annexure-1', 'fixed'),
    S('signoff', 'Section 9: Sign-off', 'fixed'),
    S('open_questions', 'Open Questions', 'after'),
  ],
  SRS_FULL: [
    S('purpose', 'Purpose', 'ai', ['problem', 'integrations', 'objectives'], 'the end-to-end functional requirements this document defines and which systems are connected'),
    S('problem_statement', 'Problem Statement', 'ai', ['problem', 'current_process'], 'what goes wrong today and its concrete consequences'),
    S('objectives', 'Objectives', 'ai', ['objectives', 'success_criteria'], '3 bullets, each starting with a bold action phrase', true),
    S('in_scope', 'In Scope', 'fixed', ['scope_in', 'deliverables'], undefined, true),
    S('out_of_scope', 'Out of Scope', 'fixed', ['scope_out'], undefined, true),
    S('functional', 'Functional Requirements (FRs)', 'frs', ['future_process', 'integrations', 'security', 'devices'], undefined, true),
    S('effort', 'Change Effort Estimation', 'fixed'),
    S('open_questions', 'Open Questions', 'after'),
  ],
  SRS_CR: [
    S('purpose', '1. Purpose', 'ai', ['problem', 'objectives'], "today's problems and what this change request is for"),
    S('update_type', '2. App Update Type', 'fixed'),
    S('out_of_scope', '3. Out of Scope', 'fixed', ['scope_out'], undefined, true),
    S('design', '4. Design', 'fixed'),
    S('functional', '5. Functional Requirements', 'frs', ['future_process', 'objectives', 'devices'], undefined, true),
    S('open_questions', 'Open Questions', 'after'),
  ],
}

// ─── What the code builds from ──────────────────────────────────────────

export interface FormatCtx {
  projectName: string
  facts: Fact[]
  people: { name: string; unit: string; role: string }[]
  files: string[]
  kind?: 'new' | 'update'
  objectives: { id: string; text: string }[] // Charter objectives (BRD traceability)
}

const known = (ctx: FormatCtx, key: string) => {
  const f = ctx.facts.find((x) => x.key === key)
  return f && f.status !== 'missing' && f.value.trim() ? f.value.trim() : undefined
}
const cell = (t: string) => t.replace(/\|/g, '/').replace(/\n/g, ' ')
const guide = (t: string) => `*[${t}]*`
const table = (head: string[], rows: string[][]) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')

/** The priority table, word for word (BRD 8.0). */
export const PRIORITY_TABLE = table(
  ['Value', 'Rating', 'Description'],
  [
    ['1', 'Critical', 'This requirement is critical to the success of the project. The project will not be possible without this requirement.'],
    ['2', 'High', 'This requirement is high priority, but the project can be implemented at a bare minimum without this requirement.'],
    ['3', 'Medium', 'This requirement is somewhat important, as it provides some value but the project can proceed without it.'],
    ['4', 'Low', 'This is a low priority requirement, or a “nice to have” feature, if time and cost allow it.'],
    ['5', 'Future', 'This requirement is out of scope for this project, and has been included here for a possible future release.'],
  ],
)

const SIGNOFF_BLOCK = (nameLabel: 'Name' | 'Print Name') => `Signature: ______________________________ Date: ______________\n\n${nameLabel}: ______________________________\n\nTitle: ______________________________\n\nRole: ______________________________`

/** A list of short items from a fact ("a, b; c" or lines) as bullets, or the guidance placeholder. */
function bulletsFrom(value: string | undefined, placeholder: string): string {
  if (!value) return guide(placeholder)
  const items = value.split(/\n|;|,(?![^()]*\))/).map((x) => x.trim()).filter(Boolean)
  return items.map((x) => `- ${x}`).join('\n')
}

/** The sections built by code (make: 'fixed'). */
export function fixedSection(format: DocFormat, key: string, ctx: FormatCtx): string {
  const nameLabel = format === 'BRD_B' ? 'Print Name' : 'Name'
  switch (key) {
    case 'resources':
      return `The following comprises the internal and external stakeholders whose requirements are represented by this document:\n\n${table(['Name', 'Business Unit', 'Role'], ctx.people.length ? ctx.people.map((x) => [x.name, x.unit, x.role]) : [['<Identify all stakeholders and resources involved in gathering requirements>', '', ''], ['', '', ''], ['', '', '']])}`
    case 'assumptions': {
      const assumed = ctx.facts.filter((f) => f.status === 'assumed').map((f) => `${f.label}: ${f.value}`)
      const constraints = (['budget_total', 'timeline', 'go_live', 'connectivity'] as const).map((k) => {
        const v = known(ctx, k)
        const label = ctx.facts.find((f) => f.key === k)?.label ?? k
        return v ? `${label}: ${v}` : undefined
      }).filter(Boolean) as string[]
      const rows = [['**#**', '**Assumptions**'], ...(assumed.length ? assumed.map((a) => ['', a]) : [['', '<assumption>']]), ['**#**', '**Constraints**'], ...(constraints.length ? constraints.map((c) => ['', c]) : [['', '<constraint>']])]
      return `${guide('Mention here overall project’s both Key Assumptions and Constraints')}\n\n${table(rows[0], rows.slice(1))}`
    }
    case 'use_cases':
      return [
        '### 9.1 Functional Requirements',
        'GUI01 [Screen Prototype/ Graphical User Interface Title]',
        table(['ID', 'GUI01'], [
          ['Title', '[USE CASE Title]'], ['Actors', '<Actors>'], ['Scenario', '<Scenario>'], ['Pre-Condition', '<Pre-condition>'],
          ['Primary Flow', '*Actor primary flow description* / *System primary flow description*'],
          ['Business Rules', '*Write business rules, functions, validation, calculation etc…*'], ['Alternative Flow', '*A1. Alternative to primary flow 1*'],
          ['Included Use Cases', '[USE CASE Title]'], ['Extended Use Cases', '[USE CASE Title]'], ['Post-Condition', '<Post-condition>'],
          ['Acceptance Criteria', '*Write acceptance criteria for the use case…*'], ['Assumptions', '<Assumptions>'], ['Limitations', '<Limitations>'],
        ]),
        '### 9.2 Report Output',
        table(['Report No', 'Report Name', 'Report Description'], [['RN01', '<Report Name>', known(ctx, 'reports') ?? '<Report Description>'], ['', '', ''], ['', '', ''], ['', '', '']]),
        'RN01 <Report Name>',
        table(['Report 01', '[Name of the Report Requested]'], [
          ['Report Produced by[ Department Name]:', '[Example: Accounts department]'], ['Report Data Source:', '[Proposed System]'], ['Number of Report User:', '[All User]'],
          ['No of Concurrent Report User', ''], ['Data Search Criteria/Input field', '[Example: Employee ID]'], ['Data Frequency', '[As when required/Daily/Weekly/Monthly/Yearly]'],
          ['Any other Information', ''], ['Field Name-', '[Description/Logic/Formula/Calculation]'], ['1.[ Field Name ]', ''], ['2.[ Field Name ]', ''],
        ]),
        '**Report Sample**',
        guide('Please attach sample report template here or in appendix'),
      ].join('\n\n')
    case 'out_of_scope':
      return bulletsFrom(known(ctx, 'scope_out'), 'Please mention here which are not in scope')
    case 'in_scope':
      return bulletsFrom([known(ctx, 'scope_in'), known(ctx, 'deliverables')].filter(Boolean).join('; ') || undefined, 'In-scope items, grouped under short sub-headings')
    case 'appendix':
      return `### 12.1 Support File List\n\n${ctx.files.length ? ctx.files.map((f) => `- ${f}`).join('\n') : guide('List the attached files, links and Figma prototypes')}\n\n### 12.2 Report Template with Sample Data\n\n${guide('Please attach sample report template here')}`
    case 'signoff':
      return `${guide('List the individuals whose signatures are required. Examples of such individuals are Project Sponsor, Business Lead, Business Analyst, and Project Manager. Add additional signature lines as necessary.')}\n\nThe people the Project Manager chooses to approve and sign this document are listed here when it is sent, one block each:\n\n${SIGNOFF_BLOCK(nameLabel)}`
    case 'timeline':
      return `**Expected Delivery Timeline:**\n\n- ${known(ctx, 'go_live') ?? known(ctx, 'timeline') ?? '<Expected delivery timeline>'}`
    case 'risks': {
      const risks = known(ctx, 'risks')
      const items = risks ? risks.split(/\n|;/).map((x) => x.trim()).filter(Boolean) : []
      return table(['ID', 'Risk', 'Category', 'Likelihood', 'Impact', 'Mitigation'], items.length ? items.map((r, i) => [`R${i + 1}`, r, '<Category>', '<High / Medium / Low>', '<High / Medium / Low>', '<Mitigation>']) : [['R1', '<Risk>', '<Category>', '<High / Medium / Low>', '<High / Medium / Low>', '<Mitigation>']])
    }
    case 'support':
      return `**Support Level Needed:**\n\n- <Support level>\n\n**Product Ownership Post-Launch:**\n\n- <Product owner after launch>\n\n**Review Frequency for Updates:**\n\n- <Review frequency>`
    case 'annexure':
      return table(['SL', 'Line Items', 'Dependency', 'Status'], [['1', '**<Item title>** <description>', '<BRACIT / Central Tech-DCT / Central Technology>', '']])
    case 'update_type':
      return 'This update can be rolled out as a soft update.¹\n\n¹ If any complications arise during development which need the necessity of a forced update, all stakeholders shall be notified immediately'
    case 'design':
      return 'The link for the design prototype has been provided below:\n\nPrototype Link: <Figma or prototype URL>'
    case 'effort':
      return [
        '### 1. Effort Estimation',
        'The Effort Estimation section provides a detailed breakdown of the anticipated effort required for each activity given the successful implementation of the proposed changes. This includes estimating the amount of time in hours and the total billable effort hour will be considered as the final invoice.',
        table(['SL', 'Item', 'Days'], [['1', 'Project Management', ''], ['2', 'Business Analysis', ''], ['3', 'Development', ''], ['4', 'SQA', ''], ['5', 'Implementation', ''], ['', 'Total', '']]),
        'Note: *If any*',
        '### 2. CR Accumulation',
        table(['CR Initiated by', '[Insert Client Name]', ''], [
          ['CR Initiated on', '', ''], ['**Type of CR**', '**Category of CR**', '**Accumulation (%)**'], ['Regular ☐', 'New Addition ☐', 'X%'],
          ['Ad-Hoc (No accumulation) ☐', 'Full Replacement ☐', ''], ['Data Entry (No accumulation) ☐', 'Partial Modification ☐', ''], ['Data Correction (No accumulation) ☐', '', ''],
        ]),
        'Note: *Effort given in the “Regular” type of CR and Category in “New Addition” and “Partial Modification” will be included in AMC as per Accumulation percentage.*',
      ].join('\n\n')
    default:
      return guide('To be completed')
  }
}

// ─── BRD requirements (8.0 / Section 2) ─────────────────────────────────

const GROUPS = ['Business User Requirements', 'Reporting Requirements', 'User Access/Security Requirements', 'Usability Requirements', 'Audit Requirements', 'Support and Maintenance Requirements']

/**
 * BRD 8.0: the AI's bullets of changes, the fixed priority table, then 8.1 (FR-B rows under the six
 * group rows, the other groups left with empty rows) and 8.2 (NFR rows). Template B: one table.
 * `frb` and `nfr` are the AI's items: { id, text, supports }.
 */
export function brdRequirements(format: DocFormat, changes: string, frb: Item[], nfr: Item[]): string {
  const row = (x: Item) => [`**${x.id}**`, '<1–5>', '<Module>', `${x.text}${x.supports ? ` *(${x.supports})*` : ''}`, '<GUI01>', '<Impacted Stakeholders>']
  if (format === 'BRD_B')
    return [
      '**Core Functionalities:**', changes || guide('Core functionalities'),
      '**Business Requirements**',
      table(['REQ#', 'Module', 'Details', 'Prototype Reference', 'Impacted Stakeholders'], frb.map((x) => [`**${x.id}**`, '<Module>', `${x.text}${x.supports ? ` *(${x.supports})*` : ''}`, '<Prototype Reference>', '<Impacted Stakeholders>'])),
      '**Non-Functional Requirements:**', nfr.length ? nfr.map((x) => `- ${x.text}`).join('\n') : guide('Availability, uptime %, data integrity, fraud checks'),
    ].join('\n\n')
  const empty = ['', '', '', '', '', '']
  const rows: string[][] = []
  GROUPS.forEach((g, i) => {
    rows.push([`**${g}**`, '', '', '', '', ''])
    if (i === 0 && frb.length) rows.push(...frb.map(row))
    else rows.push(empty, empty)
  })
  return [
    changes || guide('Describe each required change in business language'),
    'The requirements in this document are prioritized as follows:',
    PRIORITY_TABLE,
    '### 8.1 Functional Requirements',
    table(['REQ#', 'Priority', 'Module', 'Details', 'Prototype Reff', 'Impacted Stakeholders'], rows),
    '### 8.2 Non-Functional Requirements',
    guide('Include technical and operational requirements that are not specific to a function. This typically includes requirements such as processing time, concurrent users, availability, etc.'),
    table(['REQ#', 'Module', 'Details', 'Impacted Stakeholders'], nfr.length ? nfr.map((x) => [`**${x.id}**`, '<Module>', x.text, '<Impacted Stakeholders>']) : [['NFR-001', '<Module>', '<Details>', '<Impacted Stakeholders>']]),
  ].join('\n\n')
}

export interface Item {
  id: string
  text: string
  supports?: string
}

// ─── SRS functional requirements ────────────────────────────────────────

/** One SRS FR block (Full SRS) or feature block (CR SRS). `shall` is the AI's requirement lines. */
export function srsBlock(format: DocFormat, n: number, fr: Item, shall: string[]): string {
  const ref = fr.id ? `*Reference: ${fr.id}${fr.supports ? ` · Traces to: ${fr.supports}` : ''}*` : ''
  const reqs = shall.length ? shall.map((x, i) => `${i + 1}. ${x}`).join('\n') : '1. The system shall <behaviour>.'
  if (format === 'SRS_CR')
    return [
      `### 5.${n} ${fr.text}`,
      ref,
      `#### FR_Title: ${fr.text}`,
      'As a BRAC Microfinance Member, I want <goal>, so that <benefit>.',
      '**User Journey**', '<First step> →\n\n<Next step> →',
      '**Requirements**', reqs,
      '**Field Specification**',
      table(['Field or Component', 'Description', 'Type', 'Placeholder or Default', 'Validation', 'Conditional Logic', 'Notes'], [['<Field> [<বাংলা লেবেল>]', '<Description>', '<Type>', '<Default>', '<Validation>', '<Logic>', '<Notes>']]),
      '**User Scenarios**',
      table(['Scenario ID', 'Scenario', 'Acceptance Criteria or Expected Outcome'], [['S1', 'First launch', '<Expected outcome>'], ['S2', 'Offline', '<Expected outcome>']]),
      '**Acceptance Criteria**', '- Given <state> When <action> Then <result>',
      '**Rules**', '1. <Rule>',
    ].join('\n\n')
  return [
    `### ${fr.id}: ${fr.text}`,
    ref,
    'Actor: <role>',
    'As a/an <actor>, I want to <goal>, so that <benefit>.',
    '#### User Journey', '1. <First step>',
    '#### Mockup / Prototype', 'N/A',
    '#### Requirements', reqs,
    '#### Acceptance Criteria', '- Given <state>, when <action>, then <result>.',
    '#### Field Specification',
    table(['Field/Component', 'Description', 'Specifications'], [['<Field>', '<Description>', 'Type: <type> · Default: <default> · Placeholder: N/A · Validation: <rule> · Notes: <notes>']]),
    '#### Rules', table(['Rule ID', 'Rule'], [['R-01', '<Rule>']]),
    '#### System Messages', table(['Message ID', 'Message', 'Type', 'Trigger', 'Display Method'], [['M-01', '“<Message>”', '<Error / Success / Info>', '<Trigger>', '<Inline / Toast>']]),
  ].join('\n\n')
}

/** The CR SRS always ends with the analytics feature (event continuity and new event tracking). */
export const CR_ANALYTICS: Item = { id: '', text: 'Feature Performance Data in Analytical Dashboard' }

// ─── Built after the rest ───────────────────────────────────────────────

/** BRAC vocabulary for the glossary: each term used in the text is listed (BRD 4.0). */
const TERMS: [string, string][] = [
  ['BRD', 'Business Requirements Document'], ['SRS', 'Software Requirements Specification'], ['Member', 'Microfinance client'], ['CO', 'Credit Officer'],
  ['BM', 'Branch Manager'], ['AM', 'Area Manager'], ['RM', 'Regional Manager'], ['HO', 'Head Office'], ['DCS', 'Data Collection System, the field app used by COs'],
  ['ERP', 'Enterprise Resource Planning system'], ['CAM Portal', 'CAM Portal'], ['DCT', 'F&A disbursement portal'], ['NID', 'National Identity Document'],
  ['MRA', 'Microcredit Regulatory Authority'], ['BRAC IT', 'BRAC Information Technology'], ['MFTECH', 'Microfinance Technology'], ['DPS', 'Deposit Pension Scheme'],
  ['FDR', 'Fixed Deposit Receipt'], ['GUI', 'Graphical User Interface'], ['NFR', 'Non-Functional Requirement'], ['FR', 'Functional Requirement'], ['UAT', 'User Acceptance Testing'], ['SQA', 'Software Quality Assurance'],
]

export function glossary(text: string, own?: 'BRD' | 'SRS'): string {
  const used = TERMS.filter(([t]) => t === own || new RegExp(`\\b${t.replace(/ /g, '\\s')}\\b`).test(text))
  return table(['Term/Acronym', 'Definition'], used.length ? used : [['<Identify any terms and acronyms used within this document>', '']])
}

/** BRD 11.0: each BRD requirement with what it supports; the SRS reference follows once the SRS exists. */
export function traceability(frb: Item[]): string {
  if (!frb.length) return '<Insert traceability matrix here>'
  return table(['BRD REQ#', 'Requirement summary', 'GUI / RN ref', 'SRS FR ref', 'Priority'], frb.map((x) => [x.id, `${x.text}${x.supports ? ` (${x.supports})` : ''}`, '<GUI01>', '<SRS FR ref>', '<1–5>']))
}

/** Every <placeholder> left in the document, once each (printed after the document). */
export function openQuestions(text: string): string {
  const found = [...new Set((text.match(/<[^<>\n]{2,80}>/g) ?? []).filter((x) => !/^<\/?(br|p|b|i|u|div|span|sup|sub)>$/i.test(x)))]
  return found.length ? `These were left as placeholders and need an answer:\n\n${found.map((x) => `- ${x.slice(1, -1)}`).join('\n')}` : 'None.'
}

/** Requirement ids used by the formats: BRD FR-B-001, NFR-001; SRS FR-01. */
export function reqId(kind: 'FRB' | 'NFR' | 'FR', n: number): string {
  return kind === 'FRB' ? `FR-B-${String(n).padStart(3, '0')}` : kind === 'NFR' ? `NFR-${String(n).padStart(3, '0')}` : `FR-${String(n).padStart(2, '0')}`
}

// ─── Cover, header and footer ───────────────────────────────────────────

export interface BracCover {
  org?: string // "BRAC Microfinance" under the logo (BRD)
  title: string // the large title
  subtitle?: string // the project name (BRD) or "Software Requirements Specification" (SRS)
  rows: [string, string][] // the document control table
  footerLeft: string // "Business Requirement Document" / "Software Requirements Specification"
  footerCentre?: string[] // Template A's own version stamp
}

/** The cover of a BRAC-format document, from the project's data; unknown values stay placeholders. */
export function coverFor(format: DocFormat, a: { projectName: string; version: number; date: string; createdBy?: string; approvers: string[] }): BracCover {
  const approved = a.approvers.length ? a.approvers.join(', ') : 'Name of approver'
  const created = a.createdBy ?? '<Created by>'
  if (format === 'BRD_A' || format === 'BRD_B')
    return {
      org: 'BRAC Microfinance',
      title: 'Business Requirements Document',
      subtitle: format === 'BRD_B' ? `[${a.projectName}]` : a.projectName,
      rows: [
        ['Reference Code:', ''],
        ['Version:', `${a.version}.0`],
        ['Date of version:', a.date],
        ['Created by:', created],
        ...(format === 'BRD_A' ? ([['Approved by:', approved]] as [string, string][]) : []),
        ['Confidentiality level:', 'Internal Use / Restricted / Confidential (as per Information Classification Policy)'],
      ],
      footerLeft: 'Business Requirement Document',
      footerCentre: format === 'BRD_A' ? ['Version 1.0 from 16/01/2021', '© Copyright 2021 BRAC'] : undefined,
    }
  if (format === 'SRS_CR')
    return {
      title: 'BRAC IT Change Request Document',
      rows: [['Title', a.projectName], ['CR ID', '<CR ID>'], ['JIRA ID', '<JIRA ID>'], ['Created by', created], ['Reviewed by', '<reviewer full name>, <reviewer designation>'], ['Approved by', a.approvers.length ? approved : '<Approver full name>, <approver designation >']],
      footerLeft: 'Software Requirements Specification',
    }
  return {
    title: a.projectName,
    subtitle: 'Software Requirements Specification',
    rows: [['PO reference', '<PO-#>'], ['JIRA ID', '<JIRA ID>'], ['Created by', created], ['Reviewed by', '<reviewer full name>, <reviewer designation>'], ['Approved by', a.approvers.length ? approved : '<Approver full name>, <approver designation >']],
    footerLeft: 'Software Requirements Specification',
  }
}

/** The sign-off blocks for the people the PM chose (blank signature and date lines; never a signature). */
export function signoffBlocks(format: DocFormat, people: { name: string; role: string }[]): string {
  const nameLabel = format === 'BRD_B' ? 'Print Name' : 'Name'
  return people.map((x) => `Signature: ______________________________ Date: ______________\n\n${nameLabel}: ${x.name}\n\nTitle: <Title>\n\nRole: ${x.role}`).join('\n\n---\n\n')
}
