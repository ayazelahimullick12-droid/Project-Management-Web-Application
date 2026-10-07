/**
 * Open items from SPEC.md and SPEC_SQA_UAT.md, with what the prototype assumes.
 * Shown as "Open question" markers on the screens where they apply, and on the Open questions page.
 */
export interface OpenQuestion {
  id: string
  source: 'SPEC.md' | 'SPEC_SQA_UAT.md'
  question: string
  assumption: string
  where: string
}

export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 'escalation', source: 'SPEC.md', question: 'After how many days without action does a stalled approval escalate to the Project Owner?', assumption: 'No escalation. Reminders continue every 4 working hours.', where: 'Notifications, dashboard' },
  { id: 'archive-reopen', source: 'SPEC.md', question: 'Can an archived project be reopened?', assumption: 'No. Archived projects are read-only for good.', where: 'Team page → Archive' },
  { id: 'archive-early', source: 'SPEC.md', question: 'Can the Owner archive a project before the SRS is signed?', assumption: 'Yes, at any time.', where: 'Team page → Archive' },
  { id: 'owner-member', source: 'SPEC.md', question: 'Is the Project Owner also a member of one of the four teams?', assumption: 'The Owner may also be in one team (still only one).', where: 'New project wizard, team page' },
  { id: 'external', source: 'SPEC.md', question: 'Do any stakeholders or sponsors come from outside BRAC?', assumption: 'Yes, possible. They have their own accounts and sign with an email one-time code.', where: 'Users, signing' },
  { id: 'rounds', source: 'SPEC.md', question: 'How many Q/A rounds before the PM decides?', assumption: '3 (Admin setting).', where: 'Intake → Questions' },
  { id: 'traceability', source: 'SPEC.md', question: 'Confirm the SRS traceability matrix.', assumption: 'SRS requirement → BRD requirement → Charter objective, with unlinked items flagged.', where: 'SRS → Traceability' },
  { id: 'legacy-import', source: 'SPEC.md', question: 'When will pre-app BRAC projects be imported into the archive?', assumption: 'Not decided. The import tool is ready.', where: 'Admin → Import' },
  { id: 'working-hours', source: 'SPEC.md', question: 'Confirm BRAC working hours for reminders.', assumption: 'Sunday to Thursday, 9:00 to 17:00 Bangladesh time. “4 working hours” counts only time inside working hours.', where: 'Admin → Settings' },
  { id: 'deputy-sign', source: 'SPEC.md', question: 'Can a deputy sponsor sign, or only approve?', assumption: 'A deputy can sign while the sponsor head is Away.', where: 'Approval panel' },
  { id: 'sqa-team', source: 'SPEC_SQA_UAT.md', question: 'Where does BRAC’s SQA team sit?', assumption: 'Inside the tech team, tagged SQA.', where: 'Team page' },
  { id: 'sqa-approver', source: 'SPEC_SQA_UAT.md', question: 'Who approves the SQA sign-off?', assumption: 'The tech head.', where: 'SQA → Sign-off' },
  { id: 'uat-chain', source: 'SPEC_SQA_UAT.md', question: 'Is the UAT sign-off chain right?', assumption: 'PM, tech head, stakeholder head, then the sponsor head signs.', where: 'UAT → Sign-off' },
  { id: 'blocking', source: 'SPEC_SQA_UAT.md', question: 'Which severities block sign-off and cannot be deferred?', assumption: 'Critical and High (Admin setting).', where: 'Defects, sign-off' },
  { id: 'sqa-visible', source: 'SPEC_SQA_UAT.md', question: 'Should stakeholders and sponsors see SQA defects?', assumption: 'Yes, read-only.', where: 'SQA → Defects' },
  { id: 'prototype-review', source: 'SPEC_SQA_UAT.md', question: 'Should a Prototype Review stage be added before development?', assumption: 'Not included.', where: 'Stage tracker' },
  { id: 'rag-tests', source: 'SPEC_SQA_UAT.md', question: 'Should test cases and defects from finished projects be reused through RAG?', assumption: 'Not included.', where: 'RAG panel' },
]

export const openQuestion = (id: string) => OPEN_QUESTIONS.find((q) => q.id === id)
