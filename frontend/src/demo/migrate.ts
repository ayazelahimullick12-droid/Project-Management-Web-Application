/**
 * Brings data saved by an older version of the app up to date. Runs every time the data is loaded;
 * data that is already up to date is left alone.
 *
 * November 2026: testing changed from test cases, builds, runs and defects to testing points,
 * product versions and PASS / FAIL checks (see DECISIONS.md). Nothing is lost:
 * - each test case becomes a testing point (its title, and its expected result after a dash);
 * - each build becomes a product version;
 * - each recorded result becomes a check on that version: Pass → PASS, Fail or Blocked → FAIL,
 *   with what the tester wrote (and the linked defects' titles) as the comment;
 * - sign-off reports keep pointing at the same version.
 * Defects themselves are dropped; their titles live on in the comments of the failed checks.
 */
import type { DemoState, PointCheck, ProductVersion, TestPoint } from '../types'

type Old = Record<string, any>

export function migrate(state: DemoState): DemoState {
  const s = state as unknown as Old
  if (!s.testPoints) convertTesting(s)
  return state
}

function convertTesting(s: Old) {
  const at = new Date().toISOString()
  const defects: Old[] = s.defects ?? []
  const points: TestPoint[] = (s.testCases ?? []).map((tc: Old) => {
    const expected = String(tc.expected ?? '').trim()
    const lastChange = tc.needsReview ? (tc.history?.at(-1)?.at ?? tc.createdAt) : tc.createdAt
    return {
      id: tc.id,
      projectId: tc.projectId,
      stage: tc.stage,
      key: String(tc.key).replace('-TC-', '-'),
      text: expected.length > 10 ? `${tc.title} — ${expected}` : tc.title,
      requirementIds: tc.requirementIds ?? [],
      ai: !!tc.ai && !(tc.history ?? []).some((h: Old) => h.by && h.text === 'Edited'),
      changedAt: lastChange,
      needsReview: tc.needsReview || undefined,
      createdBy: tc.createdBy ?? null,
      createdAt: tc.createdAt,
      history: [...(tc.history ?? []), { by: null, at, text: `Converted from test case ${tc.key}` }],
    }
  })
  const versions: ProductVersion[] = (s.builds ?? []).map((b: Old) => ({
    id: b.id,
    projectId: b.projectId,
    version: b.version,
    notes: b.notes ?? '',
    link: b.envUrl ?? '',
    addedBy: b.registeredBy,
    addedAt: b.registeredAt,
  }))
  const checks: PointCheck[] = (s.executions ?? [])
    .filter((e: Old) => e.result && e.result !== 'not_run' && points.some((pt) => pt.id === e.testCaseId))
    .map((e: Old) => {
      const linked = defects.filter((d) => (e.defectIds ?? []).includes(d.id)).map((d) => `${d.key}: ${d.title}`)
      const comment = [e.result === 'blocked' ? `Blocked${e.blockedReason ? `: ${e.blockedReason}` : ''}` : '', e.actual, e.notes, ...linked].map((x) => String(x ?? '').trim()).filter(Boolean).join('; ')
      return {
        id: e.id,
        projectId: e.projectId,
        stage: e.stage,
        pointId: e.testCaseId,
        versionId: e.buildId,
        result: e.result === 'pass' ? 'pass' : 'fail',
        comment: comment || undefined,
        by: e.executedBy ?? e.assigneeId,
        at: e.executedAt ?? at,
      } as PointCheck
    })
  for (const v of s.versions ?? []) {
    if (v.buildId) v.testedVersionId = v.buildId
    delete v.buildId
  }
  s.testPoints = points
  s.productVersions = versions
  s.pointChecks = checks
  for (const k of ['testCases', 'testConfirmations', 'builds', 'testRuns', 'executions', 'defects']) delete s[k]
  if (s.settings) {
    delete s.settings.signoffBlocking
    delete s.settings.defectDuplicateThreshold
  }
}
