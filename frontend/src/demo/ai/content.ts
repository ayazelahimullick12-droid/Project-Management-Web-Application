/**
 * Pre-written results for the parts that are still SIMULATED, in seed/ai/<project-slug>.json:
 * the text read from an upload (OCR), a call transcript, and the numbered requirements of a
 * demo project. Everything else is written by the real AI (src/ai).
 *
 * Projects without canned content get generic results (see demo/ai/agents.ts).
 */
export interface CannedAi {
  uploadOcr?: { pages: number; text: string }
  requirements?: Partial<Record<'PROPOSAL' | 'BRD' | 'SRS', (string | null)[][]>>
  transcript?: { segments: { speaker: string; raw: string; corrected: string }[]; decisions: { text: string; factKey?: string }[] }
}

const jsons = import.meta.glob('../../../seed/ai/*.json', { eager: true, import: 'default' }) as Record<string, CannedAi>

export function cannedFor(slug: string): CannedAi | undefined {
  return Object.entries(jsons).find(([path]) => path.endsWith(`/${slug}.json`))?.[1]
}

/** All canned content, used to compute the seed version (so edits reset the demo). */
export function allCannedText(): string {
  return JSON.stringify(jsons)
}
