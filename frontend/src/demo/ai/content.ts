/**
 * Access to the pre-written AI results in seed/ai/ (SIMULATED AI).
 *
 * seed/ai/<project-slug>.json   facts, RAG matches, transcript, requirements…
 * seed/ai/<project-slug>/*.md   document drafts, one per document type
 *
 * Projects without canned content (for example ones created during a demo) get generic
 * results built from their own Fact Sheet and the templates.
 */
import type { DocType } from '../../types'

export interface CannedAi {
  uploadOcr?: { pages: number; text: string }
  extraction?: { key: string; source: string; value: string; conflictFromUpload?: string }[]
  rag?: {
    matches: { projectId: string; score: number; why: string[]; sections: { docType: DocType; sectionKey: string; title: string; excerpt: string }[] }[]
    suggestions: { kind: string; factKey: string; factLabel: string; text: string; sourceProjectId: string; sourceDocType: DocType; sectionTitle: string; highlights: string[] }[]
  }
  regen?: Record<string, string>
  requirements?: Partial<Record<'PROPOSAL' | 'BRD' | 'SRS', (string | null)[][]>>
  transcript?: { segments: { speaker: string; raw: string; corrected: string }[]; decisions: { text: string; factKey?: string }[] }
}

const jsons = import.meta.glob('../../../seed/ai/*.json', { eager: true, import: 'default' }) as Record<string, CannedAi>
const docs = import.meta.glob('../../../seed/ai/*/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

export function cannedFor(slug: string): CannedAi | undefined {
  return Object.entries(jsons).find(([path]) => path.endsWith(`/${slug}.json`))?.[1]
}

/** The pre-written text for a document. 'CHARTER' is the Charter part of the Proposal & Charter. */
export function cannedDoc(slug: string, type: DocType | 'CHARTER'): string | undefined {
  return Object.entries(docs).find(([path]) => path.endsWith(`/${slug}/${type.toLowerCase()}.md`))?.[1]
}

/** All canned content, used to compute the seed version (so edits reset the demo). */
export function allCannedText(): string {
  return JSON.stringify(jsons) + Object.values(docs).join('')
}
