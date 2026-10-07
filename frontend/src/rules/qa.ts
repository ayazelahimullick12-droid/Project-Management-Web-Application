/**
 * Q/A agent rules (the parts that are plain logic, not AI).
 *
 * Spec: SPEC.md "Q/A agent and the Project Fact Sheet" — required-fields checklist built from
 * all four templates, statuses, routing by question type, "Unknown" as an assumption, conflicts
 * settled by the PM, round limit.
 */
import type { Fact, FactDef, FactSource, ID, QARound, RoundPurpose, Team, Template } from '../types'

/** Business questions → stakeholders; funding/budget → sponsors; technical → tech team. */
export function routeTeam(def: Pick<FactDef, 'category'>): Team {
  if (def.category === 'budget') return 'SPONSOR'
  if (def.category === 'technical') return 'TECH'
  return 'STAKEHOLDER'
}

/** Which documents need each fact (shown on the Fact Sheet). */
export function requiredBy(templates: Template[], key: string): string[] {
  const out = new Set<string>()
  for (const t of templates) if (t.sections.some((s) => s.factKeys.includes(key))) out.add(t.docType)
  return [...out]
}

/** The Fact Sheet as shown: every checklist field (missing if nobody has given it) plus extras. */
export function factRows(facts: Fact[], catalog: FactDef[]): Fact[] {
  const rows: Fact[] = catalog.map(
    (def) => facts.find((f) => f.key === def.key) ?? { key: def.key, label: def.label, category: def.category, value: '', status: 'missing' },
  )
  for (const f of facts) if (!catalog.some((d) => d.key === f.key)) rows.push(f)
  return rows
}

/** Checklist fields of a round that are still missing. */
export function missingFor(facts: Fact[], catalog: FactDef[], round: Exclude<RoundPurpose, 'change_request'>): FactDef[] {
  return catalog.filter((d) => d.round === round && (facts.find((f) => f.key === d.key)?.status ?? 'missing') === 'missing')
}

export function conflicts(facts: Fact[]): Fact[] {
  return facts.filter((f) => f.status === 'conflicting')
}

export function roundsOf(rounds: QARound[], projectId: ID, purpose: RoundPurpose): QARound[] {
  return rounds.filter((r) => r.projectId === projectId && r.purpose === purpose).sort((a, b) => a.number - b.number)
}

/** After QA_ROUND_LIMIT rounds the PM decides: ask again, or proceed and log the gaps. */
export function atRoundLimit(rounds: QARound[], projectId: ID, purpose: RoundPurpose, limit: number): boolean {
  return roundsOf(rounds, projectId, purpose).length >= limit
}

/** Turns an answer into a fact. "Unknown" becomes an assumption with the agreed default. */
export function factFromAnswer(def: Pick<FactDef, 'key' | 'label' | 'category'>, answer: { text: string; unknown: boolean; defaultValue?: string; source: FactSource; userName: string }): Fact {
  if (answer.unknown) {
    return {
      key: def.key,
      label: def.label,
      category: def.category,
      value: answer.defaultValue || 'To be confirmed',
      status: 'assumed',
      source: answer.source,
      assumption: `${answer.userName} answered “Unknown”, so the agreed default is used until someone confirms it.`,
    }
  }
  return { key: def.key, label: def.label, category: def.category, value: answer.text.trim(), status: 'filled', source: answer.source }
}

/** Adds a new value to a fact; if it differs from the existing value, the fact becomes conflicting. */
export function mergeValue(existing: Fact | undefined, incoming: Fact): Fact {
  if (!existing || existing.status === 'missing' || existing.status === 'assumed' || !existing.value) return incoming
  if (existing.value.trim().toLowerCase() === incoming.value.trim().toLowerCase()) return existing
  return {
    ...existing,
    status: 'conflicting',
    conflict: [
      ...(existing.conflict ?? [{ value: existing.value, source: existing.source ?? { type: 'manual', label: 'Earlier value' } }]),
      { value: incoming.value, source: incoming.source ?? { type: 'manual', label: 'New value' } },
    ],
  }
}

/** The PM picks the value of a conflicting fact. */
export function settleConflict(fact: Fact, value: string, pmName: string): Fact {
  return { ...fact, value, status: 'filled', conflict: undefined, source: { type: 'manual', label: `Conflict settled by ${pmName}` } }
}
